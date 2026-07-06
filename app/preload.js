// PCC Cockpit - preload bridge.
// contextIsolation is on and nodeIntegration is off, so the chat window never
// touches Node or the filesystem directly. It can only call what is listed
// here: read the project header, and send a message to Claude.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcc', {
  getState: () => ipcRenderer.invoke('pcc:getState'),
  send: (message) => ipcRenderer.invoke('pcc:send', message),
  getRules: () => ipcRenderer.invoke('pcc:getRules'),
  getMemory: () => ipcRenderer.invoke('pcc:getMemory'),
  saveMemory: (text) => ipcRenderer.invoke('pcc:saveMemory', text),
});
