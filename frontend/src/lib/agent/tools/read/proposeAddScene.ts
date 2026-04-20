import { z } from 'zod';
import type { Proposal } from '../../types';
import type { ToolDefinition } from '../types';
import { fetchProjectAssets } from '../../../api';

const ResultSchema = z.object({
  proposal: z.unknown(),
});

export const proposeAddSceneTool: ToolDefinition<
  { description?: string },
  z.infer<typeof ResultSchema>
> = {
  name: 'proposeAddScene',
  description: 'Create a proposal to add a new scene asset (no changes are applied).',
  category: 'read',
  paramsSchema: z.object({
    description: z.string().optional(),
  }),
  resultSchema: ResultSchema,
  async execute(context, params) {
    const assets = await fetchProjectAssets(context.projectId);
    const sceneCount = assets.filter(a => a.asset_type === 'scene').length;
    const newSceneNumber = sceneCount + 1;

    const proposal: Proposal = {
      kind: 'create_asset',
      projectId: context.projectId,
      summary: `Create Scene ${newSceneNumber}`,
      asset_type: 'scene',
      asset_category: 'scene',
      title: `Scene ${newSceneNumber}`,
      content: { description: params.description?.trim() || `Description for Scene ${newSceneNumber}` },
      metadata: {},
      source_mode: 'copilot',
      status: 'draft',
      afterApply: { type: 'navigate', path: `/projects/${context.projectId}/scenes` },
    };

    return { proposal };
  },
};

