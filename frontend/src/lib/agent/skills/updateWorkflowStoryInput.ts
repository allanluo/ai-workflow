import type { Proposal, Skill, SkillContext, SkillResult } from '../types';
import { executeTool } from '../tools';
import { extractFirstJsonObjectLenient, llmGenerateText } from '../llmClient';

function stripCommonInstructionPrefixes(text: string) {
  let t = text.trim();
  const patterns = [
    /^I\s+want\s+you\s+to\s+help\s+me\s+to\s+work\s+on\s+the\s+story\s+input\s+node[^\n]*\n+/i,
    /^I\s+want\s+you\s+to\s+update\s+the\s+story\s+input[^\n]*\n+/i,
    /^please\s+(put|add|set|paste)\s+(this\s+)?(in|into)\s+(the\s+)?story\s+input[^\n]*:?\s*/i,
    /^here\s+(is|are)\s+the\s+lyrics:?\s*/i,
    /^lyrics:?\s*/i,
    /^the\s+lyrics\s+(is\s+)?listed:?\s*/i,
  ];
  for (const re of patterns) {
    t = t.replace(re, '').trim();
  }
  return t;
}

async function deriveStoryTextForNode(userRequest: string): Promise<string> {
  const trimmed = userRequest.trim();
  if (!trimmed) return '';

  const stripped = stripCommonInstructionPrefixes(trimmed);
  if (stripped.length >= 200 || /\n{2,}/.test(stripped) || /(verse|chorus|bridge|pre-chorus|🎶)/i.test(stripped)) {
    return stripped;
  }

  const model =
    (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
    (import.meta.env.VITE_COPILOT_INTENT_MODEL as string | undefined) ||
    'gemma4:e2b';

  const prompt = [
    'You choose the exact string to store in a workflow "Story Input" node (params.text).',
    '',
    'Rules:',
    '- If the user pasted lyrics, a script, a poem, or multi-paragraph story text, return it verbatim including line breaks and emoji. Do not summarize.',
    '- If the user only wrote a short instruction with no body text, return the instruction text as-is.',
    '- Never wrap the story in JSON or markdown fences inside the storyText value.',
    '',
    'Return ONLY a JSON object: {"storyText":"<string>"}  (escape quotes and newlines inside the JSON string properly).',
    '',
    'USER_REQUEST:',
    trimmed.slice(0, 24000),
  ].join('\n');

  try {
    const raw = await llmGenerateText({ model, prompt, stream: false });
    const parsed = extractFirstJsonObjectLenient(raw) as { storyText?: unknown };
    if (typeof parsed.storyText === 'string' && parsed.storyText.trim()) {
      return parsed.storyText;
    }
  } catch {
    // fall through
  }

  return stripped.length > 0 ? stripped : trimmed;
}

export const updateWorkflowStoryInputSkill: Skill = {
  name: 'updateWorkflowStoryInput',
  description:
    'Proposes an update to the workflow story input node (lyrics, script, or narrative text) using a workflow_patch.',
  keywords: ['story input', 'lyrics', 'workflow node', 'input node', 'update workflow'],
  examples: [
    'Update the story input node with these lyrics',
    'Put this text into the story input',
    'Set the workflow story to the following',
  ],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      if (!context.workflowId) {
        return {
          success: false,
          message:
            'Open the workflow in the Workflows tab (so this chat is scoped to that workflow), then ask me again to update the story input.',
        };
      }

      const storyText = await deriveStoryTextForNode(input?.trim() || '');
      if (!storyText.trim()) {
        return {
          success: false,
          message: 'I did not find any story or lyrics text to put in the story input. Paste the lyrics or story after your request.',
        };
      }
      if (storyText.trim().length < 24 && !/\n/.test(storyText) && !/(verse|chorus|bridge|lyrics|🎶)/i.test(storyText)) {
        return {
          success: false,
          message:
            'The text to store looks too short to be lyrics or a full story. Paste the full lyrics (or script) under your message, then ask again.',
        };
      }

      const res = await executeTool('proposePatchStoryInput', context, {
        workflowId: context.workflowId,
        storyText,
      });

      if (!res.ok) {
        return { success: false, message: res.error.message };
      }

      const proposal = (res.data as { proposal?: unknown })?.proposal;
      if (!proposal) {
        return { success: false, message: 'No proposal returned.' };
      }

      return {
        success: true,
        message:
          'I can update the **Story Input** node with that text. Review the proposal and type **/apply** to save it to the workflow (nothing changes until you apply).',
        proposal: proposal as Proposal,
      };
    } catch (error) {
      console.error('updateWorkflowStoryInput skill error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to prepare story input update.',
      };
    }
  },
};
