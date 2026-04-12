import {
  approveAssetVersion,
  createAsset,
  createAssetVersion,
  getAssetById,
  getAssetVersionById,
  lockAssetVersion,
  listAssetVersions,
  listAssets,
  unlockAssetVersion,
  updateAsset
} from "@ai-workflow/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createAssetSchema = z.object({
  asset_type: z.string().min(1).max(100),
  asset_category: z.string().min(1).max(100),
  title: z.string().max(200).optional().default(""),
  content: z.record(z.any()).optional().default({}),
  metadata: z.record(z.any()).optional().default({}),
  source_mode: z.enum(["manual", "copilot", "workflow", "import", "system"]).default("manual"),
  status: z.enum(["draft", "needs_revision", "ready", "locked", "deprecated", "failed"]).optional().default("draft")
});

const createAssetVersionSchema = z.object({
  content: z.record(z.any()).optional().default({}),
  metadata: z.record(z.any()).optional().default({}),
  status: z.enum(["draft", "needs_revision", "ready", "locked", "deprecated", "failed"]).optional().default("draft"),
  source_mode: z.enum(["manual", "copilot", "workflow", "import", "system"]).default("manual"),
  locked_fields: z.array(z.string()).optional().default([]),
  make_current: z.boolean().optional().default(true)
});

const approveAssetSchema = z.object({
  asset_version_id: z.string().optional(),
  notes: z.string().optional().default("")
});

const lockAssetSchema = z.object({
  asset_version_id: z.string().optional(),
  locked_fields: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default("")
});

const unlockAssetSchema = z.object({
  asset_version_id: z.string().optional(),
  status: z.enum(["draft", "needs_revision", "ready", "deprecated", "failed"]).optional().default("draft"),
  notes: z.string().optional().default("")
});

const updateAssetSchema = z.object({
  title: z.string().max(200).optional(),
  asset_type: z.string().min(1).max(100).optional(),
  asset_category: z.string().min(1).max(100).optional(),
  status: z.enum(["draft", "needs_revision", "ready", "locked", "deprecated", "failed"]).optional(),
  metadata: z.record(z.any()).optional()
});

export async function registerAssetRoutes(app: FastifyInstance) {
  app.post("/projects/:projectId/assets", async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = createAssetSchema.parse(request.body);
    const asset = createAsset(params.projectId, body);

    reply.code(201);

    return {
      ok: true,
      data: { asset },
      error: null
    };
  });

  app.get("/projects/:projectId/assets", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z
      .object({
        asset_type: z.string().optional(),
        asset_category: z.string().optional(),
        status: z.string().optional(),
        approval_state: z.string().optional()
      })
      .parse(request.query);

    return {
      ok: true,
      data: {
        items: listAssets(params.projectId, query),
        next_cursor: null
      },
      error: null
    };
  });

  app.get("/assets/:assetId", async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const asset = getAssetById(params.assetId);

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Asset ${params.assetId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null
    };
  });

  app.patch("/assets/:assetId", async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = updateAssetSchema.parse(request.body);
    const asset = updateAsset(params.assetId, body);

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Asset ${params.assetId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null
    };
  });

  app.get("/assets/:assetId/versions", async (request) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);

    return {
      ok: true,
      data: {
        items: listAssetVersions(params.assetId),
        next_cursor: null
      },
      error: null
    };
  });

  app.get("/asset-versions/:assetVersionId", async (request, reply) => {
    const params = z.object({ assetVersionId: z.string() }).parse(request.params);
    const assetVersion = getAssetVersionById(params.assetVersionId);

    if (!assetVersion) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Asset version ${params.assetVersionId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: { asset_version: assetVersion },
      error: null
    };
  });

  app.post("/assets/:assetId/versions", async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = createAssetVersionSchema.parse(request.body);
    const assetVersion = createAssetVersion(params.assetId, body);

    if (!assetVersion) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Asset ${params.assetId} was not found`
        }
      };
    }

    reply.code(201);

    return {
      ok: true,
      data: { asset_version: assetVersion },
      error: null
    };
  });

  app.post("/assets/:assetId/approve", async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = approveAssetSchema.parse(request.body);
    const asset = approveAssetVersion(params.assetId, body.asset_version_id, body.notes);

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Asset ${params.assetId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null
    };
  });

  app.post("/assets/:assetId/lock", async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = lockAssetSchema.parse(request.body);
    const asset = lockAssetVersion(
      params.assetId,
      body.asset_version_id,
      body.locked_fields,
      body.notes
    );

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Asset ${params.assetId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null
    };
  });

  app.post("/assets/:assetId/unlock", async (request, reply) => {
    const params = z.object({ assetId: z.string() }).parse(request.params);
    const body = unlockAssetSchema.parse(request.body);
    const asset = unlockAssetVersion(params.assetId, body.asset_version_id, body.status, body.notes);

    if (!asset) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Asset ${params.assetId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: { asset },
      error: null
    };
  });
}
