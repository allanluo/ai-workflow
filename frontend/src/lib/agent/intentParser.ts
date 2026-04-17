import type { ParsedIntent } from './types';
import { createWorkflowSkill } from './skills/createWorkflow';
import { addSceneSkill } from './skills/addScene';
import { improveShotPromptSkill } from './skills/improveShotPrompt';
import type { SkillContext } from './types';

export type SkillName =
  | 'createWorkflow'
  | 'addScene'
  | 'improveShotPrompt'
  | 'explainNode'
  | 'generateShots'
  | 'chat';

interface IntentPattern {
  skillName: SkillName;
  patterns: RegExp[];
}

const intentPatterns: IntentPattern[] = [
  {
    skillName: 'createWorkflow',
    patterns: [
      /create\s+(a\s+)?(new\s+)?workflow/i,
      /make\s+(a\s+)?(new\s+)?workflow/i,
      /build\s+(a\s+)?(new\s+)?workflow/i,
      /I\s+want\s+(to\s+)?create\s+(a\s+)?workflow/i,
      /help\s+me\s+create\s+(a\s+)?workflow/i,
      /create\s+(a\s+)?(new\s+)?(music|song)\s+video/i,
      /(music|song)\s+video/i,
      /\bMV\b/i,
      /song\s+video/i,
    ],
  },
  {
    skillName: 'generateShots',
    patterns: [
      /generate\s+(new\s+)?shots/i,
      /create\s+(new\s+)?shots/i,
      /make\s+(new\s+)?shots/i,
      /I\s+want\s+(to\s+)?add\s+(new\s+)?shots/i,
    ],
  },
  {
    skillName: 'addScene',
    patterns: [
      /add\s+(a\s+)?new\s+scene/i,
      /create\s+(a\s+)?new\s+scene/i,
      /I\s+want\s+(to\s+)?add\s+(a\s+)?scene/i,
    ],
  },
  {
    skillName: 'explainNode',
    patterns: [
      /explain\s+(this\s+)?node/i,
      /what\s+does\s+(this\s+)?node\s+do/i,
      /tell\s+me\s+about\s+(this\s+)?node/i,
    ],
  },
  {
    skillName: 'improveShotPrompt',
    patterns: [
      /improve\s+(this\s+)?(shot\s+)?prompt/i,
      /fix\s+(this\s+)?(shot\s+)?(image\s+)?prompt/i,
      /make\s+(this\s+)?shot\s+more\s+cinematic/i,
      /shot\s+prompt\s+improvement/i,
    ],
  },
];

const skills = {
  createWorkflow: createWorkflowSkill,
  addScene: addSceneSkill,
  improveShotPrompt: improveShotPromptSkill,
};

export function parseIntent(userInput: string): ParsedIntent | null {
  const lowerInput = userInput.toLowerCase();

  for (const intent of intentPatterns) {
    for (const pattern of intent.patterns) {
      if (pattern.test(lowerInput)) {
        return {
          skillName: intent.skillName,
          confidence: 0.8,
        };
      }
    }
  }

  return null;
}

export async function executeSkill(
  skillName: string,
  context: SkillContext,
  userInput: string
): Promise<{ skillResult: unknown; shouldChat: boolean }> {
  const skill = skills[skillName as keyof typeof skills];

  if (skill) {
    const result = await skill.execute(context as never, userInput);
    return { skillResult: result, shouldChat: !result.success };
  }

  return { skillResult: null, shouldChat: true };
}

export function getSkillExamples(skillName: SkillName): string[] {
  switch (skillName) {
    case 'createWorkflow':
      return createWorkflowSkill.examples;
    case 'addScene':
      return addSceneSkill.examples;
    default:
      return [];
  }
}
