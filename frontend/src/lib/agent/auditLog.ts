export type CopilotAuditEventType =
  | 'user_message'
  | 'assistant_message'
  | 'planner_plan'
  | 'plan_run'
  | 'tool_call'
  | 'tool_result'
  | 'proposal_created'
  | 'proposal_applied';

export type CopilotAuditEvent = {
  id: string;
  ts: string;
  projectId: string;
  type: CopilotAuditEventType;
  tool?: string;
  ok?: boolean;
  duration_ms?: number;
  summary?: string;
  details?: string;
};

const STORAGE_PREFIX = 'copilot_audit_v1:';
const MAX_EVENTS = 300;
const MAX_DETAILS_CHARS = 4000;

const UNSENT_PREFIX = 'copilot_audit_unsent_v1:';

type ProjectState = {
  events: CopilotAuditEvent[];
  listeners: Set<(events: CopilotAuditEvent[]) => void>;
};

const byProject = new Map<string, ProjectState>();

function nowIso() {
  return new Date().toISOString();
}

function safeStringify(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    if (s.length > MAX_DETAILS_CHARS) return s.slice(0, MAX_DETAILS_CHARS) + '…';
    return s;
  } catch {
    try {
      return String(value);
    } catch {
      return '(unserializable)';
    }
  }
}

function getProjectState(projectId: string): ProjectState {
  const existing = byProject.get(projectId);
  if (existing) return existing;

  const loaded = loadAuditEvents(projectId);
  const created: ProjectState = { events: loaded, listeners: new Set() };
  byProject.set(projectId, created);
  // Best-effort backend hydrate (async)
  void hydrateFromBackend(projectId).catch(() => {});
  return created;
}

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId}`;
}

function unsentKey(projectId: string) {
  return `${UNSENT_PREFIX}${projectId}`;
}

function loadAuditEvents(projectId: string): CopilotAuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e === 'object')
      .map(e => e as CopilotAuditEvent)
      .slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

function loadUnsent(projectId: string): CopilotAuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(unsentKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e === 'object')
      .map(e => e as CopilotAuditEvent);
  } catch {
    return [];
  }
}

function persistUnsent(projectId: string, events: CopilotAuditEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(unsentKey(projectId), JSON.stringify(events.slice(-500)));
  } catch {
    // ignore quota errors
  }
}

function persist(projectId: string, events: CopilotAuditEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // ignore quota / serialization errors
  }
}

export function getAuditEvents(projectId: string): CopilotAuditEvent[] {
  return [...getProjectState(projectId).events];
}

export function clearAuditEvents(projectId: string) {
  const state = getProjectState(projectId);
  state.events = [];
  persist(projectId, state.events);
  for (const cb of state.listeners) cb([...state.events]);
}

export function subscribeAuditEvents(projectId: string, cb: (events: CopilotAuditEvent[]) => void) {
  const state = getProjectState(projectId);
  state.listeners.add(cb);
  cb([...state.events]);
  // ensure backend hydrate happens even if state already existed
  void hydrateFromBackend(projectId).catch(() => {});
  return () => {
    state.listeners.delete(cb);
  };
}

export function appendAuditEvent(projectId: string, event: Omit<CopilotAuditEvent, 'id' | 'ts' | 'projectId'>) {
  if (!projectId) return;
  const state = getProjectState(projectId);
  const next: CopilotAuditEvent = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ts: nowIso(),
    projectId,
    ...event,
  };
  state.events = [...state.events, next].slice(-MAX_EVENTS);
  persist(projectId, state.events);
  for (const cb of state.listeners) cb([...state.events]);

  // Best-effort backend sync (batched)
  enqueueUnsent(projectId, next);
}

export function summarizeDetails(value: unknown) {
  return safeStringify(value);
}

let flushTimer: number | null = null;
const flushInFlightByProject = new Set<string>();

function enqueueUnsent(projectId: string, event: CopilotAuditEvent) {
  const cur = loadUnsent(projectId);
  cur.push(event);
  persistUnsent(projectId, cur);

  if (typeof window === 'undefined') return;
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushAllUnsent();
  }, 800);
}

async function flushAllUnsent() {
  if (typeof window === 'undefined') return;
  const { appendCopilotAuditEvents } = await import('../api');

  // Flush per-project to keep payloads reasonable.
  for (const [projectId] of byProject) {
    if (flushInFlightByProject.has(projectId)) continue;
    const pending = loadUnsent(projectId);
    if (!pending.length) continue;

    flushInFlightByProject.add(projectId);
    try {
      await appendCopilotAuditEvents(
        projectId,
        pending.map(e => ({
          id: e.id,
          ts: e.ts,
          type: e.type,
          tool: e.tool,
          ok: e.ok,
          duration_ms: e.duration_ms,
          summary: e.summary,
          details: e.details,
        }))
      );
      persistUnsent(projectId, []);
    } catch {
      // keep unsent; try again later
    } finally {
      flushInFlightByProject.delete(projectId);
    }
  }
}

let hydrateInFlight = new Set<string>();

async function hydrateFromBackend(projectId: string) {
  if (!projectId) return;
  if (typeof window === 'undefined') return;
  if (hydrateInFlight.has(projectId)) return;
  hydrateInFlight.add(projectId);
  try {
    const { fetchCopilotAuditEvents } = await import('../api');
    const res = await fetchCopilotAuditEvents(projectId, { limit: 300 });
    const items = Array.isArray(res.items) ? res.items : [];

    const state = getProjectState(projectId);
    const existingIds = new Set(state.events.map(e => e.id));
    const mapped: CopilotAuditEvent[] = items
      .filter(Boolean)
      .map(row => {
        const r = row as any;
        return {
          id: String(r.id ?? ''),
          ts: String(r.ts ?? r.created_at ?? ''),
          projectId,
          type: (r.event_type ?? r.type ?? 'tool_call') as CopilotAuditEventType,
          tool: typeof r.tool === 'string' ? r.tool : undefined,
          ok: typeof r.ok === 'boolean' ? r.ok : undefined,
          duration_ms: typeof r.duration_ms === 'number' ? r.duration_ms : undefined,
          summary: typeof r.summary === 'string' ? r.summary : undefined,
          details:
            r.details === undefined
              ? undefined
              : typeof r.details === 'string'
                ? r.details
                : safeStringify(r.details),
        } as CopilotAuditEvent;
      })
      .filter(e => e.id && e.ts && e.type);

    const merged = [...state.events];
    for (const e of mapped) {
      if (existingIds.has(e.id)) continue;
      existingIds.add(e.id);
      merged.push(e);
    }

    merged.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    state.events = merged.slice(-MAX_EVENTS);
    persist(projectId, state.events);
    for (const cb of state.listeners) cb([...state.events]);
  } catch {
    // ignore
  } finally {
    hydrateInFlight.delete(projectId);
  }
}
