import type { Proposal, Skill, SkillContext, SkillResult } from '../types';
import { fetchAsset, fetchProjectAssets, type Asset } from '../../api';
import {
  ensureShotIdsInPlan,
  locateShotInPlan,
  parseShotPlanForEdit,
} from '../../shotPlanEditing';
import { extractFirstJsonObject, llmGenerateText } from '../llmClient';

export type ShotPromptSuggestion = {
  prompt_structured: string;
  prompt: string;
  negative_prompt: string;
  questions?: { id: string; question: string; default?: string }[];
  assumptions?: string[];
};

function isShotPromptSuggestion(value: unknown): value is ShotPromptSuggestion {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.prompt_structured === 'string' &&
    typeof record.prompt === 'string' &&
    typeof record.negative_prompt === 'string'
  );
}

function pickLatestNonDeprecated(assets: Asset[]) {
  return (
    [...assets]
      .filter(a => a.status !== 'deprecated')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null
  );
}

function buildCanonSummary(canonAsset: Asset | null, shotText: string) {
  if (!canonAsset) return 'CANON:\n  (none)';
  const content =
    (canonAsset.current_version?.content ??
      canonAsset.current_approved_version?.content ??
      {}) as Record<string, unknown>;

  const getString = (key: string) => (typeof content[key] === 'string' ? (content[key] as string).trim() : '');
  const getStringArray = (key: string) =>
    Array.isArray(content[key])
      ? (content[key] as unknown[]).filter(v => typeof v === 'string').map(v => (v as string).trim()).filter(Boolean)
      : [];

  const tone = getString('tone');
  const themes = getStringArray('themes').slice(0, 6);
  const worldRules = (getStringArray('worldRules').length ? getStringArray('worldRules') : getStringArray('world_rules')).slice(0, 6);
  const locations = getStringArray('locations').slice(0, 8);
  const equipment = getStringArray('equipment').slice(0, 8);
  const colorPalette = (getStringArray('colorPalette').length ? getStringArray('colorPalette') : getStringArray('color_palette')).slice(0, 6);

  const charactersRaw = Array.isArray(content.characters)
    ? (content.characters.filter(v => v && typeof v === 'object') as Record<string, unknown>[])
    : [];
  const lowered = shotText.toLowerCase();
  const matched = charactersRaw
    .filter(c => {
      const name = typeof c.name === 'string' ? c.name.trim() : '';
      return name && lowered.includes(name.toLowerCase());
    })
    .slice(0, 3);
  const characters = (matched.length ? matched : charactersRaw.slice(0, 2))
    .map(c => {
      const name = typeof c.name === 'string' ? c.name.trim() : '';
      const description = typeof c.description === 'string' ? c.description.trim() : '';
      const appearance = Array.isArray(c.appearance)
        ? (c.appearance as unknown[])
            .filter(v => typeof v === 'string')
            .map(v => (v as string).trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];
      return { name, description, appearance };
    })
    .filter(c => c.name || c.description || c.appearance.length);

  const lines: string[] = [];
  lines.push('CANON:');
  if (tone) lines.push(`  tone: ${tone}`);
  if (themes.length) lines.push(`  themes: [${themes.join(', ')}]`);
  if (colorPalette.length) lines.push(`  color_palette: [${colorPalette.join(', ')}]`);
  if (worldRules.length) {
    lines.push('  world_rules:');
    for (const rule of worldRules) lines.push(`    - ${rule}`);
  }
  if (locations.length) lines.push(`  locations: [${locations.join(', ')}]`);
  if (equipment.length) lines.push(`  equipment: [${equipment.join(', ')}]`);
  if (characters.length) {
    lines.push('  characters:');
    for (const c of characters) {
      lines.push('    -');
      if (c.name) lines.push(`      name: ${c.name}`);
      if (c.description) lines.push(`      description: ${c.description}`);
      if (c.appearance.length) lines.push(`      appearance: [${c.appearance.join(', ')}]`);
    }
  }
  if (lines.length === 1) lines.push('  (none)');
  return lines.join('\n');
}

function buildSceneSummary(sceneBatchAsset: Asset | null, sceneTitle: string) {
  if (!sceneBatchAsset) return 'SCENE:\n  (none)';
  const content = (sceneBatchAsset.current_version?.content ?? {}) as Record<string, unknown>;
  const scenes = Array.isArray(content.scenes) ? content.scenes : [];
  if (!Array.isArray(scenes) || scenes.length === 0) return 'SCENE:\n  (none)';

  const wanted = (sceneTitle || '').trim().toLowerCase();
  const match = scenes.find(s => {
    if (!s || typeof s !== 'object') return false;
    const title = typeof (s as Record<string, unknown>).title === 'string' ? ((s as Record<string, unknown>).title as string).trim() : '';
    if (!wanted) return false;
    const normalized = title.toLowerCase();
    return normalized === wanted || normalized.includes(wanted) || wanted.includes(normalized);
  }) as Record<string, unknown> | undefined;

  if (!match) return 'SCENE:\n  (none)';

  const title = typeof match.title === 'string' ? match.title.trim() : '';
  const setting = typeof match.setting === 'string' ? match.setting.trim() : '';
  const emotionalBeat =
    typeof match.emotionalBeat === 'string'
      ? match.emotionalBeat.trim()
      : typeof match.emotional_beat === 'string'
        ? String(match.emotional_beat).trim()
        : '';

  const lines: string[] = [];
  lines.push('SCENE:');
  if (title) lines.push(`  title: ${title}`);
  if (setting) lines.push(`  setting: ${setting}`);
  if (emotionalBeat) lines.push(`  emotional_beat: ${emotionalBeat}`);
  if (lines.length === 1) lines.push('  (none)');
  return lines.join('\n');
}

function buildShotSummary(input: {
  sceneTitle?: string;
  framing?: string;
  angle?: string;
  motion?: string;
  description?: string;
  negative?: string;
}) {
  const lines: string[] = [];
  lines.push('SHOT:');
  if (input.sceneTitle) lines.push(`  scene: ${input.sceneTitle}`);
  if (input.framing) lines.push(`  framing: ${input.framing}`);
  if (input.angle) lines.push(`  angle: ${input.angle}`);
  if (input.motion) lines.push(`  motion: ${input.motion}`);
  if (input.description) lines.push(`  description: ${input.description}`);
  if (input.negative) lines.push(`  negative: ${input.negative}`);
  if (lines.length === 1) lines.push('  (none)');
  return lines.join('\n');
}

function buildSystemPrompt() {
  return [
    'You are a production copilot that improves image-generation prompts for a single shot.',
    '',
    'Return ONLY a valid JSON object matching this schema:',
    '{',
    '  "prompt_structured": string,',
    '  "prompt": string,',
    '  "negative_prompt": string,',
    '  "questions"?: [{ "id": string, "question": string, "default"?: string }],',
    '  "assumptions"?: string[]',
    '}',
    '',
    'Rules:',
    '- Use CANON + SCENE + SHOT context faithfully; do not contradict canon.',
    '- The prompt must be visually specific, cinematic, and include camera/framing/angle/motion.',
    '- Always include: no text, no watermark, no logos.',
    '- Keep it consistent with the setting and emotional beat.',
    '- If key info is missing, ask 1-3 concise questions in "questions" (do not ask more).',
    '- Do not include markdown, code fences, or extra commentary outside the JSON.',
  ].join('\n');
}

export const improveShotPromptSkill: Skill = {
  name: 'improveShotPrompt',
  description: 'Suggests a better image-generation prompt for the selected shot (proposal-only)',
  keywords: ['shot', 'prompt', 'image', 'improve', 'fix', 'cinematic'],
  examples: [
    'Improve this shot prompt',
    'Fix the image prompt for the selected shot',
    'Make this shot more cinematic',
  ],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      const shotPlanAssetId = context.shotPlanAssetId;
      const shotId = context.shotId;
      if (!shotPlanAssetId || !shotId) {
        return {
          success: false,
          message: 'Select a shot first, then ask me to improve its prompt.',
        };
      }

      const [planAsset, canonAssets, sceneAssets] = await Promise.all([
        fetchAsset(shotPlanAssetId),
        fetchProjectAssets(context.projectId, 'canon_text'),
        fetchProjectAssets(context.projectId, 'scene'),
      ]);

      const parsed = parseShotPlanForEdit(planAsset);
      if (!parsed) {
        return {
          success: false,
          message: 'This shot plan format cannot be edited.',
        };
      }

      const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
      ensureShotIdsInPlan(plan, planAsset.id);

      const located = locateShotInPlan(plan, shotId);
      if (!located) {
        return {
          success: false,
          message: 'Could not find the selected shot in the shot plan. Try re-selecting the shot.',
        };
      }

      const shot = located.shot as Record<string, unknown>;
      const description = typeof shot.description === 'string' ? shot.description : '';
      const framing = typeof shot.framing === 'string' ? shot.framing : '';
      const angle = typeof shot.angle === 'string' ? shot.angle : '';
      const motion = typeof shot.motion === 'string' ? shot.motion : '';
      const negative = typeof shot.continuityNotes === 'string' ? shot.continuityNotes : '';
      const sceneTitle = located.sceneTitle ?? '';

      const userFeedback = (input || '').trim();
      const shotText = `${sceneTitle}\n${description}\n${framing}\n${angle}\n${motion}`.trim();

      const latestCanon = pickLatestNonDeprecated(canonAssets);
      const latestSceneBatch = (() => {
        const candidates = (sceneAssets ?? []).filter(a => {
          if (a.status === 'deprecated') return false;
          const c = a.current_version?.content as unknown;
          return Boolean(c && typeof c === 'object' && Array.isArray((c as Record<string, unknown>).scenes));
        });
        return pickLatestNonDeprecated(candidates);
      })();

      const contextBlock = [
        buildCanonSummary(latestCanon, shotText),
        '',
        buildSceneSummary(latestSceneBatch, sceneTitle),
        '',
        buildShotSummary({ sceneTitle, framing, angle, motion, description, negative }),
        '',
        'USER_FEEDBACK:',
        userFeedback ? `  ${userFeedback}` : '  (none)',
      ].join('\n');

      const model = (import.meta.env.VITE_COPILOT_MODEL as string | undefined) || 'gemma3:1b';

      const fullPrompt = `${buildSystemPrompt()}\n\nCONTEXT:\n${contextBlock}\n\nJSON:`;
      const raw = await llmGenerateText({ model, prompt: fullPrompt, stream: false });
      const parsedJson = extractFirstJsonObject(raw);

      if (!isShotPromptSuggestion(parsedJson)) {
        return {
          success: false,
          message: 'Copilot returned an invalid response. Try again or simplify your feedback.',
          data: { raw },
        };
      }

      const suggestion = parsedJson;
      const nextImage = {
        prompt_structured: suggestion.prompt_structured,
        prompt: suggestion.prompt,
        negative_prompt: suggestion.negative_prompt,
        width: 1280,
        height: 720,
        last_updated_by: 'copilot',
        last_updated_at: new Date().toISOString(),
      };

      const alreadyHasImage = Boolean((located.shot as Record<string, unknown>).image);
      const proposal: Proposal = {
        kind: 'asset_patch',
        assetId: shotPlanAssetId,
        baseAssetVersionId: planAsset.current_asset_version_id,
        summary: `Set image prompt override for shot ${shotId}${sceneTitle ? ` (scene: ${sceneTitle})` : ''}.`,
        patch: [
          {
            op: alreadyHasImage ? 'replace' : 'add',
            path: `${located.shotPath}/image`,
            value: nextImage,
          },
        ],
        metadata: {
          shotId,
          shotPath: located.shotPath,
          shotPlanAssetId,
        },
      };

      return {
        success: true,
        message: 'Drafted an improved image prompt. Review it and click Apply to save it to the shot plan.',
        data: { suggestion, context: contextBlock },
        proposal,
        action: { type: 'show_modal', payload: { kind: 'shot_prompt' } },
      };
    } catch (error) {
      console.error('Improve shot prompt skill error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sorry, I encountered an error.',
      };
    }
  },
};
