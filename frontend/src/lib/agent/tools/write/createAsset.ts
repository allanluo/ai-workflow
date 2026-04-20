import { z } from 'zod';
import { createAsset } from '../../../api';
import type { ToolDefinition } from '../types';
import { AssetSchema } from '../schemas';

type Params = {
  asset_type: string;
  asset_category: string;
  title: string;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source_mode: 'manual' | 'copilot' | 'workflow' | 'import' | 'system';
  status?: 'draft' | 'needs_revision' | 'ready' | 'locked' | 'deprecated' | 'failed';
};

export const createAssetTool: ToolDefinition<Params, z.infer<typeof AssetSchema>> = {
  name: 'createAsset',
  description: 'Create a new asset in the current project.',
  category: 'write',
  exposedToPlanner: false,
  paramsSchema: z.object({
    asset_type: z.string().min(1),
    asset_category: z.string().min(1),
    title: z.string().min(1),
    content: z.record(z.unknown()),
    metadata: z.record(z.unknown()).optional(),
    source_mode: z.enum(['manual', 'copilot', 'workflow', 'import', 'system']),
    status: z.enum(['draft', 'needs_revision', 'ready', 'locked', 'deprecated', 'failed']).optional(),
  }),
  resultSchema: AssetSchema,
  execute: async (context, params) => {
    return (await createAsset({
      projectId: context.projectId,
      asset_type: params.asset_type,
      asset_category: params.asset_category,
      title: params.title,
      content: params.content,
      metadata: params.metadata ?? {},
      source_mode: params.source_mode,
      status: params.status,
    })) as unknown as z.infer<typeof AssetSchema>;
  },
};
