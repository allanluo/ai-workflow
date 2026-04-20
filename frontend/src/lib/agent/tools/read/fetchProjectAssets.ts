import { z } from 'zod';
import { fetchProjectAssets } from '../../../api';
import type { ToolDefinition } from '../types';
import { AssetListSchema } from '../schemas';

type Params = { assetType?: string };

export const fetchProjectAssetsTool: ToolDefinition<Params, z.infer<typeof AssetListSchema>> = {
  name: 'fetchProjectAssets',
  description: 'List assets for the current project (optionally filtered by asset_type).',
  category: 'read',
  paramsSchema: z.object({ assetType: z.string().min(1).optional() }),
  resultSchema: AssetListSchema,
  execute: async (context, params) => {
    return (await fetchProjectAssets(context.projectId, params.assetType)) as unknown as z.infer<
      typeof AssetListSchema
    >;
  },
};
