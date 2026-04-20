import { z } from 'zod';
import { fetchProjectWorkflows } from '../../../api';
import type { ToolDefinition } from '../types';
import { WorkflowDefinitionListSchema } from '../schemas';

type Params = {};

export const fetchProjectWorkflowsTool: ToolDefinition<
  Params,
  z.infer<typeof WorkflowDefinitionListSchema>
> = {
  name: 'fetchProjectWorkflows',
  description: 'List workflows for the current project.',
  category: 'read',
  paramsSchema: z.object({}).strict(),
  resultSchema: WorkflowDefinitionListSchema,
  execute: async context => {
    return (await fetchProjectWorkflows(context.projectId)) as unknown as z.infer<
      typeof WorkflowDefinitionListSchema
    >;
  },
};

