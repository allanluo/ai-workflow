import type { SkillContext } from '../types';
import { executeTool } from '../tools';
import type { CopilotContext, CopilotMessage, CopilotSelection } from './types';
import { cosineSim as cosineSimHashed, embedText as embedTextHashed, getCachedEmbedding } from './semanticRetrieval';
import { cosineSim, getOrCreateModelEmbedding } from './modelEmbeddingCache';

function stableHash(str: string) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

type BuildContextInput = {
  skillContext: SkillContext;
  selection: CopilotSelection;
  conversation?: CopilotMessage[];
  query?: string;
};

function pickLatestNonDeprecated<T extends { status?: string; updated_at?: string }>(items: T[]) {
  return (
    [...items]
      .filter(i => (i.status ?? '') !== 'deprecated')
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0] ??
    null
  );
}

function parseMentions(query: string): { assets: string[]; workflows: string[] } {
  const assets: string[] = [];
  const workflows: string[] = [];
  const mentionRegex = /@(\w+):(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(query)) !== null) {
    const type = match[1];
    const id = match[2];
    if (type === 'asset') assets.push(id);
    else if (type === 'workflow') workflows.push(id);
  }
  return { assets, workflows };
}

function keywordSearch(query: string, items: { id: string; title?: string; content?: unknown }[], maxResults = 5) {
  if (!query.trim()) return [];
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  if (!keywords.length) return [];

  const scored = items.map(item => {
    const title = (item.title || '').toLowerCase();
    const content = typeof item.content === 'string' ? item.content.toLowerCase() : JSON.stringify(item.content || {}).toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (title.includes(kw)) score += 10;
      if (content.includes(kw)) score += 1;
    }
    return { item, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map(s => s.item);
}

function keywordScore(query: string, item: { title?: string; content?: unknown }) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return 0;
  const keywords = q.split(/\s+/).filter(k => k.length > 2).slice(0, 20);
  if (!keywords.length) return 0;
  const title = (item.title || '').toLowerCase();
  const content = typeof item.content === 'string' ? item.content.toLowerCase() : JSON.stringify(item.content || {}).toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (title.includes(kw)) score += 10;
    if (content.includes(kw)) score += 1;
  }
  return score;
}

function assetTextForEmbedding(asset: any) {
  const title = typeof asset?.title === 'string' ? asset.title : '';
  const type = typeof asset?.asset_type === 'string' ? asset.asset_type : '';
  const content = asset?.current_version?.content ?? asset?.current_approved_version?.content ?? {};
  const body =
    typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 0);
  return `${type}\n${title}\n${body}`.slice(0, 12000);
}

function workflowTextForEmbedding(workflow: any) {
  const title = typeof workflow?.title === 'string' ? workflow.title : '';
  const desc = typeof workflow?.description === 'string' ? workflow.description : '';
  return `${title}\n${desc}`.slice(0, 12000);
}

function parseWorkflowRunIdFromNodeRunSnippet(content: string) {
  const m = (content || '').match(/workflow_run_id:\s*([a-f0-9-]{8,})/i);
  return m?.[1] ? String(m[1]).trim() : null;
}

export async function buildDeterministicCopilotContext(input: BuildContextInput): Promise<CopilotContext> {
  const { skillContext, selection, query = '' } = input;

  const [projectRes, assetsRes, workflowsRes, runsRes] = await Promise.all([
    executeTool('fetchProjectById', skillContext, {}),
    executeTool('fetchProjectAssets', skillContext, {}),
    executeTool('fetchProjectWorkflows', skillContext, {}),
    executeTool('fetchProjectWorkflowRuns', skillContext, {}),
  ]);

  const project = projectRes.ok ? (projectRes.data as any) : null;
  const assets = assetsRes.ok ? ((assetsRes.data as any[]) ?? []) : [];
  const workflows = workflowsRes.ok ? ((workflowsRes.data as any[]) ?? []) : [];
  const runs = runsRes.ok ? ((runsRes.data as any[]) ?? []) : [];

  // Pin versions for the focused items (MVP).
  const focusedAsset =
    selection.assetId && assets.length ? assets.find(a => a.id === selection.assetId) ?? null : null;
  const focusedShotPlan =
    selection.shotPlanAssetId && assets.length
      ? assets.find(a => a.id === selection.shotPlanAssetId) ?? null
      : null;
  const focusedWorkflow =
    selection.workflowId && workflows.length ? workflows.find(w => w.id === selection.workflowId) ?? null : null;

  const pinned = {
    assetVersionId: focusedAsset?.current_asset_version_id ?? null,
    shotPlanAssetVersionId: focusedShotPlan?.current_asset_version_id ?? null,
    workflowVersionId: (focusedWorkflow as any)?.current_version_id ?? null,
  };

  // Parse @mentions for explicit context
  const mentions = parseMentions(query);
  const mentionedAssets = assets.filter(a => mentions.assets.includes(a.id));
  const mentionedWorkflows = workflows.filter(w => mentions.workflows.includes(w.id));

  // Deterministic + keyword retrieval (early RAG):
  // - always include focused items
  // - include @mentioned items
  // - include latest canon, scenes batch, shot plan
  // - keyword + semantic ranking on assets/workflows
  const latestCanon = pickLatestNonDeprecated(assets.filter(a => a.asset_type === 'canon_text'));
  const latestScenes = pickLatestNonDeprecated(
    assets.filter(a => a.asset_type === 'scene').filter(a => {
      const c = a.current_version?.content as any;
      return Boolean(c && typeof c === 'object' && Array.isArray(c.scenes));
    })
  );
  const latestShotPlan = pickLatestNonDeprecated(assets.filter(a => a.asset_type === 'shot_plan'));

  const keywordAssets = keywordSearch(
    query,
    assets.map(a => ({ id: a.id, title: a.title, content: a.current_version?.content }))
  );
  const keywordWorkflows = keywordSearch(
    query,
    workflows.map(w => ({ id: w.id, title: w.title, content: w.description }))
  );

  // Prefer persistent semantic index (server-side embeddings) when available.
  const semanticRes = query.trim()
    ? await executeTool('semanticSearch', skillContext, {
        query,
        contextTypes: ['asset', 'workflow', 'run', 'node_run'],
        limit: 40,
        // Only pass an explicit embedding model when configured; otherwise let the backend default.
        model: (import.meta.env.VITE_COPILOT_EMBEDDING_MODEL as string | undefined) || undefined,
      })
    : null;
  const useSemanticIndex = Boolean(
    semanticRes &&
      semanticRes.ok &&
      Array.isArray((semanticRes.data as any)?.items) &&
      ((semanticRes.data as any).items as any[]).length > 0
  );
  const semanticAssetScores = new Map<string, number>();
  const semanticWorkflowScores = new Map<string, number>();
  const semanticRunScores = new Map<string, number>();
  const semanticNodeRunScores = new Map<string, number>();
  const semanticHitsForContext: Array<{ context_type: string; item_id: string; score: number; content: string }> = [];
  if (semanticRes && semanticRes.ok) {
    const items = ((semanticRes.data as any)?.items ?? []) as any[];
    for (const hit of items) {
      if (!hit || typeof hit !== 'object') continue;
      if (hit.context_type === 'asset' && typeof hit.item_id === 'string' && typeof hit.score === 'number') {
        const prev = semanticAssetScores.get(hit.item_id) ?? -Infinity;
        if (hit.score > prev) semanticAssetScores.set(hit.item_id, hit.score);
      }
      if (hit.context_type === 'workflow' && typeof hit.item_id === 'string' && typeof hit.score === 'number') {
        const prev = semanticWorkflowScores.get(hit.item_id) ?? -Infinity;
        if (hit.score > prev) semanticWorkflowScores.set(hit.item_id, hit.score);
      }
      if (hit.context_type === 'run' && typeof hit.item_id === 'string' && typeof hit.score === 'number') {
        const prev = semanticRunScores.get(hit.item_id) ?? -Infinity;
        if (hit.score > prev) semanticRunScores.set(hit.item_id, hit.score);
      }
      if (hit.context_type === 'node_run' && typeof hit.item_id === 'string' && typeof hit.score === 'number') {
        const prev = semanticNodeRunScores.get(hit.item_id) ?? -Infinity;
        if (hit.score > prev) semanticNodeRunScores.set(hit.item_id, hit.score);
        const runId = typeof hit.content === 'string' ? parseWorkflowRunIdFromNodeRunSnippet(hit.content) : null;
        if (runId) {
          const runPrev = semanticRunScores.get(runId) ?? -Infinity;
          // Treat strong node-run matches as evidence that the parent workflow run is relevant too.
          if (hit.score > runPrev) semanticRunScores.set(runId, hit.score * 0.98);
        }
      }
    }

    for (const hit of items) {
      if (!hit || typeof hit !== 'object') continue;
      if (typeof hit.context_type !== 'string' || typeof hit.item_id !== 'string' || typeof hit.score !== 'number') continue;
      if (typeof hit.content !== 'string' || !hit.content.trim()) continue;
      if (!['run', 'node_run'].includes(hit.context_type)) continue;
      semanticHitsForContext.push({
        context_type: hit.context_type,
        item_id: hit.item_id,
        score: hit.score,
        content: hit.content.slice(0, 900),
      });
      if (semanticHitsForContext.length >= 6) break;
    }
  }

  const mustAssets = [
    focusedAsset,
    focusedShotPlan,
    ...mentionedAssets,
    latestCanon,
    latestScenes,
    latestShotPlan,
  ].filter(Boolean) as any[];
  const mustAssetIds = new Set(mustAssets.map(a => a.id));

  // Legacy fallback: client-side embeddings (model or hashed) when semantic index isn't available.
  const embeddingModel =
    (import.meta.env.VITE_COPILOT_EMBEDDING_MODEL as string | undefined) ||
    (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
    undefined;
  const queryModelEmb =
    !useSemanticIndex && query.trim()
      ? await getOrCreateModelEmbedding({
          projectId: skillContext.projectId,
          key: `query:${stableHash(query)}`,
          updatedAt: 'query',
          model: embeddingModel,
          make: async () => {
            const res = await executeTool('embedText', skillContext, { text: query, model: embeddingModel });
            if (!res.ok) throw new Error(res.error.message);
            return (res.data as any).embedding as number[];
          },
        })
      : null;
  const useModelEmbeddings = Boolean(!useSemanticIndex && queryModelEmb && queryModelEmb.length > 0);
  const queryHashedEmb = !useSemanticIndex && !useModelEmbeddings ? embedTextHashed(query || '') : null;
  const embedCandidateAssetIds = new Set<string>([
    ...mustAssets.map(a => a.id),
    ...keywordAssets.map(a => a.id),
  ]);

  const scoredAssetsRaw = await Promise.all(
    assets
      .filter(a => (a.status ?? '') !== 'deprecated')
      .map(async a => {
        const updatedAt = String(a.current_asset_version_id ?? a.updated_at ?? '');
        let sem = 0;
        if (query.trim() && useSemanticIndex) {
          sem = semanticAssetScores.get(a.id) ?? 0;
        } else if (query.trim() && embedCandidateAssetIds.has(a.id)) {
          if (useModelEmbeddings) {
            const emb = await getOrCreateModelEmbedding({
              projectId: skillContext.projectId,
              key: `asset:${a.id}`,
              updatedAt,
              model: embeddingModel,
              make: async () => {
                const res = await executeTool('embedText', skillContext, {
                  text: assetTextForEmbedding(a),
                  model: embeddingModel,
                });
                if (!res.ok) throw new Error(res.error.message);
                return (res.data as any).embedding as number[];
              },
            });
            if (emb && queryModelEmb) sem = cosineSim(queryModelEmb, emb);
          } else if (queryHashedEmb) {
            const emb = getCachedEmbedding({
              projectId: skillContext.projectId,
              key: `asset:${a.id}`,
              updatedAt,
              text: assetTextForEmbedding(a),
            });
            sem = cosineSimHashed(queryHashedEmb, emb);
          }
        }
        const kw = keywordScore(query, { title: a.title, content: a.current_version?.content });
        let boost = 0;
        if (mustAssetIds.has(a.id)) boost += 100;
        if (a.id === selection.assetId) boost += 50;
        if (a.asset_type === 'canon_text') boost += 10;
        if (a.asset_type === 'scene') boost += 8;
        if (a.asset_type === 'shot_plan') boost += 8;
        return { a, score: boost + sem * 30 + kw * 0.8 };
      })
  );
  const scoredAssets = scoredAssetsRaw.sort((x, y) => y.score - x.score);

  const retrievedAssets = [
    ...mustAssets,
    ...scoredAssets.map(s => s.a).filter(a => !mustAssetIds.has(a.id)).slice(0, 12 - mustAssets.length),
  ];

  const mustWorkflows = [focusedWorkflow, ...mentionedWorkflows].filter(Boolean) as any[];
  const mustWorkflowIds = new Set(mustWorkflows.map(w => w.id));

  const embedCandidateWorkflowIds = new Set<string>([
    ...mustWorkflows.map(w => w.id),
    ...keywordWorkflows.map(w => w.id),
  ]);

  const scoredWorkflowsRaw = await Promise.all(
    workflows.map(async w => {
      const updatedAt = String((w as any)?.current_version_id ?? (w as any)?.updated_at ?? '');
      let sem = 0;
      if (query.trim() && useSemanticIndex) {
        sem = semanticWorkflowScores.get(w.id) ?? 0;
      } else if (query.trim() && embedCandidateWorkflowIds.has(w.id)) {
        if (useModelEmbeddings) {
            const emb = await getOrCreateModelEmbedding({
              projectId: skillContext.projectId,
              key: `workflow:${w.id}`,
              updatedAt,
              model: embeddingModel,
              make: async () => {
                const res = await executeTool('embedText', skillContext, {
                  text: workflowTextForEmbedding(w),
                  model: embeddingModel,
                });
                if (!res.ok) throw new Error(res.error.message);
                return (res.data as any).embedding as number[];
              },
            });
            if (emb && queryModelEmb) sem = cosineSim(queryModelEmb, emb);
          } else if (queryHashedEmb) {
            const emb = getCachedEmbedding({
              projectId: skillContext.projectId,
              key: `workflow:${w.id}`,
              updatedAt,
              text: workflowTextForEmbedding(w),
            });
            sem = cosineSimHashed(queryHashedEmb, emb);
          }
        }
        const kw = keywordScore(query, { title: w.title, content: w.description });
        let boost = 0;
      if (mustWorkflowIds.has(w.id)) boost += 100;
      if (w.id === selection.workflowId) boost += 50;
      return { w, score: boost + sem * 30 + kw * 0.8 };
    })
  );
  const scoredWorkflows = scoredWorkflowsRaw.sort((x, y) => y.score - x.score);

  const retrievedWorkflows = [
    ...mustWorkflows,
    ...scoredWorkflows.map(s => s.w).filter(w => !mustWorkflowIds.has(w.id)).slice(0, 8 - mustWorkflows.length),
  ];

  const conversation = input.conversation ?? [];

  return {
    project,
    assets,
    workflows,
    runs,
    selection,
    pinned,
    conversation,
    retrieval: {
      assets: [...new Map(retrievedAssets.map(a => [a.id, a])).values()],
      workflows: [...new Map(retrievedWorkflows.map(w => [w.id, w])).values()],
      runs: (useSemanticIndex
        ? [...runs].sort((a: any, b: any) => {
            const sa = semanticRunScores.get(String(a?.id ?? '')) ?? 0;
            const sb = semanticRunScores.get(String(b?.id ?? '')) ?? 0;
            if (sb !== sa) return sb - sa;
            return new Date(String(b?.created_at ?? b?.started_at ?? 0)).getTime() - new Date(String(a?.created_at ?? a?.started_at ?? 0)).getTime();
          })
        : runs
      ).slice(0, 10),
      ...(semanticHitsForContext.length ? { semantic_hits: semanticHitsForContext } : {}),
    },
  };
}
