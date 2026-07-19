const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Store
  getConnections: () => ipcRenderer.invoke('store:getConnections'),
  saveConnection: (conn) => ipcRenderer.invoke('store:saveConnection', conn),
  deleteConnection: (id) => ipcRenderer.invoke('store:deleteConnection', id),

  // SSH
  connect: (id, config) => ipcRenderer.invoke('ssh:connect', { id, config }),
  disconnect: (id) => ipcRenderer.invoke('ssh:disconnect', id),
  write: (id, data) => ipcRenderer.invoke('ssh:write', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.invoke('ssh:resize', { id, cols, rows }),

  // Events
  onData: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('ssh:data', handler);
    return () => ipcRenderer.off('ssh:data', handler);
  },
  onStatus: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('ssh:status', handler);
    return () => ipcRenderer.off('ssh:status', handler);
  }
});
