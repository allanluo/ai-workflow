import { create } from 'zustand';

type PendingShotImageGeneration = {
  requestId: string;
  projectId: string;
  shotId: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
};

interface CopilotActionsState {
  pendingShotImageGeneration: PendingShotImageGeneration | null;
  requestShotImageGeneration: (input: Omit<PendingShotImageGeneration, 'requestId'>) => void;
  clearPendingShotImageGeneration: () => void;
}

export const useCopilotActionsStore = create<CopilotActionsState>()(set => ({
  pendingShotImageGeneration: null,
  requestShotImageGeneration: input =>
    set({
      pendingShotImageGeneration: {
        ...input,
        requestId: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      },
    }),
  clearPendingShotImageGeneration: () => set({ pendingShotImageGeneration: null }),
}));
