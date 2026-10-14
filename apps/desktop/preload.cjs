const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('labRpc', {
  invoke: (method, params, token) => ipcRenderer.invoke('rpc', method, params, token),
});
