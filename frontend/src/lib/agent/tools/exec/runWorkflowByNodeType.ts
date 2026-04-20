import { z } from 'zod';
import { createWorkflowRun, fetchProjectWorkflows, fetchWorkflowById, fetchWorkflowRunById } from '../../../api';
import type { ToolDefinition } from '../types';

type WorkflowLike = {
  id: string;
  title?: string;
  updated_at?: string;
  current_version_id?: string | null;
  nodes?: unknown[];
};

function workflowHasNodeType(workflow: WorkflowLike, nodeType: string) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  return nodes.some(n => {
    if (!n || typeof n !== 'object') return false;
    const type = (n as Record<string, unknown>).type;
    return typeof type === 'string' && type === nodeType;
  });
}

function isTerminalStatus(status: string) {
  const s = (status || '').toLowerCase();
  return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'canceled';
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const runWorkflowByNodeTypeTool: ToolDefinition<
  { nodeType: string; trigger_source?: string; timeoutMs?: number; pollMs?: number },
  {
    workflowId: string;
    workflowTitle?: string;
    workflowVersionId: string;
    workflowRunId: string;
    status: string;
  }
> = {
  name: 'runWorkflowByNodeType',
  description:
    'Pick the most recently updated workflow containing a given node type, run it, and wait for completion.',
  category: 'exec',
  exposedToPlanner: true,
  paramsSchema: z.object({
    nodeType: z.string().min(1),
    trigger_source: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    pollMs: z.number().int().positive().optional(),
  }),
  resultSchema: z
    .object({
      workflowId: z.string(),
      workflowTitle: z.string().optional(),
      workflowVersionId: z.string(),
      workflowRunId: z.string(),
      status: z.string(),
    })
    .passthrough(),
  async execute(context, params) {
    const workflows = (await fetchProjectWorkflows(context.projectId)) as unknown as WorkflowLike[];
    const candidates = (workflows ?? [])
      .filter(w => w && typeof w === 'object' && typeof w.id === 'string')
      .filter(w => workflowHasNodeType(w, params.nodeType))
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());

    const picked = candidates[0] ?? null;
    if (!picked) {
      throw new Error(
        `No workflow found containing node type "${params.nodeType}". Create a workflow like "Storyboard From Story" first.`
      );
    }

    const workflowVersionId =
      picked.current_version_id ||
      (await fetchWorkflowById(picked.id)).current_version_id ||
      null;
    if (!workflowVersionId) throw new Error('Missing workflowVersionId for selected workflow.');

    const run = await createWorkflowRun({
      workflowVersionId,
      trigger_source: params.trigger_source ?? 'copilot',
    });

    const timeoutMs = params.timeoutMs ?? 10 * 60_000;
    const pollMs = params.pollMs ?? 1500;
    const started = Date.now();

    let status = String((run as any).status ?? '');
    while (!isTerminalStatus(status) && Date.now() - started < timeoutMs) {
      const latest = await fetchWorkflowRunById(run.id);
      status = String((latest as any).status ?? '');
      if (isTerminalStatus(status)) break;
      await sleep(pollMs);
    }

    return {
      workflowId: picked.id,
      workflowTitle: typeof picked.title === 'string' ? picked.title : undefined,
      workflowVersionId,
      workflowRunId: run.id,
      status,
    };
  },
};

