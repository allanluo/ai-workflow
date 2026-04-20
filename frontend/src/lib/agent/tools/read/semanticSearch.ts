import { z } from 'zod';
import { semanticSearchCopilotIndex, type CopilotSemanticSearchHit } from '../../../api';
import type { ToolDefinition } from '../types';

export const semanticSearchTool: ToolDefinition<
  { query: string; contextTypes?: string[]; limit?: number; model?: string },
  { items: CopilotSemanticSearchHit[]; model: string }
> = {
  name: 'semanticSearch',
  description: 'Semantic search across indexed project items (persistent embeddings).',
  category: 'read',
  exposedToPlanner: true,
  paramsSchema: z.object({
    query: z.string().min(1),
    contextTypes: z.array(z.string()).optional(),
    limit: z.number().int().positive().max(50).optional(),
    model: z.string().optional(),
  }),
  resultSchema: z.object({
    model: z.string(),
    items: z.array(
      z.object({
        id: z.string(),
        context_type: z.string(),
        item_id: z.string(),
        item_version_id: z.string().nullable(),
        chunk_id: z.string(),
        chunk_index: z.number(),
        chunk_count: z.number(),
        model: z.string(),
        score: z.number(),
        content: z.string(),
        indexed_at: z.string(),
      })
    ),
  }),
  async execute(context, params) {
    return await semanticSearchCopilotIndex({
      projectId: context.projectId,
      query: params.query,
      model: params.model,
      context_types: params.contextTypes,
      limit: params.limit,
    });
  },
};
