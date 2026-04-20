import type { Skill, SkillContext, SkillResult } from '../types';

export const generateShotPlansSkill: Skill = {
  name: 'generateShotPlans',
  description: 'Runs the workflow node generate_shot_plan and verifies a shot_plan asset was produced.',
  keywords: ['shots', 'shot plan', 'generate shots', 'generate shot plan'],
  examples: ['Generate shots', 'Generate shot plans', 'Create shot plan'],

  async execute(_context: SkillContext): Promise<SkillResult> {
    return {
      success: true,
      message: 'I can generate shot plans using your project workflow. Review the plan and click Confirm & Run.',
      plan: {
        intent: 'Generate shot plans',
        requires_confirmation: true,
        steps: [
          {
            id: 'run',
            title: 'Run workflow to generate shot plans',
            tool: 'runWorkflowByNodeType',
            params: { nodeType: 'generate_shot_plan', trigger_source: 'copilot', timeoutMs: 600000 },
          },
          {
            id: 'verify',
            title: 'Verify shot plan assets were produced',
            tool: 'findAssetsProducedByWorkflowRun',
            params: {
              workflowRunId: '{{steps.run.result.workflowRunId}}',
              assetType: 'shot_plan',
              limit: 5,
              requireNonEmpty: true,
            },
          },
        ],
      },
    };
  },
};

