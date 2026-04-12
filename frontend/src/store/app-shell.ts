import { create } from "zustand";

type UserMode = "simple" | "guided" | "advanced";

interface AppShellState {
  userMode: UserMode;
  rightPanelOpen: boolean;
  activityDockOpen: boolean;
  setUserMode: (mode: UserMode) => void;
  toggleRightPanel: () => void;
  toggleActivityDock: () => void;
}

export const useAppShellStore = create<AppShellState>((set) => ({
  userMode: "advanced",
  rightPanelOpen: true,
  activityDockOpen: true,
  setUserMode: (userMode) => set({ userMode }),
  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  toggleActivityDock: () =>
    set((state) => ({ activityDockOpen: !state.activityDockOpen }))
}));
