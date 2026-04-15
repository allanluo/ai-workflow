export interface SkillContext {
  projectId: string;
  workflowId?: string;
  assetId?: string;
  selectedNode?: {
    id: string;
    type: string;
    label: string;
    params: Record<string, unknown>;
  };
}

export interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
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

export type SkillName = 'createWorkflow' | 'addScene' | 'explainNode' | 'generateShots' | 'chat';
