import {
  createAsset,
  createAssetVersion,
  createWorkflow,
  createWorkflowVersion,
  deleteWorkflow,
  fetchAsset,
  fetchWorkflowById,
  updateAsset,
  updateWorkflow,
} from '../api';
import type { Proposal } from './types';
import {
  ensureShotIdsInPlan,
  locateShotInPlan,
  parseShotPlanForEdit,
  updateShotImageOverrideInPlan,
  writeBackShotPlan,
  type ShotPlanItem,
} from '../shotPlanEditing';
import { applyJsonPatch, parseJsonPointer } from './jsonPatch';
import { appendAuditEvent } from './auditLog';

type ApplyProposalResult = {
  ok: boolean;
  warning?: string;
  assetVersionId?: string;
  assetId?: string;
  workflowId?: string;
  workflowVersionId?: string;
};

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getFirstPatchValue(proposal: Proposal) {
  if (proposal.kind !== 'asset_patch') return null;
  const op = proposal.patch.find((p: { op: string }) => p.op === 'add' || p.op === 'replace');
  if (!op || !('value' in op)) return null;
  return op.value;
}

function isShotPlanImageOverrideProposal(proposal: Proposal, assetType: string) {
  if (proposal.kind !== 'asset_patch') return false;
  const strategy = getString(proposal.metadata?.applyStrategy) ?? null;
  return assetType === 'shot_plan' && strategy === 'shot_plan_image_override';
}

function ensureWorkflowPatchIsSafe(proposal: Extract<Proposal, { kind: 'workflow_patch' }>) {
  const allowedTop = new Set([
    'title',
    'description',
    'mode',
    'status',
    'defaults',
    'nodes',
    'edges',
    'metadata',
  ]);
  for (const op of proposal.patch) {
    if (op.path === '') throw new Error('Root-level patch is not allowed.');
    const parts = parseJsonPointer(op.path);
    const top = parts[0] ?? '';
    if (!top || !allowedTop.has(top)) {
      throw new Error(`Unsupported workflow patch path: ${op.path}`);
    }
  }
}

function ensureAssetPatchIsSafe(proposal: Extract<Proposal, { kind: 'asset_patch' }>) {
  if (!Array.isArray(proposal.patch) || proposal.patch.length === 0) {
    throw new Error('Empty patch is not allowed.');
  }
  if (proposal.patch.length > 200) {
    throw new Error('Patch too large.');
  }

  for (const op of proposal.patch) {
    if (!op || typeof op !== 'object') throw new Error('Invalid patch operation.');
    if (op.path === '') throw new Error('Root-level patch is not allowed.');
    const parts = parseJsonPointer(op.path);
    if (parts.length > 80) throw new Error('Patch path too deep.');
    for (const p of parts) {
      if (p.length > 200) throw new Error('Patch path segment too long.');
    }
  }
}

export async function applyProposal(proposal: Proposal): Promise<ApplyProposalResult> {
  if (proposal.kind === 'create_asset') {
    const asset = await createAsset({
      projectId: proposal.projectId,
      asset_type: proposal.asset_type,
      asset_category: proposal.asset_category,
      title: proposal.title,
      content: proposal.content,
      metadata: proposal.metadata ?? {},
      source_mode: proposal.source_mode ?? 'copilot',
      status: proposal.status ?? 'draft',
    });
    appendAuditEvent(proposal.projectId, { type: 'proposal_applied', summary: proposal.summary });
    return { ok: true, assetId: asset.id };
  }

  if (proposal.kind === 'create_workflow') {
    const workflow = await createWorkflow({
      projectId: proposal.projectId,
      title: proposal.title,
      description: proposal.description,
      mode: proposal.mode,
      template_type: proposal.template_type,
      defaults: proposal.defaults ?? {},
      nodes: proposal.nodes ?? [],
      edges: proposal.edges ?? [],
      metadata: proposal.metadata ?? {},
    });
    appendAuditEvent(proposal.projectId, { type: 'proposal_applied', summary: proposal.summary });
    return { ok: true, workflowId: workflow.id };
  }

  if (proposal.kind === 'workflow_patch') {
    ensureWorkflowPatchIsSafe(proposal);
    const workflow = await fetchWorkflowById(proposal.workflowId);
    const workflowProjectId = ((workflow as any).project_id ?? (workflow as any).projectId ?? '') as string;
    const baseMismatch =
      proposal.baseWorkflowUpdatedAt && workflow.updated_at !== proposal.baseWorkflowUpdatedAt;

    const patched = applyJsonPatch(
      {
        title: workflow.title,
        description: workflow.description,
        mode: workflow.mode,
        status: workflow.status,
        defaults: workflow.defaults ?? {},
        nodes: workflow.nodes ?? [],
        edges: workflow.edges ?? [],
        metadata: workflow.metadata ?? {},
      },
      proposal.patch
    ) as {
      title?: string;
      description?: string;
      mode?: 'simple' | 'guided' | 'advanced';
      status?: 'draft' | 'testing' | 'approved' | 'deprecated';
      defaults?: Record<string, unknown>;
      nodes?: unknown[];
      edges?: unknown[];
      metadata?: Record<string, unknown>;
    };

    await updateWorkflow({
      workflowId: proposal.workflowId,
      title: typeof patched.title === 'string' ? patched.title : undefined,
      description: typeof patched.description === 'string' ? patched.description : undefined,
      mode: patched.mode,
      status: patched.status,
      defaults: patched.defaults,
      nodes: patched.nodes,
      edges: patched.edges,
      metadata: patched.metadata,
    });

    const version = await createWorkflowVersion({
      workflowId: proposal.workflowId,
      notes: `copilot: ${proposal.summary}`,
    });

    if (workflowProjectId) appendAuditEvent(workflowProjectId, { type: 'proposal_applied', summary: proposal.summary });
    return {
      ok: true,
      workflowId: proposal.workflowId,
      workflowVersionId: version.id,
      warning: baseMismatch ? 'Workflow changed since proposal was generated.' : undefined,
    };
  }

  if (proposal.kind === 'delete_workflow') {
    const workflow = await fetchWorkflowById(proposal.workflowId);
    const workflowProjectId = ((workflow as any).project_id ?? (workflow as any).projectId ?? '') as string;
    const baseMismatch =
      proposal.baseWorkflowUpdatedAt && workflow.updated_at !== proposal.baseWorkflowUpdatedAt;

    const deleted = await deleteWorkflow(proposal.workflowId);
    if (!deleted) return { ok: false, warning: 'Delete workflow failed.' };

    if (workflowProjectId) appendAuditEvent(workflowProjectId, { type: 'proposal_applied', summary: proposal.summary });
    return {
      ok: true,
      workflowId: proposal.workflowId,
      warning: baseMismatch ? 'Workflow changed since proposal was generated.' : undefined,
    };
  }

  if (proposal.kind === 'asset_update') {
    const asset = await fetchAsset(proposal.assetId);
    const assetProjectId = ((asset as any).project_id ?? (asset as any).projectId ?? '') as string;
    const baseMismatch = proposal.baseAssetUpdatedAt && asset.updated_at !== proposal.baseAssetUpdatedAt;

    const allowed: Record<string, unknown> = {};
    if (typeof proposal.updates.title === 'string') allowed.title = proposal.updates.title;
    if (proposal.updates.status) allowed.status = proposal.updates.status;
    if (proposal.updates.metadata && typeof proposal.updates.metadata === 'object') allowed.metadata = proposal.updates.metadata;

    await updateAsset(proposal.assetId, allowed as any);
    if (assetProjectId) appendAuditEvent(assetProjectId, { type: 'proposal_applied', summary: proposal.summary });
    return {
      ok: true,
      assetId: proposal.assetId,
      warning: baseMismatch ? 'Asset changed since proposal was generated.' : undefined,
    };
  }

  if (proposal.kind !== 'asset_patch') {
    return { ok: false, warning: 'Unsupported proposal kind.' };
  }

  ensureAssetPatchIsSafe(proposal);

  const asset = await fetchAsset(proposal.assetId);
  const assetProjectId = ((asset as any).project_id ?? (asset as any).projectId ?? '') as string;
  const baseMismatch =
    proposal.baseAssetVersionId && asset.current_asset_version_id !== proposal.baseAssetVersionId;

  // Special case: shot plan image override uses the existing plan editing utilities to support
  // multiple stored formats (nested scenes, raw text wrapper, etc.)
  if (isShotPlanImageOverrideProposal(proposal, asset.asset_type)) {
    const shotId = getString(proposal.metadata?.shotId);
    if (!shotId) return { ok: false, warning: 'Missing shot id for proposal.' };

    const patchValue = getFirstPatchValue(proposal);
    if (!patchValue || typeof patchValue !== 'object') {
      return { ok: false, warning: 'Missing patch value for proposal.' };
    }

    const parsed = parseShotPlanForEdit(asset);
    if (!parsed) return { ok: false, warning: 'This shot plan format cannot be edited.' };

    const plan = JSON.parse(JSON.stringify(parsed.plan ?? {})) as Record<string, unknown>;
    ensureShotIdsInPlan(plan, asset.id);
    const located = locateShotInPlan(plan, shotId);
    if (!located) return { ok: false, warning: 'Could not find the shot in the shot plan.' };

    updateShotImageOverrideInPlan(plan, located, patchValue as NonNullable<ShotPlanItem['image']>);
    const nextContent = writeBackShotPlan(parsed, plan);

    const version = await createAssetVersion(asset.id, {
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

    if (assetProjectId) appendAuditEvent(assetProjectId, { type: 'proposal_applied', summary: proposal.summary });
    return {
      ok: true,
      warning: baseMismatch ? 'Base version changed since proposal was generated.' : undefined,
      assetVersionId: version.id,
    };
  }

  const baseContent =
    (asset.current_version?.content ??
      asset.current_approved_version?.content ??
      {}) as Record<string, unknown>;

  let nextContent: Record<string, unknown>;
  try {
    nextContent = applyJsonPatch(baseContent, proposal.patch);
  } catch (err) {
    return { ok: false, warning: err instanceof Error ? err.message : 'Failed to apply JSON patch.' };
  }

  const version = await createAssetVersion(asset.id, {
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

  if (assetProjectId) appendAuditEvent(assetProjectId, { type: 'proposal_applied', summary: proposal.summary });
  return {
    ok: true,
    warning: baseMismatch ? 'Base version changed since proposal was generated.' : undefined,
    assetVersionId: version.id,
  };
}
