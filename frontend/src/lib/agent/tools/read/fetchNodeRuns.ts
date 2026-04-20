import { z } from 'zod';
import { fetchNodeRuns } from '../../../api';
import { NodeRunListSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const fetchNodeRunsTool: ToolDefinition<{ workflowRunId: string }, z.infer<typeof NodeRunListSchema>> = {
  name: 'fetchNodeRuns',
  description: 'Fetch node runs for a workflow run.',
  category: 'read',
  paramsSchema: z.object({
    workflowRunId: z.string().min(1),
  }),
  resultSchema: NodeRunListSchema,
  async execute(_context, params) {
    return (await fetchNodeRuns(params.workflowRunId)) as unknown as z.infer<typeof NodeRunListSchema>;
  },
};

