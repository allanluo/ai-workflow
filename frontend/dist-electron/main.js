import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, shell, dialog, session } from 'electron';
import { startBackendProcess, waitForUrl } from './backend-process.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
function getPnpmCommand() {
    return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}
let backendProcess = null;
let mainWindow = null;
function setupSecurityHeaders() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    isDev
                        ? "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* http://localhost:*; img-src 'self' data: blob:;"
                        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';",
                ],
                'X-Content-Type-Options': ['nosniff'],
                'X-Frame-Options': ['DENY'],
                'X-XSS-Protection': ['1; mode=block'],
            },
        });
    });
}
function createApplicationMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu:new-project');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => app.quit(),
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(process.platform === 'darwin'
                    ? [{ type: 'separator' }, { role: 'front' }]
                    : [{ type: 'separator' }, { role: 'close' }]),
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: async () => {
                        await shell.openExternal('https://github.com/your-repo/docs');
                    },
                },
                {
                    label: 'Report Issue',
                    click: async () => {
                        await shell.openExternal('https://github.com/your-repo/issues');
                    },
                },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
async function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1100,
        minHeight: 720,
        backgroundColor: '#10211d',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
        },
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    if (isDev) {
        console.log('[Main] Loading development URL');
        await mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        console.log('[Main] Loading production build');
        await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    return mainWindow;
}
process.on('uncaughtException', error => {
    console.error('[Main] Uncaught exception:', error);
    dialog.showErrorBox('Error', `An unexpected error occurred: ${error.message}`);
});
process.on('unhandledRejection', reason => {
    console.error('[Main] Unhandled rejection:', reason);
});
app.whenReady().then(async () => {
    console.log('[Main] App ready, creating window');
    setupSecurityHeaders();
    createApplicationMenu();
    if (isDev) {
        console.log('[Main] Waiting for Vite dev server...');
        const viteReady = await waitForUrl('http://localhost:5173', 15000);
        if (!viteReady) {
            console.log('[Main] Vite not running, starting dev server...');
            const repoRoot = path.resolve(__dirname, '../..');
            spawn(getPnpmCommand(), ['dev'], {
                cwd: repoRoot,
                stdio: 'inherit',
                detached: true,
            });
            const newViteReady = await waitForUrl('http://localhost:5173', 30000);
            if (!newViteReady) {
                console.error('[Main] Vite dev server failed to start');
                app.quit();
                return;
            }
        }
        console.log('[Main] Vite dev server ready');
        console.log('[Main] Waiting for backend...');
        const backendReady = await waitForUrl('http://127.0.0.1:8787/api/v1/health', 15000);
        if (!backendReady) {
            console.log('[Main] Starting backend...');
            spawn(getPnpmCommand(), ['dev:backend'], {
                cwd: path.resolve(__dirname, '../..'),
                stdio: 'inherit',
                detached: true,
            });
            await waitForUrl('http://127.0.0.1:8787/api/v1/health', 30000);
        }
        console.log('[Main] Backend ready');
    }
    else {
        backendProcess = await startBackendProcess(isDev);
        if (backendProcess) {
            backendProcess.on('error', error => {
                console.error('[Main] Backend process error:', error);
            });
            backendProcess.on('exit', code => {
                console.log('[Main] Backend process exited with code:', code);
            });
        }
    }
    await createMainWindow();
    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createMainWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('before-quit', () => {
    console.log('[Main] App quitting, cleaning up');
    if (backendProcess && !backendProcess.killed) {
        console.log('[Main] Killing backend process');
        backendProcess.kill();
    }
});
