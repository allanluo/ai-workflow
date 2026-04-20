import { createHash } from 'node:crypto';
import {
  getAssetById,
  getCopilotVectorIndexStatus,
  getNodeRunById,
  getWorkflowRunById,
  getWorkflowDefinitionById,
  listNodeRuns,
  searchCopilotVectorIndex,
  upsertCopilotVectorIndexItem,
  deleteCopilotVectorIndexForItem,
} from '@ai-workflow/database';
import { embedTextWithFallback } from '../services/llmEmbeddings.js';

type IndexableAsset = {
  id: string;
  project_id: string;
  asset_type?: string;
  title?: string | null;
  status?: string;
  updated_at?: string;
  current_version_id?: string | null;
  current_version?: { id: string; updated_at?: string; content?: unknown } | null;
  current_approved_version?: { id: string; updated_at?: string; content?: unknown } | null;
};

type IndexableWorkflow = {
  id: string;
  project_id: string;
  title?: string;
  description?: string;
  status?: string;
  updated_at?: string;
  current_version_id?: string | null;
  nodes?: unknown[];
  edges?: unknown[];
};

type IndexableWorkflowRun = {
  id: string;
  workflow_version_id: string;
  project_id: string;
  status: string;
  trigger_source?: string;
  started_at?: string;
  ended_at?: string | null;
  resolved_input_snapshot?: unknown;
  summary?: unknown;
  logs?: unknown;
  warnings?: unknown;
  errors?: unknown;
  created_at?: string;
};

type IndexableNodeRun = {
  id: string;
  workflow_run_id: string;
  workflow_version_id: string;
  project_id: string;
  node_id: string;
  node_type: string;
  status: string;
  position?: number;
  started_at?: string;
  ended_at?: string | null;
  input_snapshot?: unknown;
  output_snapshot?: unknown;
  logs?: unknown;
  warnings?: unknown;
  errors?: unknown;
  created_at?: string;
  updated_at?: string;
};

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function normalize(vec: number[]) {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) sum += (vec[i] ?? 0) * (vec[i] ?? 0);
  const norm = Math.sqrt(sum) || 1;
  return vec.map(v => (v ?? 0) / norm);
}

function assetTextForEmbedding(asset: IndexableAsset) {
  const title = typeof asset?.title === 'string' ? asset.title : '';
  const type = typeof asset?.asset_type === 'string' ? asset.asset_type : '';
  const content = asset?.current_version?.content ?? asset?.current_approved_version?.content ?? {};
  const body =
    typeof content === 'string'
      ? content
      : JSON.stringify(content ?? {}, null, 0);
  return `${type}\n${title}\n${body}`.slice(0, 12000);
}

function workflowTextForEmbedding(workflow: IndexableWorkflow) {
  const title = typeof workflow?.title === 'string' ? workflow.title : '';
  const desc = typeof workflow?.description === 'string' ? workflow.description : '';
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
  const graph = nodes.length || edges.length ? `\nNODES:${JSON.stringify(nodes)}\nEDGES:${JSON.stringify(edges)}` : '';
  return `${title}\n${desc}${graph}`.slice(0, 12000);
}

function chunkTextByChars(input: string, opts?: { maxChars?: number; overlapChars?: number; maxChunks?: number }) {
  const maxChars = Math.max(200, Math.min(6000, opts?.maxChars ?? 1400));
  const overlap = Math.max(0, Math.min(Math.floor(maxChars / 2), opts?.overlapChars ?? 200));
  const maxChunks = Math.max(1, Math.min(200, opts?.maxChunks ?? 24));
  const text = (input || '').trim();
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < maxChunks) {
    const end = Math.min(text.length, start + maxChars);
    let slice = text.slice(start, end);

    // Try to cut at a nearby newline boundary for nicer chunks.
    const lastNl = slice.lastIndexOf('\n');
    if (lastNl > Math.floor(maxChars * 0.6)) {
      slice = slice.slice(0, lastNl);
    }

    chunks.push(slice.trim());
    if (end >= text.length) break;
    start = Math.max(0, start + (slice.length || maxChars) - overlap);
  }

  return chunks.filter(Boolean);
}

function chunkAssetContent(asset: IndexableAsset) {
  const content = asset?.current_version?.content ?? asset?.current_approved_version?.content ?? {};

  // Scene list: chunk per scene.
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const maybeScenes = (content as any).scenes;
    if (Array.isArray(maybeScenes) && maybeScenes.length > 0) {
      const scenes = maybeScenes
        .map((s: any, idx: number) => {
          const title = typeof s?.title === 'string' ? s.title : `Scene ${idx + 1}`;
          const body = JSON.stringify(s ?? {}, null, 0);
          return { id: `scene:${idx}`, text: `SCENE: ${title}\n${body}`.slice(0, 8000) };
        })
        .filter(s => s.text.trim().length > 0);
      if (scenes.length > 1) return scenes;
    }

    // Shot plan-ish: chunk per shot if a top-level `shots` exists.
    const maybeShots = (content as any).shots;
    if (Array.isArray(maybeShots) && maybeShots.length > 0) {
      const shots = maybeShots
        .map((s: any, idx: number) => {
          const title =
            typeof s?.title === 'string'
              ? s.title
              : typeof s?.name === 'string'
                ? s.name
                : `Shot ${idx + 1}`;
          const body = JSON.stringify(s ?? {}, null, 0);
          return { id: `shot:${idx}`, text: `SHOT: ${title}\n${body}`.slice(0, 6000) };
        })
        .filter(s => s.text.trim().length > 0);
      if (shots.length > 4) return shots.slice(0, 60);
    }
  }

  // Generic fallback: chunk the full embedded text.
  const full = assetTextForEmbedding(asset);
  const chunks = chunkTextByChars(full, { maxChars: 1400, overlapChars: 200, maxChunks: 24 });
  return chunks.map((t, i) => ({ id: `chunk:${i}`, text: t }));
}

function chunkWorkflowContent(workflow: IndexableWorkflow) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  if (nodes.length > 0) {
    const perNode = nodes
      .map((n: any, idx: number) => {
        const nodeId = typeof n?.id === 'string' ? n.id : `node_${idx + 1}`;
        const nodeType = typeof n?.type === 'string' ? n.type : '';
        const params = n?.params ?? {};
        const body = JSON.stringify({ id: nodeId, type: nodeType, params }, null, 0);
        return { id: `node:${nodeId}`, text: `WORKFLOW_NODE: ${nodeId}${nodeType ? ` (${nodeType})` : ''}\n${body}`.slice(0, 6000) };
      })
      .filter(x => x.text.trim().length > 0);
    if (perNode.length > 1) return perNode.slice(0, 80);
  }

  const full = workflowTextForEmbedding(workflow);
  const chunks = chunkTextByChars(full, { maxChars: 1400, overlapChars: 200, maxChunks: 24 });
  return chunks.map((t, i) => ({ id: `chunk:${i}`, text: t }));
}

function stringifyJson(value: unknown) {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value ?? {}, null, 0);
  } catch {
    return '';
  }
}

function runTextForEmbedding(run: IndexableWorkflowRun) {
  const header = [
    `WORKFLOW_RUN: ${run.id}`,
    `status: ${run.status}`,
    run.trigger_source ? `trigger_source: ${run.trigger_source}` : '',
    run.started_at ? `started_at: ${run.started_at}` : '',
    run.ended_at ? `ended_at: ${run.ended_at}` : '',
    `workflow_version_id: ${run.workflow_version_id}`,
  ]
    .filter(Boolean)
    .join('\n');

  const summary = stringifyJson(run.summary ?? {});
  const errors = stringifyJson(run.errors ?? []);
  const warnings = stringifyJson(run.warnings ?? []);
  const logs = stringifyJson(run.logs ?? []);
  const resolved = stringifyJson(run.resolved_input_snapshot ?? {});

  // Keep run bodies smaller since node runs are indexed separately.
  const body = [
    'SUMMARY:',
    summary.slice(0, 4000),
    'ERRORS:',
    errors.slice(0, 3000),
    'WARNINGS:',
    warnings.slice(0, 2000),
    'LOGS:',
    logs.slice(0, 3000),
    'INPUT_SNAPSHOT:',
    resolved.slice(0, 2000),
  ].join('\n');

  return `${header}\n${body}`.slice(0, 12000);
}

function nodeRunTextForEmbedding(node: IndexableNodeRun) {
  const header = [
    `NODE_RUN: ${node.id}`,
    `node_id: ${node.node_id}`,
    `node_type: ${node.node_type}`,
    `status: ${node.status}`,
    node.position !== undefined ? `position: ${node.position}` : '',
    node.started_at ? `started_at: ${node.started_at}` : '',
    node.ended_at ? `ended_at: ${node.ended_at}` : '',
    `workflow_run_id: ${node.workflow_run_id}`,
    `workflow_version_id: ${node.workflow_version_id}`,
  ]
    .filter(Boolean)
    .join('\n');

  const errors = stringifyJson(node.errors ?? []);
  const warnings = stringifyJson(node.warnings ?? []);
  const logs = stringifyJson(node.logs ?? []);
  const input = stringifyJson(node.input_snapshot ?? {});
  const output = stringifyJson(node.output_snapshot ?? {});

  const body = [
    'ERRORS:',
    errors.slice(0, 3000),
    'WARNINGS:',
    warnings.slice(0, 2000),
    'LOGS:',
    logs.slice(0, 3000),
    'INPUT:',
    input.slice(0, 3000),
    'OUTPUT:',
    output.slice(0, 4000),
  ].join('\n');

  return `${header}\n${body}`.slice(0, 14000);
}

function chunkRunContent(run: IndexableWorkflowRun) {
  const full = runTextForEmbedding(run);
  const chunks = chunkTextByChars(full, { maxChars: 1600, overlapChars: 200, maxChunks: 20 });
  return chunks.map((t, i) => ({ id: `chunk:${i}`, text: t }));
}

function chunkNodeRunContent(node: IndexableNodeRun) {
  const full = nodeRunTextForEmbedding(node);
  const chunks = chunkTextByChars(full, { maxChars: 1600, overlapChars: 200, maxChunks: 20 });
  return chunks.map((t, i) => ({ id: `chunk:${i}`, text: t }));
}

async function embedText(input: { model?: string; text: string; allowFallback: boolean }) {
  return await embedTextWithFallback({
    text: input.text,
    model: input.model,
    allowFallback: input.allowFallback,
  });
}

export async function indexCopilotAsset(input: {
  assetId: string;
  model?: string;
}) {
  const asset = getAssetById(input.assetId) as any as IndexableAsset | null;
  if (!asset) throw new Error('Asset not found');

  const requestedModel = (input.model || process.env.DEFAULT_EMBEDDING_MODEL || '').trim();

  if ((asset.status ?? '') === 'deprecated') {
    deleteCopilotVectorIndexForItem({
      projectId: asset.project_id,
      contextType: 'asset',
      itemId: asset.id,
    });
    return { ok: true, indexed: false, reason: 'deprecated' as const };
  }

  const sourceUpdatedAt = String(
    asset.current_version_id ?? asset.current_version?.updated_at ?? asset.updated_at ?? ''
  );
  const itemVersionId = asset.current_version_id ?? asset.current_version?.id ?? null;

  // If the caller doesn't specify a model, clear all models for the item (so switching DEFAULT_EMBEDDING_MODEL works).
  deleteCopilotVectorIndexForItem({
    projectId: asset.project_id,
    contextType: 'asset',
    itemId: asset.id,
    model: input.model ? requestedModel : undefined,
  });

  const chunksRaw = chunkAssetContent(asset);
  const chunks = chunksRaw.length ? chunksRaw : [{ id: 'chunk:0', text: assetTextForEmbedding(asset) }];
  const chunkCount = Math.max(1, chunks.length);
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]!;
    const content = chunk.text;
    const { model: usedModel, embedding: rawEmb } = await embedText({
      model: requestedModel || undefined,
      text: content,
      allowFallback: !input.model,
    });
    const embedding = normalize(rawEmb);
    const contentHash = sha256(`${usedModel}\n${content}`);
    const chunkId = chunk.id || `chunk:${i}`;
    const id = `${asset.project_id}:asset:${asset.id}:${usedModel}:${chunkId}`;

    upsertCopilotVectorIndexItem({
      id,
      projectId: asset.project_id,
      contextType: 'asset',
      itemId: asset.id,
      itemVersionId,
      chunkId,
      chunkIndex: i,
      chunkCount,
      model: usedModel,
      embedding,
      content,
      contentHash,
      sourceUpdatedAt,
    });
  }

  return { ok: true, indexed: true, id: `${asset.project_id}:asset:${asset.id}` };
}

export async function indexCopilotWorkflow(input: {
  workflowId: string;
  model?: string;
}) {
  const workflow = getWorkflowDefinitionById(input.workflowId) as any as IndexableWorkflow | null;
  if (!workflow) throw new Error('Workflow not found');

  const requestedModel = (input.model || process.env.DEFAULT_EMBEDDING_MODEL || '').trim();

  if ((workflow.status ?? '') === 'deprecated') {
    deleteCopilotVectorIndexForItem({
      projectId: workflow.project_id,
      contextType: 'workflow',
      itemId: workflow.id,
    });
    return { ok: true, indexed: false, reason: 'deprecated' as const };
  }

  const sourceUpdatedAt = String(workflow.current_version_id ?? workflow.updated_at ?? '');
  const itemVersionId = workflow.current_version_id ?? null;

  deleteCopilotVectorIndexForItem({
    projectId: workflow.project_id,
    contextType: 'workflow',
    itemId: workflow.id,
    model: input.model ? requestedModel : undefined,
  });

  const chunksRaw = chunkWorkflowContent(workflow);
  const chunks = chunksRaw.length ? chunksRaw : [{ id: 'chunk:0', text: workflowTextForEmbedding(workflow) }];
  const chunkCount = Math.max(1, chunks.length);
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]!;
    const content = chunk.text;
    const { model: usedModel, embedding: rawEmb } = await embedText({
      model: requestedModel || undefined,
      text: content,
      allowFallback: !input.model,
    });
    const embedding = normalize(rawEmb);
    const contentHash = sha256(`${usedModel}\n${content}`);
    const chunkId = chunk.id || `chunk:${i}`;
    const id = `${workflow.project_id}:workflow:${workflow.id}:${usedModel}:${chunkId}`;

    upsertCopilotVectorIndexItem({
      id,
      projectId: workflow.project_id,
      contextType: 'workflow',
      itemId: workflow.id,
      itemVersionId,
      chunkId,
      chunkIndex: i,
      chunkCount,
      model: usedModel,
      embedding,
      content,
      contentHash,
      sourceUpdatedAt,
    });
  }

  return { ok: true, indexed: true, id: `${workflow.project_id}:workflow:${workflow.id}` };
}

export async function indexCopilotWorkflowRun(input: { workflowRunId: string; model?: string }) {
  const run = getWorkflowRunById(input.workflowRunId) as any as IndexableWorkflowRun | null;
  if (!run) throw new Error('Workflow run not found');

  const requestedModel = (input.model || process.env.DEFAULT_EMBEDDING_MODEL || '').trim();

  deleteCopilotVectorIndexForItem({
    projectId: run.project_id,
    contextType: 'run',
    itemId: run.id,
    model: input.model ? requestedModel : undefined,
  });

  const sourceUpdatedAt = String(run.ended_at ?? run.started_at ?? run.created_at ?? '');
  const itemVersionId = run.workflow_version_id ?? null;

  const chunksRaw = chunkRunContent(run);
  const chunks = chunksRaw.length ? chunksRaw : [{ id: 'chunk:0', text: runTextForEmbedding(run) }];
  const chunkCount = Math.max(1, chunks.length);

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]!;
    const content = chunk.text;
    const { model: usedModel, embedding: rawEmb } = await embedText({
      model: requestedModel || undefined,
      text: content,
      allowFallback: !input.model,
    });
    const embedding = normalize(rawEmb);
    const contentHash = sha256(`${usedModel}\n${content}`);
    const chunkId = chunk.id || `chunk:${i}`;
    const id = `${run.project_id}:run:${run.id}:${usedModel}:${chunkId}`;

    upsertCopilotVectorIndexItem({
      id,
      projectId: run.project_id,
      contextType: 'run',
      itemId: run.id,
      itemVersionId,
      chunkId,
      chunkIndex: i,
      chunkCount,
      model: usedModel,
      embedding,
      content,
      contentHash,
      sourceUpdatedAt,
    });
  }

  return { ok: true, indexed: true, id: `${run.project_id}:run:${run.id}` };
}

export async function indexCopilotNodeRun(input: { nodeRunId: string; model?: string }) {
  const node = getNodeRunById(input.nodeRunId) as any as IndexableNodeRun | null;
  if (!node) throw new Error('Node run not found');

  const requestedModel = (input.model || process.env.DEFAULT_EMBEDDING_MODEL || '').trim();

  deleteCopilotVectorIndexForItem({
    projectId: node.project_id,
    contextType: 'node_run',
    itemId: node.id,
    model: input.model ? requestedModel : undefined,
  });

  const sourceUpdatedAt = String(node.updated_at ?? node.ended_at ?? node.started_at ?? node.created_at ?? '');
  const itemVersionId = node.workflow_version_id ?? null;

  const chunksRaw = chunkNodeRunContent(node);
  const chunks = chunksRaw.length ? chunksRaw : [{ id: 'chunk:0', text: nodeRunTextForEmbedding(node) }];
  const chunkCount = Math.max(1, chunks.length);

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]!;
    const content = chunk.text;
    const { model: usedModel, embedding: rawEmb } = await embedText({
      model: requestedModel || undefined,
      text: content,
      allowFallback: !input.model,
    });
    const embedding = normalize(rawEmb);
    const contentHash = sha256(`${usedModel}\n${content}`);
    const chunkId = chunk.id || `chunk:${i}`;
    const id = `${node.project_id}:node_run:${node.id}:${usedModel}:${chunkId}`;

    upsertCopilotVectorIndexItem({
      id,
      projectId: node.project_id,
      contextType: 'node_run',
      itemId: node.id,
      itemVersionId,
      chunkId,
      chunkIndex: i,
      chunkCount,
      model: usedModel,
      embedding,
      content,
      contentHash,
      sourceUpdatedAt,
    });
  }

  return { ok: true, indexed: true, id: `${node.project_id}:node_run:${node.id}` };
}

// Convenience: reindex all node runs for a workflow run.
export async function indexCopilotNodeRunsForWorkflowRun(input: {
  workflowRunId: string;
  model?: string;
  maxNodeRuns?: number;
}) {
  const nodes = listNodeRuns(input.workflowRunId) as any as IndexableNodeRun[];
  const maxNodeRuns = typeof input.maxNodeRuns === 'number' ? Math.max(1, Math.min(500, input.maxNodeRuns)) : 250;
  const selected = nodes.slice(0, maxNodeRuns);
  for (const n of selected) {
    if (!n?.id) continue;
    await indexCopilotNodeRun({ nodeRunId: String(n.id), model: input.model });
  }
  return { ok: true, indexed: selected.length };
}

export async function searchCopilotSemanticIndex(input: {
  projectId: string;
  query: string;
  model?: string;
  contextTypes?: string[];
  limit?: number;
}) {
  const q = (input.query || '').trim();
  if (!q) return { items: [], model: (input.model || process.env.DEFAULT_EMBEDDING_MODEL || '').trim() };

  const status = getCopilotVectorIndexStatus({ projectId: input.projectId });
  const modelCounts = status?.models ?? {};
  const indexedModels = Object.entries(modelCounts)
    .sort((a, b) => (b[1]?.total ?? 0) - (a[1]?.total ?? 0))
    .map(([m]) => m)
    .filter(Boolean);

  const preferredCandidates = [
    (input.model || '').trim(),
    (process.env.DEFAULT_EMBEDDING_MODEL || '').trim(),
    ...indexedModels,
  ].filter(Boolean);

  const tried: string[] = [];
  for (const candidate of preferredCandidates) {
    if (tried.includes(candidate)) continue;
    tried.push(candidate);
    if (status.total > 0 && !modelCounts[candidate]) continue;
    try {
      const { embedding: rawEmb } = await embedText({ model: candidate, text: q, allowFallback: false });
      const queryEmbedding = normalize(rawEmb);
      const hits = searchCopilotVectorIndex({
        projectId: input.projectId,
        queryEmbedding,
        model: candidate,
        contextTypes: input.contextTypes,
        limit: input.limit,
      });
      return { ...hits, model: candidate };
    } catch {
      // try next
    }
  }

  // If the index is empty (or the preferred models failed), allow fallback to pick an embedding model.
  const { model: pickedModel, embedding: rawEmb } = await embedText({
    model: preferredCandidates[0],
    text: q,
    allowFallback: true,
  });
  const queryEmbedding = normalize(rawEmb);
  const hits = searchCopilotVectorIndex({
    projectId: input.projectId,
    queryEmbedding,
    model: pickedModel,
    contextTypes: input.contextTypes,
    limit: input.limit,
  });
  return { ...hits, model: pickedModel };
}
