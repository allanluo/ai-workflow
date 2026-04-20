type CacheEntry = { updatedAt: string; v: number[] };

const DIM = 192;
const STORAGE_PREFIX = 'aiwf:copilotEmbeddings:v1:';
const memoryCache = new Map<string, Float32Array>();

function hash32(str: string, seed = 0) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .filter(t => t.length > 1);
}

function addHashedFeatures(vec: Float32Array, token: string, weight: number, seed: number) {
  const h = hash32(token, seed);
  const idx = h % DIM;
  const sign = (h & 1) === 0 ? 1 : -1;
  vec[idx] += sign * weight;
}

function normalize(vec: Float32Array) {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) sum += vec[i]! * vec[i]!;
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vec.length; i += 1) vec[i] = vec[i]! / norm;
  return vec;
}

export function embedText(text: string) {
  const vec = new Float32Array(DIM);
  const tokens = tokenize(text);
  for (const t of tokens.slice(0, 1200)) addHashedFeatures(vec, t, 1, 1);

  // Add a bit of character trigram signal for robustness (misspellings, punctuation).
  const compact = text.toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < Math.min(compact.length - 2, 1500); i += 1) {
    const tri = compact.slice(i, i + 3);
    addHashedFeatures(vec, tri, 0.35, 2);
  }

  return normalize(vec);
}

export function cosineSim(a: Float32Array, b: Float32Array) {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i]! * b[i]!;
  return dot;
}

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

export function getCachedEmbedding(input: {
  projectId: string;
  key: string;
  updatedAt: string;
  text: string;
}): Float32Array {
  const memKey = `${input.projectId}:${input.key}:${input.updatedAt}`;
  const hit = memoryCache.get(memKey);
  if (hit) return hit;

  const store = loadStorage(input.projectId);
  const existing = store[input.key];
  if (existing && existing.updatedAt === input.updatedAt && Array.isArray(existing.v) && existing.v.length === DIM) {
    const vec = new Float32Array(existing.v);
    memoryCache.set(memKey, vec);
    return vec;
  }

  const vec = embedText(input.text);
  memoryCache.set(memKey, vec);

  // Best-effort persist (bounded size).
  store[input.key] = { updatedAt: input.updatedAt, v: Array.from(vec) };
  const keys = Object.keys(store);
  if (keys.length > 250) {
    // Drop oldest-ish by insertion order (good enough).
    for (const k of keys.slice(0, keys.length - 250)) delete store[k];
  }
  saveStorage(input.projectId, store);

  return vec;
}

