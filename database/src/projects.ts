import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./client.js";
import { projectEvents, projects } from "./schema.js";

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface CreateProjectInput {
  title: string;
  description?: string;
  primary_output_type?: string | null;
  metadata?: Record<string, unknown>;
}

interface UpdateProjectInput {
  title?: string;
  description?: string;
  primary_output_type?: string | null;
  status?: "active" | "archived";
  metadata?: Record<string, unknown>;
}

function mapProject(row: typeof projects.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    primary_output_type: row.primaryOutputType,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    archived_at: row.archivedAt,
    metadata: safeParseJson(row.metadataJson, {})
  };
}

export function insertProjectEvent(projectId: string, eventType: string, payload: Record<string, unknown>) {
  db.insert(projectEvents).values({
    id: randomUUID(),
    projectId,
    eventType,
    targetType: "project",
    targetId: projectId,
    payloadJson: JSON.stringify(payload),
    createdAt: new Date().toISOString()
  }).run();
}

export function listProjects(status?: "active" | "archived") {
  const rows =
    status
      ? db.select().from(projects).where(eq(projects.status, status)).orderBy(desc(projects.updatedAt)).all()
      : db
          .select()
          .from(projects)
          .where(sql`${projects.status} != 'deleted'`)
          .orderBy(desc(projects.updatedAt))
          .all();

  return rows.map(mapProject);
}

export function getProjectById(projectId: string) {
  const row = db.select().from(projects).where(eq(projects.id, projectId)).get();
  return row ? mapProject(row) : null;
}

export function createProject(input: CreateProjectInput) {
  const timestamp = new Date().toISOString();
  const id = randomUUID();

  db.insert(projects)
    .values({
      id,
      title: input.title,
      description: input.description ?? "",
      status: "active",
      primaryOutputType: input.primary_output_type ?? null,
      createdBy: "user",
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      metadataJson: JSON.stringify(input.metadata ?? {})
    })
    .run();

  insertProjectEvent(id, "project_created", { title: input.title });

  return getProjectById(id)!;
}

export function updateProject(projectId: string, input: UpdateProjectInput) {
  const existing = db.select().from(projects).where(eq(projects.id, projectId)).get();

  if (!existing) {
    return null;
  }

  db.update(projects)
    .set({
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      status: input.status ?? existing.status,
      primaryOutputType:
        input.primary_output_type === undefined
          ? existing.primaryOutputType
          : input.primary_output_type,
      updatedAt: new Date().toISOString(),
      metadataJson:
        input.metadata === undefined ? existing.metadataJson : JSON.stringify(input.metadata),
      archivedAt:
        input.status === "archived" && !existing.archivedAt
          ? new Date().toISOString()
          : existing.archivedAt
    })
    .where(eq(projects.id, projectId))
    .run();

  insertProjectEvent(projectId, "project_updated", {
    title: input.title ?? existing.title,
    status: input.status ?? existing.status
  });

  return getProjectById(projectId);
}

export function archiveProject(projectId: string) {
  const existing = db.select().from(projects).where(eq(projects.id, projectId)).get();

  if (!existing) {
    return null;
  }

  db.update(projects)
    .set({
      status: "archived",
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(projects.id, projectId))
    .run();

  insertProjectEvent(projectId, "project_archived", {});

  return getProjectById(projectId);
}

export function listProjectEvents(projectId: string) {
  return db
    .select()
    .from(projectEvents)
    .where(eq(projectEvents.projectId, projectId))
    .orderBy(desc(projectEvents.createdAt))
    .limit(50)
    .all()
    .map((row) => ({
      id: row.id,
      event_type: row.eventType,
      target_type: row.targetType,
      target_id: row.targetId,
      workflow_run_id: row.workflowRunId,
      node_run_id: row.nodeRunId,
      export_job_id: row.exportJobId,
      created_at: row.createdAt,
      payload: safeParseJson(row.payloadJson, {})
    }));
}
