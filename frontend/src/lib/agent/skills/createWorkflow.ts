import type { Skill, SkillContext, SkillResult } from '../types';
import { createWorkflowDraftFromTemplate } from '../../workflowCatalog';
import { createWorkflow } from '../../api';

const WORKFLOW_TEMPLATES: Record<string, string> = {
  music_video: 'story_to_video',
  music_video_madonna: 'story_to_video',
  song_video: 'story_to_video',
  mv: 'story_to_video',
  narrated_story: 'narrated_story_video',
  story_video: 'narrated_story_video',
  default: 'story_to_video',
};

function detectTemplate(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('music') || lower.includes('song') || lower.includes('mv')) {
    return 'music_video';
  }
  if (lower.includes('narrat') || lower.includes('story')) {
    return 'narrated_story';
  }
  return 'default';
}

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
      const templateKey = detectTemplate(input);
      const templateId = WORKFLOW_TEMPLATES[templateKey] || WORKFLOW_TEMPLATES.default;
      const template = createWorkflowDraftFromTemplate(templateId);

      const workflow = await createWorkflow({
        projectId: context.projectId,
        title: template.title,
        description: template.description,
        mode: 'advanced',
        template_type: template.template_type,
        nodes: template.nodes,
        edges: template.edges,
      });

      return {
        success: true,
        message: `I've created a new workflow "${workflow.title}" for your project. You can now open it and customize the nodes!`,
        data: { workflowId: workflow.id },
        action: {
          type: 'navigate',
          payload: { path: `/projects/${context.projectId}/workflows`, workflowId: workflow.id },
        },
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
