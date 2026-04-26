import type { Asset } from '../../api';
import type { JsonPatchOperation, Skill, SkillContext, SkillResult } from '../types';
import { extractFirstJsonObjectLenient } from '../llmClient';
import { executeTool } from '../tools';

type ScenePatchResponse = {
  patch?: JsonPatchOperation[];
  questions?: { id: string; question: string; default?: string }[];
  assumptions?: string[];
};

function pickLatestNonDeprecated(assets: Asset[]) {
  return (
    [...assets]
      .filter(a => a.status !== 'deprecated')
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0] ??
    null
  );
}

function sceneContent(asset: Asset): Record<string, unknown> {
  return (asset.current_version?.content ?? asset.current_approved_version?.content ?? {}) as Record<string, unknown>;
}

function buildSystemPrompt() {
  return [
    'You are a production copilot that proposes updates to a single SCENE asset.',
    '',
    'Return ONLY a valid JSON object matching this schema:',
    '{',
    '  "patch": [ { "op": "replace", "path": string, "value": any } ],',
    '  "questions": [ { "id": string, "question": string, "default": string } ], // optional if info is missing',
    '  "assumptions": string[] // optional',
    '}',
    '',
    'Rules:',
    '- Focus ONLY on updating scene fields: "title", "setting", "emotional_beat", "purpose", "text".',
    '- Use "replace" operations for existing fields.',
    '- If the user just describes changes, translate them into specific field updates.',
    '- Be visually specific but concise.',
    '- If you are unsure which scene to update, ask a question.',
    '- Do NOT include markdown, code fences, or extra commentary outside the JSON.',
    '- Fields to prioritize: "title", "setting", "emotionalBeat" (or "emotional_beat"), "purpose", "text".',
  ].join('\n');
}

export const updateSceneSkill: Skill = {
  name: 'updateScene',
  description: 'Discusses scene updates and compiles them into a proposal on demand',
  keywords: ['scene', 'update scene', 'edit scene', 'change scene', 'setting'],
  examples: ['Update the scene setting', 'Change scene 1 to be in a forest', 'Edit the emotional beat of this scene'],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      const userRequest = input?.trim() || '';
      
      // 1) Select scene asset (focused one if it is a scene, else match by title/number, else latest).
      let targetScene: Asset | null = null;
      if (context.assetId) {
        const focusedRes = await executeTool('fetchAsset', context, { assetId: context.assetId });
        if (focusedRes.ok) {
          const a = focusedRes.data as Asset;
          if (a.asset_type === 'scene' && a.status !== 'deprecated') targetScene = a;
        }
      }

      if (!targetScene) {
        const allScenesRes = await executeTool('fetchProjectAssets', context, { assetType: 'scene' });
        if (allScenesRes.ok) {
          const scenes = allScenesRes.data as Asset[];
          // Simple matching: if user says "scene 1", "scene 2", etc.
          const numMatch = userRequest.match(/\bscene\s*(\d+)\b/i);
          if (numMatch) {
            const idx = parseInt(numMatch[1], 10) - 1;
            if (scenes[idx] && scenes[idx].status !== 'deprecated') targetScene = scenes[idx];
          }
          // Title matching
          if (!targetScene) {
            for (const s of scenes) {
              if (s.title && userRequest.toLowerCase().includes(s.title.toLowerCase())) {
                targetScene = s;
                break;
              }
            }
          }
          // Fallback: latest
          if (!targetScene) targetScene = pickLatestNonDeprecated(scenes);
        }
      }

      if (!targetScene) {
        return {
          success: true,
          message: 'I could not find a scene to update. Please select a scene in the project first.',
        };
      }

      const current = sceneContent(targetScene);
      const prompt = [
        buildSystemPrompt(),
        '',
        `SCENE_ASSET_ID: ${targetScene.id}`,
        `SCENE_TITLE: ${targetScene.title || '(untitled)'}`,
        '',
        'CURRENT_SCENE_JSON:',
        JSON.stringify(current, null, 2),
        '',
        'USER_REQUEST:',
        userRequest,
        '',
        'JSON:',
      ].join('\n');

      const model =
        (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
        'gemma4:e2b';

      const llmRes = await executeTool('llmGenerateText', context, { model, prompt, stream: false });
      if (!llmRes.ok) return { success: false, message: llmRes.error.message };
      const raw = String((llmRes.data as any)?.text ?? '');

      const parsed = extractFirstJsonObjectLenient(raw) as ScenePatchResponse;
      const patch = Array.isArray(parsed.patch) ? parsed.patch : [];
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

      if (questions.length && patch.length === 0) {
        return {
          success: true,
          message: questions[0]?.question || 'I need more info to update the scene.',
        };
      }

      if (!patch.length) {
        return {
          success: false,
          message: 'No changes were proposed for the scene. Try explaining what you want to change (e.g., "Change the setting to a forest").',
        };
      }

      const proposal = {
        kind: 'asset_patch' as const,
        assetId: targetScene.id,
        baseAssetVersionId: targetScene.current_asset_version_id ?? null,
        summary: `Update scene: ${targetScene.title || targetScene.id.slice(0, 8)}`,
        patch,
        metadata: {
          applyStrategy: 'scene_update',
          sceneAssetId: targetScene.id,
        },
      };

      return {
        success: true,
        message: `Drafted updates for scene "${targetScene.title || 'unnamed'}". Review the proposal and type /apply to save it.`,
        proposal,
      };
    } catch (error) {
      console.error('Update scene skill error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sorry, I encountered an error.',
      };
    }
  },
};
