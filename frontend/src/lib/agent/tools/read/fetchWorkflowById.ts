import { z } from 'zod';
import { fetchWorkflowById } from '../../../api';
import { WorkflowDefinitionSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const fetchWorkflowByIdTool: ToolDefinition<{ workflowId: string }, z.infer<typeof WorkflowDefinitionSchema>> = {
  name: 'fetchWorkflowById',
  description: 'Fetch a workflow definition by id.',
  category: 'read',
  paramsSchema: z.object({
    workflowId: z.string().min(1),
  }),
  resultSchema: WorkflowDefinitionSchema,
  async execute(_context, params) {
    return (await fetchWorkflowById(params.workflowId)) as unknown as z.infer<typeof WorkflowDefinitionSchema>;
  },
};

