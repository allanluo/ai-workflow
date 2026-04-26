export interface SkillContext {
  projectId: string;
  workflowId?: string;
  assetId?: string;
  shotPlanAssetId?: string;
  shotId?: string;
  selectedNode?: {
    id: string;
    type: string;
    label: string;
    params: Record<string, unknown>;
  };
}

export type JsonPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string };

export type Proposal =
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
      updates: {
        title?: string;
        status?: 'draft' | 'needs_revision' | 'ready' | 'locked' | 'deprecated' | 'failed';
        metadata?: Record<string, unknown>;
      };
      metadata?: Record<string, unknown>;
      afterApply?: { type: 'navigate'; path: string };
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
      source_mode?: 'manual' | 'copilot' | 'workflow' | 'import' | 'system';
      status?: 'draft' | 'needs_revision' | 'ready' | 'locked' | 'deprecated' | 'failed';
      afterApply?: { type: 'navigate'; path: string };
    }
  | {
      kind: 'create_workflow';
      projectId: string;
      summary: string;
      title: string;
      description: string;
      mode: 'simple' | 'guided' | 'advanced';
      template_type: string;
      defaults?: Record<string, unknown>;
      nodes?: unknown[];
      edges?: unknown[];
      metadata?: Record<string, unknown>;
      afterApply?: { type: 'navigate'; path: string };
    }
  | {
      kind: 'workflow_patch';
      workflowId: string;
      baseWorkflowUpdatedAt?: string | null;
      summary: string;
      patch: JsonPatchOperation[];
      metadata?: Record<string, unknown>;
      afterApply?: { type: 'navigate'; path: string };
    }
  | {
      kind: 'delete_workflow';
      workflowId: string;
      baseWorkflowUpdatedAt?: string | null;
      summary: string;
      metadata?: Record<string, unknown>;
      afterApply?: { type: 'navigate'; path: string };
    };

export interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
  proposal?: Proposal;
  // Optional: skills can provide a deterministic plan (tool sequence) for the UI to review + execute.
  plan?: import('./planner').ExecutionPlan;
  action?: {
    type: 'create_workflow' | 'navigate' | 'refresh' | 'show_modal';
    payload?: unknown;
  };
}

export interface Skill {
  name: string;
  description: string;
  keywords: string[];
  examples: string[];
  execute(context: SkillContext, input: string): Promise<SkillResult>;
}

export interface ParsedIntent {
  skillName: string;
  confidence: number;
  parameters?: Record<string, unknown>;
}

export type SkillName =
  | 'createWorkflow'
  | 'updateWorkflowStoryInput'
  | 'addScene'
  | 'improveShotPrompt'
  | 'generateCanon'
  | 'updateCanon'
  | 'generateScenes'
  | 'generateShotPlans'
  | 'explainNode'
  | 'generateShots'
  | 'chat';
