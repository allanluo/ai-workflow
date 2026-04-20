import { z } from 'zod';
import { createWorkflowDraftFromTemplate } from '../../../workflowCatalog';
import type { Proposal } from '../../types';
import type { ToolDefinition } from '../types';

const WORKFLOW_TEMPLATES: Record<string, string> = {
  music_video: 'storyboard_from_story',
  music_video_madonna: 'storyboard_from_story',
  song_video: 'storyboard_from_story',
  mv: 'storyboard_from_story',
  narrated_story: 'narrated_story_video',
  story_video: 'narrated_story_video',
  default: 'storyboard_from_story',
};

function detectTemplate(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('music') || lower.includes('song') || lower.includes('mv')) return 'music_video';
  if (lower.includes('narrat') || lower.includes('story')) return 'narrated_story';
  return 'default';
}

const ResultSchema = z.object({
  proposal: z.unknown(),
});

export const proposeCreateWorkflowTool: ToolDefinition<{ request: string }, z.infer<typeof ResultSchema>> = {
  name: 'proposeCreateWorkflow',
  description: 'Create a proposal to add a new workflow (no changes are applied).',
  category: 'read',
  paramsSchema: z.object({
    request: z.string().min(1),
  }),
  resultSchema: ResultSchema,
  async execute(context, params) {
    const templateKey = detectTemplate(params.request);
    const templateId = WORKFLOW_TEMPLATES[templateKey] || WORKFLOW_TEMPLATES.default;
    const template = createWorkflowDraftFromTemplate(templateId);

    const proposal: Proposal = {
      kind: 'create_workflow',
      projectId: context.projectId,
      summary: `Create workflow "${template.title}"`,
      title: template.title,
      description: template.description,
      mode: template.mode,
      template_type: template.template_type,
      defaults: template.defaults ?? {},
      nodes: template.nodes,
      edges: template.edges,
      metadata: {},
      afterApply: { type: 'navigate', path: `/projects/${context.projectId}/workflows` },
    };

    return { proposal };
  },
};
