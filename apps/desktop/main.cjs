// Electron main process: boots SQLite via @the-lab/core, registers unified RPC dispatcher.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const DEV_URL = process.env.LAB_DEV_URL || 'http://localhost:3000';
const isDev = process.argv.includes('--dev');

let dbInstance = null;
let dispatcher = null;

function initDatabase() {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  const dbPath = path.join(userDataDir, 'the-lab.db');

  const core = require('../../packages/core/dist/index.js');
  const factory = (f) => new Database(f);

  dbInstance = core.openDatabase({ filename: dbPath, factory });
  core.runMigrations(dbInstance);

  const clock = core.systemClock;
  const ids = core.randomIds();

  dispatcher = new core.CoreRpcDispatcher(dbInstance, clock, ids);
}

function registerIpcHandlers() {
  ipcMain.handle('rpc', async (_event, method, params, sessionToken) => {
    if (!dispatcher) {
      return {
        error: {
          code: 'INTERNAL',
          messageKey: 'errors.dbNotInitialized',
          message: 'Database not initialized',
        },
      };
    }
    return dispatcher.dispatch(method, params, sessionToken);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Security hardening: deny unrequested new windows and external navigation
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith('http://localhost') || url.startsWith('file://');
    if (!isLocal) {
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'packages', 'ui', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  try {
    initDatabase();
    registerIpcHandlers();
  } catch (err) {
    console.error('Failed to initialize local database in Electron:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (err) {
      console.error('Error closing database:', err);
    }
  }
  app.quit();
});
