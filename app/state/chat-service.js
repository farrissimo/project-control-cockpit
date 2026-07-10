// chat-service.js — the main-owned canonical-chat facade (PCC data-truth
// recovery, Phase 2A slice 4.1). Enforces PROJECT IDENTITY on every canonical
// path so a delayed command from Project A can never mutate Project B after a
// switch, even if revision numbers happen to match. Pure Node (delegates to
// chat-store); takes explicit paths so it is unit-testable against throwaway dirs.
//
// Identity rules:
//   READ   — resolve the active project's stable id; a store whose projectId does
//            NOT match the active project is REJECTED (never served as current).
//   MUTATE — the renderer command carries expectedProjectId AND expectedRevision.
//            main resolves the CURRENT active project id and rejects unless:
//              caller.expectedProjectId === active project id, AND
//              store.projectId === active project id (enforced by chat-store).
//            If identity cannot be resolved, the operation fails closed.

const cs = require('./chat-store');

function _resolveActive(projectDir, now) {
  const r = cs.resolveProjectId(projectDir, { now });
  if (!r.ok) return { ok: false, error: 'project_unresolved:' + r.error };
  return { ok: true, projectId: r.projectId };
}

// Read the canonical store, bound to the active project.
function readCanonical(opts) {
  opts = opts || {};
  const active = _resolveActive(opts.projectDir, opts.now);
  if (!active.ok) return active;
  const rd = cs.readStore(opts.chatsFile);
  if (!rd.ok) return rd;
  if (rd.store && rd.store.projectId !== active.projectId) {
    return { ok: false, error: 'project_mismatch', storeProjectId: rd.store.projectId, activeProjectId: active.projectId };
  }
  return { ok: true, store: rd.store, served: rd.served, projectId: active.projectId };
}

// Shared mutation guard: resolve the active project, require the caller's
// expectedProjectId to match it, then delegate to the chat-store command with
// expectedProjectId set (so the store's own projectId must also match).
function _mutate(fnName, opts) {
  opts = opts || {};
  const active = _resolveActive(opts.projectDir, opts.now);
  if (!active.ok) return active;
  if (opts.expectedProjectId !== active.projectId) {
    return { ok: false, error: 'project_mismatch', activeProjectId: active.projectId, expectedProjectId: opts.expectedProjectId };
  }
  return cs[fnName](opts.chatsFile, opts.expectedRevision, opts.args, { now: opts.now, expectedProjectId: active.projectId });
}

function createChat(opts) { return _mutate('createChat', opts); }
function appendMessage(opts) { return _mutate('appendMessage', opts); }
function updateChatMetadata(opts) { return _mutate('updateChatMetadata', opts); }
function renameChat(opts) { return _mutate('renameChat', opts); }
function deleteChat(opts) { return _mutate('deleteChat', opts); }
function setActiveChat(opts) { return _mutate('setActiveChat', opts); }

module.exports = {
  readCanonical, createChat, appendMessage, updateChatMetadata, renameChat, deleteChat, setActiveChat,
};
