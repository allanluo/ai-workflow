import { z } from 'zod';
import { fetchCopilotPlanStep } from '../../../api';
import { CopilotPlanStepSchema } from '../schemas';
import type { ToolDefinition } from '../types';

export const verifyResultTool: ToolDefinition<
  { stepId: string; runId: string },
  z.infer<typeof CopilotPlanStepSchema>
> = {
  name: 'verifyResult',
  description: 'Verify the result of a completed copilot plan step.',
  category: 'exec',
  paramsSchema: z.object({
    stepId: z.string().min(1),
    runId: z.string().min(1),
  }),
  resultSchema: CopilotPlanStepSchema,
  async execute(context, params) {
    const step = await fetchCopilotPlanStep(context.projectId, params.runId, params.stepId);

    // Basic verification: check if status is 'success' and no error
    if (step.status !== 'success') {
      throw new Error(`Step ${params.stepId} did not complete successfully. Status: ${step.status}`);
    }

    if (step.error) {
      throw new Error(`Step ${params.stepId} has an error: ${JSON.stringify(step.error)}`);
    }

    return step;
  },
};