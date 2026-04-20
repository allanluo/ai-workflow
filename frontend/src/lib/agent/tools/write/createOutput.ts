import { z } from 'zod';
import { createOutput } from '../../../api';
import type { ToolDefinition } from '../types';

type Params = {
  title: string;
  output_type: string;
};

export const createOutputTool: ToolDefinition<Params, { success: boolean }> = {
  name: 'createOutput',
  description: 'Create a new output configuration for the project.',
  category: 'write',
  paramsSchema: z.object({
    title: z.string().min(1),
    output_type: z.string().min(1),
  }),
  resultSchema: z.object({ success: z.boolean() }),
  execute: async (context, params) => {
    await createOutput({ projectId: context.projectId, ...params });
    return { success: true };
  },
};