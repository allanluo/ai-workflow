import {
  createAsset,
  createAssetVersion,
  createWorkflowDefinition,
  createWorkflowVersion,
  deleteWorkflowDefinition,
  getAssetById,
  getWorkflowDefinitionById,
  updateAsset,
  updateWorkflowDefinition,
  validateWorkflowDefinition,
} from '@ai-workflow/database';
import { applyJsonPatch, parseJsonPointer } from './jsonPatch.js';
import {
  ensureShotIdsInPlan,
  locateShotInPlan,
  parseShotPlanForEdit,
  updateShotImageOverrideInPlan,
  writeBackShotPlan,
  type ShotPlanItem,
} from './shotPlanEditing.js';

type JsonPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string };

type Proposal =
  | {
      kind: 'asset_patch';
      assetId: string;
      baseAssetVersionId?: string | null;
      summary: string;
      patch: JsonPatchOperation[];
      metadata?: Record<string, unknown>;
    }
  | {
      kind: 'asset_update';
      assetId: string;
      baseAssetUpdatedAt?: string | null;
      summary: string;
      updates: { title?: string; status?: string; metadata?: Record<string, unknown> };
      metadata?: Record<string, unknown>;
    }
  | {
      kind: 'create_asset';
      projectId: string;
      summary: string;
      asset_type: string;
      asset_category: string;
      title: string;
      content: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      source_mode?: string;
      status?: string;
    }
  | {
      kind: 'create_workflow';
      projectId: string;
      summary: string;
      title: string;
      description: string;
      mode: string;
      template_type: string;
      defaults?: Record<string, unknown>;
      nodes?: unknown[];
      edges?: unknown[];
      metadata?: Record<string, unknown>;
    }
  | {
      kind: 'workflow_patch';
      workflowId: string;
      baseWorkflowUpdatedAt?: string | null;
      summary: string;
      patch: JsonPatchOperation[];
      metadata?: Record<string, unknown>;
    }
  | {
      kind: 'delete_workflow';
      workflowId: string;
      baseWorkflowUpdatedAt?: string | null;
      summary: string;
      metadata?: Record<string, unknown>;
    };

export type ApplyProposalResult = {
  ok: boolean;
  warning?: string;
  assetId?: string;
  assetVersionId?: string;
  workflowId?: string;
  workflowVersionId?: string;
};

function getString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

function getFirstPatchValue(proposal: Extract<Proposal, { kind: 'asset_patch' }>) {
  const op = proposal.patch.find(p => p.op === 'add' || p.op === 'replace') as any;
  if (!op || !('value' in op)) return null;
  return op.value;
}

function isShotPlanImageOverrideProposal(proposal: Extract<Proposal, { kind: 'asset_patch' }>, assetType: string) {
  const strategy = getString(proposal.metadata?.applyStrategy);
  return assetType === 'shot_plan' && strategy === 'shot_plan_image_override';
}

function ensureWorkflowPatchIsSafe(proposal: Extract<Proposal, { kind: 'workflow_patch' }>) {
  const allowedTop = new Set(['title', 'description', 'mode', 'status', 'defaults', 'nodes', 'edges', 'metadata']);
  for (const op of proposal.patch) {
    if (op.path === '') throw new Error('Root-level patch is not allowed.');
    const parts = parseJsonPointer(op.path);
    const top = parts[0] ?? '';
    if (!top || !allowedTop.has(top)) throw new Error(`Unsupported workflow patch path: ${op.path}`);
  }
}

function ensureAssetPatchIsSafe(proposal: Extract<Proposal, { kind: 'asset_patch' }>) {
  if (!Array.isArray(proposal.patch) || proposal.patch.length === 0) throw new Error('Empty patch is not allowed.');
  if (proposal.patch.length > 200) throw new Error('Patch too large.');
  for (const op of proposal.patch) {
    if (op.path === '') throw new Error('Root-level patch is not allowed.');
    const parts = parseJsonPointer(op.path);
    if (parts.length > 80) throw new Error('Patch path too deep.');
    for (const p of parts) if (p.length > 200) throw new Error('Patch path segment too long.');
  }
}

export async function applyCopilotProposal(input: {
  projectId: string;
  proposal: Proposal;
  confirmed?: boolean;
}): Promise<ApplyProposalResult> {
  const { projectId, proposal } = input;

  if (proposal.kind === 'delete_workflow' && !input.confirmed) {
    return { ok: false, warning: 'Confirmation required for delete_workflow.' };
  }

  if (proposal.kind === 'create_asset') {
    const asset = createAsset(projectId, {
      asset_type: proposal.asset_type,
      asset_category: proposal.asset_category,
      title: proposal.title,
      content: proposal.content,
      metadata: proposal.metadata ?? {},
      source_mode: (proposal.source_mode as any) ?? 'copilot',
      status: (proposal.status as any) ?? 'draft',
    });
    return { ok: true, assetId: asset.id };
  }

  if (proposal.kind === 'asset_update') {
    const asset = getAssetById(proposal.assetId);
    if (!asset) return { ok: false, warning: 'Asset not found.' };
    const baseMismatch = proposal.baseAssetUpdatedAt && asset.updated_at !== proposal.baseAssetUpdatedAt;

    const next = updateAsset(proposal.assetId, {
      title: proposal.updates.title,
      status: proposal.updates.status as any,
      metadata: proposal.updates.metadata,
    });
    if (!next) return { ok: false, warning: 'Asset update failed.' };
    return { ok: true, assetId: proposal.assetId, warning: baseMismatch ? 'Asset changed since proposal was generated.' : undefined };
  }

  if (proposal.kind === 'asset_patch') {
    ensureAssetPatchIsSafe(proposal);
    const asset = getAssetById(proposal.assetId);
    if (!asset) return { ok: false, warning: 'Asset not found.' };
    const baseMismatch =
      proposal.baseAssetVersionId && asset.current_version_id !== proposal.baseAssetVersionId;

    const baseContent =
      (asset.current_version?.content ??
        asset.current_approved_version?.content ??
        {}) as Record<string, unknown>;

    // Special case: shot plan image override
    if (isShotPlanImageOverrideProposal(proposal, asset.asset_type)) {
      const shotId = getString(proposal.metadata?.shotId);
      if (!shotId) return { ok: false, warning: 'Missing shotId.' };

      const patchValue = getFirstPatchValue(proposal);
      if (!patchValue || typeof patchValue !== 'object') return { ok: false, warning: 'Missing patch value.' };

      const parsed = parseShotPlanForEdit(baseContent);
      if (!parsed) return { ok: false, warning: 'This shot plan format cannot be edited.' };

      const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
      ensureShotIdsInPlan(plan, asset.id);
      const located = locateShotInPlan(plan, shotId);
      if (!located) return { ok: false, warning: 'Could not find shot in shot plan.' };

      updateShotImageOverrideInPlan(plan, located, patchValue as NonNullable<ShotPlanItem['image']>);
      const nextContent = writeBackShotPlan(parsed, plan);

      const version = createAssetVersion(asset.id, {
        content: nextContent,
        source_mode: 'copilot',
        status: 'draft',
        make_current: true,
        metadata: {
          copilot: {
            proposal_summary: proposal.summary,
            base_asset_version_id: proposal.baseAssetVersionId ?? null,
            applied_at: new Date().toISOString(),
          },
        },
      });
      if (!version) return { ok: false, warning: 'Failed to create asset version.' };

      return {
        ok: true,
        assetId: asset.id,
        assetVersionId: version.id,
        warning: baseMismatch ? 'Base version changed since proposal was generated.' : undefined,
      };
    }

    try {
      const nextContent = applyJsonPatch(baseContent, proposal.patch as any);
      const version = createAssetVersion(asset.id, {
        content: nextContent,
        source_mode: 'copilot',
        status: 'draft',
        make_current: true,
        metadata: {
          copilot: {
            proposal_summary: proposal.summary,
            base_asset_version_id: proposal.baseAssetVersionId ?? null,
            applied_at: new Date().toISOString(),
          },
        },
      });
      if (!version) return { ok: false, warning: 'Failed to create asset version.' };
      return {
        ok: true,
        assetId: asset.id,
        assetVersionId: version.id,
        warning: baseMismatch ? 'Base version changed since proposal was generated.' : undefined,
      };
    } catch (err) {
      console.error('[Copilot] Apply patch failed:', err);
      return {
        ok: false,
        warning: err instanceof Error ? err.message : 'Failed to apply patch.',
      };
    }
  }

  if (proposal.kind === 'create_workflow') {
    const workflow = createWorkflowDefinition(projectId, {
      title: proposal.title,
      description: proposal.description,
      mode: proposal.mode as any,
      template_type: proposal.template_type,
      defaults: proposal.defaults ?? {},
      nodes: proposal.nodes ?? [],
      edges: proposal.edges ?? [],
      metadata: proposal.metadata ?? {},
    });
    return { ok: true, workflowId: workflow.id };
  }

  if (proposal.kind === 'workflow_patch') {
    ensureWorkflowPatchIsSafe(proposal);
    const wf = getWorkflowDefinitionById(proposal.workflowId);
    if (!wf) return { ok: false, warning: 'Workflow not found.' };
    const baseMismatch = proposal.baseWorkflowUpdatedAt && wf.updated_at !== proposal.baseWorkflowUpdatedAt;

    const patched = applyJsonPatch(
      {
        title: wf.title,
        description: wf.description ?? '',
        mode: wf.mode,
        status: wf.status,
        defaults: wf.defaults ?? {},
        nodes: wf.nodes ?? [],
        edges: wf.edges ?? [],
        metadata: wf.metadata ?? {},
      },
      proposal.patch as any
    ) as any;

    const updated = updateWorkflowDefinition(proposal.workflowId, {
      title: typeof patched.title === 'string' ? patched.title : undefined,
      description: typeof patched.description === 'string' ? patched.description : undefined,
      mode: patched.mode,
      status: patched.status,
      defaults: patched.defaults,
      nodes: patched.nodes,
      edges: patched.edges,
      metadata: patched.metadata,
    });
    if (!updated) return { ok: false, warning: 'Workflow update failed.' };

    const validation = validateWorkflowDefinition(proposal.workflowId);
    if (validation?.status === 'fail') {
      return { ok: false, warning: 'Workflow validation failed; cannot create a frozen version.' };
    }

    const version = createWorkflowVersion(proposal.workflowId, {
      input_asset_versions: {},
      runtime_environment: {},
      notes: `copilot: ${proposal.summary}`,
    });

    return {
      ok: true,
      workflowId: proposal.workflowId,
      workflowVersionId: version?.id,
      warning: baseMismatch ? 'Workflow changed since proposal was generated.' : undefined,
    };
  }

  if (proposal.kind === 'delete_workflow') {
    const wf = getWorkflowDefinitionById(proposal.workflowId);
    if (!wf) return { ok: false, warning: 'Workflow not found.' };
    const baseMismatch = proposal.baseWorkflowUpdatedAt && wf.updated_at !== proposal.baseWorkflowUpdatedAt;
    const deleted = deleteWorkflowDefinition(proposal.workflowId);
    if (!deleted) return { ok: false, warning: 'Delete workflow failed.' };
    return { ok: true, workflowId: proposal.workflowId, warning: baseMismatch ? 'Workflow changed since proposal was generated.' : undefined };
  }

  return { ok: false, warning: 'Unsupported proposal kind.' };
}
