import {
  completeNodeRun,
  completeWorkflowRun,
  createAssetFromNodeOutput,
  createNodeRun,
  emitWorkflowRunProgress,
  failWorkflowRun,
  getWorkflowRunExecutionContext,
  startWorkflowRun,
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
  position: number
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
    _debug_keys: Object.keys(resolvedInputSnapshot),
  };
}

function getRetryPolicyForNode(nodeType: string): RetryPolicy {
  const retryPolicies: Record<string, RetryPolicy> = {
    llm_text: 'retry_with_backoff',
    llm: 'retry_with_backoff',
    tts: 'retry_with_backoff',
    text_to_speech: 'retry_with_backoff',
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
          const emotionalBeat =
            typeof so.emotionalBeat === 'string'
              ? so.emotionalBeat
              : typeof so.emotional_beat === 'string'
                ? (so.emotional_beat as string)
                : '';
          const setting = typeof so.setting === 'string' ? so.setting : '';
          return { title, purpose, emotionalBeat, setting };
        })
        .filter(s => s.title || s.purpose || s.emotionalBeat || s.setting);

      if (scenes.length > 0) {
        return { sourceKey: key, scenes };
      }
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
  if (nodeType === 'generate_shot_plan' && providedScenes) {
    const directive = `IMPORTANT: A scene outline was provided in SOURCE CONTENT (from: ${providedScenes.sourceKey}). You MUST output a JSON object with a top-level "scenes" array, and each scene MUST contain a "title" and a "shots" array with multiple shots for that scene. Do NOT output a top-level "shots" array when scenes are provided.`;
    finalPrompt = [
      baseInstructions,
      directive,
      `### PROVIDED_SCENES_JSON ###\n${stringifyForContext({ scenes: providedScenes.scenes }, 12000)}`,
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

  // Try to parse as JSON if the prompt asks for JSON output
  if (baseInstructions.toLowerCase().includes('json')) {
    try {
      // Try direct JSON parse first
      const parsed = JSON.parse(rawText) as Record<string, unknown>;

      if (nodeType === 'generate_shot_plan' && providedScenes) {
        const hasScenes = Array.isArray((parsed as Record<string, unknown>).scenes);
        const flatShots = (parsed as Record<string, unknown>).shots;
        if (!hasScenes && Array.isArray(flatShots)) {
          const shots = flatShots.filter(s => s && typeof s === 'object');
          let cursor = 0;
          const sceneCount = providedScenes.scenes.length;
          const scenes = providedScenes.scenes.map((scene, idx) => {
            const remainingShots = Math.max(0, shots.length - cursor);
            const remainingScenes = Math.max(1, sceneCount - idx);
            const take = Math.ceil(remainingShots / remainingScenes);
            const sceneShots = shots.slice(cursor, cursor + take);
            cursor += take;
            return { ...scene, shots: sceneShots };
          });
          return { scenes, _raw: rawText };
        }
      }

      return { ...parsed, _raw: rawText };
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;

          if (nodeType === 'generate_shot_plan' && providedScenes) {
            const hasScenes = Array.isArray((parsed as Record<string, unknown>).scenes);
            const flatShots = (parsed as Record<string, unknown>).shots;
            if (!hasScenes && Array.isArray(flatShots)) {
              const shots = flatShots.filter(s => s && typeof s === 'object');
              let cursor = 0;
              const sceneCount = providedScenes.scenes.length;
              const scenes = providedScenes.scenes.map((scene, idx) => {
                const remainingShots = Math.max(0, shots.length - cursor);
                const remainingScenes = Math.max(1, sceneCount - idx);
                const take = Math.ceil(remainingShots / remainingScenes);
                const sceneShots = shots.slice(cursor, cursor + take);
                cursor += take;
                return { ...scene, shots: sceneShots };
              });
              return { scenes, _raw: rawText };
            }
          }

          return { ...parsed, _raw: rawText };
        } catch {}
      }
      // Try to extract JSON from plain text using regex
      const plainMatch = rawText.match(/\{[\s\S]*\}/);
      if (plainMatch) {
        try {
          const parsed = JSON.parse(plainMatch[0]) as Record<string, unknown>;

          if (nodeType === 'generate_shot_plan' && providedScenes) {
            const hasScenes = Array.isArray((parsed as Record<string, unknown>).scenes);
            const flatShots = (parsed as Record<string, unknown>).shots;
            if (!hasScenes && Array.isArray(flatShots)) {
              const shots = flatShots.filter(s => s && typeof s === 'object');
              let cursor = 0;
              const sceneCount = providedScenes.scenes.length;
              const scenes = providedScenes.scenes.map((scene, idx) => {
                const remainingShots = Math.max(0, shots.length - cursor);
                const remainingScenes = Math.max(1, sceneCount - idx);
                const take = Math.ceil(remainingShots / remainingScenes);
                const sceneShots = shots.slice(cursor, cursor + take);
                cursor += take;
                return { ...scene, shots: sceneShots };
              });
              return { scenes, _raw: rawText };
            }
          }

          return { ...parsed, _raw: rawText };
        } catch {}
      }
      // If all JSON parsing fails, return as text
      console.warn('[LLM] JSON parse failed, returning raw text');
    }
  }

  return {
    text: rawText,
    model: response.model,
  };
}

async function executeTTSNode(
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const innerParams = (snapshot.params as Record<string, unknown>) || {};
  const text = typeof innerParams.text === 'string' ? innerParams.text : '';
  const template =
    typeof innerParams.template === 'string' ? innerParams.template : config.defaults.tts_voice;

  if (!text) {
    throw new Error("TTS node requires a 'text' parameter");
  }

  const response = await executeWithRetry(
    () =>
      adapters.generateSpeech({
        text,
        template,
        speed: typeof innerParams.speed === 'number' ? innerParams.speed : 1.0,
        volume: typeof innerParams.volume === 'number' ? innerParams.volume : 1.0,
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
    audio_path: response.audio_path,
    audio_url: response.audio_url,
    job_id: response.job_id,
    status: job.status,
  };
}

async function executeImageNode(
  snapshot: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const innerParams = (snapshot.params as Record<string, unknown>) || {};
  const prompt = typeof innerParams.prompt === 'string' ? innerParams.prompt : '';

  if (!prompt) {
    throw new Error("Image node requires a 'prompt' parameter");
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

  try {
    switch (nodeType) {
      case 'llm_text':
      case 'llm':
      case 'extract_canon':
      case 'generate_scenes':
      case 'generate_shot_plan':
        return await executeLLMNode(snapshot, nodeRunId);

      case 'tts':
      case 'text_to_speech':
        return await executeTTSNode(snapshot, nodeRunId);

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
        const innerParams = (p.params as Record<string, unknown>) || p;
        const textValue =
          typeof innerParams.text === 'string'
            ? innerParams.text
            : typeof innerParams.prompt === 'string'
              ? innerParams.prompt
              : '';
        console.log(
          '[input node] innerParams:',
          JSON.stringify(innerParams).slice(0, 100),
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
      const inputSnapshot = buildNodeInputSnapshot(node, context.resolved_input_snapshot, index);
      const progress = Math.round(((index + 1) / context.nodes.length) * 100);

      emitWorkflowRunProgress(context.project_id, workflowRunId, progress, nodeId, nodeType);

      console.log(
        `[Workflow ${workflowRunId}] Executing node ${nodeId} (${index + 1}/${context.nodes.length})`
      );

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
        const output = await executeNode(
          node,
          inputSnapshot as Record<string, unknown>,
          nodeRun.id
        );

        completeNodeRun(nodeRun.id, output, 'completed');
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

        if (isGenerativeNode && output?.result !== 'error') {
          const asset = createAssetFromNodeOutput({
            project_id: context.project_id,
            workflow_version_id: context.workflow_version_id,
            workflow_run_id: workflowRunId,
            node_run_id: nodeRun.id,
            node_type: nodeType,
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
