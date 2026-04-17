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
    };

export interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
  proposal?: Proposal;
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
  | 'addScene'
  | 'improveShotPrompt'
  | 'explainNode'
  | 'generateShots'
  | 'chat';
