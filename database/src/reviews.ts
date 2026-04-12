import { randomUUID } from 'node:crypto';
import { and, eq, desc } from 'drizzle-orm';
import { db } from './client.js';
import {
  approvals,
  comments,
  exportJobs,
  outputVersions,
  outputs,
  projectEvents,
} from './schema.js';

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface CreateCommentInput {
  projectId: string;
  assetVersionId?: string | null;
  nodeRunId?: string | null;
  authorId: string;
  authorName: string;
  content: string;
  parentCommentId?: string | null;
}

export interface Comment {
  id: string;
  project_id: string;
  asset_version_id: string | null;
  node_run_id: string | null;
  author_id: string;
  author_name: string;
  content: string;
  resolved: boolean;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateApprovalInput {
  projectId: string;
  assetId: string;
  assetVersionId: string;
  approvedBy: string;
  approverName: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}

export interface Approval {
  id: string;
  project_id: string;
  asset_id: string;
  asset_version_id: string;
  approved_by: string;
  approver_name: string;
  decision: 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
}

export interface CreateOutputInput {
  projectId: string;
  title: string;
  outputType: string;
  createdBy?: string;
}

export interface Output {
  id: string;
  project_id: string;
  title: string;
  output_type: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOutputVersionInput {
  outputId: string;
  assembledFromAssetVersionIds: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface OutputVersion {
  id: string;
  output_id: string;
  version_number: number;
  status: string;
  assembled_from_asset_version_ids: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface CreateExportJobInput {
  projectId: string;
  outputVersionId: string;
  exportFormat: string;
}

export interface ExportJob {
  id: string;
  project_id: string;
  output_version_id: string;
  export_format: string;
  status: string;
  progress: number;
  output_path: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function createComment(input: CreateCommentInput): Comment {
  const timestamp = new Date().toISOString();
  const id = randomUUID();

  db.insert(comments)
    .values({
      id,
      projectId: input.projectId,
      assetVersionId: input.assetVersionId ?? null,
      nodeRunId: input.nodeRunId ?? null,
      authorId: input.authorId,
      authorName: input.authorName,
      content: input.content,
      resolved: 0,
      parentCommentId: input.parentCommentId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  const row = db.select().from(comments).where(eq(comments.id, id)).get()!;
  return mapComment(row);
}

export function listComments(projectId: string, assetVersionId?: string): Comment[] {
  const conditions = [eq(comments.projectId, projectId)];
  if (assetVersionId) {
    conditions.push(eq(comments.assetVersionId, assetVersionId));
  }

  return db
    .select()
    .from(comments)
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt))
    .all()
    .map(mapComment);
}

export function resolveComment(commentId: string, resolved: boolean): Comment | null {
  const row = db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!row) return null;

  db.update(comments)
    .set({
      resolved: resolved ? 1 : 0,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(comments.id, commentId))
    .run();

  return getCommentById(commentId);
}

export function getCommentById(commentId: string): Comment | null {
  const row = db.select().from(comments).where(eq(comments.id, commentId)).get();
  return row ? mapComment(row) : null;
}

function mapComment(row: typeof comments.$inferSelect): Comment {
  return {
    id: row.id,
    project_id: row.projectId,
    asset_version_id: row.assetVersionId,
    node_run_id: row.nodeRunId,
    author_id: row.authorId,
    author_name: row.authorName,
    content: row.content,
    resolved: row.resolved === 1,
    parent_comment_id: row.parentCommentId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function createApproval(input: CreateApprovalInput): Approval {
  const timestamp = new Date().toISOString();
  const id = randomUUID();

  db.insert(approvals)
    .values({
      id,
      projectId: input.projectId,
      assetId: input.assetId,
      assetVersionId: input.assetVersionId,
      approvedBy: input.approvedBy,
      approverName: input.approverName,
      decision: input.decision,
      notes: input.notes ?? null,
      createdAt: timestamp,
    })
    .run();

  insertProjectEvent({
    projectId: input.projectId,
    eventType: `asset_${input.decision}d`.replace('_d', 'ed'),
    targetType: 'asset',
    targetId: input.assetId,
    payload: {
      asset_id: input.assetId,
      asset_version_id: input.assetVersionId,
      decision: input.decision,
      approver_name: input.approverName,
    },
  });

  const row = db.select().from(approvals).where(eq(approvals.id, id)).get()!;
  return mapApproval(row);
}

export function listApprovals(assetId: string): Approval[] {
  return db
    .select()
    .from(approvals)
    .where(eq(approvals.assetId, assetId))
    .orderBy(desc(approvals.createdAt))
    .all()
    .map(mapApproval);
}

function mapApproval(row: typeof approvals.$inferSelect): Approval {
  return {
    id: row.id,
    project_id: row.projectId,
    asset_id: row.assetId,
    asset_version_id: row.assetVersionId,
    approved_by: row.approvedBy,
    approver_name: row.approverName,
    decision: row.decision as 'approved' | 'rejected',
    notes: row.notes,
    created_at: row.createdAt,
  };
}

export function createOutput(input: CreateOutputInput): Output {
  const timestamp = new Date().toISOString();
  const id = randomUUID();

  db.insert(outputs)
    .values({
      id,
      projectId: input.projectId,
      title: input.title,
      outputType: input.outputType,
      status: 'draft',
      createdBy: input.createdBy ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  const row = db.select().from(outputs).where(eq(outputs.id, id)).get()!;
  return mapOutput(row);
}

export function listOutputs(projectId: string): Output[] {
  return db
    .select()
    .from(outputs)
    .where(eq(outputs.projectId, projectId))
    .orderBy(desc(outputs.createdAt))
    .all()
    .map(mapOutput);
}

export function getOutputById(outputId: string): Output | null {
  const row = db.select().from(outputs).where(eq(outputs.id, outputId)).get();
  return row ? mapOutput(row) : null;
}

function mapOutput(row: typeof outputs.$inferSelect): Output {
  return {
    id: row.id,
    project_id: row.projectId,
    title: row.title,
    output_type: row.outputType,
    status: row.status,
    created_by: row.createdBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function createOutputVersion(input: CreateOutputVersionInput): OutputVersion {
  const timestamp = new Date().toISOString();
  const id = randomUUID();

  const existingVersions = db
    .select()
    .from(outputVersions)
    .where(eq(outputVersions.outputId, input.outputId))
    .all();

  const versionNumber = existingVersions.length + 1;

  db.insert(outputVersions)
    .values({
      id,
      outputId: input.outputId,
      versionNumber,
      status: 'draft',
      assembledFromAssetVersionIdsJson: JSON.stringify(input.assembledFromAssetVersionIds),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdBy: input.createdBy ?? null,
      createdAt: timestamp,
    })
    .run();

  const row = db.select().from(outputVersions).where(eq(outputVersions.id, id)).get()!;
  return mapOutputVersion(row);
}

export function listOutputVersions(outputId: string): OutputVersion[] {
  return db
    .select()
    .from(outputVersions)
    .where(eq(outputVersions.outputId, outputId))
    .orderBy(desc(outputVersions.versionNumber))
    .all()
    .map(mapOutputVersion);
}

function mapOutputVersion(row: typeof outputVersions.$inferSelect): OutputVersion {
  return {
    id: row.id,
    output_id: row.outputId,
    version_number: row.versionNumber,
    status: row.status,
    assembled_from_asset_version_ids: safeParseJson(row.assembledFromAssetVersionIdsJson, []),
    metadata: safeParseJson(row.metadataJson, {}),
    created_by: row.createdBy,
    created_at: row.createdAt,
  };
}

export function createExportJob(input: CreateExportJobInput): ExportJob {
  const timestamp = new Date().toISOString();
  const id = randomUUID();

  db.insert(exportJobs)
    .values({
      id,
      projectId: input.projectId,
      outputVersionId: input.outputVersionId,
      exportFormat: input.exportFormat,
      status: 'queued',
      progress: 0,
      outputPath: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: timestamp,
    })
    .run();

  const row = db.select().from(exportJobs).where(eq(exportJobs.id, id)).get()!;
  return mapExportJob(row);
}

export function listExportJobs(projectId: string): ExportJob[] {
  return db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.projectId, projectId))
    .orderBy(desc(exportJobs.createdAt))
    .all()
    .map(mapExportJob);
}

export function updateExportJobProgress(
  jobId: string,
  progress: number,
  status?: string
): ExportJob | null {
  const row = db.select().from(exportJobs).where(eq(exportJobs.id, jobId)).get();
  if (!row) return null;

  const updates: Record<string, unknown> = { progress };
  if (status) {
    updates.status = status;
  }
  if (status === 'running' && !row.startedAt) {
    updates.startedAt = new Date().toISOString();
  }
  if (status === 'completed' || status === 'failed') {
    updates.completedAt = new Date().toISOString();
  }

  db.update(exportJobs)
    .set(updates as typeof exportJobs.$inferInsert)
    .where(eq(exportJobs.id, jobId))
    .run();

  return getExportJobById(jobId);
}

export function completeExportJob(
  jobId: string,
  outputPath: string,
  success: boolean,
  errorMessage?: string
): ExportJob | null {
  const row = db.select().from(exportJobs).where(eq(exportJobs.id, jobId)).get();
  if (!row) return null;

  const timestamp = new Date().toISOString();

  db.update(exportJobs)
    .set({
      status: success ? 'completed' : 'failed',
      progress: success ? 100 : 0,
      outputPath: success ? outputPath : null,
      errorMessage: errorMessage ?? null,
      startedAt: row.startedAt ?? timestamp,
      completedAt: timestamp,
    } as typeof exportJobs.$inferInsert)
    .where(eq(exportJobs.id, jobId))
    .run();

  insertProjectEvent({
    projectId: row.projectId,
    eventType: success ? 'export_completed' : 'export_failed',
    targetType: 'export_job',
    targetId: jobId,
    payload: {
      export_job_id: jobId,
      output_path: outputPath,
      error: errorMessage,
    },
  });

  return getExportJobById(jobId);
}

export function getExportJobById(jobId: string): ExportJob | null {
  const row = db.select().from(exportJobs).where(eq(exportJobs.id, jobId)).get();
  return row ? mapExportJob(row) : null;
}

function mapExportJob(row: typeof exportJobs.$inferSelect): ExportJob {
  return {
    id: row.id,
    project_id: row.projectId,
    output_version_id: row.outputVersionId,
    export_format: row.exportFormat,
    status: row.status,
    progress: row.progress,
    output_path: row.outputPath,
    error_message: row.errorMessage,
    started_at: row.startedAt,
    completed_at: row.completedAt,
    created_at: row.createdAt,
  };
}

function insertProjectEvent(input: {
  projectId: string;
  eventType: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
}) {
  db.insert(projectEvents)
    .values({
      id: randomUUID(),
      projectId: input.projectId,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      payloadJson: JSON.stringify(input.payload),
      createdAt: new Date().toISOString(),
    })
    .run();
}
