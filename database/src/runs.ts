import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './client.js';
import {
  assetVersions,
  assets,
  nodeRuns,
  projectEvents,
  workflowRuns,
  workflowVersions,
} from './schema.js';

type WorkflowRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
type NodeRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

interface CreateWorkflowRunInput {
  trigger_source?: string;
  rerun_of_workflow_run_id?: string | null;
}

interface WorkflowNodeDefinition {
  id?: unknown;
  type?: unknown;
  params?: unknown;
}

interface CreateNodeRunInput {
  workflow_run_id: string;
  workflow_version_id: string;
  project_id: string;
  node_id: string;
  node_type: string;
  position: number;
  input_snapshot: Record<string, unknown>;
}

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapWorkflowRun(row: typeof workflowRuns.$inferSelect) {
  return {
    id: row.id,
    workflow_version_id: row.workflowVersionId,
    project_id: row.projectId,
    status: row.status,
    triggered_by: row.triggeredBy,
    trigger_source: row.triggerSource,
    rerun_of_workflow_run_id: row.rerunOfWorkflowRunId,
    started_at: row.startedAt,
    ended_at: row.endedAt,
    resolved_input_snapshot: safeParseJson(row.resolvedInputSnapshotJson, {}),
    summary: safeParseJson(row.summaryJson, {}),
    logs: safeParseJson(row.logsJson, []),
    warnings: safeParseJson(row.warningsJson, []),
    errors: safeParseJson(row.errorsJson, []),
    created_at: row.createdAt,
  };
}

function mapNodeRun(row: typeof nodeRuns.$inferSelect) {
  return {
    id: row.id,
    workflow_run_id: row.workflowRunId,
    workflow_version_id: row.workflowVersionId,
    project_id: row.projectId,
    node_id: row.nodeId,
    node_type: row.nodeType,
    status: row.status,
    position: row.position,
    started_at: row.startedAt,
    ended_at: row.endedAt,
    input_snapshot: safeParseJson(row.inputSnapshotJson, {}),
    output_snapshot: safeParseJson(row.outputSnapshotJson, {}),
    logs: safeParseJson(row.logsJson, []),
    warnings: safeParseJson(row.warningsJson, []),
    errors: safeParseJson(row.errorsJson, []),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function insertProjectEvent(input: {
  projectId: string;
  eventType: string;
  targetType: string;
  targetId: string;
  workflowRunId?: string | null;
  nodeRunId?: string | null;
  payload: Record<string, unknown>;
}) {
  db.insert(projectEvents)
    .values({
      id: randomUUID(),
      projectId: input.projectId,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      workflowRunId: input.workflowRunId ?? null,
      nodeRunId: input.nodeRunId ?? null,
      payloadJson: JSON.stringify(input.payload),
      createdAt: new Date().toISOString(),
    })
    .run();
}

function getWorkflowVersionRow(workflowVersionId: string) {
  return db.select().from(workflowVersions).where(eq(workflowVersions.id, workflowVersionId)).get();
}

function appendStringLog(existingJson: string, message: string) {
  const logs = safeParseJson<string[]>(existingJson, []);
  logs.push(message);
  return JSON.stringify(logs);
}

function appendStringError(existingJson: string, message: string) {
  const errors = safeParseJson<string[]>(existingJson, []);
  errors.push(message);
  return JSON.stringify(errors);
}

function getWorkflowRunRow(workflowRunId: string) {
  return db.select().from(workflowRuns).where(eq(workflowRuns.id, workflowRunId)).get();
}

function getNodeRunRow(nodeRunId: string) {
  return db.select().from(nodeRuns).where(eq(nodeRuns.id, nodeRunId)).get();
}

export function createWorkflowRun(workflowVersionId: string, input: CreateWorkflowRunInput = {}) {
  const workflowVersion = getWorkflowVersionRow(workflowVersionId);

  if (!workflowVersion) {
    return null;
  }

  const runId = randomUUID();
  const createdAt = new Date().toISOString();
  const resolvedInputSnapshot = safeParseJson<Record<string, unknown>>(
    workflowVersion.inputAssetVersionsJson,
    {}
  );
  const frozenWorkflow = safeParseJson<{ nodes?: WorkflowNodeDefinition[] }>(
    workflowVersion.frozenWorkflowJson,
    {}
  );
  const nodes = Array.isArray(frozenWorkflow.nodes) ? frozenWorkflow.nodes : [];

  db.insert(workflowRuns)
    .values({
      id: runId,
      workflowVersionId,
      projectId: workflowVersion.projectId,
      status: 'queued' satisfies WorkflowRunStatus,
      triggeredBy: 'user',
      triggerSource: input.trigger_source ?? 'manual',
      rerunOfWorkflowRunId: input.rerun_of_workflow_run_id ?? null,
      startedAt: createdAt,
      endedAt: null,
      resolvedInputSnapshotJson: JSON.stringify(resolvedInputSnapshot),
      summaryJson: JSON.stringify({
        node_count: nodes.length,
        completed_node_count: 0,
      }),
      logsJson: JSON.stringify([
        `Workflow run queued for version ${workflowVersion.versionNumber}.`,
      ]),
      warningsJson: JSON.stringify([]),
      errorsJson: JSON.stringify([]),
      createdAt,
    })
    .run();

  insertProjectEvent({
    projectId: workflowVersion.projectId,
    eventType: 'workflow_run_created',
    targetType: 'workflow_run',
    targetId: runId,
    workflowRunId: runId,
    payload: {
      workflow_version_id: workflowVersionId,
      version_number: workflowVersion.versionNumber,
    },
  });

  return getWorkflowRunById(runId);
}

export function getWorkflowRunExecutionContext(workflowRunId: string) {
  const workflowRun = getWorkflowRunRow(workflowRunId);

  if (!workflowRun) {
    return null;
  }

  const workflowVersion = getWorkflowVersionRow(workflowRun.workflowVersionId);

  if (!workflowVersion) {
    return null;
  }

  const frozenWorkflow = safeParseJson<{ nodes?: WorkflowNodeDefinition[] }>(
    workflowVersion.frozenWorkflowJson,
    {}
  );

  return {
    workflow_run_id: workflowRun.id,
    workflow_version_id: workflowRun.workflowVersionId,
    project_id: workflowRun.projectId,
    version_number: workflowVersion.versionNumber,
    resolved_input_snapshot: safeParseJson(workflowRun.resolvedInputSnapshotJson, {}),
    nodes: Array.isArray(frozenWorkflow.nodes) ? frozenWorkflow.nodes : [],
  };
}

export function startWorkflowRun(workflowRunId: string) {
  const workflowRun = getWorkflowRunRow(workflowRunId);

  if (!workflowRun) {
    return null;
  }

  const startedAt = new Date().toISOString();

  db.update(workflowRuns)
    .set({
      status: 'running',
      startedAt,
      logsJson: appendStringLog(workflowRun.logsJson, 'Workflow run started.'),
    })
    .where(eq(workflowRuns.id, workflowRunId))
    .run();

  insertProjectEvent({
    projectId: workflowRun.projectId,
    eventType: 'workflow_run_started',
    targetType: 'workflow_run',
    targetId: workflowRunId,
    workflowRunId,
    payload: {
      workflow_version_id: workflowRun.workflowVersionId,
    },
  });

  return getWorkflowRunById(workflowRunId);
}

export function createNodeRun(input: CreateNodeRunInput) {
  const timestamp = new Date().toISOString();
  const nodeRunId = randomUUID();

  db.insert(nodeRuns)
    .values({
      id: nodeRunId,
      workflowRunId: input.workflow_run_id,
      workflowVersionId: input.workflow_version_id,
      projectId: input.project_id,
      nodeId: input.node_id,
      nodeType: input.node_type,
      status: 'running' satisfies NodeRunStatus,
      position: input.position,
      startedAt: timestamp,
      endedAt: null,
      inputSnapshotJson: JSON.stringify(input.input_snapshot),
      outputSnapshotJson: JSON.stringify({}),
      logsJson: JSON.stringify([`Started ${input.node_type}.`]),
      warningsJson: JSON.stringify([]),
      errorsJson: JSON.stringify([]),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  insertProjectEvent({
    projectId: input.project_id,
    eventType: 'node_run_started',
    targetType: 'node_run',
    targetId: nodeRunId,
    workflowRunId: input.workflow_run_id,
    nodeRunId,
    payload: {
      node_id: input.node_id,
      node_type: input.node_type,
      position: input.position,
    },
  });

  return getNodeRunById(nodeRunId);
}

export function completeNodeRun(nodeRunId: string, outputSnapshot: Record<string, unknown>) {
  const nodeRun = getNodeRunRow(nodeRunId);

  if (!nodeRun) {
    return null;
  }

  const workflowRun = getWorkflowRunRow(nodeRun.workflowRunId);

  if (!workflowRun) {
    return null;
  }

  const endedAt = new Date().toISOString();
  const workflowSummary = safeParseJson<Record<string, unknown>>(workflowRun.summaryJson, {});
  const completedNodeCount = Number(workflowSummary.completed_node_count ?? 0) + 1;

  db.update(nodeRuns)
    .set({
      status: 'completed',
      endedAt,
      outputSnapshotJson: JSON.stringify(outputSnapshot),
      logsJson: appendStringLog(
        nodeRun.logsJson,
        `Executed ${nodeRun.nodeType} in deterministic development mode.`
      ),
      updatedAt: endedAt,
    })
    .where(eq(nodeRuns.id, nodeRunId))
    .run();

  db.update(workflowRuns)
    .set({
      summaryJson: JSON.stringify({
        ...workflowSummary,
        completed_node_count: completedNodeCount,
      }),
      logsJson: appendStringLog(
        workflowRun.logsJson,
        `Node ${nodeRun.nodeId} completed (${completedNodeCount}/${String(workflowSummary.node_count ?? 0)}).`
      ),
    })
    .where(eq(workflowRuns.id, workflowRun.id))
    .run();

  insertProjectEvent({
    projectId: nodeRun.projectId,
    eventType: 'node_run_completed',
    targetType: 'node_run',
    targetId: nodeRunId,
    workflowRunId: nodeRun.workflowRunId,
    nodeRunId,
    payload: {
      node_id: nodeRun.nodeId,
      node_type: nodeRun.nodeType,
      position: nodeRun.position,
    },
  });

  return getNodeRunById(nodeRunId);
}

export function completeWorkflowRun(workflowRunId: string) {
  const workflowRun = getWorkflowRunRow(workflowRunId);

  if (!workflowRun) {
    return null;
  }

  const endedAt = new Date().toISOString();
  const summary = safeParseJson<Record<string, unknown>>(workflowRun.summaryJson, {});

  db.update(workflowRuns)
    .set({
      status: 'completed',
      endedAt,
      logsJson: appendStringLog(
        workflowRun.logsJson,
        `Workflow run completed with ${String(summary.completed_node_count ?? 0)} node(s).`
      ),
    })
    .where(eq(workflowRuns.id, workflowRunId))
    .run();

  insertProjectEvent({
    projectId: workflowRun.projectId,
    eventType: 'workflow_run_completed',
    targetType: 'workflow_run',
    targetId: workflowRunId,
    workflowRunId,
    payload: {
      workflow_version_id: workflowRun.workflowVersionId,
      node_count: summary.completed_node_count ?? 0,
    },
  });

  return getWorkflowRunById(workflowRunId);
}

export function failWorkflowRun(workflowRunId: string, errorMessage: string) {
  const workflowRun = getWorkflowRunRow(workflowRunId);

  if (!workflowRun) {
    return null;
  }

  const endedAt = new Date().toISOString();

  db.update(workflowRuns)
    .set({
      status: 'failed',
      endedAt,
      logsJson: appendStringLog(workflowRun.logsJson, `Workflow run failed: ${errorMessage}`),
      errorsJson: appendStringError(workflowRun.errorsJson, errorMessage),
    })
    .where(eq(workflowRuns.id, workflowRunId))
    .run();

  insertProjectEvent({
    projectId: workflowRun.projectId,
    eventType: 'workflow_run_failed',
    targetType: 'workflow_run',
    targetId: workflowRunId,
    workflowRunId,
    payload: {
      workflow_version_id: workflowRun.workflowVersionId,
      error: errorMessage,
    },
  });

  return getWorkflowRunById(workflowRunId);
}

export function listProjectWorkflowRuns(projectId: string, workflowVersionId?: string) {
  const conditions = [eq(workflowRuns.projectId, projectId)];

  if (workflowVersionId) {
    conditions.push(eq(workflowRuns.workflowVersionId, workflowVersionId));
  }

  return db
    .select()
    .from(workflowRuns)
    .where(and(...conditions))
    .orderBy(desc(workflowRuns.createdAt))
    .all()
    .map(mapWorkflowRun);
}

export function getWorkflowRunById(workflowRunId: string) {
  const row = getWorkflowRunRow(workflowRunId);
  return row ? mapWorkflowRun(row) : null;
}

export function listNodeRuns(workflowRunId: string) {
  return db
    .select()
    .from(nodeRuns)
    .where(eq(nodeRuns.workflowRunId, workflowRunId))
    .orderBy(asc(nodeRuns.position))
    .all()
    .map(mapNodeRun);
}

export function getNodeRunById(nodeRunId: string) {
  const row = getNodeRunRow(nodeRunId);
  return row ? mapNodeRun(row) : null;
}

export function emitWorkflowRunProgress(
  projectId: string,
  workflowRunId: string,
  progress: number,
  currentNodeId?: string,
  currentNodeType?: string
) {
  insertProjectEvent({
    projectId,
    eventType: 'workflow_run_progress',
    targetType: 'workflow_run',
    targetId: workflowRunId,
    workflowRunId,
    payload: {
      progress,
      current_node_id: currentNodeId,
      current_node_type: currentNodeType,
    },
  });
}

interface RecoverableRun {
  id: string;
  workflow_version_id: string;
  project_id: string;
  status: string;
  started_at: string | null;
}

export function findStaleWorkflowRuns(): RecoverableRun[] {
  return db
    .select({
      id: workflowRuns.id,
      workflow_version_id: workflowRuns.workflowVersionId,
      project_id: workflowRuns.projectId,
      status: workflowRuns.status,
      started_at: workflowRuns.startedAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.status, 'running'))
    .all();
}

export function findStaleNodeRuns(workflowRunId: string): Array<{
  id: string;
  workflow_run_id: string;
  node_id: string;
  node_type: string;
}> {
  return db
    .select({
      id: nodeRuns.id,
      workflow_run_id: nodeRuns.workflowRunId,
      node_id: nodeRuns.nodeId,
      node_type: nodeRuns.nodeType,
    })
    .from(nodeRuns)
    .where(eq(nodeRuns.workflowRunId, workflowRunId))
    .all();
}

export function recoverStaleWorkflowRun(runId: string, reason: string) {
  const timestamp = new Date().toISOString();

  db.update(workflowRuns)
    .set({
      status: 'failed',
      endedAt: timestamp,
      logsJson: appendStringLog(
        db
          .select({ logsJson: workflowRuns.logsJson })
          .from(workflowRuns)
          .where(eq(workflowRuns.id, runId))
          .get()?.logsJson ?? '[]',
        `Workflow run recovered after server restart: ${reason}`
      ),
      errorsJson: appendStringError(
        db
          .select({ errorsJson: workflowRuns.errorsJson })
          .from(workflowRuns)
          .where(eq(workflowRuns.id, runId))
          .get()?.errorsJson ?? '[]',
        `Recovered: ${reason}`
      ),
    })
    .where(eq(workflowRuns.id, runId))
    .run();
}

interface CreateAssetFromNodeOutputInput {
  project_id: string;
  workflow_run_id: string;
  node_run_id: string;
  node_type: string;
  output: Record<string, unknown>;
}

export function createAssetFromNodeOutput(input: CreateAssetFromNodeOutputInput) {
  const timestamp = new Date().toISOString();
  const { project_id, workflow_run_id, node_run_id, node_type, output } = input;

  const assetTypeMap: Record<string, { type: string; category: string }> = {
    llm_text: { type: 'generated_text', category: 'story' },
    llm: { type: 'generated_text', category: 'story' },
    tts: { type: 'narration_audio', category: 'audio' },
    text_to_speech: { type: 'narration_audio', category: 'audio' },
    image: { type: 'generated_image', category: 'visual' },
    image_generation: { type: 'generated_image', category: 'visual' },
    generate_image: { type: 'generated_image', category: 'visual' },
    video: { type: 'generated_video', category: 'visual' },
    video_generation: { type: 'generated_video', category: 'visual' },
    generate_video: { type: 'generated_video', category: 'visual' },
  };

  const assetInfo = assetTypeMap[node_type];
  if (!assetInfo) {
    return null;
  }

  const assetId = randomUUID();
  const versionId = randomUUID();

  db.insert(assets)
    .values({
      id: assetId,
      projectId: project_id,
      assetType: assetInfo.type,
      assetCategory: assetInfo.category,
      title: (output.title as string) ?? `${node_type} output`,
      currentVersionNumber: 1,
      currentAssetVersionId: versionId,
      status: 'ready',
      approvalState: 'unapproved',
      createdBy: 'workflow',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  db.insert(assetVersions)
    .values({
      id: versionId,
      assetId,
      projectId: project_id,
      versionNumber: 1,
      previousVersionId: null,
      parentAssetId: null,
      status: 'ready',
      approvalState: 'unapproved',
      sourceMode: 'workflow',
      workflowRunId: workflow_run_id,
      nodeRunId: node_run_id,
      contentJson: JSON.stringify(output),
      metadataJson: JSON.stringify({
        node_type,
      }),
      createdBy: 'workflow',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  insertProjectEvent({
    projectId: project_id,
    eventType: 'asset_created_from_workflow',
    targetType: 'asset',
    targetId: assetId,
    workflowRunId: workflow_run_id,
    nodeRunId: node_run_id,
    payload: {
      asset_id: assetId,
      asset_version_id: versionId,
      node_type,
      source_workflow_run_id: workflow_run_id,
    },
  });

  return {
    asset_id: assetId,
    asset_version_id: versionId,
  };
}
