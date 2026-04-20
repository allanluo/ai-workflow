import type { ExecutionPlan } from '../planner';
import type { ToolContext } from '../tools';
import { executeTool } from '../tools';
import { getTool } from '../tools/registry';
import { appendAuditEvent, summarizeDetails } from '../auditLog';
import { emitProjectEvent } from '../../api';

export type PlanStepRunState = {
  id: string;
  title: string;
  tool: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  result?: unknown;
  error?: string;
};

export type PlanRunResult = {
  ok: boolean;
  steps: PlanStepRunState[];
  error?: string;
};

function getByPath(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const segment of path) {
    if (cur == null) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

function resolveTemplateExpression(exprRaw: string, context: ToolContext, stepResults: Record<string, unknown>) {
  const expr = exprRaw.trim();
  const parts = expr.split('.').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;

  if (parts[0] === 'context') {
    return getByPath(context as unknown, parts.slice(1));
  }

  if (parts[0] === 'steps') {
    const stepId = parts[1];
    if (!stepId) return undefined;
    if (parts[2] !== 'result') return undefined;
    const base = stepResults[stepId];
    return getByPath(base, parts.slice(3));
  }

  return undefined;
}

function resolveTemplates(value: unknown, context: ToolContext, stepResults: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const m = value.match(/^\{\{([\s\S]+)\}\}$/);
    if (!m) return value;
    const resolved = resolveTemplateExpression(m[1] ?? '', context, stepResults);
    return resolved;
  }

  if (Array.isArray(value)) {
    return value.map(v => resolveTemplates(v, context, stepResults));
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveTemplates(v, context, stepResults);
    }
    return out;
  }

  return value;
}

export async function executeExecutionPlan(input: {
  plan: ExecutionPlan;
  context: ToolContext;
  onStepUpdate?: (step: PlanStepRunState, all: PlanStepRunState[]) => void;
  allowWrite?: boolean;
  signal?: AbortSignal;
}): Promise<PlanRunResult> {
  appendAuditEvent((input.context as any)?.projectId ?? '', {
    type: 'plan_run',
    summary: `Execute plan: ${input.plan.intent}`,
    details: summarizeDetails(
      input.plan.steps.map(s => ({ id: s.id, tool: s.tool, title: s.title, on_error: s.on_error }))
    ),
  });

  const steps: PlanStepRunState[] = input.plan.steps.map(s => ({
    id: s.id,
    title: s.title,
    tool: s.tool,
    status: 'pending',
  }));
  const stepResultsById: Record<string, unknown> = {};

  const update = (idx: number, patch: Partial<PlanStepRunState>) => {
    steps[idx] = { ...steps[idx]!, ...patch };
    input.onStepUpdate?.(steps[idx]!, [...steps]);
    // Emit real-time update via project events
    const projectId = (input.context as any)?.projectId;
    if (projectId) {
      emitProjectEvent({
        projectId,
        event_type: 'copilot_step_update',
        target_type: 'copilot_plan',
        target_id: (input.context as any)?.planId || 'unknown',
        payload: {
          stepId: steps[idx]!.id,
          status: steps[idx]!.status,
          result: steps[idx]!.result,
          error: steps[idx]!.error,
        },
      }).catch(err => console.warn('Failed to emit project event', err));
    }
  };

  for (let i = 0; i < input.plan.steps.length; i += 1) {
    if (input.signal?.aborted) {
      for (let j = i; j < steps.length; j += 1) {
        if (steps[j]!.status === 'pending') update(j, { status: 'skipped', error: 'Cancelled.' });
      }
      return { ok: false, steps: [...steps], error: 'Cancelled.' };
    }

    const step = input.plan.steps[i]!;
    const tool = getTool(step.tool);
    const category = tool?.category ?? 'exec';
    if ((category === 'write' || category === 'exec') && !input.allowWrite) {
      update(i, {
        status: 'error',
        error: `Tool "${step.tool}" requires confirmation (category: ${category}).`,
      });
      return { ok: false, steps: [...steps], error: `Confirmation required for: ${step.tool}` };
    }

    update(i, { status: 'running' });

    const resolvedParams = resolveTemplates(step.params, input.context, stepResultsById);
    if (resolvedParams === undefined || resolvedParams === null) {
      update(i, { status: 'error', error: 'Param interpolation failed (resolved to empty).' });
      if (step.on_error !== 'continue') {
        return { ok: false, steps: [...steps], error: 'Param interpolation failed.' };
      }
      continue;
    }

    const res = await executeTool(step.tool, input.context, resolvedParams);
    if (!res.ok) {
      update(i, { status: 'error', error: res.error.message, result: res.error.details });
      if (step.on_error !== 'continue') {
        return { ok: false, steps: [...steps], error: res.error.message };
      }
      continue;
    }

    update(i, { status: 'success', result: res.data });
    stepResultsById[step.id] = res.data;
  }

  return { ok: true, steps: [...steps] };
}
