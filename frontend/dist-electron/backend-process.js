import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function getPnpmCommand() {
    return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}
async function isBackendRunning(port) {
    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
            signal: AbortSignal.timeout(1000),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}
async function waitForUrl(url, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
            if (response.ok)
                return true;
        }
        catch {
            // continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
}
export { waitForUrl };
export async function startBackendProcess(isDev) {
    if (process.env.AI_WORKFLOW_SKIP_BACKEND === 'true') {
        console.log('[Main] Skipping backend process');
        return null;
    }
    const port = Number(process.env.PORT ?? '8787');
    const isPackaged = app.isPackaged;
    if (isDev) {
        const alreadyRunning = await isBackendRunning(port);
        if (alreadyRunning) {
            console.log(`[Main] Backend already running on port ${port}, skipping spawn`);
            return null;
        }
        console.log('[Main] Starting backend in development mode');
        const repoRoot = path.resolve(__dirname, '../..');
        const backendRoot = path.resolve(repoRoot, 'backend');
        return spawn(getPnpmCommand(), ['--dir', backendRoot, 'dev'], {
            cwd: repoRoot,
            stdio: 'inherit',
            env: {
                ...process.env,
                PORT: String(port),
                DATABASE_URL: process.env.DATABASE_URL ?? path.join(app.getPath('userData'), 'ai-workflow.sqlite'),
            },
            detached: false,
        });
    }
    if (isPackaged) {
        console.log('[Main] Starting backend in production mode');
        const appPath = path.dirname(app.getPath('exe'));
        const backendDistPath = path.join(appPath, 'backend', 'dist', 'server.js');
        const userDataPath = app.getPath('userData');
        return spawn(process.execPath, [backendDistPath], {
            cwd: appPath,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'production',
                PORT: String(port),
                DATABASE_URL: path.join(userDataPath, 'ai-workflow.sqlite'),
                PROJECT_STORAGE_ROOT: path.join(userDataPath, 'projects'),
            },
            detached: false,
        });
    }
    return null;
}
