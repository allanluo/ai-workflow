import { z } from 'zod';
import { generateVideoFromImage } from '../../../api';
import { VideoGenerationResultSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const generateVideoFromImageTool: ToolDefinition<
  {
    prompt: string;
    workflow?: string;
    width?: number;
    height?: number;
    length?: number;
    reference_image_url: string;
  },
  z.infer<typeof VideoGenerationResultSchema>
> = {
  name: 'generateVideoFromImage',
  description: 'Generate an image-to-video job using a reference image URL.',
  category: 'exec',
  paramsSchema: z.object({
    prompt: z.string().min(1),
    workflow: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    length: z.number().int().positive().optional(),
    reference_image_url: z.string().min(1),
  }),
  resultSchema: VideoGenerationResultSchema,
  async execute(context, params) {
    if (!context.projectId) throw new Error('Missing projectId in tool context');
    return (await generateVideoFromImage({
      projectId: context.projectId,
      prompt: params.prompt,
      workflow: params.workflow,
      width: params.width,
      height: params.height,
      length: params.length,
      reference_image_url: params.reference_image_url,
    })) as unknown as z.infer<typeof VideoGenerationResultSchema>;
  },
};
