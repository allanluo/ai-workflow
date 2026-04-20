import {
  cancelCopilotPlanRun,
  getCopilotPlanRunById,
  listCopilotPlanSteps,
  updateCopilotPlanRun,
  updateCopilotPlanStep,
  type CopilotPlanRunRecord,
} from '@ai-workflow/database';
import { startWorkflowRunInBackground } from '../runtime/execution-engine.js';
import {
  getProjectById,
  listAssets,
  getAssetById,
  listWorkflowDefinitions,
  listProjectWorkflowRuns,
  getWorkflowDefinitionById,
  listWorkflowVersions,
  listNodeRuns,
  createWorkflowRun,
  getWorkflowRunById,
} from '@ai-workflow/database';
import { generateImage, createVideo, createVideoFromImage, generateSpeech, generateSound, getJobStatus } from '../services/adapters.js';
import { config } from '../config.js';
import { applyCopilotProposal } from './applyProposal.js';
import { searchCopilotSemanticIndex } from './vectorIndex.js';

type ToolCategory = 'read' | 'write' | 'exec';

type ToolHandler = {
  category: ToolCategory;
  execute: (context: Record<string, unknown>, params: any, stepResults: Record<string, unknown>) => Promise<any>;
};

function getByPath(root: any, path: string[]) {
  let cur: any = root;
  for (const seg of path) {
    if (cur == null) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = cur[seg];
  }
  return cur;
}

function resolveTemplateExpression(exprRaw: string, context: any, stepResults: Record<string, unknown>) {
  const expr = (exprRaw || '').trim();
  const parts = expr.split('.').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  if (parts[0] === 'context') return getByPath(context, parts.slice(1));
  if (parts[0] === 'steps') {
    const stepId = parts[1];
    if (!stepId) return undefined;
    if (parts[2] !== 'result') return undefined;
    const base = stepResults[stepId];
    return getByPath(base as any, parts.slice(3));
  }
  return undefined;
}

function resolveTemplates(value: any, context: any, stepResults: Record<string, unknown>): any {
  if (typeof value === 'string') {
    const m = value.match(/^\{\{([\s\S]+)\}\}$/);
    if (!m) return value;
    return resolveTemplateExpression(m[1] ?? '', context, stepResults);
  }
  if (Array.isArray(value)) return value.map(v => resolveTemplates(v, context, stepResults));
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTemplates(v, context, stepResults);
    return out;
  }
  return value;
}

const toolHandlers: Record<string, ToolHandler> = {
  fetchProjectById: {
    category: 'read',
    execute: async (ctx) => {
      const projectId = String(ctx.projectId ?? '');
      const project = getProjectById(projectId);
      if (!project) throw new Error('Project not found');
      return project;
    },
  },
  fetchProjectAssets: {
    category: 'read',
    execute: async (ctx, params) => {
      const projectId = String(ctx.projectId ?? '');
      const assetType = params?.assetType ? String(params.assetType) : undefined;
      return listAssets(projectId, assetType ? { asset_type: assetType } : {});
    },
  },
  searchAssets: {
    category: 'read',
    execute: async (ctx, params) => {
      const projectId = String(ctx.projectId ?? '');
      const query = String(params?.query ?? '').trim().toLowerCase();
      if (!query) throw new Error('Missing query');
      const assetType = params?.assetType ? String(params.assetType) : undefined;
      const limit = typeof params?.limit === 'number' ? Math.max(1, Math.min(50, params.limit)) : 10;
      const terms = query.split(/\s+/).filter(Boolean).slice(0, 8);
      const assets = listAssets(projectId, assetType ? { asset_type: assetType } : {}) as any[];

      const stringify = (v: any) => {
        try {
          if (typeof v === 'string') return v;
          return JSON.stringify(v ?? {});
        } catch {
          return '';
        }
      };

      const scored = (assets ?? [])
        .filter(a => a && typeof a === 'object' && typeof a.id === 'string')
        .map(a => {
          const title = typeof a.title === 'string' ? a.title : '';
          const contentStr = stringify(a.current_version?.content);
          const hay = `${title}\n${contentStr}`.toLowerCase();
          const titleLower = title.toLowerCase();
          let score = 0;
          for (const t of terms) {
            if (!t) continue;
            if (hay.includes(t)) score += 1;
            if (titleLower.includes(t)) score += 0.5;
          }
          return { a, score };
        })
        .filter(x => x.score > 0)
        .sort((x, y) => {
          if (y.score !== x.score) return y.score - x.score;
          return new Date(y.a.updated_at ?? 0).getTime() - new Date(x.a.updated_at ?? 0).getTime();
        })
        .slice(0, limit)
        .map(x => ({
          id: x.a.id,
          asset_type: x.a.asset_type,
          title: x.a.title ?? null,
          updated_at: x.a.updated_at,
          score: x.score,
        }));

      return { items: scored };
    },
  },
  semanticSearch: {
    category: 'read',
    execute: async (ctx, params) => {
      const projectId = String(ctx.projectId ?? '');
      const query = String(params?.query ?? '').trim();
      if (!query) throw new Error('Missing query');
      const model = params?.model ? String(params.model) : undefined;
      const contextTypes = Array.isArray(params?.contextTypes)
        ? params.contextTypes.map((t: any) => String(t)).filter(Boolean)
        : undefined;
      const limit = typeof params?.limit === 'number' ? Math.max(1, Math.min(50, params.limit)) : undefined;
      return await searchCopilotSemanticIndex({ projectId, query, model, contextTypes, limit });
    },
  },
  findAssetsProducedByWorkflowRun: {
    category: 'read',
    execute: async (ctx, params) => {
      const projectId = String(ctx.projectId ?? '');
      const workflowRunId = String(params?.workflowRunId ?? '');
      if (!workflowRunId) throw new Error('Missing workflowRunId');
      const assetType = params?.assetType ? String(params.assetType) : undefined;
      const limit = typeof params?.limit === 'number' ? Math.max(1, Math.min(50, params.limit)) : 10;
      const requireNonEmpty = Boolean(params?.requireNonEmpty);

      const assets = listAssets(projectId, assetType ? { asset_type: assetType } : {}) as any[];
      const items = (assets ?? [])
        .filter(a => a && typeof a === 'object' && typeof a.id === 'string')
        .filter(a => {
          const cv = a.current_version;
          const runId = cv?.workflow_run_id ?? cv?.workflowRunId ?? null;
          return typeof runId === 'string' && runId === workflowRunId;
        })
        .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
        .slice(0, limit)
        .map(a => ({
          id: a.id,
          asset_type: a.asset_type,
          title: a.title ?? null,
          updated_at: a.updated_at,
        }));

      if (requireNonEmpty && items.length === 0) {
        const typeHint = assetType ? ` (${assetType})` : '';
        throw new Error(
          `No assets${typeHint} were produced by workflow run ${workflowRunId.slice(0, 8)}…. Check the workflow outputs and try again.`
        );
      }

      return { items };
    },
  },
  fetchAsset: {
    category: 'read',
    execute: async (_ctx, params) => {
      const assetId = String(params?.assetId ?? '');
      const asset = getAssetById(assetId);
      if (!asset) throw new Error('Asset not found');
      return asset;
    },
  },
  fetchProjectWorkflows: {
    category: 'read',
    execute: async (ctx) => {
      const projectId = String(ctx.projectId ?? '');
      return listWorkflowDefinitions(projectId);
    },
  },
  pickWorkflowByNodeType: {
    category: 'read',
    execute: async (ctx, params) => {
      const projectId = String(ctx.projectId ?? '');
      const nodeType = String(params?.nodeType ?? '');
      if (!nodeType) throw new Error('Missing nodeType');
      const workflows = listWorkflowDefinitions(projectId) as any[];
      const candidates = (workflows ?? [])
        .filter(w => w && typeof w === 'object' && typeof w.id === 'string')
        .filter(w => {
          const nodes = Array.isArray(w.nodes) ? w.nodes : [];
          return nodes.some((n: any) => n && typeof n === 'object' && n.type === nodeType);
        })
        .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());
      const picked = candidates[0] ?? null;
      if (!picked) {
        return {
          found: false,
          reason: `No workflow found containing node type "${nodeType}". Create or select a workflow first.`,
        };
      }
      return {
        found: true,
        workflowId: picked.id,
        workflowVersionId: picked.current_version_id ?? null,
        workflowTitle: typeof picked.title === 'string' ? picked.title : undefined,
      };
    },
  },
  fetchProjectWorkflowRuns: {
    category: 'read',
    execute: async (ctx, params) => {
      const projectId = String(ctx.projectId ?? '');
      const workflowVersionId = params?.workflowVersionId ? String(params.workflowVersionId) : undefined;
      return listProjectWorkflowRuns(projectId, workflowVersionId);
    },
  },
  fetchWorkflowById: {
    category: 'read',
    execute: async (_ctx, params) => {
      const workflowId = String(params?.workflowId ?? '');
      const wf = getWorkflowDefinitionById(workflowId);
      if (!wf) throw new Error('Workflow not found');
      return wf;
    },
  },
  fetchWorkflowVersions: {
    category: 'read',
    execute: async (_ctx, params) => {
      const workflowId = String(params?.workflowId ?? '');
      return listWorkflowVersions(workflowId);
    },
  },
  fetchNodeRuns: {
    category: 'read',
    execute: async (_ctx, params) => {
      const workflowRunId = String(params?.workflowRunId ?? '');
      return listNodeRuns(workflowRunId);
    },
  },
  fetchJobStatus: {
    category: 'read',
    execute: async (_ctx, params) => {
      const jobId = String(params?.jobId ?? '');
      return await getJobStatus(jobId);
    },
  },
  runWorkflow: {
    category: 'exec',
    execute: async (_ctx, params) => {
      const workflowVersionId = params?.workflowVersionId
        ? String(params.workflowVersionId)
        : params?.workflowId
          ? (() => {
              const wf = getWorkflowDefinitionById(String(params.workflowId));
              return wf?.current_version_id ?? null;
            })()
          : null;
      if (!workflowVersionId) throw new Error('Missing workflowVersionId');
      const workflowRun = createWorkflowRun(workflowVersionId, {
        trigger_source: String(params?.trigger_source ?? 'copilot'),
        rerun_of_workflow_run_id: null,
      });
      if (!workflowRun) throw new Error('Failed to create workflow run');
      startWorkflowRunInBackground(workflowRun.id);
      return workflowRun;
    },
  },
  runWorkflowByNodeType: {
    category: 'exec',
    execute: async (ctx, params) => {
      const projectId = String(ctx.projectId ?? '');
      const nodeType = String(params?.nodeType ?? '');
      if (!nodeType) throw new Error('Missing nodeType');

      const timeoutMs = typeof params?.timeoutMs === 'number' ? params.timeoutMs : 10 * 60_000;
      const pollMs = typeof params?.pollMs === 'number' ? params.pollMs : 1500;

      const workflows = listWorkflowDefinitions(projectId) as any[];
      const candidates = (workflows ?? [])
        .filter(w => w && typeof w === 'object' && typeof w.id === 'string')
        .filter(w => {
          const nodes = Array.isArray(w.nodes) ? w.nodes : [];
          return nodes.some((n: any) => n && typeof n === 'object' && n.type === nodeType);
        })
        .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());

      const picked = candidates[0] ?? null;
      if (!picked) {
        throw new Error(
          `No workflow found containing node type "${nodeType}". Create a workflow like "Storyboard From Story" first.`
        );
      }

      const workflowVersionId = String(picked.current_version_id ?? '');
      if (!workflowVersionId) throw new Error('Missing workflowVersionId for selected workflow');

      const workflowRun = createWorkflowRun(workflowVersionId, {
        trigger_source: String(params?.trigger_source ?? 'copilot'),
        rerun_of_workflow_run_id: null,
      });
      if (!workflowRun) throw new Error('Failed to create workflow run');
      startWorkflowRunInBackground(workflowRun.id);

      const isTerminal = (status: string) => {
        const s = (status || '').toLowerCase();
        return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'canceled';
      };

      const started = Date.now();
      let status = String((workflowRun as any).status ?? '');
      while (!isTerminal(status) && Date.now() - started < timeoutMs) {
        const copilotRunId = String((ctx as any)._copilotRunId ?? '');
        if (copilotRunId) {
          const run = getCopilotPlanRunById(copilotRunId);
          if (run?.status === 'cancelled') throw new Error('Cancelled');
        }

        const latest = getWorkflowRunById(workflowRun.id);
        status = String((latest as any)?.status ?? status);
        if (isTerminal(status)) break;
        await new Promise(r => setTimeout(r, pollMs));
      }

      return {
        workflowId: picked.id,
        workflowTitle: typeof picked.title === 'string' ? picked.title : undefined,
        workflowVersionId,
        workflowRunId: workflowRun.id,
        status,
      };
    },
  },
  waitForWorkflowRun: {
    category: 'exec',
    execute: async (ctx, params) => {
      const workflowRunId = String(params?.workflowRunId ?? '');
      if (!workflowRunId) throw new Error('Missing workflowRunId');
      const timeoutMs = typeof params?.timeoutMs === 'number' ? params.timeoutMs : 10 * 60_000;
      const pollMs = typeof params?.pollMs === 'number' ? params.pollMs : 1500;
      const started = Date.now();

      const isTerminal = (status: string) => {
        const s = (status || '').toLowerCase();
        return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'canceled';
      };

      while (Date.now() - started < timeoutMs) {
        // Allow cancelling the Copilot run while waiting.
        const copilotRunId = String((ctx as any)._copilotRunId ?? '');
        if (copilotRunId) {
          const run = getCopilotPlanRunById(copilotRunId);
          if (run?.status === 'cancelled') throw new Error('Cancelled');
        }

        const run = getWorkflowRunById(workflowRunId);
        if (!run) throw new Error('Workflow run not found');
        if (isTerminal(String((run as any).status ?? ''))) {
          return { workflowRunId, status: (run as any).status, workflowRun: run };
        }
        await new Promise(r => setTimeout(r, pollMs));
      }

      const run = getWorkflowRunById(workflowRunId);
      if (!run) throw new Error('Workflow run not found');
      return { workflowRunId, status: (run as any).status, workflowRun: run };
    },
  },
  generateImage: {
    category: 'exec',
    execute: async (_ctx, params) => {
      return await generateImage({
        prompt: String(params?.prompt ?? ''),
        workflow: params?.workflow ? String(params.workflow) : undefined,
        width: typeof params?.width === 'number' ? params.width : undefined,
        height: typeof params?.height === 'number' ? params.height : undefined,
      });
    },
  },
  generateVideo: {
    category: 'exec',
    execute: async (_ctx, params) => {
      return await createVideo({
        prompt: String(params?.prompt ?? ''),
        workflow: params?.workflow ? String(params.workflow) : undefined,
        width: typeof params?.width === 'number' ? params.width : undefined,
        height: typeof params?.height === 'number' ? params.height : undefined,
      });
    },
  },
  generateVideoFromImage: {
    category: 'exec',
    execute: async (_ctx, params) => {
      const reference_image_url = String(params?.reference_image_url ?? params?.referenceImageUrl ?? '');
      if (!reference_image_url) throw new Error('Missing reference_image_url');
      const base = new URL(config.localAIAPI.endpoint);
      const resolved = reference_image_url.startsWith('/')
        ? new URL(reference_image_url, base).toString()
        : reference_image_url;
      let parsed: URL;
      try {
        parsed = new URL(resolved);
      } catch {
        throw new Error('Invalid reference image URL');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Invalid reference image URL');
      }
      if (parsed.host !== base.host) {
        throw new Error('Reference image must be hosted by the Local AI API');
      }

      const res = await fetch(parsed.toString());
      if (!res.ok) throw new Error(`Failed to fetch reference image (${res.status})`);
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const bytes = await res.arrayBuffer();
      const filename = parsed.pathname.split('/').pop() || 'reference.jpg';
      return await createVideoFromImage({
        prompt: String(params?.prompt ?? ''),
        workflow: params?.workflow ? String(params.workflow) : 'image2video',
        width: typeof params?.width === 'number' ? params.width : undefined,
        height: typeof params?.height === 'number' ? params.height : undefined,
        length: typeof params?.length === 'number' ? params.length : undefined,
        reference_image: { bytes, contentType, filename },
      });
    },
  },
  generateVoiceOver: {
    category: 'exec',
    execute: async (_ctx, params) => {
      return await generateSpeech({
        text: String(params?.text ?? ''),
        template: params?.template ? String(params.template) : undefined,
        provider: params?.provider,
        speed: typeof params?.speed === 'number' ? params.speed : undefined,
        volume: typeof params?.volume === 'number' ? params.volume : undefined,
        prompt_text: params?.prompt_text ? String(params.prompt_text) : undefined,
        prompt_wav: params?.prompt_wav ? String(params.prompt_wav) : undefined,
        model_dir: params?.model_dir ? String(params.model_dir) : undefined,
      });
    },
  },
  generateSoundEffect: {
    category: 'exec',
    execute: async (_ctx, params) => {
      return await generateSound({
        prompt: String(params?.prompt ?? ''),
        workflow: params?.workflow ? String(params.workflow) : undefined,
        duration_seconds: typeof params?.duration_seconds === 'number' ? params.duration_seconds : undefined,
        batch_size: typeof params?.batch_size === 'number' ? params.batch_size : undefined,
        negative_prompt: params?.negative_prompt ? String(params.negative_prompt) : undefined,
      });
    },
  },
  applyProposal: {
    category: 'write',
    execute: async (ctx, params) => {
      const proposal = params?.proposal;
      if (!proposal || typeof proposal !== 'object') throw new Error('Missing proposal');
      const confirmed = params?.confirmed === undefined ? Boolean((ctx as any)._confirmed) : Boolean(params?.confirmed);
      const result = await applyCopilotProposal({
        projectId: String(ctx.projectId ?? ''),
        proposal: proposal as any,
        confirmed,
      });
      if (!result.ok) throw new Error(result.warning || 'Apply failed');
      return result;
    },
  },
};

export function canRunPlanOnBackend(plan: any) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  if (!steps.length) return false;
  return steps.every((s: any) => s && typeof s.tool === 'string' && Boolean(toolHandlers[s.tool]));
}

export function planRequiresConfirmation(plan: any) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  return steps.some((s: any) => toolHandlers[s?.tool]?.category !== 'read');
}

export type StepUpdateEvent = { type: 'step_update'; runId: string; stepIndex: number; step: any };
export type RunUpdateEvent = { type: 'run_update'; runId: string; run: any };

type EmitFn = (event: StepUpdateEvent | RunUpdateEvent) => void;

export async function executeCopilotPlanRun(runId: string, emit?: EmitFn) {
  const run = getCopilotPlanRunById(runId);
  if (!run) return;

  const plan = run.plan as any;
  const ctx = run.context as any;
  // Internal: helps long-running tools (like waits) detect cancellation.
  ctx._copilotRunId = runId;
  const steps = listCopilotPlanSteps(runId);

  const startedAt = new Date().toISOString();
  updateCopilotPlanRun(runId, { status: 'running', started_at: startedAt });
  emit?.({ type: 'run_update', runId, run: getCopilotPlanRunById(runId) });

  const stepResultsById: Record<string, unknown> = {};

  for (const stepRecord of steps) {
    const latest = getCopilotPlanRunById(runId);
    if (!latest) return;
    if (latest.status === 'cancelled') {
      // mark remaining steps as skipped
      const remaining = listCopilotPlanSteps(runId).filter(s => s.step_index >= stepRecord.step_index);
      for (const r of remaining) {
        if (r.status === 'pending') {
          const updated = updateCopilotPlanStep(runId, r.step_index, { status: 'skipped', error: { message: 'Cancelled' } });
          emit?.({ type: 'step_update', runId, stepIndex: r.step_index, step: updated });
        }
      }
      emit?.({ type: 'run_update', runId, run: getCopilotPlanRunById(runId) });
      return;
    }

    const stepDef = (Array.isArray(plan.steps) ? plan.steps[stepRecord.step_index] : null) as any;
    const handler = toolHandlers[stepRecord.tool];
    if (!handler) {
      updateCopilotPlanStep(runId, stepRecord.step_index, { status: 'error', error: { message: `Unsupported tool: ${stepRecord.tool}` }, ended_at: new Date().toISOString() });
      updateCopilotPlanRun(runId, { status: 'failed', error_message: `Unsupported tool: ${stepRecord.tool}`, ended_at: new Date().toISOString() });
      emit?.({ type: 'run_update', runId, run: getCopilotPlanRunById(runId) });
      return;
    }

    const now = new Date().toISOString();
    const running = updateCopilotPlanStep(runId, stepRecord.step_index, { status: 'running', started_at: now, error: null });
    emit?.({ type: 'step_update', runId, stepIndex: stepRecord.step_index, step: running });

    try {
      const resolvedParams = resolveTemplates(stepDef?.params ?? stepRecord.params, ctx, stepResultsById);
      const result = await handler.execute(ctx, resolvedParams, stepResultsById);
      const ended = new Date().toISOString();
      const updated = updateCopilotPlanStep(runId, stepRecord.step_index, { status: 'success', result, ended_at: ended, error: null });
      emit?.({ type: 'step_update', runId, stepIndex: stepRecord.step_index, step: updated });
      stepResultsById[stepRecord.step_id] = result;
    } catch (err) {
      const ended = new Date().toISOString();
      const message = err instanceof Error ? err.message : 'Tool failed';
      const updated = updateCopilotPlanStep(runId, stepRecord.step_index, { status: 'error', error: { message }, ended_at: ended });
      emit?.({ type: 'step_update', runId, stepIndex: stepRecord.step_index, step: updated });
      updateCopilotPlanRun(runId, { status: 'failed', error_message: message, ended_at: ended });
      emit?.({ type: 'run_update', runId, run: getCopilotPlanRunById(runId) });
      return;
    }
  }

  updateCopilotPlanRun(runId, { status: 'completed', ended_at: new Date().toISOString() });
  emit?.({ type: 'run_update', runId, run: getCopilotPlanRunById(runId) });
}
