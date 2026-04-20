import { z } from 'zod';
import { fetchProjectAssets } from '../../../api';
import type { ToolDefinition } from '../types';

type AssetLike = {
  id: string;
  asset_type?: string;
  title?: string | null;
  updated_at?: string;
  current_version?: { workflow_run_id?: string | null; workflowRunId?: string | null } | null;
};

export const findAssetsProducedByWorkflowRunTool: ToolDefinition<
  { workflowRunId: string; assetType?: string; limit?: number; requireNonEmpty?: boolean },
  { items: Array<{ id: string; asset_type?: string; title?: string | null; updated_at?: string }> }
> = {
  name: 'findAssetsProducedByWorkflowRun',
  description:
    'Find assets whose current version was produced by a given workflow run (best-effort verification).',
  category: 'read',
  exposedToPlanner: true,
  paramsSchema: z.object({
    workflowRunId: z.string().min(1),
    assetType: z.string().optional(),
    limit: z.number().int().positive().max(50).optional(),
    requireNonEmpty: z.boolean().optional(),
  }),
  resultSchema: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        asset_type: z.string().optional(),
        title: z.string().nullable().optional(),
        updated_at: z.string().optional(),
      })
    ),
  }),
  async execute(context, params) {
    const limit = params.limit ?? 10;
    const assets = (await fetchProjectAssets(context.projectId, params.assetType)) as unknown as AssetLike[];
    const wanted = params.workflowRunId;

    const items = (assets ?? [])
      .filter(a => a && typeof a === 'object' && typeof a.id === 'string')
      .filter(a => {
        const cv = a.current_version;
        const runId = (cv as any)?.workflow_run_id ?? (cv as any)?.workflowRunId ?? null;
        return typeof runId === 'string' && runId === wanted;
      })
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
      .slice(0, limit)
      .map(a => ({ id: a.id, asset_type: a.asset_type, title: a.title ?? null, updated_at: a.updated_at }));

    if (params.requireNonEmpty && items.length === 0) {
      const typeHint = params.assetType ? ` (${params.assetType})` : '';
      throw new Error(
        `No assets${typeHint} were produced by workflow run ${wanted.slice(0, 8)}…. Check the workflow outputs and try again.`
      );
    }

    return { items };
  },
};
