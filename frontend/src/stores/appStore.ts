import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useDraftStore } from './draftStore';
import { useSelectionStore } from './selectionStore';

export type PageId =
  | 'home'
  | 'sources'
  | 'canon'
  | 'scenes'
  | 'shots'
  | 'workflows'
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
  createProjectModalOpen: boolean;
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
  openCreateProjectModal: () => void;
  closeCreateProjectModal: () => void;
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      currentProjectId: null,
      currentProjectTitle: null,
      selectedPage: 'home',
      userMode: 'advanced',
      connectionStatus: 'disconnected',
      sidebarCollapsed: false,
      projectPickerOpen: false,
      createProjectModalOpen: false,

      setCurrentProject: (id, title) => {
        const previousProjectId = get().currentProjectId;
        set({ currentProjectId: id, currentProjectTitle: title });

        if (previousProjectId !== id) {
          useSelectionStore.getState().clearSelection();
          useDraftStore.getState().setDraft(null);
        }
      },
      setSelectedPage: page => set({ selectedPage: page }),
      setUserMode: mode => set({ userMode: mode }),
      setConnectionStatus: status => set({ connectionStatus: status }),
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: collapsed => set({ sidebarCollapsed: collapsed }),
      openProjectPicker: () => set({ projectPickerOpen: true }),
      closeProjectPicker: () => set({ projectPickerOpen: false }),
      openCreateProjectModal: () => set({ createProjectModalOpen: true }),
      closeCreateProjectModal: () => set({ createProjectModalOpen: false }),
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
