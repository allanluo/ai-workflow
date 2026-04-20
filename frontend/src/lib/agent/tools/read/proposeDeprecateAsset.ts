import { z } from 'zod';
import { fetchAsset } from '../../../api';
import type { Proposal } from '../../types';
import type { ToolDefinition } from '../types';

const ResultSchema = z.object({
  proposal: z.unknown(),
});

export const proposeDeprecateAssetTool: ToolDefinition<
  { assetId: string; reason?: string },
  z.infer<typeof ResultSchema>
> = {
  name: 'proposeDeprecateAsset',
  description: 'Create a proposal to deprecate (soft-delete) an asset (no changes are applied).',
  category: 'read',
  paramsSchema: z.object({
    assetId: z.string().min(1),
    reason: z.string().optional(),
  }),
  resultSchema: ResultSchema,
  async execute(context, params) {
    const asset = await fetchAsset(params.assetId);
    const title = (asset?.title ?? '').toString();
    const summary = `Deprecate asset "${title || params.assetId}"`;
    const proposal: Proposal = {
      kind: 'asset_update',
      assetId: params.assetId,
      baseAssetUpdatedAt: (asset as any)?.updated_at ?? null,
      summary,
      updates: {
        status: 'deprecated',
        metadata: {
          ...(asset.metadata ?? {}),
          deprecated_reason: params.reason ?? '',
          deprecated_by: 'copilot',
          deprecated_at: new Date().toISOString(),
        },
      },
      metadata: {
        reason: params.reason ?? '',
        projectId: context.projectId,
      },
      afterApply: { type: 'navigate', path: `/projects/${context.projectId}/assets` },
    };
    return { proposal };
  },
};

