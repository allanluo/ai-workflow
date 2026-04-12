import { contextBridge, ipcRenderer } from 'electron';
import { ZodError, z } from 'zod';

export class IpcValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: { path: string[]; message: string }[]
  ) {
    super(message);
    this.name = 'IpcValidationError';
  }
}

const validChannels = [
  'projects:list',
  'projects:get',
  'projects:create',
  'projects:update',
  'assets:list',
  'assets:get',
  'assets:create',
  'assets:createVersion',
  'assets:approve',
  'workflows:list',
  'workflows:get',
  'workflows:create',
  'workflows:validate',
  'workflows:createVersion',
  'workflowRuns:create',
  'workflowRuns:get',
  'workflowRuns:listForProject',
  'workflowRuns:listNodeRuns',
] as const;

const exposedApi = {
  appName: 'AI Workflow',

  async invoke<T>(channel: string, params?: unknown): Promise<T> {
    if (!validChannels.includes(channel as (typeof validChannels)[number])) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }

    try {
      const result = await ipcRenderer.invoke(channel, params);
      return result as T;
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e: z.ZodIssue) => ({
          path: e.path.map(String),
          message: e.message,
        }));
        throw new IpcValidationError('Response validation failed', errors);
      }
      throw error;
    }
  },

  onEvent(callback: (event: { type: string; data: unknown }) => void) {
    const listener = (_event: Electron.IpcRendererEvent, data: { type: string; data: unknown }) => {
      callback(data);
    };
    ipcRenderer.on('project-event', listener);
    return () => {
      ipcRenderer.removeListener('project-event', listener);
    };
  },
};

contextBridge.exposeInMainWorld('desktop', exposedApi);

declare global {
  interface Window {
    desktop: typeof exposedApi;
  }
}
