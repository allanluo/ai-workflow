import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './client.js';
import { copilotPlanRuns, copilotPlanSteps } from './schema.js';

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type CopilotPlanRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type CopilotPlanRunRecord = {
  id: string;
  project_id: string;
  status: CopilotPlanRunStatus;
  plan: Record<string, unknown>;
  context: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  ended_at?: string | null;
};

export type CopilotPlanStepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export type CopilotPlanStepRecord = {
  id: string;
  run_id: string;
  project_id: string;
  step_index: number;
  step_id: string;
  title: string;
  tool: string;
  status: CopilotPlanStepStatus;
  params: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
  started_at?: string | null;
  ended_at?: string | null;
  updated_at: string;
};

function mapRun(row: typeof copilotPlanRuns.$inferSelect): CopilotPlanRunRecord {
  return {
    id: row.id,
    project_id: row.projectId,
    status: row.status as CopilotPlanRunStatus,
    plan: safeParseJson(row.planJson, {}),
    context: safeParseJson(row.contextJson, {}),
    error_message: row.errorMessage ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    started_at: row.startedAt ?? null,
    ended_at: row.endedAt ?? null,
  };
}

function mapStep(row: typeof copilotPlanSteps.$inferSelect): CopilotPlanStepRecord {
  return {
    id: row.id,
    run_id: row.runId,
    project_id: row.projectId,
    step_index: row.stepIndex,
    step_id: row.stepId,
    title: row.title,
    tool: row.tool,
    status: row.status as CopilotPlanStepStatus,
    params: safeParseJson(row.paramsJson, {}),
    result: row.resultJson ? safeParseJson(row.resultJson, null) : undefined,
    error: row.errorJson ? safeParseJson(row.errorJson, null) : undefined,
    started_at: row.startedAt ?? null,
    ended_at: row.endedAt ?? null,
    updated_at: row.updatedAt,
  };
}

export function createCopilotPlanRun(input: {
  projectId: string;
  plan: Record<string, unknown>;
  context: Record<string, unknown>;
}): { run: CopilotPlanRunRecord; steps: CopilotPlanStepRecord[] } {
  const now = new Date().toISOString();
  const runId = randomUUID();

  db.insert(copilotPlanRuns)
    .values({
      id: runId,
      projectId: input.projectId,
      status: 'queued',
      planJson: JSON.stringify(input.plan ?? {}),
      contextJson: JSON.stringify(input.context ?? {}),
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      endedAt: null,
    })
    .run();

  const plan = (input.plan ?? {}) as any;
  const steps = Array.isArray(plan.steps) ? plan.steps : [];

  for (let i = 0; i < steps.length; i += 1) {
    const s = steps[i] ?? {};
    db.insert(copilotPlanSteps)
      .values({
        id: randomUUID(),
        runId,
        projectId: input.projectId,
        stepIndex: i,
        stepId: typeof s.id === 'string' ? s.id : String(i),
        title: typeof s.title === 'string' ? s.title : `Step ${i + 1}`,
        tool: typeof s.tool === 'string' ? s.tool : 'unknown',
        status: 'pending',
        paramsJson: JSON.stringify(typeof s.params === 'object' && s.params ? s.params : {}),
        resultJson: '',
        errorJson: '',
        startedAt: null,
        endedAt: null,
        updatedAt: now,
      })
      .run();
  }

  return { run: getCopilotPlanRunById(runId)!, steps: listCopilotPlanSteps(runId) };
}

export function getCopilotPlanRunById(runId: string): CopilotPlanRunRecord | null {
  const row = db.select().from(copilotPlanRuns).where(eq(copilotPlanRuns.id, runId)).get();
  return row ? mapRun(row) : null;
}

export function listCopilotPlanRuns(projectId: string, limit = 20): CopilotPlanRunRecord[] {
  return db
    .select()
    .from(copilotPlanRuns)
    .where(eq(copilotPlanRuns.projectId, projectId))
    .orderBy(desc(copilotPlanRuns.updatedAt))
    .limit(Math.max(1, Math.min(100, limit)))
    .all()
    .map(mapRun);
}

export function listCopilotPlanSteps(runId: string): CopilotPlanStepRecord[] {
  return db
    .select()
    .from(copilotPlanSteps)
    .where(eq(copilotPlanSteps.runId, runId))
    .orderBy(asc(copilotPlanSteps.stepIndex))
    .all()
    .map(mapStep);
}

export function getCopilotPlanStepById(stepId: string): CopilotPlanStepRecord | null {
  const row = db.select().from(copilotPlanSteps).where(eq(copilotPlanSteps.id, stepId)).get();
  return row ? mapStep(row) : null;
}

export function getCopilotPlanStep(runId: string, stepIndex: number): CopilotPlanStepRecord | null {
  const row = db
    .select()
    .from(copilotPlanSteps)
    .where(and(eq(copilotPlanSteps.runId, runId), eq(copilotPlanSteps.stepIndex, stepIndex)))
    .get();
  return row ? mapStep(row) : null;
}

export function updateCopilotPlanRun(runId: string, patch: Partial<{
  status: CopilotPlanRunStatus;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
}>): CopilotPlanRunRecord | null {
  const existing = db.select().from(copilotPlanRuns).where(eq(copilotPlanRuns.id, runId)).get();
  if (!existing) return null;
  const now = new Date().toISOString();

  db.update(copilotPlanRuns)
    .set({
      status: patch.status ?? (existing.status as any),
      errorMessage: patch.error_message === undefined ? existing.errorMessage : patch.error_message,
      updatedAt: now,
      startedAt: patch.started_at === undefined ? existing.startedAt : patch.started_at,
      endedAt: patch.ended_at === undefined ? existing.endedAt : patch.ended_at,
    })
    .where(eq(copilotPlanRuns.id, runId))
    .run();

  return getCopilotPlanRunById(runId);
}

export function updateCopilotPlanStep(runId: string, stepIndex: number, patch: Partial<{
  status: CopilotPlanStepStatus;
  result: unknown;
  error: unknown;
  started_at: string | null;
  ended_at: string | null;
}>): CopilotPlanStepRecord | null {
  const existing = db
    .select()
    .from(copilotPlanSteps)
    .where(and(eq(copilotPlanSteps.runId, runId), eq(copilotPlanSteps.stepIndex, stepIndex)))
    .get();
  if (!existing) return null;
  const now = new Date().toISOString();

  db.update(copilotPlanSteps)
    .set({
      status: patch.status ?? (existing.status as any),
      resultJson:
        patch.result === undefined ? existing.resultJson : patch.result === null ? '' : JSON.stringify(patch.result),
      errorJson:
        patch.error === undefined ? existing.errorJson : patch.error === null ? '' : JSON.stringify(patch.error),
      startedAt: patch.started_at === undefined ? existing.startedAt : patch.started_at,
      endedAt: patch.ended_at === undefined ? existing.endedAt : patch.ended_at,
      updatedAt: now,
    })
    .where(and(eq(copilotPlanSteps.runId, runId), eq(copilotPlanSteps.stepIndex, stepIndex)))
    .run();

  return getCopilotPlanStep(runId, stepIndex);
}

export function cancelCopilotPlanRun(runId: string): CopilotPlanRunRecord | null {
  const existing = getCopilotPlanRunById(runId);
  if (!existing) return null;
  if (existing.status === 'completed' || existing.status === 'failed' || existing.status === 'cancelled') return existing;
  return updateCopilotPlanRun(runId, { status: 'cancelled', ended_at: new Date().toISOString() });
}

