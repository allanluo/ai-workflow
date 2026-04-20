import { z } from 'zod';
import { fetchJobStatus } from '../../../api';
import { JobStatusSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const fetchJobStatusTool: ToolDefinition<{ jobId: string }, z.infer<typeof JobStatusSchema>> = {
  name: 'fetchJobStatus',
  description: 'Fetch a generation/job status by job id.',
  category: 'read',
  paramsSchema: z.object({
    jobId: z.string().min(1),
  }),
  resultSchema: JobStatusSchema,
  async execute(_context, params) {
    return (await fetchJobStatus(params.jobId)) as unknown as z.infer<typeof JobStatusSchema>;
  },
};
