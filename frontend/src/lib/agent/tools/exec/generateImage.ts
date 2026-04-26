import { z } from 'zod';
import { generateCharacterImage } from '../../../api';
import { ImageGenerationResultSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const generateImageTool: ToolDefinition<
  { prompt: string; negativePrompt?: string; width?: number; height?: number },
  z.infer<typeof ImageGenerationResultSchema>
> = {
  name: 'generateImage',
  description: 'Generate an image for the current project (returns a job id and optionally an image URL).',
  category: 'exec',
  paramsSchema: z.object({
    prompt: z.string().min(1),
    negativePrompt: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  resultSchema: ImageGenerationResultSchema,
  async execute(context, params) {
    if (!context.projectId) throw new Error('Missing projectId in tool context');
    return (await generateCharacterImage({
      projectId: context.projectId,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      width: params.width,
      height: params.height,
    })) as unknown as z.infer<typeof ImageGenerationResultSchema>;
  },
};
