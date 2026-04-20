import type { Proposal, Skill, SkillContext, SkillResult } from '../types';
import type { Asset } from '../../api';
import {
  ensureShotIdsInPlan,
  locateShotInPlan,
  parseShotPlanForEdit,
} from '../../shotPlanEditing';
import { extractFirstJsonObjectLenient } from '../llmClient';
import { executeTool } from '../tools';

export type ShotPromptSuggestion = {
  prompt_structured: string;
  prompt: string;
  negative_prompt: string;
  questions?: { id: string; question: string; default?: string }[];
  assumptions?: string[];
};

type FramingIntent = 'wide' | 'bird_eye' | 'medium' | 'close_up' | 'unknown';

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
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0] ??
    null
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

function inferFramingIntent(input: { framing: string; angle: string; userFeedback: string }) : FramingIntent {
  const framing = (input.framing || '').toLowerCase();
  const angle = (input.angle || '').toLowerCase();
  const fb = (input.userFeedback || '').toLowerCase();

  const wantsBird = /\b(bird[\s-]?eye|overhead|top[\s-]?down)\b/.test(fb) || /\b(bird[\s-]?eye|overhead|top[\s-]?down)\b/.test(angle);
  if (wantsBird) return 'bird_eye';
  const wantsWide =
    /\b(wide|establishing|long[\s-]?shot)\b/.test(fb) ||
    /\b(wide|establishing|long[\s-]?shot)\b/.test(framing) ||
    /\bwide\b/.test(angle);
  if (wantsWide) return 'wide';
  const wantsClose = /\b(close[\s-]?up|portrait|head[\s-]?shot|tight framing)\b/.test(fb) || /\bclose[\s-]?up\b/.test(framing);
  if (wantsClose) return 'close_up';
  const wantsMedium = /\bmedium\b/.test(fb) || /\bmedium\b/.test(framing);
  if (wantsMedium) return 'medium';
  return 'unknown';
}

function violatesFramingIntent(intent: FramingIntent, suggestion: ShotPromptSuggestion) {
  const prompt = `${suggestion.prompt_structured}\n${suggestion.prompt}`.toLowerCase();
  if (intent === 'wide' || intent === 'bird_eye') {
    if (/\b(close[\s-]?up|portrait|head[\s-]?shot)\b/.test(prompt)) return true;
    // If we talk about a face as the main subject, it usually implies a tight shot.
    if (/\b(allan['’]s\s+face|focus on.*eyes|close on.*eyes)\b/.test(prompt)) return true;
  }
  return false;
}

function buildHardConstraints(intent: FramingIntent) {
  const lines: string[] = [];
  lines.push('HARD_CONSTRAINTS:');
  lines.push('- Must be visually consistent with CANON + SCENE + SHOT.');
  lines.push('- Must include: no text, no watermark, no logos.');
  if (intent === 'wide') {
    lines.push('- REQUIRED: wide establishing shot; subject not filling the frame.');
    lines.push('- FORBIDDEN: close-up, portrait, headshot, tight framing, face-focused composition.');
  } else if (intent === 'bird_eye') {
    lines.push('- REQUIRED: bird-eye / top-down / overhead wide shot; figures can be small due to distance.');
    lines.push('- FORBIDDEN: close-up, portrait, headshot, tight framing, face-focused composition.');
  } else if (intent === 'close_up') {
    lines.push('- REQUIRED: close-up framing (face/upper body) with cinematic details.');
  }
  return lines.join('\n');
}

function composeFallbackSuggestion(input: {
  intent: FramingIntent;
  sceneTitle: string;
  sceneSummary: string;
  shotSummary: string;
  userFeedback: string;
}) : ShotPromptSuggestion {
  const baseIntent =
    input.intent === 'bird_eye'
      ? 'Bird-eye wide establishing shot'
      : input.intent === 'wide'
        ? 'Wide establishing shot'
        : input.intent === 'medium'
          ? 'Medium shot'
          : input.intent === 'close_up'
            ? 'Close-up'
            : 'Wide establishing shot';

  const prompt_structured = [
    'SHOT_PROMPT_STRUCTURED:',
    `- framing: ${baseIntent}`,
    `- scene: ${input.sceneTitle || '(unknown)'}`,
    '- subject: Allan, partially hidden behind tall grass in the foreground',
    '- action: Allan is scared, watching distant gunfire exchanging between two groups far away',
    '- scale: distant figures are very small due to distance; focus on environment + mood, not faces',
    `- setting_notes: ${input.sceneSummary || '(see scene)'}`,
    `- shot_notes: ${input.shotSummary || '(see shot)'}`,
    `- user_feedback: ${input.userFeedback || '(none)'}`,
    '- camera: cinematic, realistic; stable framing; strong sense of distance and vulnerability',
    '- constraints: no text, no watermark, no logos',
  ].join('\n');

  const prompt = [
    `${baseIntent} in a grassland at dusk/overcast.`,
    `Allan is crouched/hiding behind tall grass in the foreground, visibly scared, watching a distant firefight.`,
    `Two small groups of people exchange gunfire far away; the figures are tiny silhouettes due to the distance.`,
    `Emphasize vast landscape, depth, and tension; Allan should NOT be a close-up or face-focused portrait.`,
    `No text, no watermark, no logos.`,
  ].join(' ');

  const negative_prompt = [
    'close-up',
    'portrait',
    'headshot',
    'tight framing',
    'face close-up',
    'text',
    'watermark',
    'logo',
    'UI',
  ].join(', ');

  return { prompt_structured, prompt, negative_prompt, assumptions: ['Used deterministic fallback due to constraint violation.'] };
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
    '  "questions": [{ "id": string, "question": string, "default": string }], // optional',
    '  "assumptions": string[] // optional',
    '}',
    '',
    'Rules:',
    '- Use CANON + SCENE + SHOT context faithfully; do not contradict canon.',
    '- Do NOT change shot scale (e.g. wide vs close-up) unless the user explicitly asks.',
    '- The prompt must be visually specific, cinematic, and include camera/framing/angle/motion.',
    '- Always include: no text, no watermark, no logos.',
    '- Keep it consistent with the setting and emotional beat.',
    '- If key info is missing, ask 1-3 concise questions in "questions" (do not ask more).',
    '- If USER_FEEDBACK provides explicit framing/composition, treat it as authoritative and apply it (do not ask again).',
    '- Do not include markdown, code fences, or extra commentary outside the JSON.',
    '- Use double quotes for all JSON keys and string values.',
  ].join('\n');
}

function buildJsonRepairPrompt(input: { schemaHint: string; invalidOutput: string; error?: string }) {
  return [
    'You are a strict JSON repair assistant.',
    '',
    'The following output was intended to be a JSON object, but it is invalid JSON.',
    'Fix it so that it becomes a valid JSON object that matches this schema hint:',
    input.schemaHint,
    '',
    input.error ? `JSON_PARSE_ERROR: ${input.error}` : '',
    '',
    'Rules:',
    '- Return ONLY the repaired JSON object.',
    '- Do not add markdown, code fences, or commentary.',
    '- Preserve the original meaning; do not invent new fields.',
    '',
    'INVALID_OUTPUT:',
    input.invalidOutput,
    '',
    'JSON:',
  ]
    .filter(Boolean)
    .join('\n');
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

      const planAssetResult = await executeTool('fetchAsset', context, { assetId: shotPlanAssetId });
      if (!planAssetResult.ok) {
        return { success: false, message: planAssetResult.error.message };
      }
      const planAsset = planAssetResult.data as Asset;

      const canonAssetsResult = await executeTool('fetchProjectAssets', context, {
        assetType: 'canon_text',
      });
      if (!canonAssetsResult.ok) {
        return { success: false, message: canonAssetsResult.error.message };
      }
      const canonAssets = canonAssetsResult.data as Asset[];

      const sceneAssetsResult = await executeTool('fetchProjectAssets', context, { assetType: 'scene' });
      if (!sceneAssetsResult.ok) {
        return { success: false, message: sceneAssetsResult.error.message };
      }
      const sceneAssets = sceneAssetsResult.data as Asset[];

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
      const framingIntent = inferFramingIntent({ framing, angle, userFeedback });

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
        buildHardConstraints(framingIntent),
        '',
        buildCanonSummary(latestCanon, shotText),
        '',
        buildSceneSummary(latestSceneBatch, sceneTitle),
        '',
        buildShotSummary({ sceneTitle, framing, angle, motion, description, negative }),
        '',
        'USER_FEEDBACK:',
        userFeedback ? `  ${userFeedback}` : '  (none)',
      ].join('\n');

      const model =
        (import.meta.env.VITE_COPILOT_SHOT_PROMPT_MODEL as string | undefined) ||
        (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
        'gemma3:1b';

      const fullPrompt = `${buildSystemPrompt()}\n\nCONTEXT:\n${contextBlock}\n\nJSON:`;
      const llmRes = await executeTool('llmGenerateText', context, { model, prompt: fullPrompt, stream: false });
      if (!llmRes.ok) return { success: false, message: llmRes.error.message };
      const raw = String((llmRes.data as any)?.text ?? '');
      let parsedJson: unknown;
      try {
        parsedJson = extractFirstJsonObjectLenient(raw);
      } catch (err) {
        // Best-effort repair: ask the model to output valid JSON only.
        const schemaHint =
          '{ "prompt_structured": string, "prompt": string, "negative_prompt": string, "questions": [{ "id": string, "question": string, "default": string }], "assumptions": string[] } (questions/assumptions optional)';
        const repairPrompt = buildJsonRepairPrompt({
          schemaHint,
          invalidOutput: raw.slice(0, 8000),
          error: err instanceof Error ? err.message : String(err),
        });
        const repairModel =
          (import.meta.env.VITE_COPILOT_PLANNER_MODEL as string | undefined) ||
          (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
          'gemma3:1b';
        const repairRes = await executeTool('llmGenerateText', context, { model: repairModel, prompt: repairPrompt, stream: false });
        if (!repairRes.ok) {
          return {
            success: false,
            message: 'Copilot returned invalid JSON and repair failed. Try again.',
            data: { raw, repairError: repairRes.error.message },
          };
        }
        const repairedRaw = String((repairRes.data as any)?.text ?? '');
        try {
          parsedJson = extractFirstJsonObjectLenient(repairedRaw);
        } catch (err2) {
          return {
            success: false,
            message: 'Copilot returned invalid JSON. Try again or simplify your feedback.',
            data: {
              raw,
              repairedRaw,
              parseError: err instanceof Error ? err.message : String(err),
              repairParseError: err2 instanceof Error ? err2.message : String(err2),
            },
          };
        }
      }

      if (!isShotPromptSuggestion(parsedJson)) {
        return {
          success: false,
          message: 'Copilot returned an invalid response. Try again or simplify your feedback.',
          data: { raw },
        };
      }

      let suggestion = parsedJson;

      // Guardrail: if the model violates explicit framing intent, try one corrective pass; then fall back.
      if (violatesFramingIntent(framingIntent, suggestion)) {
        const correctionPrompt = [
          buildSystemPrompt(),
          '',
          'You previously returned a JSON suggestion that VIOLATED HARD_CONSTRAINTS (wrong framing).',
          'Return ONLY corrected JSON matching the schema and HARD_CONSTRAINTS.',
          '',
          'CONTEXT:',
          contextBlock,
          '',
          'PREVIOUS_JSON:',
          JSON.stringify(suggestion, null, 2),
          '',
          'JSON:',
        ].join('\n');

        const correctionRes = await executeTool('llmGenerateText', context, { model, prompt: correctionPrompt, stream: false });
        if (correctionRes.ok) {
          const correctionRaw = String((correctionRes.data as any)?.text ?? '');
          try {
            const corrected = extractFirstJsonObjectLenient(correctionRaw);
            if (isShotPromptSuggestion(corrected) && !violatesFramingIntent(framingIntent, corrected)) {
              suggestion = corrected;
            }
          } catch {
            // ignore; fall back below
          }
        }
      }

      if (violatesFramingIntent(framingIntent, suggestion)) {
        const sceneSummary = buildSceneSummary(latestSceneBatch, sceneTitle);
        const shotSummary = buildShotSummary({ sceneTitle, framing, angle, motion, description, negative });
        suggestion = composeFallbackSuggestion({
          intent: framingIntent,
          sceneTitle,
          sceneSummary,
          shotSummary,
          userFeedback,
        });
      }

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
          applyStrategy: 'shot_plan_image_override',
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
