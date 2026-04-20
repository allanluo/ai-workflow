const STORAGE_PREFIX = 'aiwf:copilotEmbeddings:model:v1:';
const memoryCache = new Map<string, Float32Array>();

type CacheEntry = {
  updatedAt: string;
  model?: string;
  v: number[];
};

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId}`;
}

function loadStorage(projectId: string): Record<string, CacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStorage(projectId: string, next: Record<string, CacheEntry>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

function normalize(vec: Float32Array) {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) sum += vec[i]! * vec[i]!;
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vec.length; i += 1) vec[i] = vec[i]! / norm;
  return vec;
}

export function cosineSim(a: Float32Array, b: Float32Array) {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i]! * b[i]!;
  return dot;
}

export async function getOrCreateModelEmbedding(input: {
  projectId: string;
  key: string;
  updatedAt: string;
  model?: string;
  make: () => Promise<number[]>;
}): Promise<Float32Array | null> {
  const memKey = `${input.projectId}:${input.key}:${input.updatedAt}:${input.model ?? ''}`;
  const hit = memoryCache.get(memKey);
  if (hit) return hit;

  const store = loadStorage(input.projectId);
  const existing = store[input.key];
  if (
    existing &&
    existing.updatedAt === input.updatedAt &&
    Array.isArray(existing.v) &&
    existing.v.length > 0 &&
    (input.model ? existing.model === input.model : true)
  ) {
    const vec = normalize(new Float32Array(existing.v));
    memoryCache.set(memKey, vec);
    return vec;
  }

  try {
    const v = await input.make();
    if (!Array.isArray(v) || v.length === 0) return null;
    const vec = normalize(new Float32Array(v));
    memoryCache.set(memKey, vec);

    store[input.key] = { updatedAt: input.updatedAt, model: input.model, v };
    const keys = Object.keys(store);
    if (keys.length > 400) {
      for (const k of keys.slice(0, keys.length - 400)) delete store[k];
    }
    saveStorage(input.projectId, store);

    return vec;
  } catch {
    return null;
  }
}

