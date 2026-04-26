import { z } from 'zod';
import { fetchWorkflowById } from '../../../api';
import type { Proposal } from '../../types';
import type { ToolDefinition } from '../types';

const ResultSchema = z.object({
  proposal: z.unknown(),
});

function nodeRecord(node: unknown): Record<string, unknown> | null {
  return typeof node === 'object' && node !== null && !Array.isArray(node) ? (node as Record<string, unknown>) : null;
}

/** Locate the primary story / source text node in a workflow graph. */
export function findStoryInputNodeIndex(nodes: unknown[]): number {
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodeRecord(nodes[i]);
    if (!n) continue;
    const id = typeof n.id === 'string' ? n.id : '';
    const type = typeof n.type === 'string' ? n.type.toLowerCase() : '';
    const data = nodeRecord(n.data);
    const catalogRaw =
      data && typeof data.catalog_type === 'string'
        ? data.catalog_type
        : data && typeof (data as { catalogtype?: string }).catalogtype === 'string'
          ? (data as { catalogtype: string }).catalogtype
          : '';
    const catalog = catalogRaw.toLowerCase().replace(/-/g, '_');

    if (id === 'story-input' || catalog === 'story_input' || type === 'story_input' || type === 'storyinput') {
      return i;
    }
    if (type === 'input' && (!catalog || catalog === 'story_input')) {
      return i;
    }
  }
  return -1;
}

export const proposePatchStoryInputTool: ToolDefinition<
  { workflowId?: string; storyText: string },
  z.infer<typeof ResultSchema>
> = {
  name: 'proposePatchStoryInput',
  description:
    'Build a workflow_patch proposal that sets the story input node params.text (no changes applied until apply).',
  category: 'read',
  paramsSchema: z.object({
    workflowId: z.string().min(1).optional(),
    storyText: z.string(),
  }),
  resultSchema: ResultSchema,
  async execute(context, params) {
    const workflowId = params.workflowId?.trim() || context.workflowId;
    if (!workflowId) {
      throw new Error('Missing workflowId (open a workflow in the editor first).');
    }

    const workflow = (await fetchWorkflowById(workflowId)) as {
      updated_at?: string | null;
      nodes?: unknown[];
    };
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const idx = findStoryInputNodeIndex(nodes);
    if (idx < 0) {
      throw new Error('This workflow has no story input node to update.');
    }

    const proposal: Proposal = {
      kind: 'workflow_patch',
      workflowId,
      baseWorkflowUpdatedAt: workflow.updated_at ?? null,
      summary: `Update story input (${params.storyText.length} characters)`,
      patch: [{ op: 'replace', path: `/nodes/${idx}/params/text`, value: params.storyText }],
      metadata: { storyInputNodeIndex: idx },
    };

    return { proposal };
  },
};
