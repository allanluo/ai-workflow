import type { Asset, Project, WorkflowDefinition, WorkflowRun } from '../../api';

export type CopilotSelection = {
  workflowId?: string;
  assetId?: string;
  nodeId?: string;
  shotPlanAssetId?: string;
  shotId?: string;
};

export type CopilotPinnedVersions = {
  // Helps prevent drift for multi-step actions.
  workflowVersionId?: string | null;
  assetVersionId?: string | null;
  shotPlanAssetVersionId?: string | null;
};

export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type CopilotContext = {
  project: Project | null;
  assets: Asset[];
  workflows: WorkflowDefinition[];
  runs: WorkflowRun[];
  selection: CopilotSelection;
  pinned: CopilotPinnedVersions;
  conversation: CopilotMessage[];
  retrieval: {
    assets: Asset[];
    workflows: WorkflowDefinition[];
    runs: WorkflowRun[];
    semantic_hits?: Array<{
      context_type: string;
      item_id: string;
      score: number;
      content: string;
    }>;
  };
};
