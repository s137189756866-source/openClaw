const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  version: process.versions.electron,
  sendChat: (payload) => ipcRenderer.invoke('send-chat', payload),
  restart: () => ipcRenderer.send('restart-app')
});
