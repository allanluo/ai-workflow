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
  return typeof node.type === 'string' ? node.type : 'unknown';
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
    resolved_input: resolvedInputSnapshot[nodeId] ?? null,
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
  params: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const prompt = typeof params.prompt === 'string' ? params.prompt : '';
  const model = typeof params.model === 'string' ? params.model : config.defaults.llm_model;

  if (!prompt) {
    throw new Error("LLM node requires a 'prompt' parameter");
  }

  const response = await executeWithRetry(
    () => adapters.generateText({ model, prompt }),
    getRetryPolicyForNode('llm')
  );

  return {
    text: response.response,
    model: response.model,
  };
}

async function executeTTSNode(
  params: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const text = typeof params.text === 'string' ? params.text : '';
  const template =
    typeof params.template === 'string' ? params.template : config.defaults.tts_voice;

  if (!text) {
    throw new Error("TTS node requires a 'text' parameter");
  }

  const response = await executeWithRetry(
    () =>
      adapters.generateSpeech({
        text,
        template,
        speed: typeof params.speed === 'number' ? params.speed : 1.0,
        volume: typeof params.volume === 'number' ? params.volume : 1.0,
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
  params: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const prompt = typeof params.prompt === 'string' ? params.prompt : '';

  if (!prompt) {
    throw new Error("Image node requires a 'prompt' parameter");
  }

  const response = await executeWithRetry(
    () =>
      adapters.generateImage({
        prompt,
        width: typeof params.width === 'number' ? params.width : 1024,
        height: typeof params.height === 'number' ? params.height : 1024,
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
  params: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const prompt = typeof params.prompt === 'string' ? params.prompt : '';

  if (!prompt) {
    throw new Error("Video node requires a 'prompt' parameter");
  }

  const response = await executeWithRetry(
    () =>
      adapters.createVideo({
        prompt,
        width: typeof params.width === 'number' ? params.width : 1024,
        height: typeof params.height === 'number' ? params.height : 576,
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
  params: Record<string, unknown>,
  nodeRunId: string
): Promise<Record<string, unknown>> {
  const nodeType = getNodeType(node);

  try {
    switch (nodeType) {
      case 'llm_text':
      case 'llm':
        return await executeLLMNode(params, nodeRunId);

      case 'tts':
      case 'text_to_speech':
        return await executeTTSNode(params, nodeRunId);

      case 'image':
      case 'image_generation':
      case 'generate_image':
        return await executeImageNode(params, nodeRunId);

      case 'video':
      case 'video_generation':
      case 'generate_video':
        return await executeVideoNode(params, nodeRunId);

      case 'asset_query':
        return {
          query_status: 'resolved',
          selected_assets: [],
        };

      case 'input':
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
          inputSnapshot.params as Record<string, unknown>,
          nodeRun.id
        );

        completeNodeRun(nodeRun.id, output);

        const isGenerativeNode = [
          'llm_text',
          'llm',
          'tts',
          'text_to_speech',
          'image',
          'image_generation',
          'generate_image',
          'video',
          'video_generation',
          'generate_video',
        ].includes(nodeType);

        if (isGenerativeNode && output.result !== 'error') {
          const asset = createAssetFromNodeOutput({
            project_id: context.project_id,
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

        completeNodeRun(nodeRun.id, {
          result: 'error',
          error: message,
        });
      }

      await delay(100);
    }

    completeWorkflowRun(workflowRunId);
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
