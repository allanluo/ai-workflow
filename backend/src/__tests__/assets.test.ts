import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initializeDatabase, resetDatabase } from "@ai-workflow/database";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("Asset API", () => {
  let app: FastifyInstance;
  let projectId: string;

  beforeEach(async () => {
    resetDatabase();
    initializeDatabase();
    app = await buildApp();

    // Create a test project
    const projectResponse = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: { title: "Test Project for Assets" }
    });
    const projectBody = JSON.parse(projectResponse.payload);
    projectId = projectBody.data.project.id;
  });

  afterEach(async () => {
    if (app.close) {
      await app.close();
    }
  });

  describe("POST /api/v1/projects/:projectId/assets", () => {
    it("should create a new asset", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Test Story Asset",
          content: { text: "Once upon a time..." },
          metadata: { author: "Test Author" }
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset).toBeDefined();
      expect(body.data.asset.title).toBe("Test Story Asset");
      expect(body.data.asset.asset_type).toBe("source_story");
      expect(body.data.asset.asset_category).toBe("story");
      expect(body.data.asset.status).toBe("draft");
      expect(body.data.asset.current_version_id).toBeDefined();
      expect(body.data.asset.versions).toHaveLength(1);
    });

    it("should create asset with minimal data", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "reference_image",
          asset_category: "visual"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.title).toBe("");
      expect(body.data.asset.status).toBe("draft");
    });

    it("should validate required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          title: "Missing required fields"
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/projects/:projectId/assets", () => {
    beforeEach(async () => {
      // Create test assets
      await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Story Asset 1"
        }
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "reference_image",
          asset_category: "visual",
          title: "Image Asset 1"
        }
      });
    });

    it("should list all assets for project", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${projectId}/assets`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(2);
      const titles = body.data.items.map((a: { title: string }) => a.title);
      expect(titles).toContain("Story Asset 1");
      expect(titles).toContain("Image Asset 1");
    });

    it("should filter by asset_type", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${projectId}/assets?asset_type=source_story`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].asset_type).toBe("source_story");
    });

    it("should filter by asset_category", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${projectId}/assets?asset_category=visual`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].asset_category).toBe("visual");
    });
  });

  describe("GET /api/v1/assets/:assetId", () => {
    let assetId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Test Asset for Get"
        }
      });
      const body = JSON.parse(response.payload);
      assetId = body.data.asset.id;
    });

    it("should get asset by id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/assets/${assetId}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.id).toBe(assetId);
      expect(body.data.asset.title).toBe("Test Asset for Get");
    });

    it("should return 404 for non-existent asset", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/assets/non-existent-id"
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("not_found");
    });
  });

  describe("PATCH /api/v1/assets/:assetId", () => {
    let assetId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Original Asset Title"
        }
      });
      const body = JSON.parse(response.payload);
      assetId = body.data.asset.id;
    });

    it("should update asset title", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/assets/${assetId}`,
        payload: {
          title: "Updated Asset Title"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.title).toBe("Updated Asset Title");
      expect(body.data.asset.asset_type).toBe("source_story");
    });

    it("should update asset type and category", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/assets/${assetId}`,
        payload: {
          asset_type: "reference_video",
          asset_category: "visual"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.asset_type).toBe("reference_video");
      expect(body.data.asset.asset_category).toBe("visual");
    });

    it("should update asset status", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/assets/${assetId}`,
        payload: {
          status: "ready"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.status).toBe("ready");
    });

    it("should update asset metadata", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/assets/${assetId}`,
        payload: {
          metadata: { author: "Updated Author", tags: ["tag1", "tag2"] }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.metadata.author).toBe("Updated Author");
      expect(body.data.asset.metadata.tags).toEqual(["tag1", "tag2"]);
    });

    it("should update multiple fields", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/assets/${assetId}`,
        payload: {
          title: "New Title",
          status: "needs_revision",
          metadata: { priority: "high" }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.title).toBe("New Title");
      expect(body.data.asset.status).toBe("needs_revision");
      expect(body.data.asset.metadata.priority).toBe("high");
    });

    it("should return 404 for non-existent asset", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/assets/non-existent-id",
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

  describe("Asset Versioning", () => {
    let assetId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Versioned Asset"
        }
      });
      const body = JSON.parse(response.payload);
      assetId = body.data.asset.id;
    });

    describe("GET /api/v1/assets/:assetId/versions", () => {
      it("should list asset versions", async () => {
        const response = await app.inject({
          method: "GET",
          url: `/api/v1/assets/${assetId}/versions`
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.items).toHaveLength(1); // Initial version
        expect(body.data.items[0].version_number).toBe(1);
      });
    });

    describe("POST /api/v1/assets/:assetId/versions", () => {
      it("should create new asset version", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/assets/${assetId}/versions`,
          payload: {
            content: { text: "Updated content" },
            metadata: { updated: true },
            status: "ready"
          }
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.asset_version).toBeDefined();
        expect(body.data.asset_version.version_number).toBe(2);
        expect(body.data.asset_version.status).toBe("ready");
      });

      it("should create version without making it current", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/assets/${assetId}/versions`,
          payload: {
            content: { text: "Draft version" },
            make_current: false
          }
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.asset_version.version_number).toBe(2);
      });

      it("should return 404 for non-existent asset", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/assets/non-existent-id/versions",
          payload: {
            content: { text: "Should not work" }
          }
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("not_found");
      });
    });

    describe("GET /api/v1/asset-versions/:assetVersionId", () => {
      let versionId: string;

      beforeEach(async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/assets/${assetId}/versions`,
          payload: {
            content: { text: "Version 2 content" }
          }
        });
        const body = JSON.parse(response.payload);
        versionId = body.data.asset_version.id;
      });

      it("should get asset version by id", async () => {
        const response = await app.inject({
          method: "GET",
          url: `/api/v1/asset-versions/${versionId}`
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.asset_version.id).toBe(versionId);
        expect(body.data.asset_version.content.text).toBe("Version 2 content");
      });

      it("should return 404 for non-existent version", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/asset-versions/non-existent-id"
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("not_found");
      });
    });
  });

  describe("Asset Approval", () => {
    let assetId: string;
    let versionId: string;

    beforeEach(async () => {
      // Create asset
      const assetResponse = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Asset for Approval"
        }
      });
      const assetBody = JSON.parse(assetResponse.payload);
      assetId = assetBody.data.asset.id;

      // Create a new version to approve
      const versionResponse = await app.inject({
        method: "POST",
        url: `/api/v1/assets/${assetId}/versions`,
        payload: {
          content: { text: "Ready for approval" },
          status: "ready"
        }
      });
      const versionBody = JSON.parse(versionResponse.payload);
      versionId = versionBody.data.asset_version.id;
    });

    describe("POST /api/v1/assets/:assetId/approve", () => {
      it("should approve asset version", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/assets/${assetId}/approve`,
          payload: {
            asset_version_id: versionId,
            notes: "Approved for production"
          }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.asset).toBeDefined();
        expect(body.data.asset.approval_state).toBe("approved");
        expect(body.data.asset.current_approved_version_id).toBe(versionId);
      });

      it("should approve current version if no version specified", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/assets/${assetId}/approve`,
          payload: {
            notes: "Approved current version"
          }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.asset.approval_state).toBe("approved");
      });

      it("should return 404 for non-existent asset", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/assets/non-existent-id/approve",
          payload: {
            notes: "Should not work"
          }
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("not_found");
      });
    });
  });

  describe("Asset Locking", () => {
    let assetId: string;
    let versionId: string;

    beforeEach(async () => {
      const assetResponse = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Asset for Locking"
        }
      });
      const assetBody = JSON.parse(assetResponse.payload);
      assetId = assetBody.data.asset.id;

      const versionResponse = await app.inject({
        method: "POST",
        url: `/api/v1/assets/${assetId}/versions`,
        payload: {
          content: { text: "Lock this version" },
          status: "ready",
          locked_fields: ["content.text"]
        }
      });
      const versionBody = JSON.parse(versionResponse.payload);
      versionId = versionBody.data.asset_version.id;
    });

    it("should lock the target asset version", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/assets/${assetId}/lock`,
        payload: {
          asset_version_id: versionId,
          locked_fields: ["content.text", "metadata.seed"],
          notes: "Freeze editing for review"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.status).toBe("locked");
      expect(body.data.asset.current_version.status).toBe("locked");
      expect(body.data.asset.current_version.locked_fields).toEqual([
        "content.text",
        "metadata.seed"
      ]);
    });

    it("should unlock the target asset version with the requested status", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/assets/${assetId}/lock`,
        payload: {
          asset_version_id: versionId,
          locked_fields: ["content.text"]
        }
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/assets/${assetId}/unlock`,
        payload: {
          asset_version_id: versionId,
          status: "ready",
          notes: "Editing reopened"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.asset.status).toBe("ready");
      expect(body.data.asset.current_version.status).toBe("ready");
      expect(body.data.asset.current_version.locked_fields).toEqual([]);
    });
  });
});
