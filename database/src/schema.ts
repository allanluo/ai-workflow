import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  primaryOutputType: text('primary_output_type'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  archivedAt: text('archived_at'),
  metadataJson: text('metadata_json').notNull().default('{}'),
});

export const fileRecords = sqliteTable('file_records', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  assetVersionId: text('asset_version_id'),
  fileRole: text('file_role').notNull(),
  storageType: text('storage_type').notNull(),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  createdAt: text('created_at').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
});

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  assetType: text('asset_type').notNull(),
  assetCategory: text('asset_category').notNull(),
  title: text('title'),
  currentVersionNumber: integer('current_version_number').notNull().default(0),
  currentAssetVersionId: text('current_asset_version_id'),
  currentApprovedAssetVersionId: text('current_approved_asset_version_id'),
  status: text('status').notNull(),
  approvalState: text('approval_state').notNull().default('unapproved'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
});

export const assetVersions = sqliteTable('asset_versions', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  projectId: text('project_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  previousVersionId: text('previous_version_id'),
  parentAssetId: text('parent_asset_id'),
  status: text('status').notNull(),
  approvalState: text('approval_state').notNull().default('unapproved'),
  sourceMode: text('source_mode').notNull(),
  createdBy: text('created_by'),
  editedByLast: text('edited_by_last'),
  workflowVersionId: text('workflow_version_id'),
  workflowRunId: text('workflow_run_id'),
  nodeRunId: text('node_run_id'),
  contentJson: text('content_json').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
  lockedFieldsJson: text('locked_fields_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const workflowDefinitions = sqliteTable('workflow_definitions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  mode: text('mode').notNull(),
  status: text('status').notNull(),
  templateType: text('template_type').notNull(),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  defaultsJson: text('defaults_json').notNull().default('{}'),
  nodesJson: text('nodes_json').notNull().default('[]'),
  edgesJson: text('edges_json').notNull().default('[]'),
  metadataJson: text('metadata_json').notNull().default('{}'),
});

export const workflowVersions = sqliteTable('workflow_versions', {
  id: text('id').primaryKey(),
  workflowDefinitionId: text('workflow_definition_id').notNull(),
  projectId: text('project_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  status: text('status').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: text('approved_at'),
  graphHash: text('graph_hash').notNull(),
  templateType: text('template_type').notNull(),
  frozenWorkflowJson: text('frozen_workflow_json').notNull(),
  inputAssetVersionsJson: text('input_asset_versions_json').notNull().default('{}'),
  runtimeEnvironmentJson: text('runtime_environment_json').notNull().default('{}'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const workflowRuns = sqliteTable('workflow_runs', {
  id: text('id').primaryKey(),
  workflowVersionId: text('workflow_version_id').notNull(),
  projectId: text('project_id').notNull(),
  status: text('status').notNull(),
  triggeredBy: text('triggered_by'),
  triggerSource: text('trigger_source').notNull(),
  rerunOfWorkflowRunId: text('rerun_of_workflow_run_id'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  resolvedInputSnapshotJson: text('resolved_input_snapshot_json').notNull().default('{}'),
  summaryJson: text('summary_json').notNull().default('{}'),
  logsJson: text('logs_json').notNull().default('[]'),
  warningsJson: text('warnings_json').notNull().default('[]'),
  errorsJson: text('errors_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const nodeRuns = sqliteTable('node_runs', {
  id: text('id').primaryKey(),
  workflowRunId: text('workflow_run_id').notNull(),
  workflowVersionId: text('workflow_version_id').notNull(),
  projectId: text('project_id').notNull(),
  nodeId: text('node_id').notNull(),
  nodeType: text('node_type').notNull(),
  status: text('status').notNull(),
  position: integer('position').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  inputSnapshotJson: text('input_snapshot_json').notNull().default('{}'),
  outputSnapshotJson: text('output_snapshot_json').notNull().default('{}'),
  logsJson: text('logs_json').notNull().default('[]'),
  warningsJson: text('warnings_json').notNull().default('[]'),
  errorsJson: text('errors_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectEvents = sqliteTable('project_events', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  eventType: text('event_type').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  workflowRunId: text('workflow_run_id'),
  nodeRunId: text('node_run_id'),
  exportJobId: text('export_job_id'),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  assetVersionId: text('asset_version_id'),
  nodeRunId: text('node_run_id'),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  content: text('content').notNull(),
  resolved: integer('resolved').notNull().default(0),
  parentCommentId: text('parent_comment_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  assetId: text('asset_id').notNull(),
  assetVersionId: text('asset_version_id').notNull(),
  approvedBy: text('approved_by').notNull(),
  approverName: text('approver_name').notNull(),
  decision: text('decision').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const outputs = sqliteTable('outputs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  outputType: text('output_type').notNull(),
  status: text('status').notNull(),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const outputVersions = sqliteTable('output_versions', {
  id: text('id').primaryKey(),
  outputId: text('output_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  status: text('status').notNull(),
  assembledFromAssetVersionIdsJson: text('assembled_from_asset_version_ids_json').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
});

export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  outputVersionId: text('output_version_id').notNull(),
  exportFormat: text('export_format').notNull(),
  status: text('status').notNull(),
  progress: integer('progress').notNull().default(0),
  outputPath: text('output_path'),
  errorMessage: text('error_message'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
});

export const assetLinks = sqliteTable('asset_links', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  sourceAssetVersionId: text('source_asset_version_id').notNull(),
  targetAssetVersionId: text('target_asset_version_id').notNull(),
  linkType: text('link_type').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
});

export const assetTags = sqliteTable('asset_tags', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  assetId: text('asset_id').notNull(),
  tag: text('tag').notNull(),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
});

export const copilotSessions = sqliteTable('copilot_sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  stateJson: text('state_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const copilotAuditEvents = sqliteTable('copilot_audit_events', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  ts: text('ts').notNull(),
  eventType: text('event_type').notNull(),
  tool: text('tool'),
  ok: integer('ok'),
  durationMs: integer('duration_ms'),
  summary: text('summary'),
  detailsJson: text('details_json').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

export const copilotPlanRuns = sqliteTable('copilot_plan_runs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  status: text('status').notNull(),
  planJson: text('plan_json').notNull().default('{}'),
  contextJson: text('context_json').notNull().default('{}'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
});

export const copilotPlanSteps = sqliteTable('copilot_plan_steps', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  projectId: text('project_id').notNull(),
  stepIndex: integer('step_index').notNull(),
  stepId: text('step_id').notNull(),
  title: text('title').notNull(),
  tool: text('tool').notNull(),
  status: text('status').notNull(),
  paramsJson: text('params_json').notNull().default('{}'),
  resultJson: text('result_json').notNull().default(''),
  errorJson: text('error_json').notNull().default(''),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
  updatedAt: text('updated_at').notNull(),
});

export const copilotContextCache = sqliteTable('copilot_context_cache', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  contextType: text('context_type').notNull(), // e.g., 'asset', 'workflow', 'run'
  itemId: text('item_id').notNull(),
  content: text('content').notNull(), // searchable text
  indexedAt: text('indexed_at').notNull(),
});

// Persistent semantic index for Copilot retrieval (normalized embeddings stored as JSON arrays).
// This intentionally keeps storage simple (SQLite TEXT) and runs similarity ranking in-process.
export const copilotVectorIndex = sqliteTable('copilot_vector_index', {
  id: text('id').primaryKey(), // deterministic: `${projectId}:${contextType}:${itemId}:${model}`
  projectId: text('project_id').notNull(),
  contextType: text('context_type').notNull(), // e.g., 'asset', 'workflow'
  itemId: text('item_id').notNull(),
  itemVersionId: text('item_version_id'), // e.g., assetVersionId / workflowVersionId
  chunkId: text('chunk_id').notNull().default('0'), // '0' for single-chunk legacy rows
  chunkIndex: integer('chunk_index').notNull().default(0),
  chunkCount: integer('chunk_count').notNull().default(1),
  model: text('model').notNull(),
  dim: integer('dim').notNull(),
  embeddingJson: text('embedding_json').notNull(), // normalized vector
  content: text('content').notNull().default(''), // text used to embed (clipped)
  contentHash: text('content_hash').notNull().default(''), // hash of `content` + model
  sourceUpdatedAt: text('source_updated_at').notNull().default(''), // source item updated timestamp/version
  indexedAt: text('indexed_at').notNull(),
});
