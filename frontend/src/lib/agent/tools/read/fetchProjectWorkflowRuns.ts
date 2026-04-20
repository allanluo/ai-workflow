import { z } from 'zod';
import { fetchProjectWorkflowRuns } from '../../../api';
import type { ToolDefinition } from '../types';
import { WorkflowRunListSchema } from '../schemas';

type Params = { workflowVersionId?: string };

export const fetchProjectWorkflowRunsTool: ToolDefinition<
  Params,
  z.infer<typeof WorkflowRunListSchema>
> = {
  name: 'fetchProjectWorkflowRuns',
  description: 'List workflow runs for the current project (optionally filtered by workflow version).',
  category: 'read',
  paramsSchema: z.object({ workflowVersionId: z.string().min(1).optional() }),
  resultSchema: WorkflowRunListSchema,
  execute: async (context, params) => {
    return (await fetchProjectWorkflowRuns(context.projectId, params.workflowVersionId)) as unknown as z.infer<
      typeof WorkflowRunListSchema
    >;
  },
};

