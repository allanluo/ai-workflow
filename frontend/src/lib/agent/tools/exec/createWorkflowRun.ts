import { z } from 'zod';
import { createWorkflowRun } from '../../../api';
import { WorkflowRunSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const createWorkflowRunTool: ToolDefinition<
  { workflowVersionId: string; trigger_source?: string },
  z.infer<typeof WorkflowRunSchema>
> = {
  name: 'createWorkflowRun',
  description: 'Start a workflow run for a workflow version.',
  category: 'exec',
  paramsSchema: z.object({
    workflowVersionId: z.string().min(1),
    trigger_source: z.string().optional(),
  }),
  resultSchema: WorkflowRunSchema,
  async execute(_context, params) {
    return (await createWorkflowRun({
      workflowVersionId: params.workflowVersionId,
      trigger_source: params.trigger_source,
    })) as unknown as z.infer<typeof WorkflowRunSchema>;
  },
};
