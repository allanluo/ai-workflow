import type { Skill, SkillContext, SkillResult } from '../types';
import { executeTool } from '../tools';

export const addSceneSkill: Skill = {
  name: 'addScene',
  description: 'Adds a new scene to the project',
  keywords: ['scene', 'add', 'new', 'create'],
  examples: ['Add a new scene', 'Create a new scene', 'I want to add a scene'],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      const res = await executeTool('proposeAddScene', context, {
        description: input?.trim() || undefined,
      });
      if (!res.ok) return { success: false, message: res.error.message };
      const proposal = (res.data as any)?.proposal;
      if (!proposal) return { success: false, message: 'No proposal returned.' };

      return {
        success: true,
        message: `I can add a new scene. Review the proposal and type /apply to create it.`,
        proposal,
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
