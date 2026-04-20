import { z } from 'zod';
import { fetchProjectWorkflows } from '../../../api';
import type { ToolDefinition } from '../types';

type WorkflowLike = {
  id: string;
  title?: string;
  updated_at?: string;
  current_version_id?: string | null;
  nodes?: unknown[];
};

function workflowHasNodeType(workflow: WorkflowLike, nodeType: string) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  return nodes.some(n => {
    if (!n || typeof n !== 'object') return false;
    const type = (n as Record<string, unknown>).type;
    return typeof type === 'string' && type === nodeType;
  });
}

export const pickWorkflowByNodeTypeTool: ToolDefinition<
  { nodeType: string },
  {
    found: boolean;
    workflowId?: string;
    workflowVersionId?: string | null;
    workflowTitle?: string;
    reason?: string;
  }
> = {
  name: 'pickWorkflowByNodeType',
  description:
    'Pick the most recently updated workflow in this project that contains a node of the given type (e.g. generate_shot_plan).',
  category: 'read',
  exposedToPlanner: true,
  paramsSchema: z.object({
    nodeType: z.string().min(1),
  }),
  resultSchema: z
    .object({
      found: z.boolean(),
      workflowId: z.string().optional(),
      workflowVersionId: z.string().nullable().optional(),
      workflowTitle: z.string().optional(),
      reason: z.string().optional(),
    })
    .passthrough(),
  async execute(context, params) {
    const projectId = context.projectId;
    const workflows = (await fetchProjectWorkflows(projectId)) as unknown as WorkflowLike[];
    const candidates = (workflows ?? [])
      .filter(w => w && typeof w === 'object' && typeof w.id === 'string')
      .filter(w => workflowHasNodeType(w, params.nodeType))
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());

    const picked = candidates[0] ?? null;
    if (!picked) {
      return {
        found: false,
        reason: `No workflow found containing node type "${params.nodeType}". Create or select a workflow first.`,
      };
    }

    return {
      found: true,
      workflowId: picked.id,
      workflowVersionId: picked.current_version_id ?? null,
      workflowTitle: typeof picked.title === 'string' ? picked.title : undefined,
    };
  },
};

