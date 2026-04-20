import { and, eq } from 'drizzle-orm';
import { db } from './client.js';
import { copilotVectorIndex } from './schema.js';

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type CopilotVectorIndexRecord = {
  id: string;
  project_id: string;
  context_type: string;
  item_id: string;
  item_version_id: string | null;
  chunk_id: string;
  chunk_index: number;
  chunk_count: number;
  model: string;
  dim: number;
  embedding: number[];
  content: string;
  content_hash: string;
  source_updated_at: string;
  indexed_at: string;
};

function mapRow(row: typeof copilotVectorIndex.$inferSelect): CopilotVectorIndexRecord {
  return {
    id: row.id,
    project_id: row.projectId,
    context_type: row.contextType,
    item_id: row.itemId,
    item_version_id: row.itemVersionId ?? null,
    chunk_id: row.chunkId ?? '0',
    chunk_index: row.chunkIndex ?? 0,
    chunk_count: row.chunkCount ?? 1,
    model: row.model,
    dim: row.dim,
    embedding: safeParseJson(row.embeddingJson, []),
    content: row.content ?? '',
    content_hash: row.contentHash ?? '',
    source_updated_at: row.sourceUpdatedAt ?? '',
    indexed_at: row.indexedAt,
  };
}

export function getCopilotVectorIndexItem(id: string): CopilotVectorIndexRecord | null {
  const row = db.select().from(copilotVectorIndex).where(eq(copilotVectorIndex.id, id)).get();
  return row ? mapRow(row) : null;
}

export function upsertCopilotVectorIndexItem(input: {
  id: string;
  projectId: string;
  contextType: string;
  itemId: string;
  itemVersionId?: string | null;
  chunkId?: string;
  chunkIndex?: number;
  chunkCount?: number;
  model: string;
  embedding: number[]; // normalized
  content: string;
  contentHash: string;
  sourceUpdatedAt: string;
  indexedAt?: string;
}) {
  const now = input.indexedAt ?? new Date().toISOString();
  const existing = db.select().from(copilotVectorIndex).where(eq(copilotVectorIndex.id, input.id)).get();

  const payload = {
    id: input.id,
    projectId: input.projectId,
    contextType: input.contextType,
    itemId: input.itemId,
    itemVersionId: input.itemVersionId ?? null,
    chunkId: input.chunkId ?? '0',
    chunkIndex: input.chunkIndex ?? 0,
    chunkCount: input.chunkCount ?? 1,
    model: input.model,
    dim: input.embedding.length,
    embeddingJson: JSON.stringify(input.embedding),
    content: input.content,
    contentHash: input.contentHash,
    sourceUpdatedAt: input.sourceUpdatedAt,
    indexedAt: now,
  } satisfies typeof copilotVectorIndex.$inferInsert;

  if (!existing) {
    db.insert(copilotVectorIndex).values(payload).run();
    return getCopilotVectorIndexItem(input.id)!;
  }

  db.update(copilotVectorIndex)
    .set({
      itemVersionId: payload.itemVersionId,
      chunkId: payload.chunkId,
      chunkIndex: payload.chunkIndex,
      chunkCount: payload.chunkCount,
      model: payload.model,
      dim: payload.dim,
      embeddingJson: payload.embeddingJson,
      content: payload.content,
      contentHash: payload.contentHash,
      sourceUpdatedAt: payload.sourceUpdatedAt,
      indexedAt: payload.indexedAt,
    })
    .where(eq(copilotVectorIndex.id, input.id))
    .run();

  return getCopilotVectorIndexItem(input.id)!;
}

export function deleteCopilotVectorIndexItem(id: string) {
  db.delete(copilotVectorIndex).where(eq(copilotVectorIndex.id, id)).run();
  return true;
}

export function deleteCopilotVectorIndexForItem(input: {
  projectId: string;
  contextType: string;
  itemId: string;
  model?: string;
}) {
  const conditions = [
    eq(copilotVectorIndex.projectId, input.projectId),
    eq(copilotVectorIndex.contextType, input.contextType),
    eq(copilotVectorIndex.itemId, input.itemId),
  ];
  if (input.model) conditions.push(eq(copilotVectorIndex.model, input.model));
  db.delete(copilotVectorIndex).where(and(...conditions)).run();
  return true;
}

function dot(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

export type CopilotVectorSearchHit = {
  id: string;
  context_type: string;
  item_id: string;
  item_version_id: string | null;
  chunk_id: string;
  chunk_index: number;
  chunk_count: number;
  model: string;
  score: number;
  content: string;
  indexed_at: string;
};

export function searchCopilotVectorIndex(input: {
  projectId: string;
  queryEmbedding: number[]; // normalized
  model: string;
  contextTypes?: string[];
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(50, input.limit ?? 12));
  const conditions = [
    eq(copilotVectorIndex.projectId, input.projectId),
    eq(copilotVectorIndex.model, input.model),
  ];
  if (input.contextTypes && input.contextTypes.length > 0) {
    // drizzle doesn't have `inArray` imported elsewhere; filter in memory for now.
  }

  const rows = db.select().from(copilotVectorIndex).where(and(...conditions)).all();

  const allowedTypes = input.contextTypes?.length ? new Set(input.contextTypes) : null;

  const scored = rows
    .map(row => {
      if (allowedTypes && !allowedTypes.has(row.contextType)) return null;
      const emb = safeParseJson<number[]>(row.embeddingJson, []);
      if (!Array.isArray(emb) || emb.length === 0) return null;
      const score = dot(input.queryEmbedding, emb);
      return {
        id: row.id,
        context_type: row.contextType,
        item_id: row.itemId,
        item_version_id: row.itemVersionId ?? null,
        chunk_id: row.chunkId ?? '0',
        chunk_index: row.chunkIndex ?? 0,
        chunk_count: row.chunkCount ?? 1,
        model: row.model,
        score,
        content: row.content ?? '',
        indexed_at: row.indexedAt,
      } satisfies CopilotVectorSearchHit;
    })
    .filter(Boolean) as CopilotVectorSearchHit[];

  scored.sort((a, b) => b.score - a.score);
  return { items: scored.slice(0, limit) };
}

export function getCopilotVectorIndexStatus(input: { projectId: string }) {
  const rows = db
    .select()
    .from(copilotVectorIndex)
    .where(eq(copilotVectorIndex.projectId, input.projectId))
    .all();

  const byModel: Record<
    string,
    {
      total: number;
      by_context_type: Record<string, number>;
      last_indexed_at: string | null;
      max_chunk_count: number;
    }
  > = {};

  for (const row of rows) {
    const model = row.model || 'unknown';
    if (!byModel[model]) byModel[model] = { total: 0, by_context_type: {}, last_indexed_at: null, max_chunk_count: 1 };
    byModel[model].total += 1;
    byModel[model].by_context_type[row.contextType] = (byModel[model].by_context_type[row.contextType] ?? 0) + 1;
    const ts = row.indexedAt;
    if (ts && (!byModel[model].last_indexed_at || ts > (byModel[model].last_indexed_at as string))) {
      byModel[model].last_indexed_at = ts;
    }
    const cc = row.chunkCount ?? 1;
    if (cc > byModel[model].max_chunk_count) byModel[model].max_chunk_count = cc;
  }

  return {
    project_id: input.projectId,
    total: rows.length,
    models: byModel,
  };
}
