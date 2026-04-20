import { z } from 'zod';
import { embedText } from '../../../api';
import type { ToolDefinition } from '../types';

const ResultSchema = z.object({
  model: z.string().optional(),
  dim: z.number().int().positive().optional(),
  embedding: z.array(z.number()),
});

export const embedTextTool: ToolDefinition<{ text: string; model?: string }, z.infer<typeof ResultSchema>> = {
  name: 'embedText',
  description: 'Internal embedding call for semantic retrieval (not exposed to planner).',
  category: 'read',
  exposedToPlanner: false,
  paramsSchema: z.object({
    text: z.string().min(1),
    model: z.string().min(1).optional(),
  }),
  resultSchema: ResultSchema,
  async execute(_context, params) {
    return await embedText({ text: params.text, model: params.model });
  },
};

