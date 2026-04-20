import { z } from 'zod';
import type { Proposal } from '../../types';
import type { ToolDefinition } from '../types';
import { applyCopilotProposal } from '../../../api';

function isProposal(value: unknown): value is Proposal {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as Record<string, unknown>).kind;
  return (
    kind === 'asset_patch' ||
    kind === 'asset_update' ||
    kind === 'create_asset' ||
    kind === 'create_workflow' ||
    kind === 'workflow_patch' ||
    kind === 'delete_workflow'
  );
}

const ResultSchema = z
  .object({
    ok: z.boolean(),
    warning: z.string().optional(),
    assetVersionId: z.string().optional(),
    assetId: z.string().optional(),
    workflowId: z.string().optional(),
    workflowVersionId: z.string().optional(),
  })
  .passthrough();

export const applyProposalTool: ToolDefinition<{ proposal?: unknown }, z.infer<typeof ResultSchema>> = {
  name: 'applyProposal',
  description: 'Apply a proposal (creates a new version or new resource).',
  category: 'write',
  exposedToPlanner: true,
  paramsSchema: z.object({
    proposal: z.unknown(),
  }),
  resultSchema: ResultSchema,
  async execute(_context, params) {
    if (!isProposal(params.proposal)) {
      throw new Error('Invalid proposal object.');
    }
    const proposal = params.proposal as any;
    const projectId: string | undefined =
      proposal.projectId || proposal.metadata?.projectId || _context.projectId || undefined;
    if (!projectId) throw new Error('Missing projectId for apply.');
    const res = await applyCopilotProposal({
      projectId,
      proposal,
      confirmed: true,
    });
    return res.result as any;
  },
};
