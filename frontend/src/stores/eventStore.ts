import { create } from 'zustand';

export interface ProjectEvent {
  id: string;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  workflow_run_id: string | null;
  node_run_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface RunProgress {
  workflow_run_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_node_id?: string;
  current_node_type?: string;
  started_at: string;
  ended_at?: string;
}

interface EventState {
  recentEvents: ProjectEvent[];
  activeToasts: Toast[];
  runProgress: Record<string, RunProgress>;
  unreadNotificationCount: number;
}

interface EventActions {
  addEvent: (event: ProjectEvent) => void;
  setEvents: (events: ProjectEvent[]) => void;
  clearEvents: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  updateRunProgress: (runId: string, progress: Partial<RunProgress>) => void;
  clearRunProgress: (runId: string) => void;
  incrementUnreadNotifications: () => void;
  clearUnreadNotifications: () => void;
}

export const useEventStore = create<EventState & EventActions>()(set => ({
  recentEvents: [],
  activeToasts: [],
  runProgress: {},
  unreadNotificationCount: 0,

  addEvent: event =>
    set(state => ({
      recentEvents: [event, ...state.recentEvents].slice(0, 100),
      unreadNotificationCount: state.unreadNotificationCount + 1,
    })),

  setEvents: events => set({ recentEvents: events }),

  clearEvents: () => set({ recentEvents: [] }),

  addToast: toast =>
    set(state => ({
      activeToasts: [
        ...state.activeToasts,
        { ...toast, id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ],
    })),

  removeToast: id =>
    set(state => ({
      activeToasts: state.activeToasts.filter(t => t.id !== id),
    })),

  updateRunProgress: (runId, progress) =>
    set(state => ({
      runProgress: {
        ...state.runProgress,
        [runId]: {
          ...state.runProgress[runId],
          workflow_run_id: runId,
          ...progress,
        },
      },
    })),

  clearRunProgress: runId =>
    set(state => {
      const { [runId]: _, ...rest } = state.runProgress;
      return { runProgress: rest };
    }),

  incrementUnreadNotifications: () =>
    set(state => ({ unreadNotificationCount: state.unreadNotificationCount + 1 })),

  clearUnreadNotifications: () => set({ unreadNotificationCount: 0 }),
}));

let toastTimeouts: Record<string, NodeJS.Timeout> = {};

export function showToast(toast: Omit<Toast, 'id'>) {
  const store = useEventStore.getState();
  const duration = toast.duration ?? 5000;

  store.addToast(toast);

  if (duration > 0) {
    const timeoutId = setTimeout(() => {
      const currentToast = store.activeToasts.find(
        t => t.title === toast.title && t.message === toast.message
      );
      if (currentToast) {
        store.removeToast(currentToast.id);
      }
    }, duration);

    toastTimeouts[toast.title] = timeoutId;
  }
}
