import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initializeDatabase, resetDatabase } from "@ai-workflow/database";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";

describe("Workflow API", () => {
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
      payload: { title: "Test Project for Workflows" }
    });
    const projectBody = JSON.parse(projectResponse.payload);
    projectId = projectBody.data.project.id;
  });

  afterEach(async () => {
    if (app.close) {
      await app.close();
    }
  });

  describe("POST /api/v1/projects/:projectId/workflows", () => {
    it("should create a new workflow", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Test Workflow",
          description: "A test workflow",
          mode: "guided",
          template_type: "film",
          nodes: [
            {
              id: "node1",
              type: "input",
              data: { label: "Input Node" }
            }
          ],
          edges: []
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.workflow).toBeDefined();
      expect(body.data.workflow.title).toBe("Test Workflow");
      expect(body.data.workflow.mode).toBe("guided");
      expect(body.data.workflow.template_type).toBe("film");
      expect(body.data.workflow.current_version_id).toBeDefined();
    });

    it("should create workflow with minimal data", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Minimal Workflow",
          template_type: "custom"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.workflow.title).toBe("Minimal Workflow");
      expect(body.data.workflow.mode).toBe("guided"); // default
    });

    it("should validate required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          description: "Missing title and template_type"
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/projects/:projectId/workflows", () => {
    beforeEach(async () => {
      // Create test workflows
      await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Workflow 1",
          template_type: "film"
        }
      });
      await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Workflow 2",
          template_type: "music_video"
        }
      });
    });

    it("should list workflows for project", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${projectId}/workflows`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(2);
      const titles = body.data.items.map((w: { title: string }) => w.title);
      expect(titles).toContain("Workflow 1");
      expect(titles).toContain("Workflow 2");
    });
  });

  describe("GET /api/v1/workflows/:workflowId", () => {
    let workflowId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Test Workflow for Get",
          template_type: "film"
        }
      });
      const body = JSON.parse(response.payload);
      workflowId = body.data.workflow.id;
    });

    it("should get workflow by id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/workflows/${workflowId}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(true);
      expect(body.data.workflow.id).toBe(workflowId);
      expect(body.data.workflow.title).toBe("Test Workflow for Get");
    });

    it("should return 404 for non-existent workflow", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/workflows/non-existent-id"
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("not_found");
    });
  });

  describe("Workflow Versioning", () => {
    let workflowId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Versioned Workflow",
          template_type: "film"
        }
      });
      const body = JSON.parse(response.payload);
      workflowId = body.data.workflow.id;
    });

    describe("GET /api/v1/workflows/:workflowId/versions", () => {
      it("should list workflow versions", async () => {
        const response = await app.inject({
          method: "GET",
          url: `/api/v1/workflows/${workflowId}/versions`
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.items).toHaveLength(1); // Initial version
        expect(body.data.items[0].version_number).toBe(1);
      });
    });

    describe("POST /api/v1/workflows/:workflowId/versions", () => {
      it("should create new workflow version", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/workflows/${workflowId}/versions`,
          payload: {
            notes: "Updated workflow"
          }
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.workflow_version).toBeDefined();
        expect(body.data.workflow_version.notes).toBe("Updated workflow");
      });
    });
  });

  describe("Workflow Validation", () => {
    let workflowId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Workflow for Validation",
          template_type: "film",
          nodes: [
            {
              id: "input1",
              type: "input",
              data: { label: "Input" }
            },
            {
              id: "output1",
              type: "output",
              data: { label: "Output" }
            }
          ],
          edges: [
            {
              id: "edge1",
              source: "input1",
              target: "output1"
            }
          ]
        }
      });
      const body = JSON.parse(response.payload);
      workflowId = body.data.workflow.id;
    });

    describe("POST /api/v1/workflows/:workflowId/validate", () => {
      it("should validate workflow successfully", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/workflows/${workflowId}/validate`,
          payload: {}
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.validation).toBeDefined();
        expect(body.data.validation.status).toBeDefined();
      });

      it("should validate workflow with nodes and edges", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/workflows/${workflowId}/validate`,
          payload: {}
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.validation.status).toBeDefined();
      });

      it("should return 404 for non-existent workflow", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/workflows/non-existent-id/validate",
          payload: {}
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("not_found");
      });

      it("should surface structural and config validation failures", async () => {
        const invalidWorkflowResponse = await app.inject({
          method: "POST",
          url: `/api/v1/projects/${projectId}/workflows`,
          payload: {
            title: "Invalid Workflow",
            template_type: "film",
            nodes: [
              {
                id: "story-input",
                type: "input",
                params: { text: "" },
                data: { label: "Story Input", catalog_type: "story_input" }
              },
              {
                id: "generate-scenes",
                type: "llm_text",
                params: {},
                data: { label: "Generate Scenes", catalog_type: "generate_scenes" }
              },
              {
                id: "generate-scenes",
                type: "video_generation",
                params: { prompt: "" },
                data: { label: "Duplicate Id", catalog_type: "generate_video_clip" }
              }
            ],
            edges: [
              {
                id: "edge-1",
                source: "story-input",
                target: "missing-node"
              },
              {
                id: "edge-2",
                source: "generate-scenes",
                target: "generate-scenes"
              }
            ]
          }
        });

        const invalidWorkflowBody = JSON.parse(invalidWorkflowResponse.payload);
        const invalidWorkflowId = invalidWorkflowBody.data.workflow.id;

        const response = await app.inject({
          method: "POST",
          url: `/api/v1/workflows/${invalidWorkflowId}/validate`,
          payload: {}
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.validation.status).toBe("fail");
        expect(body.data.validation.errors).toEqual(
          expect.arrayContaining([
            expect.stringContaining('duplicated'),
            expect.stringContaining('missing target node'),
            expect.stringContaining('self-loop'),
            expect.stringContaining('prompt is required')
          ])
        );
        expect(body.data.validation.missing_references).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "missing_target_node",
              node_id: "missing-node"
            })
          ])
        );
        expect(body.data.validation.invalid_node_configs).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              node_id: "generate-scenes"
            })
          ])
        );
      });
    });
  });

  describe("Workflow Freeze Safety", () => {
    it("should reject freezing an invalid workflow", async () => {
      const workflowResponse = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Workflow That Cannot Freeze",
          template_type: "film",
          nodes: [
            {
              id: "generate-video",
              type: "video_generation",
              params: {},
              data: { label: "Generate Video", catalog_type: "generate_video_clip" }
            }
          ],
          edges: []
        }
      });

      const workflowBody = JSON.parse(workflowResponse.payload);
      const workflowId = workflowBody.data.workflow.id;

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/workflows/${workflowId}/versions`,
        payload: {
          notes: "Attempt to freeze invalid workflow"
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("invalid_workflow");
      expect(body.data.validation.status).toBe("fail");
      expect(body.data.validation.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('prompt is required')])
      );
    });
  });

  describe("Workflow Execution", () => {
    let workflowId: string;
    let workflowVersionId: string;
    let assetId: string;

    beforeEach(async () => {
      // Create an asset first
      const assetResponse = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/assets`,
        payload: {
          asset_type: "source_story",
          asset_category: "story",
          title: "Source Asset for Workflow"
        }
      });
      const assetBody = JSON.parse(assetResponse.payload);
      assetId = assetBody.data.asset.id;

      // Create workflow
      const workflowResponse = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${projectId}/workflows`,
        payload: {
          title: "Executable Workflow",
          template_type: "film",
          nodes: [
            {
              id: "input1",
              type: "input",
              data: { label: "Story Input" }
            }
          ],
          edges: []
        }
      });
      const workflowBody = JSON.parse(workflowResponse.payload);
      workflowId = workflowBody.data.workflow.id;

      // Get the current workflow version
      const versionsResponse = await app.inject({
        method: "GET",
        url: `/api/v1/workflows/${workflowId}/versions`
      });
      const versionsBody = JSON.parse(versionsResponse.payload);
      workflowVersionId = versionsBody.data.items[0].id;
    });

    describe("POST /api/v1/workflow-versions/:workflowVersionId/runs", () => {
      it("should create workflow run", async () => {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/workflow-versions/${workflowVersionId}/runs`,
          payload: {}
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.workflow_run).toBeDefined();
        expect(body.data.workflow_run.workflow_version_id).toBe(workflowVersionId);
      });

      it("should return 404 for non-existent workflow version", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/workflow-versions/non-existent-id/runs",
          payload: {}
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("not_found");
      });
    });

    describe("GET /api/v1/projects/:projectId/workflow-runs", () => {
      let runId: string;

      beforeEach(async () => {
        const runResponse = await app.inject({
          method: "POST",
          url: `/api/v1/workflow-versions/${workflowVersionId}/runs`,
          payload: {}
        });
        const runBody = JSON.parse(runResponse.payload);
        runId = runBody.data.workflow_run.id;
      });

      it("should list workflow runs for project", async () => {
        const response = await app.inject({
          method: "GET",
          url: `/api/v1/projects/${projectId}/workflow-runs`
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.ok).toBe(true);
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0].id).toBe(runId);
      });
    });
  });
});
