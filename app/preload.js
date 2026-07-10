// PCC Cockpit - preload bridge.
// contextIsolation is on and nodeIntegration is off, so the chat window never
// touches Node or the filesystem directly. It can only call what is listed
// here: read the project header, and send a message to Claude.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcc', {
  getState: () => ipcRenderer.invoke('pcc:getState'),
  visionPromises: () => ipcRenderer.invoke('pcc:visionPromises'),
  // workerSessionId = the Claude session (chat's own id, or a re-minted id after recovery);
  // chatId = the STABLE chat.id used for build authority — kept separate on purpose.
  send: (message, model, workerSessionId, isFirstTurn, chatId, attachments) => ipcRenderer.invoke('pcc:send', message, model, workerSessionId, isFirstTurn, chatId, attachments),
  authorityState: (chatId) => ipcRenderer.invoke('pcc:authorityState', chatId), // read-only, per-chat; no setter is exposed
  authorityLog: () => ipcRenderer.invoke('pcc:authorityLog'),
  // Owner-driven authority transitions (wired ONLY to explicit UI controls, never chat text):
  requestJob: (type, name, chatId) => ipcRenderer.invoke('pcc:requestJob', type, name, chatId),
  approveJob: () => ipcRenderer.invoke('pcc:approveJob'),
  cancelJob: () => ipcRenderer.invoke('pcc:cancelJob'),
  endJob: (chatId) => ipcRenderer.invoke('pcc:endJob', chatId),
  secondOpinion: (prompt) => ipcRenderer.invoke('pcc:secondOpinion', prompt),
  getModels: () => ipcRenderer.invoke('pcc:getModels'),
  newChat: () => ipcRenderer.invoke('pcc:newChat'),
  // First-class chat history (docs/CHAT_RECALL_SPEC.md): AI auto-name + structured summary card.
  autoNameChat: (messages) => ipcRenderer.invoke('pcc:autoNameChat', messages),
  summarizeChat: (chatId, messages) => ipcRenderer.invoke('pcc:summarizeChat', chatId, messages),
  persistChat: (chatId, messages) => ipcRenderer.invoke('pcc:persistChat', chatId, messages),
  deleteChatFiles: (chatId) => ipcRenderer.invoke('pcc:deleteChatFiles', chatId),
  searchChats: (query, chats) => ipcRenderer.invoke('pcc:searchChats', query, chats),
  listProjects: () => ipcRenderer.invoke('pcc:listProjects'),
  getActiveProject: () => ipcRenderer.invoke('pcc:getActiveProject'),
  setActiveProject: (dir) => ipcRenderer.invoke('pcc:setActiveProject', dir),
  addProject: (dir) => ipcRenderer.invoke('pcc:addProject', dir),
  pickFolder: () => ipcRenderer.invoke('pcc:pickFolder'),
  // New Project create-flow (DECISION-114): a scratch workspace + Save Project, all outside PCC.
  createFlowStart: () => ipcRenderer.invoke('pcc:createFlowStart'),
  createFlowSend: (message, model, attachments) => ipcRenderer.invoke('pcc:createFlowSend', message, model, attachments),
  createFlowCancel: () => ipcRenderer.invoke('pcc:createFlowCancel'),
  createFlowPickLocation: () => ipcRenderer.invoke('pcc:createFlowPickLocation'),
  createFlowSave: (name, location) => ipcRenderer.invoke('pcc:createFlowSave', name, location),
  ciStatus: () => ipcRenderer.invoke('pcc:ciStatus'),
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
  engineStatus: (dir) => ipcRenderer.invoke('pcc:engineStatus', dir),
  hardChecks: () => ipcRenderer.invoke('pcc:hardChecks'),
  detections: () => ipcRenderer.invoke('pcc:detections'),
  trustExtras: () => ipcRenderer.invoke('pcc:trustExtras'),
  handoff: () => ipcRenderer.invoke('pcc:handoff'),
  lifecycle: () => ipcRenderer.invoke('pcc:lifecycle'),
  lifecycleAdvance: (toStageId) => ipcRenderer.invoke('pcc:lifecycleAdvance', toStageId),
  recentDecisions: () => ipcRenderer.invoke('pcc:recentDecisions'),
  metrics: () => ipcRenderer.invoke('pcc:metrics'),
});
