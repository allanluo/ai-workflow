import { z } from 'zod';
import { generateProjectVideo } from '../../../api';
import { VideoGenerationResultSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const generateVideoTool: ToolDefinition<
  { prompt: string; workflow?: string; width?: number; height?: number },
  z.infer<typeof VideoGenerationResultSchema>
> = {
  name: 'generateVideo',
  description: 'Generate a text-to-video job for the current project.',
  category: 'exec',
  paramsSchema: z.object({
    prompt: z.string().min(1),
    workflow: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  resultSchema: VideoGenerationResultSchema,
  async execute(context, params) {
    if (!context.projectId) throw new Error('Missing projectId in tool context');
    return (await generateProjectVideo({
      projectId: context.projectId,
      prompt: params.prompt,
      workflow: params.workflow,
      width: params.width,
      height: params.height,
    })) as unknown as z.infer<typeof VideoGenerationResultSchema>;
  },
};
