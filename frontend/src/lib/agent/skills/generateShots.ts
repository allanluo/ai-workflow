import type { Skill, SkillContext, SkillResult } from '../types';
import { generateShotPlansSkill } from './generateShotPlans';

export const generateShotsSkill: Skill = {
  name: 'generateShots',
  description: 'Alias for generating shot plans (Generate shots).',
  keywords: ['shots', 'generate shots', 'create shots'],
  examples: ['Generate shots', 'Create shots', 'Make shots for my scenes'],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    // Keep one implementation of the deterministic plan.
    return await generateShotPlansSkill.execute(context, input);
  },
};

