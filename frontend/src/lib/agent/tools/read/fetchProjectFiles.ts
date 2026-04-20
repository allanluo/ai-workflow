import { z } from 'zod';
import { fetchProjectFiles } from '../../../api';
import { FileRecordListSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const fetchProjectFilesTool: ToolDefinition<{}, z.infer<typeof FileRecordListSchema>> = {
  name: 'fetchProjectFiles',
  description: 'Fetch files uploaded to the current project.',
  category: 'read',
  paramsSchema: z.object({}).strict(),
  resultSchema: FileRecordListSchema,
  async execute(context) {
    return (await fetchProjectFiles(context.projectId)) as unknown as z.infer<typeof FileRecordListSchema>;
  },
};

