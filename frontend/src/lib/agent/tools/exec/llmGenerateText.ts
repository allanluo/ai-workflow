import { z } from 'zod';
import { llmGenerateText } from '../../llmClient';
import type { ToolDefinition } from '../types';

const ResultSchema = z.object({
  text: z.string(),
});

export const llmGenerateTextTool: ToolDefinition<
  { prompt: string; model?: string; stream?: boolean },
  z.infer<typeof ResultSchema>
> = {
  name: 'llmGenerateText',
  description: 'Internal LLM call (not exposed to planner). Returns raw text from the configured model.',
  category: 'exec',
  exposedToPlanner: false,
  paramsSchema: z.object({
    prompt: z.string().min(1),
    model: z.string().min(1).optional(),
    stream: z.boolean().optional(),
  }),
  resultSchema: ResultSchema,
  async execute(_context, params) {
    const text = await llmGenerateText({
      model: params.model,
      prompt: params.prompt,
      stream: params.stream ?? false,
    });
    return { text };
  },
};

