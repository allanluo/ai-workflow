import { z } from 'zod';
import { createWorkflow } from '../../../api';
import type { ToolDefinition } from '../types';
import { WorkflowDefinitionSchema } from '../schemas';

type Params = {
  title: string;
  description?: string;
  mode: 'simple' | 'guided' | 'advanced';
  template_type: string;
  defaults?: Record<string, unknown>;
  nodes?: unknown[];
  edges?: unknown[];
  metadata?: Record<string, unknown>;
};

export const createWorkflowTool: ToolDefinition<Params, z.infer<typeof WorkflowDefinitionSchema>> = {
  name: 'createWorkflow',
  description: 'Create a workflow definition for the current project.',
  category: 'write',
  exposedToPlanner: false,
  paramsSchema: z.object({
    title: z.string().min(1),
    description: z.string().default(''),
    mode: z.enum(['simple', 'guided', 'advanced']),
    template_type: z.string().min(1),
    defaults: z.record(z.unknown()).optional(),
    nodes: z.array(z.unknown()).optional(),
    edges: z.array(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  resultSchema: WorkflowDefinitionSchema,
  execute: async (context, params) => {
    return (await createWorkflow({
      projectId: context.projectId,
      title: params.title,
      description: params.description ?? '',
      mode: params.mode,
      template_type: params.template_type,
      defaults: params.defaults,
      nodes: params.nodes,
      edges: params.edges,
      metadata: params.metadata,
    })) as unknown as z.infer<typeof WorkflowDefinitionSchema>;
  },
};
