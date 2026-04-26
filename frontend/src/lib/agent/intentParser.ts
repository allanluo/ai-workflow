import type { ParsedIntent } from './types';
import { createWorkflowSkill } from './skills/createWorkflow';
import { updateWorkflowStoryInputSkill } from './skills/updateWorkflowStoryInput';
import { addSceneSkill } from './skills/addScene';
import { improveShotPromptSkill } from './skills/improveShotPrompt';
import { generateCanonSkill } from './skills/generateCanon';
import { updateCanonSkill } from './skills/updateCanon';
import { generateScenesSkill } from './skills/generateScenes';
import { generateShotPlansSkill } from './skills/generateShotPlans';
import { generateShotsSkill } from './skills/generateShots';
import { updateSceneSkill } from './skills/updateScene';
import { updateShotSkill } from './skills/updateShot';
import type { SkillContext } from './types';

export type SkillName =
  | 'createWorkflow'
  | 'updateWorkflowStoryInput'
  | 'addScene'
  | 'improveShotPrompt'
  | 'generateCanon'
  | 'updateCanon'
  | 'generateScenes'
  | 'generateShotPlans'
  | 'explainNode'
  | 'generateShots'
  | 'updateScene'
  | 'updateShot'
  | 'chat';

interface IntentPattern {
  skillName: SkillName;
  patterns: RegExp[];
}

const intentPatterns: IntentPattern[] = [
  {
    skillName: 'updateWorkflowStoryInput',
    patterns: [
      /update\s+(the\s+)?story\s+input/i,
      /story\s+input\s+node/i,
      /set\s+(the\s+)?story\s*(input|text)/i,
      /fill\s+(the\s+)?story\s+input/i,
      /put\s+.{0,120}(lyrics|text).{0,40}(in|into).{0,40}(story|workflow)/i,
      /(paste|add)\s+.{0,80}(lyrics|text).{0,60}(story\s+input|input\s+node)/i,
      /workflow.*story\s*input/i,
      /story\s+input.*(lyrics|text|update|set|put)/i,
      /(work\s+on|edit|change)\s+(the\s+)?story\s+input/i,
    ],
  },
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
    // "Generate shots" is an alias for generating a shot plan asset.
    skillName: 'generateShotPlans',
    patterns: [
      /generate\s+(new\s+)?shots/i,
      /create\s+(new\s+)?shots/i,
      /make\s+(new\s+)?shots/i,
      /I\s+want\s+(to\s+)?add\s+(new\s+)?shots/i,
    ],
  },
  {
    skillName: 'generateShotPlans',
    patterns: [/generate\s+(a\s+)?shot\s+plan/i, /generate\s+shot\s+plans/i],
  },
  {
    skillName: 'generateScenes',
    patterns: [/generate\s+scenes/i, /create\s+scenes/i, /make\s+scenes/i, /generate\s+scene\s+list/i],
  },
  {
    skillName: 'generateCanon',
    patterns: [/extract\s+canon/i, /generate\s+canon/i],
  },
  {
    skillName: 'updateCanon',
    patterns: [
      /update\s+(the\s+)?canon/i,
      /edit\s+(the\s+)?canon/i,
      /change\s+(the\s+)?canon/i,
      /modify\s+(the\s+)?canon/i,
      /canon\s+update/i,
      /canon\s+edit/i,
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
    skillName: 'updateScene',
    patterns: [
      /update\s+(the\s+)?scene/i,
      /edit\s+(the\s+)?scene/i,
      /change\s+(the\s+)?scene/i,
      /modify\s+(the\s+)?scene/i,
      /scene\s+update/i,
      /scene\s+edit/i,
    ],
  },
  {
    skillName: 'updateShot',
    patterns: [
      /update\s+(the\s+)?shot/i,
      /edit\s+(the\s+)?shot/i,
      /change\s+(the\s+)?shot/i,
      /modify\s+(the\s+)?shot/i,
      /shot\s+update/i,
      /shot\s+edit/i,
      /change\s+(the\s+)?framing/i,
      /change\s+(the\s+)?angle/i,
      /change\s+(the\s+)?motion/i,
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
      /improve\s+(this\s+)?(shot\s+)?(image\s+)?(generation\s+)?prompt/i,
      /fix\s+(this\s+)?(shot\s+)?(image\s+)?(generation\s+)?prompt/i,
      /make\s+(this\s+)?shot\s+more\s+cinematic/i,
      /shot\s+prompt\s+improvement/i,
      /wrong\s+(image|prompt)/i,
      /doesn['’]?t\s+match/i,
      /\bimage\b.*\bshould\b/i,
    ],
  },
];

const skills = {
  createWorkflow: createWorkflowSkill,
  updateWorkflowStoryInput: updateWorkflowStoryInputSkill,
  addScene: addSceneSkill,
  improveShotPrompt: improveShotPromptSkill,
  generateCanon: generateCanonSkill,
  updateCanon: updateCanonSkill,
  generateScenes: generateScenesSkill,
  generateShotPlans: generateShotPlansSkill,
  generateShots: generateShotsSkill,
  updateScene: updateSceneSkill,
  updateShot: updateShotSkill,
};

function parseSlashIntent(userInput: string): ParsedIntent | null {
  const raw = (userInput || '').trim();
  if (!raw.startsWith('/')) return null;
  const body = raw.slice(1).trim().toLowerCase();
  if (!body) return null;

  const parts = body.split(/\s+/).filter(Boolean);
  const cmd = parts[0] ?? '';
  const rest = parts.slice(1).join(' ');

  const key = cmd.replace(/[^a-z0-9_-]/g, '');
  const restKey = rest.replace(/[^a-z0-9_-]/g, ' ');

  const is = (...names: string[]) => names.includes(key);

  // Canon
  if (is('canon', 'extract-canon', 'extractcanon') || (key === 'extract' && restKey.startsWith('canon'))) {
    return { skillName: 'generateCanon', confidence: 1.0 };
  }
  if (
    is('update-canon', 'edit-canon', 'canon-update', 'canonedit') ||
    (key === 'canon' && (restKey.startsWith('update') || restKey.startsWith('edit') || restKey.startsWith('change') || restKey.startsWith('modify')))
  ) {
    return { skillName: 'updateCanon', confidence: 1.0, parameters: { args: rest } };
  }
  if (is('update-canon', 'edit-canon', 'canon-update', 'canonedit') || (key === 'canon' && restKey.startsWith('update'))) {
    return { skillName: 'updateCanon', confidence: 1.0, parameters: { args: rest } };
  }

  // Scenes
  if (is('scenes', 'generate-scenes', 'genscenes') || ((key === 'generate' || key === 'gen') && restKey.startsWith('scenes'))) {
    return { skillName: 'generateScenes', confidence: 1.0 };
  }

  // Shots / shot plans
  if (
    is('shots', 'generate-shots', 'genshots', 'shot-plans', 'shotplans', 'shotplan') ||
    ((key === 'generate' || key === 'gen') && (restKey.startsWith('shots') || restKey.startsWith('shot')))
  ) {
    return { skillName: 'generateShotPlans', confidence: 1.0 };
  }

  // Workflow / scene creation shortcuts (optional args)
  if (is('create-workflow', 'workflow', 'new-workflow')) {
    return { skillName: 'createWorkflow', confidence: 1.0, parameters: { args: rest } };
  }
  if (is('update-story-input', 'story-input', 'set-story-input')) {
    return { skillName: 'updateWorkflowStoryInput', confidence: 1.0, parameters: { args: rest } };
  }
  if (is('add-scene', 'scene', 'new-scene')) {
    return { skillName: 'addScene', confidence: 1.0, parameters: { args: rest } };
  }
  if (is('update-scene', 'edit-scene', 'scene-update')) {
    return { skillName: 'updateScene', confidence: 1.0, parameters: { args: rest } };
  }
  if (is('update-shot', 'edit-shot', 'shot-update')) {
    return { skillName: 'updateShot', confidence: 1.0, parameters: { args: rest } };
  }
  if (is('improve-prompt', 'improve-shot-prompt', 'improveprompt')) {
    return { skillName: 'improveShotPrompt', confidence: 1.0, parameters: { args: rest } };
  }

  return null;
}

export function parseIntent(userInput: string): ParsedIntent | null {
  const lowerInput = userInput.toLowerCase();

  const slash = parseSlashIntent(userInput);
  if (slash) return slash;

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
  // Support slash command args by stripping the leading command token for skills that expect free-form input.
  const trimmed = (userInput || '').trim();
  const isSlash = trimmed.startsWith('/');
  let effectiveInput = userInput;
  if (isSlash) {
    const body = trimmed.slice(1).trim();
    const parts = body.split(/\s+/).filter(Boolean);
    const rest = parts.slice(1).join(' ').trim();
    effectiveInput = rest;
  }

  const skill = skills[skillName as keyof typeof skills];

  if (skill) {
    const result = await skill.execute(context as never, effectiveInput);
    return { skillResult: result, shouldChat: !result.success };
  }

  return { skillResult: null, shouldChat: true };
}

export function getSkillExamples(skillName: SkillName): string[] {
  switch (skillName) {
    case 'createWorkflow':
      return createWorkflowSkill.examples;
    case 'updateWorkflowStoryInput':
      return updateWorkflowStoryInputSkill.examples;
    case 'addScene':
      return addSceneSkill.examples;
    default:
      return [];
  }
}
