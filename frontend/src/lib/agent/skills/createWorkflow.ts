import type { Skill, SkillContext, SkillResult } from '../types';
import { executeTool } from '../tools';

export const createWorkflowSkill: Skill = {
  name: 'createWorkflow',
  description: 'Creates a new workflow based on user requirements',
  keywords: ['workflow', 'create', 'make', 'build', 'music video', 'song', 'mv'],
  examples: [
    'Create a workflow for music video',
    'Make a new workflow for my song',
    'I want to create a workflow',
    'Build a music video workflow',
    'Help me create a workflow for an MV',
  ],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      const res = await executeTool('proposeCreateWorkflow', context, {
        request: input?.trim() || 'Create a new workflow',
      });
      if (!res.ok) return { success: false, message: res.error.message };
      const proposal = (res.data as any)?.proposal;
      if (!proposal) return { success: false, message: 'No proposal returned.' };

      return {
        success: true,
        message: `I can create a new workflow. Review the proposal and type /apply to create it.`,
        proposal,
      };
    } catch (error) {
      console.error('Create workflow skill error:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error creating the workflow. Please try again.',
      };
    }
  },
};
