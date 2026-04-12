import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initializeDatabase, resetDatabase } from "@ai-workflow/database";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("Project API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetDatabase();
    initializeDatabase();
    app = await buildApp();
  });

  afterEach(async () => {
    if (app.close) {
      await app.close();
    }
  });

  describe("POST /api/v1/projects", () => {
    it("should create a new project", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: {
          title: "Test Project",
          description: "A test project",
          primary_output_type: "film"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.project).toBeDefined();
      expect(body.data.project.title).toBe("Test Project");
      expect(body.data.project.description).toBe("A test project");
      expect(body.data.project.primary_output_type).toBe("film");
      expect(body.data.project.id).toBeDefined();
      expect(body.data.project.created_at).toBeDefined();
    });

    it("should create project with minimal data", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: {
          title: "Minimal Project"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.project.title).toBe("Minimal Project");
      expect(body.data.project.description).toBe("");
    });

    it("should validate required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: {
          description: "Missing title"
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it("should validate title length", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: {
          title: "a".repeat(201) // Too long
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/projects", () => {
    beforeEach(async () => {
      // Create test projects
      await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: { title: "Active Project 1" }
      });
      await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: { title: "Active Project 2" }
      });
    });

    it("should list all projects", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(2);
      const titles = body.data.items.map((p: { title: string }) => p.title);
      expect(titles).toContain("Active Project 1");
      expect(titles).toContain("Active Project 2");
    });

    it("should filter by status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects?status=active"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("GET /api/v1/projects/:projectId", () => {
    let projectId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: { title: "Test Project for Get" }
      });
      const body = JSON.parse(response.payload);
      projectId = body.data.project.id;
    });

    it("should get project by id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${projectId}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.project.id).toBe(projectId);
      expect(body.data.project.title).toBe("Test Project for Get");
    });

    it("should return 404 for non-existent project", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects/non-existent-id"
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("not_found");
    });
  });

  describe("PATCH /api/v1/projects/:projectId", () => {
    let projectId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: {
          title: "Original Title",
          description: "Original description"
        }
      });
      const body = JSON.parse(response.payload);
      projectId = body.data.project.id;
    });

    it("should update project title", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/projects/${projectId}`,
        payload: {
          title: "Updated Title"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.project.title).toBe("Updated Title");
      expect(body.data.project.description).toBe("Original description");
    });

    it("should update project description", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/projects/${projectId}`,
        payload: {
          description: "Updated description"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.project.description).toBe("Updated description");
      expect(body.data.project.title).toBe("Original Title");
    });

    it("should update multiple fields", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/projects/${projectId}`,
        payload: {
          title: "New Title",
          description: "New description",
          primary_output_type: "music_video"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.project.title).toBe("New Title");
      expect(body.data.project.description).toBe("New description");
      expect(body.data.project.primary_output_type).toBe("music_video");
    });

    it("should return 404 for non-existent project", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/projects/non-existent-id",
        payload: {
          title: "Should not work"
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("not_found");
    });
  });
});