import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "./client.js";
import { fileRecords, projectEvents } from "./schema.js";

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface CreateFileRecordInput {
  id?: string;
  file_role: string;
  storage_type: string;
  file_path: string;
  mime_type?: string;
  size_bytes?: number;
  metadata?: Record<string, unknown>;
}

function mapFileRecord(row: typeof fileRecords.$inferSelect) {
  return {
    id: row.id,
    project_id: row.projectId,
    asset_version_id: row.assetVersionId,
    file_role: row.fileRole,
    storage_type: row.storageType,
    file_path: row.filePath,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    created_at: row.createdAt,
    metadata: safeParseJson(row.metadataJson, {})
  };
}

function insertFileEvent(projectId: string, targetId: string, payload: Record<string, unknown>) {
  db.insert(projectEvents)
    .values({
      id: randomUUID(),
      projectId,
      eventType: "file_uploaded",
      targetType: "file_record",
      targetId,
      payloadJson: JSON.stringify(payload),
      createdAt: new Date().toISOString()
    })
    .run();
}

export function createFileRecord(projectId: string, input: CreateFileRecordInput) {
  const id = input.id ?? randomUUID();
  const timestamp = new Date().toISOString();

  db.insert(fileRecords)
    .values({
      id,
      projectId,
      assetVersionId: null,
      fileRole: input.file_role,
      storageType: input.storage_type,
      filePath: input.file_path,
      mimeType: input.mime_type ?? null,
      sizeBytes: input.size_bytes ?? null,
      createdAt: timestamp,
      metadataJson: JSON.stringify(input.metadata ?? {})
    })
    .run();

  insertFileEvent(projectId, id, {
    file_role: input.file_role,
    file_path: input.file_path
  });

  return getFileRecordById(id)!;
}

export function listFileRecords(projectId: string) {
  return db
    .select()
    .from(fileRecords)
    .where(eq(fileRecords.projectId, projectId))
    .orderBy(desc(fileRecords.createdAt))
    .all()
    .map(mapFileRecord);
}

export function getFileRecordById(fileId: string) {
  const row = db.select().from(fileRecords).where(eq(fileRecords.id, fileId)).get();
  return row ? mapFileRecord(row) : null;
}

