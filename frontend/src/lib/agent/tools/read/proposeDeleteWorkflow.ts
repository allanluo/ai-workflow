import { z } from 'zod';
import { fetchWorkflowById } from '../../../api';
import type { Proposal } from '../../types';
import type { ToolDefinition } from '../types';

const ResultSchema = z.object({
  proposal: z.unknown(),
});

export const proposeDeleteWorkflowTool: ToolDefinition<
  { workflowId: string; reason?: string },
  z.infer<typeof ResultSchema>
> = {
  name: 'proposeDeleteWorkflow',
  description: 'Create a proposal to delete a workflow (no changes are applied).',
  category: 'read',
  paramsSchema: z.object({
    workflowId: z.string().min(1),
    reason: z.string().optional(),
  }),
  resultSchema: ResultSchema,
  async execute(context, params) {
    const workflow = await fetchWorkflowById(params.workflowId);
    const title = (workflow?.title ?? '').toString();
    const summary = `Delete workflow "${title || params.workflowId}"`;
    const proposal: Proposal = {
      kind: 'delete_workflow',
      workflowId: params.workflowId,
      baseWorkflowUpdatedAt: (workflow as any)?.updated_at ?? null,
      summary,
      metadata: {
        reason: params.reason ?? '',
        projectId: context.projectId,
      },
      afterApply: { type: 'navigate', path: `/projects/${context.projectId}/workflows` },
    };
    return { proposal };
  },
};

