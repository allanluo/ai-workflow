import {
  archiveProject,
  createProject,
  getProjectById,
  listProjects,
  updateProject
} from "@ai-workflow/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  primary_output_type: z.string().max(100).optional().nullable(),
  metadata: z.record(z.any()).optional().default({})
});

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  primary_output_type: z.string().max(100).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  metadata: z.record(z.any()).optional()
});

export async function registerProjectRoutes(app: FastifyInstance) {
  app.post("/projects", async (request, reply) => {
    const body = createProjectSchema.parse(request.body);
    const project = createProject(body);

    reply.code(201);

    return {
      ok: true,
      data: {
        project
      },
      error: null
    };
  });

  app.get("/projects", async (request) => {
    const query = z
      .object({
        status: z.enum(["active", "archived"]).optional()
      })
      .parse(request.query);

    return {
      ok: true,
      data: {
        items: listProjects(query.status),
        next_cursor: null
      },
      error: null
    };
  });

  app.get("/projects/:projectId", async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const project = getProjectById(params.projectId);

    if (!project) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Project ${params.projectId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: {
        project
      },
      error: null
    };
  });

  app.patch("/projects/:projectId", async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = updateProjectSchema.parse(request.body);
    const project = updateProject(params.projectId, body);

    if (!project) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Project ${params.projectId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: {
        project
      },
      error: null
    };
  });

  app.delete("/projects/:projectId", async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const archived = archiveProject(params.projectId);

    if (!archived) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Project ${params.projectId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: {
        project: archived
      },
      error: null
    };
  });
}

