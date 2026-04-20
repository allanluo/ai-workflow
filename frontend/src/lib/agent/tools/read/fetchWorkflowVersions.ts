import { z } from 'zod';
import { fetchWorkflowVersions } from '../../../api';
import { WorkflowVersionListSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const fetchWorkflowVersionsTool: ToolDefinition<
  { workflowId: string },
  z.infer<typeof WorkflowVersionListSchema>
> = {
  name: 'fetchWorkflowVersions',
  description: 'Fetch workflow versions for a workflow definition.',
  category: 'read',
  paramsSchema: z.object({
    workflowId: z.string().min(1),
  }),
  resultSchema: WorkflowVersionListSchema,
  async execute(_context, params) {
    return (await fetchWorkflowVersions(params.workflowId)) as unknown as z.infer<
      typeof WorkflowVersionListSchema
    >;
  },
};

