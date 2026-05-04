import {
  completeNodeRun,
  completeWorkflowRun,
  createAssetFromNodeOutput,
  createNodeRun,
  emitWorkflowRunProgress,
  failWorkflowRun,
  listAssets,
  getAssetById,
  getWorkflowRunExecutionContext,
  startWorkflowRun,
  addWorkflowRunLog,
} from '@ai-workflow/database';
import { scheduleIndexNodeRun, scheduleIndexWorkflowRun } from '../copilot/vectorIndexScheduler.js';
import * as adapters from '../services/adapters.js';
import { config } from '../config.js';
import { pollJobUntilComplete } from './job-poller.js';
import { executeWithRetry, type RetryPolicy } from './errors.js';
import { createDiagnosticsLogger } from './diagnostics.js';

const activeWorkflowRuns = new Set<string>();
const diag = createDiagnosticsLogger(config.logging.diagnostics_path ?? undefined);

function delay(milliseconds: number) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

interface WorkflowNode {
  id?: unknown;
  type?: unknown;
  params?: unknown;
  data?: unknown;
}

function getNodeType(node: WorkflowNode): string {
  const nodeAny = node as Record<string, unknown>;
  if (typeof nodeAny.nodeKey === 'string') return nodeAny.nodeKey;
  if (typeof nodeAny.type === 'string') return nodeAny.type;
  return 'unknown';
}

function getNodeId(node: WorkflowNode, position: number): string {
  return typeof node.id === 'string' ? node.id : `node-${position + 1}`;
}

function buildNodeInputSnapshot(
  node: WorkflowNode,
  resolvedInputSnapshot: Record<string, unknown>,
  position: number,
  projectId?: string
) {
  const nodeId = getNodeId(node, position);
  const nodeType = getNodeType(node);

  const params =
    typeof node.params === 'object' && node.params !== null
      ? (node.params as Record<string, unknown>)
      : {};

  return {
    node_id: nodeId,
    node_type: nodeType,
    params,
    resolved_input: resolvedInputSnapshot,
    project_id: projectId,
    _debug_keys: Object.keys(resolvedInputSnapshot),
  };
}

function getRetryPolicyForNode(nodeType: string): RetryPolicy {
  const retryPolicies: Record<string, RetryPolicy> = {
    llm_text: 'retry_with_backoff',
    llm: 'retry_with_backoff',
    tts: 'retry_with_backoff',
    text_to_speech: 'retry_with_backoff',
    generate_narration: 'retry_with_backoff',
    image: 'retry_with_backoff',
    image_generation: 'retry_with_backoff',
    generate_image: 'retry_with_backoff',
    video: 'retry_with_backoff',
    video_generation: 'retry_with_backoff',
    generate_video: 'retry_with_backoff',
  };
  return retryPolicies[nodeType] ?? config.execution.retry_policy;
}

async function executeLLMNode(
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const innerParams = (snapshot.params as Record<string, unknown>) || {};
  const baseInstructions = typeof innerParams.prompt === 'string' ? innerParams.prompt : '';
  const nodeType = typeof snapshot.node_type === 'string' ? snapshot.node_type : '';
  let sourceContent = '';

  const stringifyForContext = (value: unknown, maxLen = 12000) => {
    try {
      const json = JSON.stringify(value, null, 2) ?? '';
      if (json.length <= maxLen) return json;
      return `${json.slice(0, maxLen)}\n…(truncated ${json.length - maxLen} chars)`;
    } catch {
      const text = String(value);
      if (text.length <= maxLen) return text;
      return `${text.slice(0, maxLen)}\n…(truncated ${text.length - maxLen} chars)`;
    }
  };

  const extractTextLike = (prevOutput: Record<string, unknown>): string | null => {
    if (typeof prevOutput.text === 'string' && prevOutput.text.trim()) {
      return prevOutput.text;
    }
    if (typeof prevOutput._raw === 'string' && prevOutput._raw.trim()) {
      return prevOutput._raw;
    }
    // Many nodes return structured JSON (e.g., canon, scenes, shot_plan). Include it as context.
    if (prevOutput && typeof prevOutput === 'object') {
      const { _raw: _ignoredRaw, ...rest } = prevOutput as Record<string, unknown>;
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(
          ([k]) => !['_debug', '_debug_keys', 'result', 'error', 'model', 'job_id', 'status'].includes(k)
        )
      );
      const hasMeaningfulKeys = Object.keys(filtered).some(k => k.trim());
      if (hasMeaningfulKeys) {
        return stringifyForContext(filtered);
      }
    }
    return null;
  };

  const extractProvidedScenes = () => {
    if (!snapshot.resolved_input || typeof snapshot.resolved_input !== 'object') return null;
    const resolved = snapshot.resolved_input as Record<string, unknown>;
    for (const key of Object.keys(resolved)) {
      const prev = resolved[key];
      if (!prev || typeof prev !== 'object') continue;
      const prevObj = prev as Record<string, unknown>;
      const scenesRaw = prevObj.scenes;
      if (!Array.isArray(scenesRaw)) continue;
      const scenes = scenesRaw
        .filter(s => s && typeof s === 'object')
        .map(s => {
          const so = s as Record<string, unknown>;
          const title = typeof so.title === 'string' ? so.title : '';
          const purpose = typeof so.purpose === 'string' ? so.purpose : '';
          const emotional_beat =
            typeof so.emotional_beat === 'string'
              ? so.emotional_beat
              : typeof so.emotionalBeat === 'string'
                ? (so.emotionalBeat as string)
                : '';
          const setting = typeof so.setting === 'string' ? so.setting : '';
          return { title, purpose, emotional_beat, setting };
        })
        .filter(s => s.title || s.purpose || s.emotional_beat || s.setting);

      if (scenes.length > 0) {
        return { sourceKey: key, scenes };
      }
    }
    return null;
  };

  const extractProductionRequirements = async () => {
    if (!snapshot.resolved_input || typeof snapshot.resolved_input !== 'object') return null;
    const resolved = snapshot.resolved_input as Record<string, unknown>;
    
    let character_table: any[] = [];
    let environment_lock = "";
    let world_rules: any = "";
    let locations: any[] = [];

    const normalizeName = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const isNonEmptyString = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    const dedupeByName = (items: any[]) => {
      const seen = new Set<string>();
      const out: any[] = [];
      for (const it of items) {
        const name = normalizeName(it?.name).toLowerCase();
        const key = name || JSON.stringify(it).slice(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(it);
      }
      return out;
    };

    const addCharactersFromCanon = (chars: unknown) => {
      if (!Array.isArray(chars)) return;
      const mapped = chars
        .filter(c => c && typeof c === 'object')
        .map(c => {
          const o = c as Record<string, unknown>;
          const appearanceRaw = o.appearance && typeof o.appearance === 'object' && !Array.isArray(o.appearance) ? (o.appearance as Record<string, unknown>) : null;
          const appearance = appearanceRaw
            ? {
                face: isNonEmptyString(appearanceRaw.face) ? String(appearanceRaw.face).trim() : undefined,
                hair: isNonEmptyString(appearanceRaw.hair) ? String(appearanceRaw.hair).trim() : undefined,
                clothing: isNonEmptyString(appearanceRaw.clothing) ? String(appearanceRaw.clothing).trim() : undefined,
                shoes: isNonEmptyString(appearanceRaw.shoes) ? String(appearanceRaw.shoes).trim() : undefined,
                hat: isNonEmptyString(appearanceRaw.hat) ? String(appearanceRaw.hat).trim() : undefined,
                accessories: isNonEmptyString(appearanceRaw.accessories) ? String(appearanceRaw.accessories).trim() : undefined,
              }
            : undefined;

          return {
            name: normalizeName(o.name),
            role: normalizeName(o.role),
            gender: normalizeName(o.gender || (o as any).sex),
            age: normalizeName(o.age),
            description: isNonEmptyString(o.description) ? String(o.description).trim() : '',
            personality: isNonEmptyString(o.personality) ? String(o.personality).trim() : '',
            appearance,
          };
        })
        .filter(c => c.name || c.description || (c.appearance && Object.keys(c.appearance).length > 0));

      if (mapped.length) {
        character_table = dedupeByName([...character_table, ...mapped]);
      }
    };

    const isCanonLike = (asset: any) => {
      const content = asset?.current_version?.content;
      if (!content || typeof content !== 'object') return false;
      return Boolean(
        content.summary ||
        content.characters ||
        content.locations ||
        content.themes ||
        content.world_rules ||
        content.environment_lock ||
        content.character_table
      );
    };

    for (const key of Object.keys(resolved)) {
      const prev = resolved[key];
      if (!prev || typeof prev !== 'object') continue;
      const prevObj = prev as Record<string, unknown>;
      
      if (Array.isArray(prevObj.character_table)) {
        character_table = [...character_table, ...prevObj.character_table];
      }
      // Canon schema
      if (Array.isArray(prevObj.characters)) {
        addCharactersFromCanon(prevObj.characters);
      }
      if (isNonEmptyString(prevObj.environment_lock)) {
        environment_lock = String(prevObj.environment_lock).trim();
      } else if (isNonEmptyString((prevObj as any).environmentLock)) {
        environment_lock = String((prevObj as any).environmentLock).trim();
      }
      if (Array.isArray(prevObj.world_rules) && prevObj.world_rules.length > 0) {
        world_rules = prevObj.world_rules;
      } else if (Array.isArray((prevObj as any).worldRules) && (prevObj as any).worldRules.length > 0) {
        world_rules = (prevObj as any).worldRules;
      } else if (isNonEmptyString(prevObj.world_rules)) {
        world_rules = String(prevObj.world_rules).trim();
      } else if (isNonEmptyString((prevObj as any).worldRules)) {
        world_rules = String((prevObj as any).worldRules).trim();
      }
      if (Array.isArray(prevObj.locations)) {
        locations = [...locations, ...prevObj.locations];
      }
    }

    if (character_table.length === 0 && !environment_lock && typeof snapshot.project_id === 'string') {
      console.log(`[Workflow] generate_shot_plan did not receive canon from edges. Fetching latest canon directly from project ${snapshot.project_id}`);
      const allAssets = await listAssets(snapshot.project_id);
      const canonAsset = allAssets
        .filter((a: any) => a.status !== 'deprecated' && (a.asset_type === 'canon_text' || isCanonLike(a)))
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
      
      if (canonAsset?.current_version?.content) {
        const prevObj = canonAsset.current_version.content as Record<string, unknown>;
        if (Array.isArray(prevObj.character_table)) {
          character_table = [...character_table, ...prevObj.character_table];
        }
        if (Array.isArray(prevObj.characters)) {
          addCharactersFromCanon(prevObj.characters);
        }
        if (isNonEmptyString(prevObj.environment_lock)) {
          environment_lock = String(prevObj.environment_lock).trim();
        } else if (isNonEmptyString((prevObj as any).environmentLock)) {
          environment_lock = String((prevObj as any).environmentLock).trim();
        }
        if (Array.isArray(prevObj.world_rules) && prevObj.world_rules.length > 0) {
          world_rules = prevObj.world_rules;
        } else if (Array.isArray((prevObj as any).worldRules) && (prevObj as any).worldRules.length > 0) {
          world_rules = (prevObj as any).worldRules;
        } else if (isNonEmptyString(prevObj.world_rules)) {
          world_rules = String(prevObj.world_rules).trim();
        } else if (isNonEmptyString((prevObj as any).worldRules)) {
          world_rules = String((prevObj as any).worldRules).trim();
        }
        if (Array.isArray(prevObj.locations)) {
          locations = [...locations, ...prevObj.locations];
        }
      }
    }

    // Mapping character sub-fields to a more unified structure for the shot plan prompt
    const mappedCharacterTable = character_table.map(c => {
      const appearance = c.appearance || {};
      const descriptionPieces = [
        c.gender,
        c.age,
        appearance.face,
        appearance.hair,
        appearance.clothing,
        appearance.shoes,
        appearance.hat,
        appearance.accessories
      ].filter(Boolean);

      return {
        ...c,
        character_image: c.character_image || descriptionPieces.join(', ') || c.description || '',
        appearance,
      };
    });

    if (mappedCharacterTable.length > 0 || environment_lock || world_rules || locations.length > 0) {
      return { character_table: dedupeByName(mappedCharacterTable), environment_lock, world_rules, locations };
    }
    return null;
  };

  // Collect text from all previous node outputs
  if (snapshot.resolved_input) {
    const resolved = snapshot.resolved_input as Record<string, unknown>;
    const contents: string[] = [];
    for (const key of Object.keys(resolved)) {
      const prevOutput = resolved[key] as Record<string, unknown>;
      if (!prevOutput || typeof prevOutput !== 'object') continue;
      const textLike = extractTextLike(prevOutput);
      if (!textLike) continue;
      contents.push(`### ${key} ###\n${textLike}`);
    }
    sourceContent = contents.join('\n\n');
  }

  // Final prompt assembly: instructions + source material
  let finalPrompt = '';
  if (baseInstructions && sourceContent) {
    finalPrompt = `${baseInstructions}\n\n### SOURCE CONTENT ###\n${sourceContent}`;
  } else {
    finalPrompt = baseInstructions || sourceContent;
  }

  const providedScenes = nodeType === 'generate_shot_plan' ? extractProvidedScenes() : null;
  const requirements = nodeType === 'generate_shot_plan' ? await extractProductionRequirements() : null;

  if (nodeType === 'generate_shot_plan') {
    const sceneDirective = providedScenes 
      ? `IMPORTANT: A scene outline was provided. You MUST output a JSON object with a top-level "scenes" array, where each scene includes its own "shots" array. Do NOT output a top-level "shots" array.`
      : "";
    
    const consistencyDirective = requirements
      ? `STRICT CONSISTENCY RULES:
- You MUST use the characters from the provided ### PRODUCTION_REQUIREMENTS (MANDATORY) ### section. 
- Do NOT invent new characters. Do NOT change names or visual descriptions of existing characters.
- Ensure all shot visual descriptions are consistent with the Environment Lock and World Rules.`
      : "";

    finalPrompt = [
      baseInstructions,
      sceneDirective,
      consistencyDirective,
      requirements ? `### PRODUCTION_REQUIREMENTS (MANDATORY) ###\n${stringifyForContext(requirements, 8000)}` : '',
      providedScenes ? `### PROVIDED_SCENES_JSON ###\n${stringifyForContext({ scenes: providedScenes.scenes }, 12000)}` : '',
      sourceContent ? `### SOURCE CONTENT ###\n${sourceContent}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const model =
    typeof innerParams.model === 'string' ? innerParams.model : config.defaults.llm_model;

  console.log('[LLM] Request:', {
    model,
    instructionLength: baseInstructions.length,
    contentLength: sourceContent.length,
    finalPromptFirstChars: finalPrompt.slice(0, 100),
  });

  if (!finalPrompt) {
    throw new Error("LLM node requires a 'prompt' parameter or preceding node output with text");
  }

  const response = await executeWithRetry(
    () => adapters.generateText({ model, prompt: finalPrompt }),
    getRetryPolicyForNode('llm')
  );

  const rawText = response.response;
  const debugFinalPrompt =
    finalPrompt.length > 8000 ? `${finalPrompt.slice(0, 8000)}\n…(truncated)` : finalPrompt;

  // Try to parse as JSON if the prompt asks for JSON output
  if (baseInstructions.toLowerCase().includes('json')) {
    try {
      // Try direct JSON parse first
      const parsed = JSON.parse(rawText) as Record<string, unknown>;

      if (nodeType === 'generate_shot_plan' && providedScenes) {
        const hasScenes = Array.isArray((parsed as Record<string, unknown>).scenes);
        const scenesArray = hasScenes ? ((parsed as Record<string, unknown>).scenes as any[]) : [];
        const flatShots = (parsed as Record<string, unknown>).shots;
        const hasFlatShots = Array.isArray(flatShots) && flatShots.length > 0;

        // Recovery: If we have flat shots but either no scenes or empty scenes
        const scenesAreEmpty = !hasScenes || (scenesArray.length > 0 && scenesArray.every(s => !Array.isArray(s.shots) || s.shots.length === 0));

        if (hasFlatShots && (scenesAreEmpty || !hasScenes)) {
          const shots = flatShots.filter(s => s && typeof s === 'object');
          let cursor = 0;
          
          // Use provided scenes if the model didn't generate any, or use the ones the model DID generate
          const baseScenes = scenesArray.length > 0 ? scenesArray : providedScenes.scenes;
          const sceneCount = baseScenes.length;
          
          const consolidatedScenes = baseScenes.map((scene, idx) => {
            const remainingShots = Math.max(0, shots.length - cursor);
            const remainingScenes = Math.max(1, sceneCount - idx);
            const take = Math.ceil(remainingShots / remainingScenes);
            const sceneShots = shots.slice(cursor, cursor + take);
            cursor += take;
            return { ...scene, shots: sceneShots };
          });
          return { scenes: consolidatedScenes, _raw: rawText };
        }
      }

      return {
        ...parsed,
        _raw: rawText,
        _debug: {
          model,
          final_prompt: debugFinalPrompt,
        },
      };
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;

          if (nodeType === 'generate_shot_plan' && providedScenes) {
            const hasScenes = Array.isArray((parsed as Record<string, unknown>).scenes);
            const scenesArray = hasScenes ? ((parsed as Record<string, unknown>).scenes as any[]) : [];
            const flatShots = (parsed as Record<string, unknown>).shots;
            const hasFlatShots = Array.isArray(flatShots) && flatShots.length > 0;

            const scenesAreEmpty = !hasScenes || (scenesArray.length > 0 && scenesArray.every(s => !Array.isArray(s.shots) || s.shots.length === 0));

            if (hasFlatShots && (scenesAreEmpty || !hasScenes)) {
              const shots = flatShots.filter(s => s && typeof s === 'object');
              let cursor = 0;
              const baseScenes = scenesArray.length > 0 ? scenesArray : providedScenes.scenes;
              const sceneCount = baseScenes.length;
              const consolidatedScenes = baseScenes.map((scene, idx) => {
                const remainingShots = Math.max(0, shots.length - cursor);
                const remainingScenes = Math.max(1, sceneCount - idx);
                const take = Math.ceil(remainingShots / remainingScenes);
                const sceneShots = shots.slice(cursor, cursor + take);
                cursor += take;
                return { ...scene, shots: sceneShots };
              });
              return { scenes: consolidatedScenes, _raw: rawText };
            }
          }

          return {
            ...parsed,
            _raw: rawText,
            _debug: {
              model,
              final_prompt: debugFinalPrompt,
            },
          };
        } catch {}
      }
      // Try to extract JSON from plain text using regex
      const plainMatch = rawText.match(/\{[\s\S]*\}/);
      if (plainMatch) {
        try {
          const parsed = JSON.parse(plainMatch[0]) as Record<string, unknown>;

          if (nodeType === 'generate_shot_plan' && providedScenes) {
            const hasScenes = Array.isArray((parsed as Record<string, unknown>).scenes);
            const scenesArray = hasScenes ? ((parsed as Record<string, unknown>).scenes as any[]) : [];
            const flatShots = (parsed as Record<string, unknown>).shots;
            const hasFlatShots = Array.isArray(flatShots) && flatShots.length > 0;

            const scenesAreEmpty = !hasScenes || (scenesArray.length > 0 && scenesArray.every(s => !Array.isArray(s.shots) || s.shots.length === 0));

            if (hasFlatShots && (scenesAreEmpty || !hasScenes)) {
              const shots = flatShots.filter(s => s && typeof s === 'object');
              let cursor = 0;
              const baseScenes = scenesArray.length > 0 ? scenesArray : providedScenes.scenes;
              const sceneCount = baseScenes.length;
              const consolidatedScenes = baseScenes.map((scene, idx) => {
                const remainingShots = Math.max(0, shots.length - cursor);
                const remainingScenes = Math.max(1, sceneCount - idx);
                const take = Math.ceil(remainingShots / remainingScenes);
                const sceneShots = shots.slice(cursor, cursor + take);
                cursor += take;
                return { ...scene, shots: sceneShots };
              });
              return { scenes: consolidatedScenes, _raw: rawText };
            }
          }

          return {
            ...parsed,
            _raw: rawText,
            _debug: {
              model,
              final_prompt: debugFinalPrompt,
            },
          };
        } catch {}
      }
      // If all JSON parsing fails, return as text
      console.warn('[LLM] JSON parse failed, returning raw text');
    }
  }

  return {
    text: rawText,
    model: response.model,
    _debug: {
      model,
      final_prompt: debugFinalPrompt,
    },
  };
}

async function executeTTSNode(
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const innerParams = (snapshot.params as Record<string, unknown>) || {};
  const text = typeof innerParams.text === 'string' ? innerParams.text : '';
  const rawTemplate = typeof innerParams.template === 'string' ? innerParams.template.trim() : '';
  const provider =
    innerParams.provider === 'piper' || innerParams.provider === 'cosyvoice'
      ? (innerParams.provider as 'piper' | 'cosyvoice')
      : config.defaults.tts_provider;
  const prompt_text = typeof innerParams.prompt_text === 'string' ? innerParams.prompt_text : undefined;
  const prompt_wav = typeof innerParams.prompt_wav === 'string' ? innerParams.prompt_wav : undefined;
  const model_dir = typeof innerParams.model_dir === 'string' ? innerParams.model_dir : undefined;

  if (!text) {
    throw new Error("TTS node requires a 'text' parameter");
  }

  const splitSentences = (input: string) => {
    const matches = input.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
    return (matches ?? []).map(s => s.trim()).filter(Boolean);
  };

  const splitTextForTTS = (input: string, maxChars: number) => {
    const normalized = input.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= maxChars) return [normalized];

    const paragraphs = normalized
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    const units = paragraphs.length > 1 ? paragraphs : splitSentences(normalized);

    const chunks: string[] = [];
    let current = '';
    for (const unit of units) {
      const candidate = current ? `${current}\n\n${unit}` : unit;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }

      if (current) {
        chunks.push(current);
        current = '';
      }

      if (unit.length <= maxChars) {
        current = unit;
        continue;
      }

      // Fallback: hard split very long single units.
      for (let i = 0; i < unit.length; i += maxChars) {
        chunks.push(unit.slice(i, i + maxChars));
      }
    }
    if (current) chunks.push(current);
    return chunks;
  };

  // The local TTS API supports Piper and CosyVoice templates (e.g. `zero_shot_prompt.wav`, `f1.mp3`).
  // Some older workflows used OpenAI-style voice names like "alloy"; CosyVoice will fail trying to
  // resolve them as filenames. When provider is CosyVoice (or default), fall back to DEFAULT_TTS_VOICE.
  const looksLikeCosyVoiceTemplate = (value: string) => /\.(wav|mp3)$/i.test(value);
  const assumeCosyVoice = provider === 'cosyvoice';
  const template =
    assumeCosyVoice
      ? rawTemplate && !looksLikeCosyVoiceTemplate(rawTemplate)
        ? (console.warn(
            `[Node ${nodeRunId}] Invalid CosyVoice template "${rawTemplate}", falling back to default "${config.defaults.tts_voice}"`
          ),
          config.defaults.tts_voice)
        : (rawTemplate || config.defaults.tts_voice)
      : (rawTemplate || config.defaults.piper_tts_voice);

  const maxCharsPerChunk =
    typeof (innerParams as any).max_chars_per_chunk === 'number'
      ? Math.max(200, Math.min(20000, (innerParams as any).max_chars_per_chunk))
      : 3500;
  const textChunks = splitTextForTTS(text, maxCharsPerChunk);

  const makeSpeechJob = async (chunkText: string) => {
    const response = await executeWithRetry(
      () =>
        adapters.generateSpeech({
          text: chunkText,
          template,
          provider,
          speed: typeof innerParams.speed === 'number' ? innerParams.speed : 1.0,
          volume: typeof innerParams.volume === 'number' ? innerParams.volume : 1.0,
          prompt_text,
          prompt_wav,
          model_dir,
        }),
      getRetryPolicyForNode('tts')
    );

    const job = await pollJobUntilComplete(response.job_id, {
      pollIntervalMs: 2000,
      onStatusChange: status => {
        console.log(`[Node ${nodeRunId}] TTS job ${response.job_id} status: ${status}`);
      },
    });

    if (job.status === 'failed' || job.status === 'error') {
      throw new Error(`TTS job failed: ${JSON.stringify(job.artifacts)}`);
    }

    return {
      job_id: response.job_id,
      status: job.status,
      audio_path: response.audio_path,
      audio_url: response.audio_url,
      text_used: chunkText,
    };
  };

  if (textChunks.length > 1) {
    console.log(
      `[Node ${nodeRunId}] TTS chunking enabled: ${textChunks.length} segment(s) at ~${maxCharsPerChunk} chars`
    );
    const segments = [];
    for (const chunkText of textChunks) {
      segments.push(await makeSpeechJob(chunkText));
    }

    const first = segments[0] as any;
    return {
      text_used: text,
      text_used_segments: textChunks,
      audio_segments: segments,
      audio_path: first.audio_path,
      audio_url: first.audio_url,
      job_id: first.job_id,
      status: 'completed',
    };
  }

  const single = await makeSpeechJob(textChunks[0]!);

  return {
    text_used: text,
    audio_path: single.audio_path,
    audio_url: single.audio_url,
    job_id: single.job_id,
    status: single.status,
  };
}

async function executeNarrationNode(
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const innerParams = (snapshot.params as Record<string, unknown>) || {};
  const baseText = typeof innerParams.text === 'string' ? innerParams.text : '';

  if (!baseText) {
    throw new Error("Narration node requires a 'text' parameter");
  }

  type ShotRef = {
    scene_index: number;
    scene_title?: string;
    shot_number?: number | string;
    shot_id?: string;
    order: number;
  };

  const extractShotsFromShotPlan = (): ShotRef[] => {
    const resolved = snapshot.resolved_input as Record<string, unknown> | undefined;
    const projectId = typeof snapshot.project_id === 'string' ? snapshot.project_id : null;
    if ((!resolved || typeof resolved !== 'object') && !projectId) return [];

    const tryParseWrappedJson = (value: unknown) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) return null;
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? (parsed as any) : null;
      } catch {
        return null;
      }
    };

    const collectFromPlanObject = (planObj: any, fallbackPlanId?: string) => {
      const refs: ShotRef[] = [];
      let order = 0;

      const pushShotRef = (shot: any, sceneIndex?: number, sceneTitle?: string) => {
        if (!shot || typeof shot !== 'object') return;
        const localOrder = order++;
        const explicitId = typeof shot.id === 'string' ? shot.id : undefined;
        const fallbackId = fallbackPlanId ? `${fallbackPlanId}:${localOrder}` : undefined;
        refs.push({
          scene_index: typeof sceneIndex === 'number' ? sceneIndex + 1 : 1,
          scene_title: sceneTitle,
          shot_number:
            typeof shot.shot_number === 'number' || typeof shot.shot_number === 'string'
              ? shot.shot_number
              : typeof shot.shotNumber === 'number' || typeof shot.shotNumber === 'string'
                ? shot.shotNumber
                : typeof shot.shot === 'number' || typeof shot.shot === 'string'
                  ? shot.shot
                  : undefined,
          shot_id: explicitId ?? fallbackId,
          order: localOrder,
        });
      };

      if (Array.isArray(planObj?.scenes)) {
        const scenes = planObj.scenes.filter((s: any) => s && typeof s === 'object') as any[];
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
          const scene = scenes[sceneIndex] as any;
          const sceneTitle = typeof scene.title === 'string' ? scene.title : undefined;
          if (!Array.isArray(scene.shots)) continue;

          const shots = scene.shots.filter((s: any) => s && typeof s === 'object') as any[];
          shots.sort((a, b) => {
            const aNum =
              typeof a.shot_number === 'number'
                ? a.shot_number
                : typeof a.shotNumber === 'number'
                  ? a.shotNumber
                  : NaN;
            const bNum =
              typeof b.shot_number === 'number'
                ? b.shot_number
                : typeof b.shotNumber === 'number'
                  ? b.shotNumber
                  : NaN;
            if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
            if (Number.isFinite(aNum)) return -1;
            if (Number.isFinite(bNum)) return 1;
            return 0;
          });

          for (const shot of shots) {
            pushShotRef(shot, sceneIndex, sceneTitle);
          }
        }
      } else if (Array.isArray(planObj?.shots)) {
        const shots = planObj.shots.filter((s: any) => s && typeof s === 'object') as any[];
        shots.sort((a, b) => {
          const aNum =
            typeof a.shot_number === 'number'
              ? a.shot_number
              : typeof a.shotNumber === 'number'
                ? a.shotNumber
                : NaN;
          const bNum =
            typeof b.shot_number === 'number'
              ? b.shot_number
              : typeof b.shotNumber === 'number'
                ? b.shotNumber
                : NaN;
          if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
          if (Number.isFinite(aNum)) return -1;
          if (Number.isFinite(bNum)) return 1;
          return 0;
        });
        for (const shot of shots) pushShotRef(shot, 0, undefined);
      }

      return refs;
    };

    const resolvedValues = resolved && typeof resolved === 'object' ? Object.values(resolved) : [];
    for (const prev of resolvedValues) {
      if (!prev || typeof prev !== 'object') continue;
      const prevObj = prev as any;

      const directRefs = collectFromPlanObject(prevObj);
      if (directRefs.length > 0) return directRefs;

      // Many LLM nodes wrap JSON in `text` or `_raw`. Try to parse so narration splitting still works
      // even when upstream parsing failed.
      const parsed =
        tryParseWrappedJson(prevObj.text) ??
        tryParseWrappedJson(prevObj._raw) ??
        tryParseWrappedJson(prevObj.prompt_used) ??
        null;
      if (parsed) {
        const wrappedRefs = collectFromPlanObject(parsed);
        if (wrappedRefs.length > 0) return wrappedRefs;
      }
    }

    // Fallback: pull the latest shot plan from the project if edges were not wired.
    if (projectId) {
      const assets = listAssets(projectId).filter(a => a.status !== 'deprecated');
      const candidates = assets
        .filter(a =>
          ['shot_plan', 'storyboard', 'scene_batch', 'generated_text'].includes((a as any).asset_type)
        )
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      for (const asset of candidates) {
        const content = (asset as any).current_version?.content;
        if (!content || typeof content !== 'object') continue;
        const planId = typeof (asset as any).id === 'string' ? String((asset as any).id) : undefined;
        const refs = collectFromPlanObject(content, planId);
        if (refs.length > 0) return refs;

        const parsed = tryParseWrappedJson((content as any).text) ?? tryParseWrappedJson((content as any)._raw);
        if (parsed) {
          const parsedRefs = collectFromPlanObject(parsed, planId);
          if (parsedRefs.length > 0) return parsedRefs;
        }
      }
    }

    return [];
  };

  const splitTextIntoParts = (input: string, parts: number) => {
    const text = input.replace(/\r\n/g, '\n');
    const normalized = text.trim();
    if (!normalized) return [];
    if (parts <= 1) return [normalized];
    if (parts >= normalized.length) {
      // Degenerate: too many parts. Return single-char-ish chunks.
      return Array.from({ length: parts }, (_, i) => normalized[i] ?? '').map(s => s.trim()).filter(Boolean);
    }

    const isBoundaryAt = (idx: number) => {
      const c = normalized[idx];
      if (!c) return false;
      if (c === '\n' && normalized[idx + 1] === '\n') return true;
      if (c === '.' || c === '!' || c === '?') {
        const next = normalized[idx + 1];
        return next === undefined || /\s/.test(next);
      }
      return false;
    };

    const findBoundaryNear = (approx: number, start: number) => {
      const searchWindow = 320;
      const max = normalized.length - 1;
      const forwardLimit = Math.min(max, approx + searchWindow);
      for (let i = approx; i <= forwardLimit; i += 1) {
        if (i <= start) continue;
        if (isBoundaryAt(i)) return i + 1;
      }
      const backwardLimit = Math.max(start + 1, approx - searchWindow);
      for (let i = approx; i >= backwardLimit; i -= 1) {
        if (i <= start) continue;
        if (isBoundaryAt(i)) return i + 1;
      }
      return Math.min(normalized.length, Math.max(start + 1, approx));
    };

    const target = Math.ceil(normalized.length / parts);
    const segments: string[] = [];
    let start = 0;
    for (let i = 0; i < parts; i += 1) {
      if (start >= normalized.length) break;
      if (i === parts - 1) {
        segments.push(normalized.slice(start).trim());
        break;
      }
      const approx = Math.min(normalized.length - 1, start + target);
      const end = findBoundaryNear(approx, start);
      const slice = normalized.slice(start, end).trim();
      if (slice) segments.push(slice);
      start = end;
    }

    // Ensure we return exactly `parts` entries (pad empties if needed).
    while (segments.length < parts) segments.push('');
    return segments.slice(0, parts);
  };

  const extractNarrationFromShotPlan = (): string | null => {
    const resolved = snapshot.resolved_input as Record<string, unknown> | undefined;
    if (!resolved || typeof resolved !== 'object') return null;

    const collected: Array<{ order: number; text: string }> = [];
    let orderCounter = 0;

    const addNarration = (value: unknown) => {
      if (typeof value !== 'string') return;
      const text = value.trim();
      if (!text) return;
      collected.push({ order: orderCounter++, text });
    };

    for (const prev of Object.values(resolved)) {
      if (!prev || typeof prev !== 'object') continue;
      const prevObj = prev as any;

      // Preferred: scenes -> shots -> narration
      if (Array.isArray(prevObj.scenes)) {
        for (const scene of prevObj.scenes) {
          if (!scene || typeof scene !== 'object') continue;
          const sceneObj = scene as any;
          if (!Array.isArray(sceneObj.shots)) continue;

          const shots = [...sceneObj.shots].filter(s => s && typeof s === 'object') as any[];
          shots.sort((a, b) => {
            const aNum = typeof a.shot_number === 'number' ? a.shot_number : typeof a.shotNumber === 'number' ? a.shotNumber : NaN;
            const bNum = typeof b.shot_number === 'number' ? b.shot_number : typeof b.shotNumber === 'number' ? b.shotNumber : NaN;
            if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
            if (Number.isFinite(aNum)) return -1;
            if (Number.isFinite(bNum)) return 1;
            return 0;
          });

          for (const shot of shots) {
            addNarration(shot.narration);
          }
        }
      }

      // Legacy: top-level shots -> narration
      if (Array.isArray(prevObj.shots)) {
        for (const shot of prevObj.shots) {
          if (!shot || typeof shot !== 'object') continue;
          addNarration((shot as any).narration);
        }
      }
    }

    if (collected.length === 0) return null;
    return collected
      .sort((a, b) => a.order - b.order)
      .map(item => item.text)
      .join('\n\n');
  };

  const extractSourceStoryText = (): string | null => {
    const resolved = snapshot.resolved_input as Record<string, unknown> | undefined;
    const projectId = typeof snapshot.project_id === 'string' ? snapshot.project_id : null;
    if ((!resolved || typeof resolved !== 'object') && !projectId) return null;

    let best: string | null = null;
    let bestScore = -1;

    const entries = resolved && typeof resolved === 'object' ? Object.entries(resolved) : [];
    for (const [key, prev] of entries) {
      if (!prev || typeof prev !== 'object') continue;
      const text = typeof (prev as any).text === 'string' ? String((prev as any).text).trim() : '';
      if (!text) continue;
      const keyScore = /story/i.test(key) ? 1000000 : 0;
      const score = keyScore + text.length;
      if (score > bestScore) {
        bestScore = score;
        best = text;
      }
    }

    if (best) return best;

    if (projectId) {
      const story = listAssets(projectId, { asset_type: 'source_story' })[0] as any;
      const content = story?.current_version?.content;
      if (content && typeof content === 'object' && typeof content.text === 'string') {
        return String(content.text).trim() || null;
      }
    }

    return null;
  };

  // Many templates use `generate_narration` with `runtimeType: tts` but the intended behavior
  // for the narration node is planning/splitting only. It should populate per-shot narration text,
  // not generate audio. If the node contains an LLM-style instruction, we still run the LLM pass to
  // obtain narration text, but we never call TTS from this node.
  let narrationText = baseText;
  const looksLikeNarrationPlanner =
    baseText.toLowerCase().includes('output only valid json') &&
    baseText.toLowerCase().includes('"narration"');

  const splitByShot = (innerParams as any).split_by_shot !== false;
  const storyText = extractSourceStoryText();
  const shots = extractShotsFromShotPlan();

  if (looksLikeNarrationPlanner) {
    const fromStory = storyText;

    // Preferred behavior: keep the source story text intact, and ONLY split it into shot-aligned
    // chunks. This avoids the shot plan paraphrasing/omitting story content.
    const fromShotPlan = extractNarrationFromShotPlan();
    if (fromShotPlan) narrationText = fromShotPlan;
    else if (fromStory) narrationText = fromStory;
  }

  if (looksLikeNarrationPlanner && narrationText === baseText) {
    const llmSnapshot = {
      ...snapshot,
      params: {
        ...innerParams,
        prompt: baseText,
      },
    };

    const llmOut = await executeLLMNode(llmSnapshot, nodeRunId);
    const candidate = typeof (llmOut as any)?.narration === 'string' ? String((llmOut as any).narration) : '';
    narrationText = candidate.trim();
    if (!narrationText) {
      throw new Error("Narration planner did not return a 'narration' string");
    }
  }

  const narrationSource = (storyText || narrationText || '').trim();

  // Primary behavior: keep the source story text intact, and ONLY split it into shot-aligned chunks.
  // This avoids the shot plan paraphrasing/omitting story content and keeps narration generation
  // decoupled from audio generation in the Shots tab.
  if (splitByShot && narrationSource && shots.length > 0) {
    const narrationSegments = splitTextIntoParts(narrationSource, shots.length);
    const voiceover_segments: Array<Record<string, unknown>> = [];

    for (let i = 0; i < shots.length; i += 1) {
      const segmentText = narrationSegments[i] ?? '';
      const shot = shots[i]!;
      if (!segmentText.trim()) continue;

      voiceover_segments.push({
        ...shot,
        text: segmentText,
        order: i,
        status: 'ready',
      });
    }

    return {
      narration: narrationSource,
      narration_segments: narrationSegments,
      voiceover_segments,
      status: 'completed',
    };
  }

  return {
    narration: narrationSource || narrationText,
    status: 'completed',
  };
}

async function executeImageNode(
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const innerParams = (snapshot.params as Record<string, unknown>) || {};
  const basePrompt = typeof innerParams.prompt === 'string' ? innerParams.prompt : '';

  if (!basePrompt) {
    throw new Error("Image node requires a 'prompt' parameter");
  }

  // Many templates currently store an *LLM instruction* in the image node prompt
  // (e.g., "Output ONLY valid JSON" with an `image_description` field). If we pass that
  // directly to the image model, it will often generate generic/incorrect frames.
  // Instead, first run an LLM pass to produce an image description, then send that
  // description to the image generator.
  let prompt = basePrompt;
  const looksLikePromptPlanner =
    basePrompt.toLowerCase().includes('output only valid json') &&
    basePrompt.toLowerCase().includes('image_description');

  const extractScenes = (): Array<Record<string, unknown>> => {
    const resolved = snapshot.resolved_input as Record<string, unknown> | undefined;
    if (!resolved || typeof resolved !== 'object') return [];

    for (const value of Object.values(resolved)) {
      if (!value || typeof value !== 'object') continue;
      const scenes = (value as any).scenes;
      if (!Array.isArray(scenes)) continue;
      const cleaned = scenes.filter((s: any) => s && typeof s === 'object') as Array<
        Record<string, unknown>
      >;
      if (cleaned.length > 0) return cleaned;
    }

    return [];
  };

  const scenes = extractScenes();
  const shouldGeneratePerScene =
    scenes.length > 0 && (innerParams as any).batch_mode !== 'single';

  if (shouldGeneratePerScene) {
    const maxScenes = typeof (innerParams as any).max_scenes === 'number' ? (innerParams as any).max_scenes : 20;
    const slice = scenes.slice(0, Math.max(1, Math.min(maxScenes, scenes.length)));
    if (scenes.length > slice.length) {
      console.warn(
        `[Node ${nodeRunId}] generate_image: limiting scenes from ${scenes.length} to ${slice.length}`
      );
    }

    const images: Array<Record<string, unknown>> = [];

    for (let index = 0; index < slice.length; index += 1) {
      const scene = slice[index];
      const sceneTitle = typeof (scene as any).title === 'string' ? String((scene as any).title) : '';

      let scenePrompt = basePrompt;
      if (looksLikePromptPlanner) {
        const llmSnapshot: Record<string, unknown> = {
          ...snapshot,
          params: {
            ...innerParams,
            prompt: `${basePrompt}\n\n### TARGET_SCENE_JSON ###\n${JSON.stringify(scene, null, 2)}`,
          },
        };
        const llmOut = await executeLLMNode(llmSnapshot, nodeRunId);
        const imageDescription =
          typeof (llmOut as any)?.image_description === 'string'
            ? String((llmOut as any).image_description).trim()
            : '';
        if (!imageDescription) {
          throw new Error(`Image prompt planner did not return image_description for scene ${index + 1}`);
        }
        scenePrompt = imageDescription;
      } else {
        scenePrompt = `${basePrompt}\n\nScene: ${sceneTitle || `Scene ${index + 1}`}\n${JSON.stringify(scene, null, 2)}`;
      }

      const response = await executeWithRetry(
        () =>
          adapters.generateImage({
            prompt: scenePrompt,
            width: typeof innerParams.width === 'number' ? innerParams.width : 1024,
            height: typeof innerParams.height === 'number' ? innerParams.height : 1024,
          }),
        getRetryPolicyForNode('image')
      );

      const job = await pollJobUntilComplete(response.job_id, {
        pollIntervalMs: 3000,
        onStatusChange: status => {
          console.log(
            `[Node ${nodeRunId}] Image job ${response.job_id} (scene ${index + 1}/${slice.length}) status: ${status}`
          );
        },
      });

      if (job.status === 'failed' || job.status === 'error') {
        throw new Error(`Image generation failed: ${JSON.stringify(job.artifacts)}`);
      }

      images.push({
        scene_index: index,
        scene_title: sceneTitle,
        prompt_used: scenePrompt,
        image_path: response.image_path,
        image_url: response.image_url,
        job_id: response.job_id,
        status: job.status,
      });
    }

    const first = images[0] as any;
    return {
      images,
      // Back-compat for callers that still expect a single image.
      prompt_used: typeof first?.prompt_used === 'string' ? first.prompt_used : undefined,
      image_path: typeof first?.image_path === 'string' ? first.image_path : undefined,
      image_url: typeof first?.image_url === 'string' ? first.image_url : undefined,
      job_id: typeof first?.job_id === 'string' ? first.job_id : undefined,
      status: 'completed',
    };
  }

  if (looksLikePromptPlanner) {
    try {
      const llmOut = await executeLLMNode(snapshot, nodeRunId);
      const imageDescription =
        typeof (llmOut as any)?.image_description === 'string'
          ? String((llmOut as any).image_description).trim()
          : typeof (llmOut as any)?.prompt === 'string'
            ? String((llmOut as any).prompt).trim()
            : '';
      if (imageDescription) {
        prompt = imageDescription;
      }
    } catch (err) {
      console.warn(
        `[Node ${nodeRunId}] Failed to build image prompt via LLM; falling back to raw prompt:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const response = await executeWithRetry(
    () =>
      adapters.generateImage({
        prompt,
        width: typeof innerParams.width === 'number' ? innerParams.width : 1024,
        height: typeof innerParams.height === 'number' ? innerParams.height : 1024,
      }),
    getRetryPolicyForNode('image')
  );

  const job = await pollJobUntilComplete(response.job_id, {
    pollIntervalMs: 3000,
    onStatusChange: status => {
      console.log(`[Node ${nodeRunId}] Image job ${response.job_id} status: ${status}`);
    },
  });

  if (job.status === 'failed' || job.status === 'error') {
    throw new Error(`Image generation failed: ${JSON.stringify(job.artifacts)}`);
  }

  return {
    prompt_used: prompt,
    image_path: response.image_path,
    image_url: response.image_url,
    job_id: response.job_id,
    status: job.status,
  };
}

async function executeVideoNode(
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const innerParams = (snapshot.params as Record<string, unknown>) || {};
  const prompt = typeof innerParams.prompt === 'string' ? innerParams.prompt : '';

  if (!prompt) {
    throw new Error("Video node requires a 'prompt' parameter");
  }

  const response = await executeWithRetry(
    () =>
      adapters.createVideo({
        prompt,
        width: typeof innerParams.width === 'number' ? innerParams.width : 1024,
        height: typeof innerParams.height === 'number' ? innerParams.height : 576,
      }),
    getRetryPolicyForNode('video')
  );

  const job = await pollJobUntilComplete(response.job_id, {
    pollIntervalMs: 5000,
    onStatusChange: status => {
      console.log(`[Node ${nodeRunId}] Video job ${response.job_id} status: ${status}`);
    },
  });

  if (job.status === 'failed' || job.status === 'error') {
    throw new Error(`Video generation failed: ${JSON.stringify(job.artifacts)}`);
  }

  return {
    video_path: response.video_path,
    video_url: response.video_url,
    job_id: response.job_id,
    status: job.status,
  };
}

async function executeNode(
  node: WorkflowNode,
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const nodeType = getNodeType(node);
  const innerParams = (snapshot.params as Record<string, unknown>) || {};

  try {
    switch (nodeType) {
      case 'llm_text':
      case 'llm':
      case 'extract_canon':
      case 'generate_scenes':
      case 'generate_shot_plan':
        return await executeLLMNode(snapshot, nodeRunId);

      case 'tts':
      case 'text_to_speech': {
        const catalogType =
          node &&
          typeof (node as any).data === 'object' &&
          (node as any).data !== null &&
          typeof (node as any).data.catalog_type === 'string'
            ? String((node as any).data.catalog_type)
            : null;

        const baseText = typeof innerParams.text === 'string' ? innerParams.text : '';
        const looksLikeNarrationPlanner =
          baseText.toLowerCase().includes('output only valid json') &&
          baseText.toLowerCase().includes('"narration"');
        return catalogType === 'generate_narration' || looksLikeNarrationPlanner
          ? await executeNarrationNode(snapshot, nodeRunId)
          : await executeTTSNode(snapshot, nodeRunId);
      }

      case 'generate_narration':
        return await executeNarrationNode(snapshot, nodeRunId);

      case 'image':
      case 'image_generation':
      case 'generate_image':
        return await executeImageNode(snapshot, nodeRunId);

      case 'video':
      case 'video_generation':
      case 'generate_video':
        return await executeVideoNode(snapshot, nodeRunId);

      case 'asset_query':
        return {
          query_status: 'resolved',
          selected_assets: [],
        };

      case 'asset_review':
      case 'review_node': {
        console.log('=== ASSET REVIEW NODE DEBUG ===');
        console.log('[asset_review] snapshot type:', typeof snapshot);
        console.log('[asset_review] snapshot keys:', Object.keys(snapshot));
        console.log(
          '[asset_review] FULL snapshot:',
          JSON.stringify(snapshot, null, 2).slice(0, 2000)
        );

        // Direct check for resolved_input at top level
        const resolvedInput = (snapshot as Record<string, unknown>).resolved_input;
        console.log('[asset_review] resolved_input:', resolvedInput);
        console.log('[asset_review] resolved_input type:', typeof resolvedInput);

        const reviewSnapshot = snapshot as Record<string, unknown>;
        const reviewParams = (reviewSnapshot.params as Record<string, unknown>) || {};
        console.log('[asset_review] reviewParams:', reviewParams);

        // If user has provided edited_text, use it as the definitive output
        if (typeof reviewParams.edited_text === 'string' && reviewParams.edited_text) {
          console.log('[asset_review] using edited_text from params');
          return { text: reviewParams.edited_text };
        }

        // Otherwise, pull from resolved_input (aggregate all unique text)
        let fallbackText = '';
        console.log('[asset_review] checking resolvedInput, truthy:', !!resolvedInput);
        if (resolvedInput && typeof resolvedInput === 'object') {
          const resolved = resolvedInput as Record<string, unknown>;
          console.log('[asset_review] resolved keys:', Object.keys(resolved));
          const pieces: string[] = [];
          for (const key of Object.keys(resolved)) {
            const prev = resolved[key];
            console.log(`[asset_review] prev node ${key}:`, JSON.stringify(prev).slice(0, 200));
            if (prev && typeof prev === 'object') {
              const prevObj = prev as Record<string, unknown>;
              if (typeof prevObj.text === 'string' && prevObj.text) {
                pieces.push(prevObj.text);
              }
            }
          }
          fallbackText = pieces.join('\n\n');
        }

        console.log('[asset_review] final fallbackText:', fallbackText?.slice(0, 100));

        return { text: fallbackText };
      }

      case 'input':
        // Return the node's text param as output for the next node
        // Check nested params structure
        const p = snapshot as Record<string, unknown>;
        const inputParams = (p.params as Record<string, unknown>) || p;
        const textValue =
          typeof inputParams.text === 'string'
            ? inputParams.text
            : typeof inputParams.prompt === 'string'
              ? inputParams.prompt
              : '';
        console.log(
          '[input node] inputParams:',
          JSON.stringify(inputParams).slice(0, 100),
          '-> textValue:',
          textValue?.slice(0, 50)
        );
        return {
          text: textValue,
        };
      case 'output':
        return {
          result: 'noop',
          reason: `${nodeType} node type - no execution needed`,
        };

      default:
        return {
          result: 'skipped',
          reason: `Unknown node type: ${nodeType}`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Node execution failed';
    return {
      result: 'error',
      error: message,
      node_type: nodeType,
    };
  }
}

async function resolveBypassedOutput(
  projectId: string,
  node: WorkflowNode,
  workflowId?: string | null
): Promise<Record<string, unknown> | null> {
  const nodeType = getNodeType(node);
  const catalogKey =
    (node.data as any)?.catalog_type || (node as any)?.catalog_type || (node as any)?.nodeKey;

  console.log(`[Bypass] Resolving output for bypassed node: ${nodeType} (Catalog: ${catalogKey})`);

  const allAssets = listAssets(projectId);

  const isCanonLike = (asset: any) => {
    const content = asset?.current_version?.content;
    if (!content || typeof content !== 'object') return false;
    return Boolean(
      asset.asset_type === 'canon_text' ||
      content.summary ||
      content.characters ||
      content.locations ||
      content.themes ||
      content.world_rules ||
      content.environment_lock ||
      content.character_table
    );
  };

  const preferSameWorkflow = <T extends { metadata?: any }>(items: T[]) => {
    if (!workflowId) return items;
    const same = items.filter(a => (a.metadata as any)?.workflow_id === workflowId);
    return same.length ? same : items;
  };

  const isNotEmpty = (content: any) => {
    if (!content || typeof content !== 'object') return false;
    // Check for canon-like keys first
    if (Array.isArray(content.characters) && content.characters.length > 0) return true;
    if (Array.isArray(content.locations) && content.locations.length > 0) return true;
    if (typeof content.text === 'string' && content.text.trim().length > 10) return true;
    if (typeof content.summary === 'string' && content.summary.trim().length > 10) return true;
    // Fallback: check if it has more than just the basic keys like _raw or metadata
    const keys = Object.keys(content).filter(k => !k.startsWith('_'));
    return keys.length > 0;
  };

  // Strategy 1: Find by exact catalog key match in metadata (best for specific node outputs)
  const exactCandidates = allAssets.filter(a => (a.metadata as any)?.catalog_key === catalogKey);
  let match = preferSameWorkflow(exactCandidates.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))[0];

  // Strategy 2: Find by asset type (fallback for standard nodes)
  if (!match) {
    const assetTypeMap: Record<string, string> = {
      extract_canon: 'canon_text',
      generate_scenes: 'scene',
      generate_shot_plan: 'shot_plan',
      input: 'source_story',
      story_input: 'source_story',
    };
    const targetType = assetTypeMap[nodeType] || assetTypeMap[catalogKey] || catalogKey;

    // For Canon, we want the ABSOLUTE LATEST across the project, because it's the source of truth.
    // Restricting it to the "same workflow" often leads to stale data drift.
    if (targetType === 'canon_text' || nodeType === 'extract_canon' || catalogKey === 'extract_canon') {
      const canonCandidates = allAssets
        .filter(a => a.status !== 'deprecated' && (a.asset_type === 'canon_text' || isCanonLike(a)))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      match = preferSameWorkflow(canonCandidates)[0];
    } else {
      const candidates = allAssets.filter(a => a.asset_type === targetType && a.status !== 'deprecated');
      match = preferSameWorkflow(candidates.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))[0];
    }
  }

  // Strategy 3: Find by asset category (last resort)
  if (!match) {
    const assetCategoryMap: Record<string, string> = {
      extract_canon: 'story',
      generate_scenes: 'story',
      generate_shot_plan: 'story',
    };
    const targetCategory = assetCategoryMap[nodeType] || assetCategoryMap[catalogKey];
    if (targetCategory) {
      match = preferSameWorkflow(
        allAssets.filter(a => a.asset_category === targetCategory && a.status !== 'deprecated')
      )[0];
    }
  }

  if (match?.current_version?.content && isNotEmpty(match.current_version.content)) {
    console.log(
      `[Workflow] [Bypass] Found existing asset for ${getNodeId(node, 0)}: ${match.id} (Type: ${match.asset_type}, Version: ${match.current_version.id})`
    );
    return {
      ...(match.current_version.content as Record<string, unknown>),
      _debug: {
        bypass: true,
        source_asset_id: match.id,
        source_asset_type: match.asset_type,
        source_asset_version_id: match.current_version.id,
        source_updated_at: match.updated_at,
        source_workflow_id: (match.metadata as any)?.workflow_id ?? null,
        source_catalog_key: (match.metadata as any)?.catalog_key ?? null,
      },
    };
  }

  console.warn(`[Workflow] [Bypass] No existing asset found for bypassed node: ${catalogKey || nodeType}`);
  return null;
}

async function executeWorkflowRun(workflowRunId: string) {
  const context = getWorkflowRunExecutionContext(workflowRunId);

  if (!context) {
    console.error(`[Workflow ${workflowRunId}] Context not found`);
    diag.error('execution', `Workflow run context not found`, { workflow_run_id: workflowRunId });
    activeWorkflowRuns.delete(workflowRunId);
    return;
  }

  console.log(`[Workflow ${workflowRunId}] Starting execution with ${context.nodes.length} nodes`);
  console.log(
    `[Workflow ${workflowRunId}] Node types:`,
    context.nodes.map(n => n.type)
  );
  diag.info('execution', `Starting workflow execution`, {
    workflow_run_id: workflowRunId,
    project_id: context.project_id,
    node_count: context.nodes.length,
  });

  try {
    startWorkflowRun(workflowRunId);

    for (const [index, rawNode] of context.nodes.entries()) {
      const node = rawNode as WorkflowNode;
      const nodeId = getNodeId(node, index);
      const nodeType = getNodeType(node);
      const inputSnapshot = buildNodeInputSnapshot(node, context.resolved_input_snapshot, index, context.project_id);
      const progress = Math.round(((index + 1) / context.nodes.length) * 100);

      emitWorkflowRunProgress(context.project_id, workflowRunId, progress, nodeId, nodeType);

      // Execution loop

      const nodeRun = createNodeRun({
        workflow_run_id: workflowRunId,
        workflow_version_id: context.workflow_version_id,
        project_id: context.project_id,
        node_id: nodeId,
        node_type: nodeType,
        position: index,
        input_snapshot: inputSnapshot,
      });

      if (!nodeRun) {
        throw new Error(`Failed to create node run for ${nodeId}`);
      }

      try {
        const isBypassed = (node.params as any)?.bypass === true;
        const msg = `[Workflow] Node ${nodeId} (${nodeType}). Bypass toggle: ${isBypassed}`;
        console.log(`[Workflow ${workflowRunId}] ${msg}`);
        addWorkflowRunLog(workflowRunId, msg);

        let output: Record<string, unknown>;

        if (isBypassed) {
          const bypassedOutput = await resolveBypassedOutput(context.project_id, node, (context as any).workflow_id);
          if (bypassedOutput) {
            output = bypassedOutput;
          } else {
            throw new Error(`Bypass failed for node ${nodeId}: No existing asset found for this type. Please disable bypass or generate an asset first.`);
          }
        } else {
          output = await executeNode(
            node,
            inputSnapshot as Record<string, unknown>,
            nodeRun.id
          );
        }

        completeNodeRun(nodeRun.id, output, isBypassed ? 'skipped' : 'completed');
        scheduleIndexNodeRun(nodeRun.id);
        scheduleIndexWorkflowRun(workflowRunId);

        // Store node output for next node to use as input
        console.log(
          `[Workflow ${workflowRunId}] Storing output for node ${nodeId}:`,
          JSON.stringify(output).slice(0, 200)
        );
        (context.resolved_input_snapshot as Record<string, unknown>)[nodeId] = output;
        console.log(
          `[Workflow ${workflowRunId}] resolved_input_snapshot now has:`,
          Object.keys(context.resolved_input_snapshot as object)
        );

        const isGenerativeNode = [
          'input',
          'story_input',
          'prompt_input',
          'instructions_input',
          'llm_text',
          'llm',
          'extract_canon',
          'generate_scenes',
          'generate_shot_plan',
          'tts',
          'text_to_speech',
          'generate_narration',
          'image',
          'image_generation',
          'generate_image',
          'video',
          'video_generation',
          'generate_video',
        ].includes(nodeType);

        console.log(
          `[Workflow ${workflowRunId}] Node ${nodeId} type=${nodeType} isGenerativeNode=${isGenerativeNode} output result=${output?.result} hasText=${!!output?.text}`
        );

        if (isGenerativeNode && output?.result !== 'error' && !isBypassed) {
          const resolvedCatalogKey = (node.data as any)?.catalog_type || (node as any)?.catalog_type || (node as any)?.nodeKey;
          console.log(`[Workflow ${workflowRunId}] Resolved Catalog Key for ${nodeId}: ${resolvedCatalogKey}`);

          const asset = createAssetFromNodeOutput({
            project_id: context.project_id,
            workflow_version_id: context.workflow_version_id,
            workflow_run_id: workflowRunId,
            node_run_id: nodeRun.id,
            node_type: nodeType,
            catalog_key: resolvedCatalogKey,
            workflow_id: (context as any).workflow_id,
            output,
          });

          if (asset) {
            console.log(
              `[Workflow ${workflowRunId}] Created asset ${asset.asset_id} from node ${nodeId}`
            );
          }
        }

        const outputSummary = Object.keys(output)
          .filter(k => k !== 'error')
          .join(', ');
        console.log(`[Workflow ${workflowRunId}] Node ${nodeId} completed: ${outputSummary}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Node execution failed';
        console.error(`[Workflow ${workflowRunId}] Node ${nodeId} failed: ${message}`);

        completeNodeRun(
          nodeRun.id,
          {
            result: 'error',
            error: message,
          },
          'failed'
        );
        scheduleIndexNodeRun(nodeRun.id);
        scheduleIndexWorkflowRun(workflowRunId);
      }

      await delay(100);
    }

    completeWorkflowRun(workflowRunId);
    scheduleIndexWorkflowRun(workflowRunId);
    console.log(`[Workflow ${workflowRunId}] Execution completed`);
    diag.info('execution', `Workflow execution completed`, {
      workflow_run_id: workflowRunId,
      project_id: context.project_id,
      node_count: context.nodes.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow execution error';
    console.error(`[Workflow ${workflowRunId}] Execution failed: ${message}`);
    diag.error('execution', `Workflow execution failed`, {
      workflow_run_id: workflowRunId,
      project_id: context.project_id,
      error: message,
    });
    failWorkflowRun(workflowRunId, message);
    scheduleIndexWorkflowRun(workflowRunId);
  } finally {
    activeWorkflowRuns.delete(workflowRunId);
  }
}

export function startWorkflowRunInBackground(workflowRunId: string) {
  if (activeWorkflowRuns.has(workflowRunId)) {
    console.warn(`[Workflow ${workflowRunId}] Already running, skipping`);
    return;
  }

  activeWorkflowRuns.add(workflowRunId);

  setTimeout(() => {
    void executeWorkflowRun(workflowRunId);
  }, 0);
}

export function getActiveWorkflowRuns(): Set<string> {
  return new Set(activeWorkflowRuns);
}
