// Durable, PER-CHAT execution-authority store (Phase 4 recovery). Replaces the single
// volatile in-memory slot (old authority-logic.js) with a MAP of stable chat.id -> build
// authorization, PERSISTED to disk so an intended build session survives an app restart,
// and read PER CHAT so the badge and the spawn profile always reflect the chat you are
// actually in — never a global "authorized" that leaks onto a different chat.
//
// Core law (unchanged): reading context is never authorization to act. A chat is read_only
// by default; build is granted ONLY by an explicit owner approve, bound to ONE stable
// chat.id, and always expires (sliding idle window + absolute hard cap). Message content
// can never grant it — only the owner-driven request/approve path in main.
//
// Identity split (the desync fix): authority is keyed to the STABLE chat.id, which never
// changes. The Claude worker session id (which the app can re-mint for crash recovery) is a
// SEPARATE value the caller passes independently — so re-minting a worker session can never
// move or drop a chat's build authority.
//
// Pure + injectable: takes a `storage` ({ read(): obj|null, write(obj) }) and an optional
// clock, so it unit-tests with an in-memory store and a fake clock — no Electron, no fs.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCAuthorityStore = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const IDLE_MS = 30 * 60 * 1000;         // build session ends after 30 min of INACTIVITY
  const HARD_CAP_MS = 2 * 60 * 60 * 1000; // absolute ceiling: never exceeds 2 hours, ever

  function memStorage() { let d = null; return { read() { return d; }, write(o) { d = o; } }; }

  function createAuthorityStore(opts) {
    opts = opts || {};
    const idleMs = opts.idleMs || IDLE_MS;
    const hardCapMs = opts.hardCapMs || HARD_CAP_MS;
    const storage = opts.storage || memStorage();

    // chatId -> { name, idleExpiresAt, hardExpiresAt }  (PERSISTED — the authorized set)
    let authorized = {};
    // { type, name, chatId } | null  (TRANSIENT — an un-approved request must NOT survive restart)
    let pending = null;
    const log = [];

    function record(event, chatId, extra) { log.push(Object.assign({ event, chatId, at: new Date().toISOString() }, extra || {})); }
    function persist() { try { storage.write({ version: 1, chats: authorized }); } catch (e) { /* best effort */ } }

    // Drop a chat's authorization if EITHER deadline has passed. Returns true if it expired.
    // Does not persist — the caller persists once it knows a change stuck.
    function expireOne(chatId, now) {
      const a = authorized[chatId];
      if (!a) return false;
      if (now > a.idleExpiresAt || now > a.hardExpiresAt) {
        record(now > a.hardExpiresAt ? 'expired_hardcap' : 'expired_idle', chatId, { name: a.name });
        delete authorized[chatId];
        return true;
      }
      return false;
    }
    function expireAll(now) {
      let changed = false;
      for (const id of Object.keys(authorized)) { if (expireOne(id, now)) changed = true; }
      if (changed) persist();
    }

    return {
      // Load persisted authorizations and immediately drop any already past a deadline.
      // Call once at app startup (after the clock/paths are available).
      load(now) {
        let data = null;
        try { data = storage.read(); } catch (e) { data = null; }
        authorized = (data && data.chats && typeof data.chats === 'object') ? data.chats : {};
        pending = null; // never restore an un-approved request across a restart
        expireAll(now);
      },

      // Owner-initiated: request a bounded build job for the STABLE chatId -> pending
      // (approval_needed). Nothing runs yet.
      request(type, name, chatId) {
        pending = { type, name: String(name || '').slice(0, 60), chatId };
        return { chatId, job: { type, name: pending.name } };
      },
      // Owner approves the pending job -> authorized for that chatId, BOTH deadlines set, persisted.
      approve(now) {
        if (!pending) return { ok: false, message: 'Nothing to approve.' };
        const chatId = pending.chatId;
        const name = pending.name;
        authorized[chatId] = { name, idleExpiresAt: now + idleMs, hardExpiresAt: now + hardCapMs };
        record('approved', chatId, { name });
        pending = null;
        persist();
        return { ok: true, chatId, job: { type: 'new_project', name } };
      },
      // Owner cancels a pending (un-approved) request.
      cancel() { if (pending) record('cancelled', pending.chatId); pending = null; return { ok: true }; },
      // Owner disables build for a SPECIFIC chat -> that chat returns to read_only.
      disable(chatId) {
        if (authorized[chatId]) { record('disabled', chatId, { name: authorized[chatId].name }); delete authorized[chatId]; persist(); }
        return { ok: true };
      },

      // Is THIS send authorized to run the build profile? Keyed to the STABLE chatId. Renews
      // the idle window as a side effect ONLY when it grants build (the sliding window that
      // keeps an active session alive); the hard cap is checked first and is NEVER extended.
      authorizeSend(chatId, now) {
        if (!chatId) return false;
        expireOne(chatId, now);
        const a = authorized[chatId];
        if (!a) return false;
        a.idleExpiresAt = now + idleMs; // renew idle on a real grant
        persist();
        return true;
      },

      // Per-chat authority view for the badge. Reflects THIS chat only; never renews.
      stateFor(chatId, now) {
        if (chatId && expireOne(chatId, now)) persist();
        if (chatId && authorized[chatId]) return { mode: 'authorized_running', job: { name: authorized[chatId].name } };
        if (pending && pending.chatId === chatId) return { mode: 'approval_needed', job: { name: pending.name } };
        return { mode: 'read_only', job: null };
      },

      // Diagnostics.
      authorizedChatIds(now) { expireAll(now); return Object.keys(authorized); },
      logTail(n) { return log.slice(-(n || 20)); },
    };
  }

  return { createAuthorityStore, memStorage, IDLE_MS, HARD_CAP_MS };
});
