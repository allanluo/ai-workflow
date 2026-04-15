import type { Skill, SkillContext, SkillResult } from '../types';
import { fetchProjectAssets, createAsset } from '../../api';

export const addSceneSkill: Skill = {
  name: 'addScene',
  description: 'Adds a new scene to the project',
  keywords: ['scene', 'add', 'new', 'create'],
  examples: ['Add a new scene', 'Create a new scene', 'I want to add a scene'],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      const assets = await fetchProjectAssets(context.projectId);
      const sceneCount = assets.filter(a => a.asset_type === 'scene').length;
      const newSceneNumber = sceneCount + 1;

      const newScene = await createAsset({
        projectId: context.projectId,
        asset_type: 'scene',
        asset_category: 'scene',
        title: `Scene ${newSceneNumber}`,
        content: { description: `Description for Scene ${newSceneNumber}` },
        metadata: {},
        source_mode: 'copilot',
      });

      return {
        success: true,
        message: `I've created Scene ${newSceneNumber} in your project. You can now edit its content!`,
        data: { assetId: newScene.id },
        action: {
          type: 'navigate',
          payload: { path: `/projects/${context.projectId}/scenes` },
        },
      };
    } catch (error) {
      console.error('Add scene skill error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error adding the scene. Please try again.',
      };
    }
  },
};
