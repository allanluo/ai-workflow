import { z } from 'zod';
import { updateWorkflow } from '../../../api';
import type { ToolDefinition } from '../types';

type Params = {
  workflowId: string;
  title?: string;
  description?: string;
  mode?: 'simple' | 'guided' | 'advanced';
  status?: 'draft' | 'testing' | 'approved' | 'deprecated';
  defaults?: Record<string, unknown>;
  nodes?: unknown[];
  edges?: unknown[];
  metadata?: Record<string, unknown>;
};

export const updateWorkflowTool: ToolDefinition<Params, { success: boolean }> = {
  name: 'updateWorkflow',
  description: 'Update an existing workflow with new properties, nodes, or edges.',
  category: 'write',
  paramsSchema: z.object({
    workflowId: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    mode: z.enum(['simple', 'guided', 'advanced']).optional(),
    status: z.enum(['draft', 'testing', 'approved', 'deprecated']).optional(),
    defaults: z.record(z.unknown()).optional(),
    nodes: z.array(z.unknown()).optional(),
    edges: z.array(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  resultSchema: z.object({ success: z.boolean() }),
  execute: async (context, params) => {
    await updateWorkflow(params);
    return { success: true };
  },
};