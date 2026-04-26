import type { Asset } from '../../api';
import type { JsonPatchOperation, Skill, SkillContext, SkillResult } from '../types';
import { extractFirstJsonObjectLenient } from '../llmClient';
import { executeTool } from '../tools';

type ShotPatchResponse = {
  patch?: JsonPatchOperation[];
  questions?: { id: string; question: string; default?: string }[];
  assumptions?: string[];
};

function buildSystemPrompt() {
  return [
    'You are a production copilot that proposes updates to a single SHOT within a Shot Plan asset.',
    '',
    'Return ONLY a valid JSON object matching this schema:',
    '{',
    '  "patch": [ { "op": "replace", "path": string, "value": any } ],',
    '  "questions": [ { "id": string, "question": string, "default": string } ], // optional if info is missing',
    '  "assumptions": string[] // optional',
    '}',
    '',
    'Rules:',
    '- Focus ONLY on updating shot fields: "action", "description", "negative_prompt", "camera", "production".',
    '- Shots are stored in a "shots" array. Paths MUST look like "/shots/<index>/<field>".',
    '- Fields inside "camera" include: "shot_type", "angle", "motion", "duration".',
    '- Fields inside "production" include: "characters", "environment", "props".',
    '- If the user just describes changes, translate them into these specific structured fields.',
    '- If no shot ID is provided but a shot number is mentioned (e.g., "Shot 1"), use the corresponding index (index = number - 1).',
    '- Do NOT include markdown, code fences, or extra commentary outside the JSON.',
  ].join('\n');
}

export const updateShotSkill: Skill = {
  name: 'updateShot',
  description: 'Discusses updates for a specific shot and compiles them into a proposal',
  keywords: ['shot', 'update shot', 'edit shot', 'change shot', 'framing', 'angle'],
  examples: ['Update shot 1 to have a low angle', 'Change the action of the current shot', 'Edit the negative prompt for shot 2'],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      const userRequest = input?.trim() || '';

      // 1) Select shot plan asset.
      let targetAsset: Asset | null = null;
      if (context.shotPlanAssetId) {
        const res = await executeTool('fetchAsset', context, { assetId: context.shotPlanAssetId });
        if (res.ok) targetAsset = res.data as Asset;
      }

      if (!targetAsset) {
        // Fallback: search for shot plan assets in the project.
        const allAssetsRes = await executeTool('fetchProjectAssets', context, { assetType: 'shot_plan' });
        if (allAssetsRes.ok) {
          const assets = allAssetsRes.data as Asset[];
          targetAsset = assets.filter(a => a.status !== 'deprecated')[0] ?? null;
        }
      }

      if (!targetAsset) {
        return {
          success: true,
          message: 'I could not find a Shot Plan to update. Please open a Shot Plan first.',
        };
      }

      const content = (targetAsset.current_version?.content ?? {}) as { shots?: any[] };
      const shots = Array.isArray(content.shots) ? content.shots : [];

      // 2) Identify the target shot index.
      let shotIndex: number | null = null;

      // Try matching by shotId from context.
      if (context.shotId) {
        const idx = shots.findIndex(s => s.id === context.shotId);
        if (idx !== -1) shotIndex = idx;
      }

      // Try matching by "Shot N" in request.
      const numMatch = userRequest.match(/\bshot\s*(\d+)\b/i);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < shots.length) shotIndex = idx;
      }

      if (shotIndex === null) {
        if (shots.length === 1) {
          shotIndex = 0;
        } else {
          return {
            success: true,
            message: 'Which shot should I update? (e.g., "Shot 1", "Shot 2")',
          };
        }
      }

      const currentShot = shots[shotIndex];
      const prompt = [
        buildSystemPrompt(),
        '',
        `SHOT_PLAN_ASSET_ID: ${targetAsset.id}`,
        `TARGET_SHOT_INDEX: ${shotIndex}`,
        `TARGET_SHOT_NUMBER: ${shotIndex + 1}`,
        '',
        'CURRENT_SHOT_DATA:',
        JSON.stringify(currentShot, null, 2),
        '',
        'USER_REQUEST:',
        userRequest,
        '',
        'Return JSON patching "/shots/' + shotIndex + '/...":',
      ].join('\n');

      const model =
        (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
        'gemma4:e2b';

      const llmRes = await executeTool('llmGenerateText', context, { model, prompt, stream: false });
      if (!llmRes.ok) return { success: false, message: llmRes.error.message };
      const raw = String((llmRes.data as any)?.text ?? '');

      const parsed = extractFirstJsonObjectLenient(raw) as ShotPatchResponse;
      const patch = Array.isArray(parsed.patch) ? parsed.patch : [];
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

      if (questions.length && patch.length === 0) {
        return {
          success: true,
          message: questions[0]?.question || 'I need more info to update the shot.',
        };
      }

      if (!patch.length) {
        return {
          success: false,
          message: 'No changes were proposed for the shot. Try being more specific (e.g., "Change the camera angle to Low Angle").',
        };
      }

      const proposal = {
        kind: 'asset_patch' as const,
        assetId: targetAsset.id,
        baseAssetVersionId: targetAsset.current_asset_version_id ?? null,
        summary: `Update shot ${shotIndex + 1}: ${targetAsset.title || 'Shot Plan'}`,
        patch,
        metadata: {
          applyStrategy: 'shot_plan_update',
          shotPlanAssetId: targetAsset.id,
          shotIndex,
        },
      };

      return {
        success: true,
        message: `Drafted updates for shot ${shotIndex + 1}. Review the proposal and type /apply to save it.`,
        proposal,
      };
    } catch (error) {
      console.error('Update shot skill error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sorry, I encountered an error.',
      };
    }
  },
};
