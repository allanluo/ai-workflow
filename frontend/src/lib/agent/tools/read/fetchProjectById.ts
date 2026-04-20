import { z } from 'zod';
import { fetchProjectById } from '../../../api';
import type { ToolDefinition } from '../types';
import { ProjectSchema } from '../schemas';

type Params = {};

export const fetchProjectByIdTool: ToolDefinition<Params, z.infer<typeof ProjectSchema>> = {
  name: 'fetchProjectById',
  description: 'Fetch the current project by id.',
  category: 'read',
  paramsSchema: z.object({}).strict(),
  resultSchema: ProjectSchema,
  execute: async (context) => {
    return (await fetchProjectById(context.projectId)) as unknown as z.infer<typeof ProjectSchema>;
  },
};

