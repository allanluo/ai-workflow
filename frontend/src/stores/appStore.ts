import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PageId =
  | 'home'
  | 'sources'
  | 'canon'
  | 'scenes'
  | 'shots'
  | 'workflows'
  | 'outputs'
  | 'timeline'
  | 'review'
  | 'activity'
  | 'exports';

export type UserMode = 'simple' | 'guided' | 'advanced';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface AppState {
  currentProjectId: string | null;
  currentProjectTitle: string | null;
  selectedPage: PageId;
  userMode: UserMode;
  connectionStatus: ConnectionStatus;
  sidebarCollapsed: boolean;
  projectPickerOpen: boolean;
}

interface AppActions {
  setCurrentProject: (id: string | null, title: string | null) => void;
  setSelectedPage: (page: PageId) => void;
  setUserMode: (mode: UserMode) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openProjectPicker: () => void;
  closeProjectPicker: () => void;
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    set => ({
      currentProjectId: null,
      currentProjectTitle: null,
      selectedPage: 'home',
      userMode: 'advanced',
      connectionStatus: 'disconnected',
      sidebarCollapsed: false,
      projectPickerOpen: false,

      setCurrentProject: (id, title) => set({ currentProjectId: id, currentProjectTitle: title }),
      setSelectedPage: page => set({ selectedPage: page }),
      setUserMode: mode => set({ userMode: mode }),
      setConnectionStatus: status => set({ connectionStatus: status }),
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: collapsed => set({ sidebarCollapsed: collapsed }),
      openProjectPicker: () => set({ projectPickerOpen: true }),
      closeProjectPicker: () => set({ projectPickerOpen: false }),
    }),
    {
      name: 'ai-workflow-app',
      partialize: state => ({
        userMode: state.userMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
