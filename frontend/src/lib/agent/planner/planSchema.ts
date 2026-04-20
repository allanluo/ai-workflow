import { z } from 'zod';

export const PlanQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  default: z.string().optional(),
});

export const PlanStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  tool: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  on_error: z.enum(['stop', 'continue']).optional(),
});

export const ExecutionPlanSchema = z.object({
  intent: z.string().min(1),
  requires_confirmation: z.boolean().default(true),
  questions: z.array(PlanQuestionSchema).optional(),
  steps: z.array(PlanStepSchema).default([]),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

