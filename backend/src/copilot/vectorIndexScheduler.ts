import { deleteCopilotVectorIndexForItem } from '@ai-workflow/database';
import { indexCopilotAsset, indexCopilotNodeRun, indexCopilotWorkflow, indexCopilotWorkflowRun } from './vectorIndex.js';

type JobKey = string;
const pending = new Map<JobKey, NodeJS.Timeout>();

function schedule(key: JobKey, fn: () => Promise<void>, delayMs = 250) {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    pending.delete(key);
    void fn().catch(err => {
      // Best-effort; avoid failing user actions due to indexing issues.
      console.warn(`[copilot-vector-index] ${key} failed:`, err);
    });
  }, delayMs);
  pending.set(key, t);
}

export function scheduleIndexAsset(assetId: string) {
  if (!assetId) return;
  schedule(`asset:${assetId}`, async () => {
    await indexCopilotAsset({ assetId });
  });
}

export function scheduleIndexWorkflow(workflowId: string) {
  if (!workflowId) return;
  schedule(`workflow:${workflowId}`, async () => {
    await indexCopilotWorkflow({ workflowId });
  });
}

export function scheduleDeleteWorkflowIndex(projectId: string, workflowId: string) {
  if (!projectId || !workflowId) return;
  schedule(`workflow-delete:${workflowId}`, async () => {
    deleteCopilotVectorIndexForItem({ projectId, contextType: 'workflow', itemId: workflowId });
  }, 0);
}

export function scheduleIndexWorkflowRun(workflowRunId: string) {
  if (!workflowRunId) return;
  schedule(`run:${workflowRunId}`, async () => {
    await indexCopilotWorkflowRun({ workflowRunId });
  }, 400);
}

export function scheduleIndexNodeRun(nodeRunId: string) {
  if (!nodeRunId) return;
  schedule(`node_run:${nodeRunId}`, async () => {
    await indexCopilotNodeRun({ nodeRunId });
  }, 400);
}
