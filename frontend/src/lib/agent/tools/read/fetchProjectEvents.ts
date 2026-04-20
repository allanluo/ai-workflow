import { z } from 'zod';
import { fetchProjectEvents } from '../../../api';
import { ProjectEventListSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const fetchProjectEventsTool: ToolDefinition<{}, z.infer<typeof ProjectEventListSchema>> = {
  name: 'fetchProjectEvents',
  description: 'Fetch recent project events.',
  category: 'read',
  paramsSchema: z.object({}).strict(),
  resultSchema: ProjectEventListSchema,
  async execute(context) {
    return (await fetchProjectEvents(context.projectId)) as unknown as z.infer<typeof ProjectEventListSchema>;
  },
};

