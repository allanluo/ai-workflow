import { z } from 'zod';
import { fetchProjectAssets } from '../../../api';
import type { ToolDefinition } from '../types';

type AssetLike = {
  id: string;
  asset_type?: string;
  title?: string | null;
  updated_at?: string;
  current_version?: { content?: unknown } | null;
};

function normalize(text: string) {
  return (text || '').toLowerCase();
}

function stringifyContent(value: unknown) {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value ?? {});
  } catch {
    return '';
  }
}

export const searchAssetsTool: ToolDefinition<
  { query: string; assetType?: string; limit?: number },
  { items: Array<{ id: string; asset_type?: string; title?: string | null; updated_at?: string; score: number }> }
> = {
  name: 'searchAssets',
  description: 'Search project assets by title/content (keyword match; deterministic, no embeddings).',
  category: 'read',
  exposedToPlanner: true,
  paramsSchema: z.object({
    query: z.string().min(1),
    assetType: z.string().optional(),
    limit: z.number().int().positive().max(50).optional(),
  }),
  resultSchema: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        asset_type: z.string().optional(),
        title: z.string().nullable().optional(),
        updated_at: z.string().optional(),
        score: z.number(),
      })
    ),
  }),
  async execute(context, params) {
    const limit = params.limit ?? 10;
    const q = normalize(params.query.trim());
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 8);
    const assets = (await fetchProjectAssets(context.projectId, params.assetType)) as unknown as AssetLike[];

    const scored = (assets ?? [])
      .filter(a => a && typeof a === 'object' && typeof a.id === 'string')
      .map(a => {
        const title = typeof a.title === 'string' ? a.title : '';
        const contentStr = stringifyContent(a.current_version?.content);
        const hay = normalize(`${title}\n${contentStr}`);
        let score = 0;
        for (const t of terms) {
          if (!t) continue;
          if (hay.includes(t)) score += 1;
        }
        // small bonus for title match
        const titleLower = normalize(title);
        for (const t of terms) if (t && titleLower.includes(t)) score += 0.5;
        return { a, score };
      })
      .filter(x => x.score > 0)
      .sort((x, y) => {
        if (y.score !== x.score) return y.score - x.score;
        return new Date(y.a.updated_at ?? 0).getTime() - new Date(x.a.updated_at ?? 0).getTime();
      })
      .slice(0, limit)
      .map(x => ({
        id: x.a.id,
        asset_type: x.a.asset_type,
        title: x.a.title ?? null,
        updated_at: x.a.updated_at,
        score: x.score,
      }));

    return { items: scored };
  },
};

