const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('labApi', {
  workOrders: {
    list: (status) => ipcRenderer.invoke('workOrders:list', status),
    create: (dto) => ipcRenderer.invoke('workOrders:create', dto),
    release: (id) => ipcRenderer.invoke('workOrders:release', id),
    start: (id) => ipcRenderer.invoke('workOrders:start', id),
    complete: (id, params) => ipcRenderer.invoke('workOrders:complete', id, params),
  },
  inventory: {
    getBalance: (itemId, lotId, locationId) =>
      ipcRenderer.invoke('inventory:getBalance', itemId, lotId, locationId),
    recordMovement: (dto) => ipcRenderer.invoke('inventory:recordMovement', dto),
    listMovements: (itemId, limit) => ipcRenderer.invoke('inventory:listMovements', itemId, limit),
    listStockBalances: () => ipcRenderer.invoke('inventory:listStockBalances'),
    receiveGoods: (dto) => ipcRenderer.invoke('inventory:receiveGoods', dto),
    getDashboardMetrics: () => ipcRenderer.invoke('inventory:getDashboardMetrics'),
  },
  quality: {
    listLots: (filterQcStatus) => ipcRenderer.invoke('quality:listLots', filterQcStatus),
    updateLotQc: (lotId, newStatus, notes) =>
      ipcRenderer.invoke('quality:updateLotQc', lotId, newStatus, notes),
  },
});
