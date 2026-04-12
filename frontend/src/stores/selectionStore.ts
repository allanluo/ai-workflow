import { create } from 'zustand';

interface SelectionState {
  selectedAssetId: string | null;
  selectedAssetVersionId: string | null;
  selectedWorkflowId: string | null;
  selectedWorkflowVersionId: string | null;
  selectedWorkflowRunId: string | null;
  selectedOutputId: string | null;
  selectedOutputVersionId: string | null;
  selectedShotId: string | null;
  selectedSceneId: string | null;
  selectedFileId: string | null;
  selectedWorkflowNodeId: string | null;
}

interface SelectionActions {
  selectAsset: (assetId: string, versionId?: string | null) => void;
  selectWorkflow: (workflowId: string, versionId?: string | null) => void;
  selectWorkflowRun: (runId: string) => void;
  selectOutput: (outputId: string, versionId?: string | null) => void;
  selectShot: (shotId: string) => void;
  selectScene: (sceneId: string) => void;
  selectFile: (fileId: string) => void;
  selectWorkflowNode: (nodeId: string | null) => void;
  clearSelection: () => void;
  clearAssetSelection: () => void;
  clearWorkflowSelection: () => void;
  clearOutputSelection: () => void;
}

export const useSelectionStore = create<SelectionState & SelectionActions>()(set => ({
  selectedAssetId: null,
  selectedAssetVersionId: null,
  selectedWorkflowId: null,
  selectedWorkflowVersionId: null,
  selectedWorkflowRunId: null,
  selectedOutputId: null,
  selectedOutputVersionId: null,
  selectedShotId: null,
  selectedSceneId: null,
  selectedFileId: null,
  selectedWorkflowNodeId: null,

  selectAsset: (assetId, versionId = null) =>
    set({
      selectedAssetId: assetId,
      selectedAssetVersionId: versionId,
    }),

  selectWorkflow: (workflowId, versionId = null) =>
    set({
      selectedWorkflowId: workflowId,
      selectedWorkflowVersionId: versionId,
    }),

  selectWorkflowRun: runId => set({ selectedWorkflowRunId: runId }),

  selectOutput: (outputId, versionId = null) =>
    set({
      selectedOutputId: outputId,
      selectedOutputVersionId: versionId,
    }),

  selectShot: shotId => set({ selectedShotId: shotId }),

  selectScene: sceneId => set({ selectedSceneId: sceneId }),

  selectFile: fileId => set({ selectedFileId: fileId }),

  selectWorkflowNode: nodeId => set({ selectedWorkflowNodeId: nodeId }),

  clearSelection: () =>
    set({
      selectedAssetId: null,
      selectedAssetVersionId: null,
      selectedWorkflowId: null,
      selectedWorkflowVersionId: null,
      selectedWorkflowRunId: null,
      selectedOutputId: null,
      selectedOutputVersionId: null,
      selectedShotId: null,
      selectedSceneId: null,
      selectedFileId: null,
      selectedWorkflowNodeId: null,
    }),

  clearAssetSelection: () =>
    set({
      selectedAssetId: null,
      selectedAssetVersionId: null,
    }),

  clearWorkflowSelection: () =>
    set({
      selectedWorkflowId: null,
      selectedWorkflowVersionId: null,
      selectedWorkflowRunId: null,
    }),

  clearOutputSelection: () =>
    set({
      selectedOutputId: null,
      selectedOutputVersionId: null,
    }),
}));
