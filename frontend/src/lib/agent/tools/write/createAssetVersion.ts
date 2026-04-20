import { z } from 'zod';
import { createAssetVersion } from '../../../api';
import type { ToolDefinition } from '../types';
import { AssetVersionSchema } from '../schemas';

type Params = {
  assetId: string;
  input: {
    content?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    status?: 'draft' | 'needs_revision' | 'ready' | 'locked' | 'deprecated' | 'failed';
    source_mode?: 'manual' | 'copilot' | 'workflow' | 'import' | 'system';
    locked_fields?: string[];
    make_current?: boolean;
  };
};

export const createAssetVersionTool: ToolDefinition<Params, z.infer<typeof AssetVersionSchema>> = {
  name: 'createAssetVersion',
  description: 'Create a new version for an asset (optionally making it current).',
  category: 'write',
  exposedToPlanner: false,
  paramsSchema: z.object({
    assetId: z.string().min(1),
    input: z
      .object({
        content: z.record(z.unknown()).optional(),
        metadata: z.record(z.unknown()).optional(),
        status: z
          .enum(['draft', 'needs_revision', 'ready', 'locked', 'deprecated', 'failed'])
          .optional(),
        source_mode: z.enum(['manual', 'copilot', 'workflow', 'import', 'system']).optional(),
        locked_fields: z.array(z.string()).optional(),
        make_current: z.boolean().optional(),
      })
      .passthrough(),
  }),
  resultSchema: AssetVersionSchema,
  execute: async (_context, params) => {
    return (await createAssetVersion(params.assetId, params.input)) as unknown as z.infer<
      typeof AssetVersionSchema
    >;
  },
};
