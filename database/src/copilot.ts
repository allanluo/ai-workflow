import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from './client.js';
import { copilotAuditEvents, copilotSessions } from './schema.js';

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type CopilotSessionRow = {
  id: string;
  project_id: string;
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CopilotAuditEventRow = {
  id: string;
  project_id: string;
  ts: string;
  event_type: string;
  tool?: string | null;
  ok?: boolean | null;
  duration_ms?: number | null;
  summary?: string | null;
  details?: unknown;
  created_at: string;
};

export function getCopilotSession(projectId: string): CopilotSessionRow | null {
  const row = db.select().from(copilotSessions).where(eq(copilotSessions.projectId, projectId)).get();
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.projectId,
    state: safeParseJson(row.stateJson, {}),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function upsertCopilotSession(projectId: string, state: Record<string, unknown>) {
  const existing = db.select().from(copilotSessions).where(eq(copilotSessions.projectId, projectId)).get();
  const now = new Date().toISOString();

  if (!existing) {
    const id = randomUUID();
    db.insert(copilotSessions)
      .values({
        id,
        projectId,
        stateJson: JSON.stringify(state ?? {}),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return getCopilotSession(projectId)!;
  }

  db.update(copilotSessions)
    .set({
      stateJson: JSON.stringify(state ?? {}),
      updatedAt: now,
    })
    .where(eq(copilotSessions.projectId, projectId))
    .run();

  return getCopilotSession(projectId)!;
}

export function listCopilotAuditEvents(projectId: string, limit = 200): CopilotAuditEventRow[] {
  return db
    .select()
    .from(copilotAuditEvents)
    .where(eq(copilotAuditEvents.projectId, projectId))
    .orderBy(desc(copilotAuditEvents.createdAt))
    .limit(Math.max(1, Math.min(500, limit)))
    .all()
    .map(row => ({
      id: row.id,
      project_id: row.projectId,
      ts: row.ts,
      event_type: row.eventType,
      tool: row.tool,
      ok: row.ok === null || row.ok === undefined ? null : Boolean(row.ok),
      duration_ms: row.durationMs ?? null,
      summary: row.summary ?? null,
      details: row.detailsJson ? safeParseJson(row.detailsJson, null) : null,
      created_at: row.createdAt,
    }));
}

export function appendCopilotAuditEvents(projectId: string, events: Array<Record<string, unknown>>) {
  const now = new Date().toISOString();

  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const id = typeof (e as any).id === 'string' && (e as any).id ? (e as any).id : randomUUID();
    const ts = typeof (e as any).ts === 'string' && (e as any).ts ? (e as any).ts : now;
    const eventType = typeof (e as any).type === 'string' ? (e as any).type : 'unknown';
    const tool = typeof (e as any).tool === 'string' ? (e as any).tool : null;
    const ok =
      typeof (e as any).ok === 'boolean' ? ((e as any).ok ? 1 : 0) : (e as any).ok === null ? null : null;
    const durationMs = typeof (e as any).duration_ms === 'number' ? Math.round((e as any).duration_ms) : null;
    const summary = typeof (e as any).summary === 'string' ? (e as any).summary : null;
    const detailsJson =
      (e as any).details === undefined ? '' : JSON.stringify((e as any).details ?? null);

    try {
      db.insert(copilotAuditEvents)
        .values({
          id,
          projectId,
          ts,
          eventType,
          tool,
          ok,
          durationMs,
          summary,
          detailsJson,
          createdAt: now,
        })
        .run();
    } catch {
      // ignore duplicate ids or any insertion errors (best-effort audit)
    }
  }
}

