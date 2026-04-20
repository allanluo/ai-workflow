import { z } from 'zod';
import { fetchWorkflowRunById } from '../../../api';
import type { ToolDefinition } from '../types';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTerminalStatus(status: string) {
  const s = (status || '').toLowerCase();
  return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'canceled';
}

export const waitForWorkflowRunTool: ToolDefinition<
  { workflowRunId: string; timeoutMs?: number; pollMs?: number },
  { workflowRunId: string; status: string; workflowRun: Record<string, unknown> }
> = {
  name: 'waitForWorkflowRun',
  description: 'Wait until a workflow run reaches a terminal status (completed/failed/cancelled).',
  category: 'exec',
  exposedToPlanner: true,
  paramsSchema: z.object({
    workflowRunId: z.string().min(1),
    timeoutMs: z.number().int().positive().optional(),
    pollMs: z.number().int().positive().optional(),
  }),
  resultSchema: z
    .object({
      workflowRunId: z.string(),
      status: z.string(),
      workflowRun: z.record(z.any()),
    })
    .passthrough(),
  async execute(_context, params) {
    const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 10 * 60_000;
    const pollMs = typeof params.pollMs === 'number' ? params.pollMs : 1500;
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const run = await fetchWorkflowRunById(params.workflowRunId);
      const status = String((run as any).status ?? '');
      if (isTerminalStatus(status)) {
        return { workflowRunId: params.workflowRunId, status, workflowRun: run as any };
      }
      await sleep(pollMs);
    }

    const run = await fetchWorkflowRunById(params.workflowRunId);
    const status = String((run as any).status ?? '');
    return { workflowRunId: params.workflowRunId, status, workflowRun: run as any };
  },
};

