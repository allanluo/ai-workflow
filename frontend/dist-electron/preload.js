import { contextBridge, ipcRenderer } from 'electron';
import { ZodError } from 'zod';
export class IpcValidationError extends Error {
    errors;
    constructor(message, errors) {
        super(message);
        this.errors = errors;
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
];
const exposedApi = {
    appName: 'AI Workflow',
    async invoke(channel, params) {
        if (!validChannels.includes(channel)) {
            throw new Error(`Invalid IPC channel: ${channel}`);
        }
        try {
            const result = await ipcRenderer.invoke(channel, params);
            return result;
        }
        catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.map((e) => ({
                    path: e.path.map(String),
                    message: e.message,
                }));
                throw new IpcValidationError('Response validation failed', errors);
            }
            throw error;
        }
    },
    onEvent(callback) {
        const listener = (_event, data) => {
            callback(data);
        };
        ipcRenderer.on('project-event', listener);
        return () => {
            ipcRenderer.removeListener('project-event', listener);
        };
    },
};
contextBridge.exposeInMainWorld('desktop', exposedApi);
