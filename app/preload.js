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
  touchActivity: (chatId) => ipcRenderer.invoke('pcc:touchActivity', chatId), // renews idle for an ALREADY-authorized chat only; never grants

  // Owner-driven authority transitions (wired ONLY to explicit UI controls, never chat text):
  requestJob: (type, name, chatId) => ipcRenderer.invoke('pcc:requestJob', type, name, chatId),
  approveJob: () => ipcRenderer.invoke('pcc:approveJob'),
  cancelJob: () => ipcRenderer.invoke('pcc:cancelJob'),
  endJob: (chatId) => ipcRenderer.invoke('pcc:endJob', chatId),
  secondOpinion: (prompt) => ipcRenderer.invoke('pcc:secondOpinion', prompt),
  getModels: () => ipcRenderer.invoke('pcc:getModels'),
  toolStatus: () => ipcRenderer.invoke('pcc:toolStatus'),
  newChat: () => ipcRenderer.invoke('pcc:newChat'),
  // First-class chat history (docs/CHAT_RECALL_SPEC.md): AI auto-name + structured summary card.
  autoNameChat: (messages) => ipcRenderer.invoke('pcc:autoNameChat', messages),
  summarizeChat: (chatId, messages) => ipcRenderer.invoke('pcc:summarizeChat', chatId, messages),
  persistChat: (chatId, messages) => ipcRenderer.invoke('pcc:persistChat', chatId, messages),
  deleteChatFiles: (chatId) => ipcRenderer.invoke('pcc:deleteChatFiles', chatId),
  searchChats: (query, chats) => ipcRenderer.invoke('pcc:searchChats', query, chats),
  saveChatsBackup: (chats) => ipcRenderer.invoke('pcc:saveChatsBackup', chats), // DISABLED no-op (S4); canonical store is the writer
  loadChatsBackup: () => ipcRenderer.invoke('pcc:loadChatsBackup'),
  // Canonical chat store (Phase 2A S4). Read + one-time bootstrap + command-shaped
  // mutations (each carries expectedRevision). No whole-store/whole-chat replace.
  chatsRead: () => ipcRenderer.invoke('pcc:chatsRead'),
  chatsBootstrap: (legacySnapshot) => ipcRenderer.invoke('pcc:chatsBootstrap', legacySnapshot),
  // Mutations carry expectedProjectId AND expectedRevision so a delayed command
  // can't cross a project switch. main rejects on either mismatch.
  chatsCreate: (expectedProjectId, expectedRevision, args) => ipcRenderer.invoke('pcc:chatsCreate', expectedProjectId, expectedRevision, args),
  chatsAppend: (expectedProjectId, expectedRevision, args) => ipcRenderer.invoke('pcc:chatsAppend', expectedProjectId, expectedRevision, args),
  chatsUpdateMeta: (expectedProjectId, expectedRevision, args) => ipcRenderer.invoke('pcc:chatsUpdateMeta', expectedProjectId, expectedRevision, args),
  chatsRename: (expectedProjectId, expectedRevision, args) => ipcRenderer.invoke('pcc:chatsRename', expectedProjectId, expectedRevision, args),
  chatsDelete: (expectedProjectId, expectedRevision, args) => ipcRenderer.invoke('pcc:chatsDelete', expectedProjectId, expectedRevision, args),
  chatsSetActive: (expectedProjectId, expectedRevision, args) => ipcRenderer.invoke('pcc:chatsSetActive', expectedProjectId, expectedRevision, args),
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
  stakes: () => ipcRenderer.invoke('pcc:stakes'),
  trustExtras: () => ipcRenderer.invoke('pcc:trustExtras'),
  handoff: () => ipcRenderer.invoke('pcc:handoff'),
  copyText: (text) => ipcRenderer.invoke('pcc:copyText', text),
  repoHead: () => ipcRenderer.invoke('pcc:repoHead'),
  lifecycle: () => ipcRenderer.invoke('pcc:lifecycle'),
  lifecycleAdvance: (toStageId) => ipcRenderer.invoke('pcc:lifecycleAdvance', toStageId),
  recentDecisions: () => ipcRenderer.invoke('pcc:recentDecisions'),
  metrics: () => ipcRenderer.invoke('pcc:metrics'),
});
