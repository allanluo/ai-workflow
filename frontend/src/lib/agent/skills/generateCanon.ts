import type { Skill, SkillContext, SkillResult } from '../types';

export const generateCanonSkill: Skill = {
  name: 'generateCanon',
  description: 'Runs the workflow node extract_canon and verifies a canon_text asset was produced.',
  keywords: ['canon', 'extract canon', 'generate canon'],
  examples: ['Extract canon', 'Generate canon', 'Extract canon from the story'],

  async execute(context: SkillContext): Promise<SkillResult> {
    return {
      success: true,
      message: 'I can extract canon using your project workflow. Review the plan and click Confirm & Run.',
      plan: {
        intent: 'Extract canon',
        requires_confirmation: true,
        steps: [
          {
            id: 'run',
            title: 'Run workflow to extract canon',
            tool: 'runWorkflowByNodeType',
            params: { nodeType: 'extract_canon', trigger_source: 'copilot', timeoutMs: 600000 },
          },
          {
            id: 'verify',
            title: 'Verify canon asset was produced',
            tool: 'findAssetsProducedByWorkflowRun',
            params: {
              workflowRunId: '{{steps.run.result.workflowRunId}}',
              assetType: 'canon_text',
              limit: 5,
              requireNonEmpty: true,
            },
          },
        ],
      },
    };
  },
};

