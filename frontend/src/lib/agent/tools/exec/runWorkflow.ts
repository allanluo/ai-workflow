import { z } from 'zod';
import { createWorkflowRun, fetchWorkflowById } from '../../../api';
import { WorkflowRunSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const runWorkflowTool: ToolDefinition<
  { workflowId?: string; workflowVersionId?: string; trigger_source?: string },
  z.infer<typeof WorkflowRunSchema>
> = {
  name: 'runWorkflow',
  description: 'Start a workflow run (uses workflowVersionId directly or resolves it from workflowId).',
  category: 'exec',
  paramsSchema: z.object({
    workflowId: z.string().min(1).optional(),
    workflowVersionId: z.string().min(1).optional(),
    trigger_source: z.string().optional(),
  }),
  resultSchema: WorkflowRunSchema,
  async execute(context, params) {
    const workflowVersionId =
      params.workflowVersionId ||
      (params.workflowId
        ? (await fetchWorkflowById(params.workflowId)).current_version_id || null
        : null);

    if (!workflowVersionId) {
      throw new Error('Missing workflowVersionId (select a workflow or pass workflowVersionId).');
    }

    return (await createWorkflowRun({
      workflowVersionId,
      trigger_source: params.trigger_source ?? 'copilot',
    })) as unknown as z.infer<typeof WorkflowRunSchema>;
  },
};

