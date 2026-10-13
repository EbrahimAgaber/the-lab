// Thin Electron shell. No business logic here; the core will be wired via IPC in M1.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const DEV_URL = process.env.LAB_DEV_URL || 'http://localhost:5173';
const isDev = process.argv.includes('--dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (isDev) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', '..', 'packages', 'ui', 'dist', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
