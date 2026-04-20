const DIM = 192;

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
  return (text || '')
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

export function embedTextHashed(text: string) {
  const vec = new Float32Array(DIM);
  const tokens = tokenize(text);
  for (const t of tokens.slice(0, 1200)) addHashedFeatures(vec, t, 1, 1);

  // Add character trigram signal for robustness.
  const compact = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < Math.min(compact.length - 2, 1500); i += 1) {
    const tri = compact.slice(i, i + 3);
    addHashedFeatures(vec, tri, 0.35, 2);
  }

  normalize(vec);
  return Array.from(vec);
}

export const HASH_EMBEDDING_MODEL = 'hash-192-v1';
export const HASH_EMBEDDING_DIM = DIM;

