import { z } from 'zod';
import { generateVoiceOver } from '../../../api';
import { VoiceOverGenerationResultSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const generateVoiceOverTool: ToolDefinition<
  {
    text: string;
    template?: string;
    provider?: 'piper' | 'cosyvoice';
    speed?: number;
    volume?: number;
    prompt_text?: string;
    prompt_wav?: string;
    model_dir?: string;
  },
  z.infer<typeof VoiceOverGenerationResultSchema>
> = {
  name: 'generateVoiceOver',
  description: 'Generate a voice-over (TTS) job for the current project.',
  category: 'exec',
  paramsSchema: z.object({
    text: z.string().min(1),
    template: z.string().optional(),
    provider: z.enum(['piper', 'cosyvoice']).optional(),
    speed: z.number().optional(),
    volume: z.number().optional(),
    prompt_text: z.string().optional(),
    prompt_wav: z.string().optional(),
    model_dir: z.string().optional(),
  }),
  resultSchema: VoiceOverGenerationResultSchema,
  async execute(context, params) {
    if (!context.projectId) throw new Error('Missing projectId in tool context');
    return (await generateVoiceOver({
      projectId: context.projectId,
      ...params,
    })) as unknown as z.infer<typeof VoiceOverGenerationResultSchema>;
  },
};
