import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  appendCopilotAuditEvents,
  getCopilotSession,
  getCopilotVectorIndexStatus,
  listCopilotAuditEvents,
  listAssets,
  listWorkflowDefinitions,
  listProjectWorkflowRuns,
  upsertCopilotSession,
} from '@ai-workflow/database';
import { applyCopilotProposal } from '../copilot/applyProposal.js';
import {
  indexCopilotAsset,
  indexCopilotWorkflow,
  indexCopilotWorkflowRun,
  indexCopilotNodeRunsForWorkflowRun,
  searchCopilotSemanticIndex,
} from '../copilot/vectorIndex.js';
import { embedTextWithFallback } from '../services/llmEmbeddings.js';

const saveSessionSchema = z.object({
  state: z.record(z.any()),
});

const appendAuditSchema = z.object({
  events: z.array(z.record(z.any())).min(1),
});

const semanticSearchSchema = z.object({
  query: z.string().min(1),
  model: z.string().optional(),
  context_types: z.array(z.string()).optional(),
  limit: z.coerce.number().optional(),
});

const reindexSchema = z.object({
  model: z.string().optional(),
  context_types: z.array(z.enum(['asset', 'workflow', 'run', 'node_run'])).optional(),
  max_runs: z.coerce.number().optional(),
  max_node_runs_per_run: z.coerce.number().optional(),
});

export async function registerCopilotRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/copilot/session', async request => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const session = getCopilotSession(params.projectId);
    return {
      ok: true,
      data: { session },
      error: null,
    };
  });

  app.put('/projects/:projectId/copilot/session', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = saveSessionSchema.parse(request.body);
    const session = upsertCopilotSession(params.projectId, body.state);
    reply.code(200);
    return {
      ok: true,
      data: { session },
      error: null,
    };
  });

  app.get('/projects/:projectId/copilot/audit', async request => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const query = z
      .object({
        limit: z.coerce.number().optional().default(200),
      })
      .parse(request.query);

    const items = listCopilotAuditEvents(params.projectId, query.limit);
    return {
      ok: true,
      data: { items },
      error: null,
    };
  });

  app.post('/projects/:projectId/copilot/audit', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = appendAuditSchema.parse(request.body);
    appendCopilotAuditEvents(params.projectId, body.events);
    reply.code(201);
    return {
      ok: true,
      data: { inserted: body.events.length },
      error: null,
    };
  });

  app.post('/projects/:projectId/copilot/apply-proposal', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = z
      .object({
        proposal: z.record(z.any()),
        confirmed: z.boolean().optional().default(false),
      })
      .parse(request.body);

    const result = await applyCopilotProposal({
      projectId: params.projectId,
      proposal: body.proposal as any,
      confirmed: body.confirmed,
    });

    if (!result.ok) {
      reply.code(400);
      return {
        ok: false,
        data: { result },
        error: { code: 'apply_failed', message: result.warning || 'Apply failed' },
      };
    }

    reply.code(200);
    return { ok: true, data: { result }, error: null };
  });

  app.post('/projects/:projectId/copilot/semantic-search', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = semanticSearchSchema.parse(request.body);

    try {
      const result = await searchCopilotSemanticIndex({
        projectId: params.projectId,
        query: body.query,
        model: body.model,
        contextTypes: body.context_types,
        limit: body.limit,
      });

      return { ok: true, data: result, error: null };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: { code: 'semantic_search_failed', message: err instanceof Error ? err.message : 'Semantic search failed' },
      };
    }
  });

  // Best-effort reindex (useful on first enablement, or after changing embedding model).
  app.post('/projects/:projectId/copilot/reindex', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    const body = reindexSchema.parse(request.body ?? {});

    type CopilotIndexContextType = 'asset' | 'workflow' | 'run' | 'node_run';
    const types: CopilotIndexContextType[] =
      body.context_types && body.context_types.length > 0 ? body.context_types : ['asset', 'workflow'];
    const model = body.model;
    const maxRuns = typeof body.max_runs === 'number' ? Math.max(1, Math.min(500, body.max_runs)) : 50;
    const maxNodeRunsPerRun =
      typeof body.max_node_runs_per_run === 'number'
        ? Math.max(1, Math.min(1000, body.max_node_runs_per_run))
        : 250;

    const assets = types.includes('asset') ? (listAssets(params.projectId, {}) as any[]) : [];
    const workflows = types.includes('workflow') ? (listWorkflowDefinitions(params.projectId) as any[]) : [];
    const runs = types.includes('run') || types.includes('node_run')
      ? (listProjectWorkflowRuns(params.projectId) as any[]).slice(0, maxRuns)
      : [];

    // Preflight embeddings so we fail fast with a helpful message instead of silently logging in the background.
    let pickedModel: string | null = null;
    try {
      const preflight = await embedTextWithFallback({
        text: 'ping',
        model: model ? String(model).trim() : undefined,
        allowFallback: !model,
      });
      pickedModel = preflight.model;
    } catch (err) {
      reply.code(400);
      return {
        ok: false,
        data: null,
        error: {
          code: 'embedding_not_configured',
          message: err instanceof Error ? err.message : 'Embeddings are not configured',
        },
      };
    }

    // Run in the background; do not block the UI.
    setTimeout(() => {
      void (async () => {
        for (const a of assets) {
          if (!a?.id) continue;
          try {
            await indexCopilotAsset({ assetId: String(a.id), model: model ? String(model) : undefined });
          } catch (err) {
            console.warn('[copilot-vector-index] asset index failed:', a.id, err);
          }
        }
        for (const w of workflows) {
          if (!w?.id) continue;
          try {
            await indexCopilotWorkflow({ workflowId: String(w.id), model: model ? String(model) : undefined });
          } catch (err) {
            console.warn('[copilot-vector-index] workflow index failed:', w.id, err);
          }
        }

        if (types.includes('run') || types.includes('node_run')) {
          for (const r of runs) {
            if (!r?.id) continue;
            const runId = String(r.id);
            if (types.includes('run')) {
              try {
                await indexCopilotWorkflowRun({ workflowRunId: runId, model: model ? String(model) : undefined });
              } catch (err) {
                console.warn('[copilot-vector-index] run index failed:', runId, err);
              }
            }
            if (types.includes('node_run')) {
              try {
                await indexCopilotNodeRunsForWorkflowRun({
                  workflowRunId: runId,
                  model: model ? String(model) : undefined,
                  maxNodeRuns: maxNodeRunsPerRun,
                });
              } catch (err) {
                console.warn('[copilot-vector-index] node_run index failed:', runId, err);
              }
            }
          }
        }
      })().catch(err => {
        console.warn('[copilot-vector-index] reindex failed:', err);
      });
    }, 0);

    reply.code(202);
    return {
      ok: true,
      data: {
        queued: assets.length + workflows.length + (runs.length || 0),
        model: model ?? null,
        picked_model: pickedModel,
        types,
        max_runs: maxRuns,
        max_node_runs_per_run: maxNodeRunsPerRun,
      },
      error: null,
    };
  });

  app.get('/projects/:projectId/copilot/index-status', async (request, reply) => {
    const params = z.object({ projectId: z.string() }).parse(request.params);
    try {
      const status = getCopilotVectorIndexStatus({ projectId: params.projectId });
      return { ok: true, data: status, error: null };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        data: null,
        error: { code: 'index_status_failed', message: err instanceof Error ? err.message : 'Index status failed' },
      };
    }
  });
}
