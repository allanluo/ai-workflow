import { z } from 'zod';
import { fetchAsset } from '../../../api';
import type { ToolDefinition } from '../types';
import { AssetSchema } from '../schemas';

type Params = { assetId: string };

export const fetchAssetTool: ToolDefinition<Params, z.infer<typeof AssetSchema>> = {
  name: 'fetchAsset',
  description: 'Fetch a single asset by id.',
  category: 'read',
  paramsSchema: z.object({ assetId: z.string().min(1) }),
  resultSchema: AssetSchema,
  execute: async (_context, params) => {
    return (await fetchAsset(params.assetId)) as unknown as z.infer<typeof AssetSchema>;
  },
};
