// Electron main process: boots SQLite via @the-lab/core, registers secure IPC handlers.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const DEV_URL = process.env.LAB_DEV_URL || 'http://localhost:5173';
const isDev = process.argv.includes('--dev');

let dbInstance = null;
let workOrderService = null;
let inventoryService = null;

function initDatabase() {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  const dbPath = path.join(userDataDir, 'the-lab.db');

  // Dynamically require core distribution / modules
  const core = require('../../packages/core/dist/index.js');
  const factory = (f) => new Database(f);

  dbInstance = core.openDatabase({ filename: dbPath, factory });
  core.runMigrations(dbInstance);

  const clock = core.systemClock;
  const ids = core.randomIds();

  // Run initial enterprise seed if empty
  core.seedInitialData(dbInstance, clock, ids);

  workOrderService = new core.WorkOrderService(dbInstance, clock, ids);
  inventoryService = new core.InventoryService(dbInstance, clock, ids);
}

function registerIpcHandlers() {
  const ctx = { actorId: 'usr-electron-session' };

  ipcMain.handle('workOrders:list', async (_event, status) => {
    return workOrderService ? workOrderService.listWorkOrders(status) : [];
  });

  ipcMain.handle('workOrders:create', async (_event, dto) => {
    return workOrderService ? workOrderService.createWorkOrder(ctx, dto) : null;
  });

  ipcMain.handle('workOrders:release', async (_event, id) => {
    return workOrderService ? workOrderService.releaseWorkOrder(ctx, id) : null;
  });

  ipcMain.handle('workOrders:start', async (_event, id) => {
    return workOrderService ? workOrderService.startWorkOrder(ctx, id) : null;
  });

  ipcMain.handle('workOrders:complete', async (_event, id, params) => {
    return workOrderService ? workOrderService.completeWorkOrder(ctx, id, params) : null;
  });

  ipcMain.handle('inventory:getBalance', async (_event, itemId, lotId, locationId) => {
    return inventoryService ? String(inventoryService.getBalance(itemId, lotId, locationId)) : '0';
  });

  ipcMain.handle('inventory:recordMovement', async (_event, dto) => {
    return inventoryService ? inventoryService.recordMovement(ctx, dto) : null;
  });

  ipcMain.handle('inventory:listMovements', async (_event, itemId, limit) => {
    return inventoryService ? inventoryService.listMovements(itemId, limit) : [];
  });

  ipcMain.handle('inventory:listStockBalances', async () => {
    return inventoryService ? inventoryService.listStockBalances() : [];
  });

  ipcMain.handle('inventory:receiveGoods', async (_event, dto) => {
    return inventoryService ? inventoryService.receiveGoods(ctx, dto) : null;
  });

  ipcMain.handle('inventory:getDashboardMetrics', async () => {
    return inventoryService
      ? inventoryService.getDashboardMetrics()
      : {
          totalValuationMinor: 0,
          activeWorkOrdersWipMinor: 0,
          activeWorkOrdersCount: 0,
          monthlyProductionYieldPct: 100,
          costVarianceMinor: 0,
          varianceBreakdown: [],
        };
  });

  ipcMain.handle('quality:listLots', async (_event, filterQcStatus) => {
    return inventoryService ? inventoryService.listLots(filterQcStatus) : [];
  });

  ipcMain.handle('quality:updateLotQc', async (_event, lotId, newStatus, notes) => {
    if (!inventoryService) return false;
    inventoryService.updateLotQc(ctx, lotId, newStatus, notes);
    return true;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', '..', 'packages', 'ui', 'dist', 'index.html'));
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
