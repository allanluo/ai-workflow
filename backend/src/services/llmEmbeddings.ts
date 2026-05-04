import { config } from '../config.js';
import { embedTextHashed, HASH_EMBEDDING_DIM, HASH_EMBEDDING_MODEL } from './hashedEmbeddings.js';

type TagsResponse = {
  models?: Array<{ name?: string; model?: string }>;
};

type EmbeddingLikeResponse =
  | { embedding?: number[]; embeddings?: number[][]; data?: Array<{ embedding?: number[] }>; error?: string; detail?: any }
  | any;

const DEFAULT_EMBEDDING_CANDIDATES = [
  // Common local embedding model names (often Ollama-backed).
  'nomic-embed-text',
  'mxbai-embed-large',
  'all-minilm',
  'bge-small-en-v1.5',
  'bge-base-en-v1.5',
  'snowflake-arctic-embed',
] as const;

function splitCsv(value: string | undefined) {
  return (value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function parseErrorMessage(text: string) {
  try {
    const parsed = JSON.parse(text) as { error?: unknown; detail?: unknown; message?: unknown };
    if (typeof parsed?.error === 'string') return parsed.error;
    if (typeof parsed?.message === 'string') return parsed.message;
    if (typeof parsed?.detail === 'string') return parsed.detail;
    return '';
  } catch {
    return '';
  }
}

function looksLikeNoEmbeddingsSupport(text: string) {
  const msg = (parseErrorMessage(text) || text || '').toLowerCase();
  return msg.includes('does not support embeddings') || msg.includes('not support embeddings');
}

function extractEmbedding(payload: EmbeddingLikeResponse): number[] | null {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray((payload as any).embedding)) return (payload as any).embedding as number[];
  if (Array.isArray((payload as any).embeddings) && Array.isArray((payload as any).embeddings?.[0]))
    return (payload as any).embeddings[0] as number[];
  if (Array.isArray((payload as any).data) && Array.isArray((payload as any).data?.[0]?.embedding))
    return (payload as any).data[0].embedding as number[];
  return null;
}

async function tryJson(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return { text: '', json: null as any };
  try {
    return { text, json: JSON.parse(text) as any };
  } catch {
    return { text, json: null as any };
  }
}

export async function listAvailableModels(baseUrl?: string): Promise<string[] | null> {
  const url = baseUrl || config.localAIAPI.endpoint;
  // Best-effort: many deployments expose an Ollama-compatible /api/tags.
  try {
    const r = await fetch(`${url}/api/tags`, { method: 'GET' });
    if (!r.ok) return null;
    const data = (await r.json()) as TagsResponse;
    const names =
      Array.isArray(data.models)
        ? data.models
            .map(m => (typeof m?.name === 'string' ? m.name : typeof m?.model === 'string' ? m.model : ''))
            .filter(Boolean)
        : [];
    return names.length ? names : null;
  } catch {
    return null;
  }
}

async function tryEmbedOnce(input: { baseUrl: string; model: string; text: string }) {
  const endpoints: Array<{ path: string; body: any }> = [
    // Preferred: Local AI API wrapper routes.
    { path: '/api/llm/embed', body: { model: input.model, input: input.text } },
    { path: '/api/llm/embeddings', body: { model: input.model, input: input.text } },
    // Fallbacks: Ollama-compatible routes (some servers mount these directly).
    { path: '/api/embeddings', body: { model: input.model, prompt: input.text } },
    { path: '/api/embed', body: { model: input.model, input: input.text } },
  ];

  let lastError: Error | null = null;
  let sawNon404 = false;
  for (const ep of endpoints) {
    const r = await fetch(`${input.baseUrl}${ep.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ep.body),
    });

    if (r.status === 404) {
      lastError = new Error(`Embedding endpoint not found: ${ep.path}`);
      continue;
    }
    sawNon404 = true;

    const { text, json } = await tryJson(r);
    if (!r.ok) {
      const errMsg = parseErrorMessage(text) || text || `status=${r.status}`;
      const error = new Error(`Embedding failed (${r.status}): ${errMsg}`);
      (error as any).raw = text;
      (error as any).status = r.status;
      (error as any).noEmbeddingsSupport = looksLikeNoEmbeddingsSupport(text);
      lastError = error;
      // if the server says "model doesn't support embeddings", there's no point trying other endpoints for same model
      if ((error as any).noEmbeddingsSupport) break;
      continue;
    }

    const embedding = extractEmbedding(json ?? {});
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      lastError = new Error(`Embedding failed: no embedding returned (${ep.path})`);
      continue;
    }

    return embedding;
  }

  const err = lastError ?? new Error('Embedding failed');
  (err as any).missingEmbeddingsEndpoint = !sawNon404;
  throw err;
}

function isModelAvailable(candidate: string, available: string[]) {
  if (!candidate) return false;
  if (available.includes(candidate)) return true;
  return available.some(a => a === `${candidate}:latest` || a.startsWith(`${candidate}:`));
}

function resolveModelName(candidate: string, available: string[]) {
  if (!candidate) return candidate;
  if (available.includes(candidate)) return candidate;
  const exactLatest = available.find(a => a === `${candidate}:latest`);
  if (exactLatest) return exactLatest;
  const pref = available.find(a => a.startsWith(`${candidate}:`));
  return pref ?? candidate;
}

export async function embedTextWithFallback(input: {
  text: string;
  model?: string;
  allowFallback?: boolean;
  baseUrl?: string;
}) {
  const baseUrl = input.baseUrl || config.localAIAPI.endpoint;
  const allowFallback = input.allowFallback !== false;
  const preferred = (input.model || '').trim();

  const available = await listAvailableModels(baseUrl);

  // Cache capability: if the Local AI API doesn't implement embeddings, fall back immediately.
  const remoteSupported = await isRemoteEmbeddingsSupported(baseUrl);
  if (!remoteSupported) {
    return { model: HASH_EMBEDDING_MODEL, embedding: embedTextHashed(input.text) };
  }

  const envPreferred = (process.env.DEFAULT_EMBEDDING_MODEL || '').trim();
  const envFallbacks = splitCsv(process.env.FALLBACK_EMBEDDING_MODELS);

  const candidatesRaw = [
    preferred,
    !preferred ? envPreferred : '',
    ...envFallbacks,
    ...DEFAULT_EMBEDDING_CANDIDATES,
  ].filter(Boolean);

  const candidates = available
    ? candidatesRaw
        .filter((c, idx) => candidatesRaw.indexOf(c) === idx)
        .filter(c => isModelAvailable(c, available))
    : candidatesRaw.filter((c, idx) => candidatesRaw.indexOf(c) === idx);

  if (!candidates.length) {
    const hint = preferred || envPreferred;
    const msg = hint
      ? `No embedding model found for "${hint}". Configure DEFAULT_EMBEDDING_MODEL (and install the model on the LLM server).`
      : `No embedding model configured. Set DEFAULT_EMBEDDING_MODEL on the backend and ensure the model exists on the LLM server.`;
    throw new Error(msg);
  }

  const errors: string[] = [];
  const networkErrors: string[] = [];

  const looksLikeNetworkFailure = (message: string) => {
    const m = (message || '').toLowerCase();
    return (
      m.includes('fetch failed') ||
      m.includes('econnrefused') ||
      m.includes('enotfound') ||
      m.includes('etimedout') ||
      m.includes('socket') ||
      m.includes('network') ||
      m.includes('request timeout')
    );
  };

  for (const candidate of candidates) {
    const modelName = available ? resolveModelName(candidate, available) : candidate;
    try {
      const embedding = await tryEmbedOnce({ baseUrl, model: modelName, text: input.text });
      return { model: modelName, embedding };
    } catch (err) {
      const noSupport = Boolean((err as any)?.noEmbeddingsSupport);
      const missingEndpoint = Boolean((err as any)?.missingEmbeddingsEndpoint);
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${modelName}: ${message}`);
      if (looksLikeNetworkFailure(message)) {
        networkErrors.push(`${modelName}: ${message}`);
      }
      if (!allowFallback) break;
      if (missingEndpoint) {
        // If the API doesn't have embeddings at all, use deterministic hashed embeddings instead.
        return { model: HASH_EMBEDDING_MODEL, embedding: embedTextHashed(input.text) };
      }
      if (!noSupport) continue;
    }
  }

  const detail = errors.slice(0, 5).join(' | ');

  // Best-effort: if the server is reachable for embeddings, we still prefer "real" embeddings. But if
  // every candidate failed due to network errors, fall back to deterministic hashed embeddings so
  // vector indexing does not spam logs or break unrelated actions.
  if (allowFallback && networkErrors.length > 0 && networkErrors.length === errors.length) {
    return { model: HASH_EMBEDDING_MODEL, embedding: embedTextHashed(input.text) };
  }

  throw new Error(
    `Embedding failed. Set DEFAULT_EMBEDDING_MODEL to an embedding-capable model supported by your LLM server. Details: ${detail}`
  );
}

let remoteEmbeddingsSupportCache: { baseUrl: string; ok: boolean; checkedAt: number } | null = null;
async function isRemoteEmbeddingsSupported(baseUrl: string) {
  const now = Date.now();
  if (remoteEmbeddingsSupportCache && remoteEmbeddingsSupportCache.baseUrl === baseUrl && now - remoteEmbeddingsSupportCache.checkedAt < 5 * 60 * 1000) {
    return remoteEmbeddingsSupportCache.ok;
  }

  // Probe the most likely endpoint. Any non-404 response implies the server has an embeddings route.
  try {
    const r = await fetch(`${baseUrl}/api/llm/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'probe', input: 'ping' }),
    });
    const ok = r.status !== 404;
    remoteEmbeddingsSupportCache = { baseUrl, ok, checkedAt: now };
    return ok;
  } catch {
    // If the probe fails (network), don't force hashed embeddings silently.
    remoteEmbeddingsSupportCache = { baseUrl, ok: true, checkedAt: now };
    return true;
  }
}
