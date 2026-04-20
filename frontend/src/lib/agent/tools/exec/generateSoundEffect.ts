import { z } from 'zod';
import { generateSoundEffect } from '../../../api';
import { SoundEffectGenerationResultSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const generateSoundEffectTool: ToolDefinition<
  {
    prompt: string;
    workflow?: string;
    duration_seconds?: number;
    batch_size?: number;
    negative_prompt?: string;
  },
  z.infer<typeof SoundEffectGenerationResultSchema>
> = {
  name: 'generateSoundEffect',
  description: 'Generate a sound effect job for the current project.',
  category: 'exec',
  paramsSchema: z.object({
    prompt: z.string().min(1),
    workflow: z.string().optional(),
    duration_seconds: z.number().int().positive().optional(),
    batch_size: z.number().int().positive().optional(),
    negative_prompt: z.string().optional(),
  }),
  resultSchema: SoundEffectGenerationResultSchema,
  async execute(context, params) {
    if (!context.projectId) throw new Error('Missing projectId in tool context');
    return (await generateSoundEffect({
      projectId: context.projectId,
      ...params,
    })) as unknown as z.infer<typeof SoundEffectGenerationResultSchema>;
  },
};
