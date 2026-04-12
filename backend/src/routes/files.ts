import {
  createFileRecord,
  getFileRecordById,
  listFileRecords
} from "@ai-workflow/database";
import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { z } from "zod";

function sanitizeFileName(fileName: string) {
  const basename = fileName.split("/").pop() ?? fileName;
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
  const parts = sanitized.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const nameWithoutExt = parts.join(".");
  return `${nameWithoutExt.slice(0, 200)}_${Date.now()}.${ext}`;
}

function getMultipartFieldValue(
  fields: Record<string, unknown>,
  key: string
): string | null {
  const field = fields[key];

  if (!field || Array.isArray(field) || typeof field !== "object") {
    return null;
  }

  const candidate = (field as { value?: unknown }).value;
  return typeof candidate === "string" ? candidate : null;
}

export async function registerFileRoutes(app: FastifyInstance) {
  app.post("/projects/:projectId/files", async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const filePart = await request.file();

    if (!filePart) {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: {
          code: "bad_request",
          message: "Multipart field `file` is required"
        }
      };
    }

    const role = getMultipartFieldValue(filePart.fields as Record<string, unknown>, "role") ?? "source_upload";
    const assetTypeHint =
      getMultipartFieldValue(filePart.fields as Record<string, unknown>, "asset_type");
    const fileId = randomUUID();
    const uploadsDir = path.join(config.projectStorageRoot, params.projectId, "uploads");
    const storedName = `${fileId}-${sanitizeFileName(filePart.filename)}`;
    const filePath = path.join(uploadsDir, storedName);

    fs.mkdirSync(uploadsDir, { recursive: true });
    await pipeline(filePart.file, fs.createWriteStream(filePath));

    const stats = fs.statSync(filePath);
    const record = createFileRecord(params.projectId, {
      id: fileId,
      file_role: role,
      storage_type: "local_fs",
      file_path: filePath,
      mime_type: filePart.mimetype,
      size_bytes: stats.size,
      metadata: {
        original_filename: filePart.filename,
        asset_type_hint: assetTypeHint
      }
    });

    reply.code(201);

    return {
      ok: true,
      data: {
        file: record
      },
      error: null
    };
  });

  app.get("/projects/:projectId/files", async (request) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);

    return {
      ok: true,
      data: {
        items: listFileRecords(params.projectId),
        next_cursor: null
      },
      error: null
    };
  });

  app.get("/files/:fileId", async (request, reply) => {
    const params = z.object({ fileId: z.string() }).parse(request.params);
    const fileRecord = getFileRecordById(params.fileId);

    if (!fileRecord) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `File ${params.fileId} was not found`
        }
      };
    }

    return {
      ok: true,
      data: { file: fileRecord },
      error: null
    };
  });

  app.get("/files/:fileId/content", async (request, reply) => {
    const params = z.object({ fileId: z.string() }).parse(request.params);
    const fileRecord = getFileRecordById(params.fileId);

    if (!fileRecord) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `File ${params.fileId} was not found`
        }
      };
    }

    if (!fs.existsSync(fileRecord.file_path)) {
      reply.code(404);
      return {
        ok: false,
        data: null,
        error: {
          code: "not_found",
          message: `Stored file for ${params.fileId} was not found on disk`
        }
      };
    }

    reply.type(fileRecord.mime_type ?? "application/octet-stream");
    return reply.send(fs.createReadStream(fileRecord.file_path));
  });
}
