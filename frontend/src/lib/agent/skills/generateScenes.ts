import type { Skill, SkillContext, SkillResult } from '../types';

export const generateScenesSkill: Skill = {
  name: 'generateScenes',
  description: 'Runs the workflow node generate_scenes and verifies scene assets were produced.',
  keywords: ['scenes', 'generate scenes', 'create scenes'],
  examples: ['Generate scenes', 'Create scenes', 'Generate the scene list'],

  async execute(_context: SkillContext): Promise<SkillResult> {
    return {
      success: true,
      message: 'I can generate scenes using your project workflow. Review the plan and click Confirm & Run.',
      plan: {
        intent: 'Generate scenes',
        requires_confirmation: true,
        steps: [
          {
            id: 'run',
            title: 'Run workflow to generate scenes',
            tool: 'runWorkflowByNodeType',
            params: { nodeType: 'generate_scenes', trigger_source: 'copilot', timeoutMs: 600000 },
          },
          {
            id: 'verify',
            title: 'Verify scene assets were produced',
            tool: 'findAssetsProducedByWorkflowRun',
            params: {
              workflowRunId: '{{steps.run.result.workflowRunId}}',
              assetType: 'scene',
              limit: 5,
              requireNonEmpty: true,
            },
          },
        ],
      },
    };
  },
};

