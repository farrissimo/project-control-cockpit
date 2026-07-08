// PCC Cockpit - preload bridge.
// contextIsolation is on and nodeIntegration is off, so the chat window never
// touches Node or the filesystem directly. It can only call what is listed
// here: read the project header, and send a message to Claude.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcc', {
  getState: () => ipcRenderer.invoke('pcc:getState'),
  visionPromises: () => ipcRenderer.invoke('pcc:visionPromises'),
  send: (message, model, chatId, isFirstTurn) => ipcRenderer.invoke('pcc:send', message, model, chatId, isFirstTurn),
  secondOpinion: (prompt) => ipcRenderer.invoke('pcc:secondOpinion', prompt),
  getModels: () => ipcRenderer.invoke('pcc:getModels'),
  newChat: () => ipcRenderer.invoke('pcc:newChat'),
  listProjects: () => ipcRenderer.invoke('pcc:listProjects'),
  getActiveProject: () => ipcRenderer.invoke('pcc:getActiveProject'),
  setActiveProject: (dir) => ipcRenderer.invoke('pcc:setActiveProject', dir),
  addProject: (dir) => ipcRenderer.invoke('pcc:addProject', dir),
  pickFolder: () => ipcRenderer.invoke('pcc:pickFolder'),
  syncStatus: () => ipcRenderer.invoke('pcc:syncStatus'),
  backup: (message) => ipcRenderer.invoke('pcc:backup', message),
  pull: () => ipcRenderer.invoke('pcc:pull'),
  getRules: () => ipcRenderer.invoke('pcc:getRules'),
  getMemory: () => ipcRenderer.invoke('pcc:getMemory'),
  saveMemory: (text) => ipcRenderer.invoke('pcc:saveMemory', text),
  verify: (record) => ipcRenderer.invoke('pcc:verify', record),
  verifyProduct: () => ipcRenderer.invoke('pcc:verifyProduct'),
  runProduct: () => ipcRenderer.invoke('pcc:runProduct'),
  setPhaseKind: (kind) => ipcRenderer.invoke('pcc:setPhaseKind', kind),
  hardChecks: () => ipcRenderer.invoke('pcc:hardChecks'),
  detections: () => ipcRenderer.invoke('pcc:detections'),
  trustExtras: () => ipcRenderer.invoke('pcc:trustExtras'),
  handoff: () => ipcRenderer.invoke('pcc:handoff'),
  lifecycle: () => ipcRenderer.invoke('pcc:lifecycle'),
  lifecycleAdvance: (toStageId) => ipcRenderer.invoke('pcc:lifecycleAdvance', toStageId),
  recentDecisions: () => ipcRenderer.invoke('pcc:recentDecisions'),
  metrics: () => ipcRenderer.invoke('pcc:metrics'),
});
