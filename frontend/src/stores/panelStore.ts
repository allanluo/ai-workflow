import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RightPanelTab = 'copilot' | 'inspector' | 'versions' | 'validation' | 'comments';
export type BottomDockTab = 'runs' | 'jobs' | 'logs' | 'notifications';

interface PanelState {
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  rightPanelWidth: number;
  bottomDockExpanded: boolean;
  bottomDockTab: BottomDockTab;
  bottomDockHeight: number;
}

interface PanelActions {
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setRightPanelWidth: (width: number) => void;
  setBottomDockExpanded: (expanded: boolean) => void;
  toggleBottomDock: () => void;
  setBottomDockTab: (tab: BottomDockTab) => void;
  setBottomDockHeight: (height: number) => void;
}

export const usePanelStore = create<PanelState & PanelActions>()(
  persist(
    set => ({
      rightPanelOpen: true,
      rightPanelTab: 'inspector',
      rightPanelWidth: 360,
      bottomDockExpanded: false,
      bottomDockTab: 'runs',
      bottomDockHeight: 200,

      setRightPanelOpen: open => set({ rightPanelOpen: open }),
      toggleRightPanel: () => set(state => ({ rightPanelOpen: !state.rightPanelOpen })),
      setRightPanelTab: tab => set({ rightPanelTab: tab, rightPanelOpen: true }),
      setRightPanelWidth: width => set({ rightPanelWidth: Math.max(280, Math.min(600, width)) }),

      setBottomDockExpanded: expanded => set({ bottomDockExpanded: expanded }),
      toggleBottomDock: () => set(state => ({ bottomDockExpanded: !state.bottomDockExpanded })),
      setBottomDockTab: tab => set({ bottomDockTab: tab, bottomDockExpanded: true }),
      setBottomDockHeight: height =>
        set({ bottomDockHeight: Math.max(150, Math.min(400, height)) }),
    }),
    {
      name: 'ai-workflow-panels',
    }
  )
);
