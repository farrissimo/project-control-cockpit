// Execution-authority state machine (DECISION-112). Split out of main.js so the
// RULES can be unit-tested directly with an injectable clock — no Electron, no real
// `claude` spawn, no 30-minute wall-clock waits. Pure logic; main.js owns the IPC,
// chatId minting, and tool-flag selection and delegates every transition here.
//
// Core law (unchanged): reading context is never authorization to act. The chat is
// read_only by default; only an EXPLICIT owner approval of a bounded job grants the
// build profile, tied to ONE chat id, and it always returns to read_only.
//
// Timeout model (Task 2L fix): the build session has TWO independent deadlines so a
// long New-Project interview can't silently lose build tools before the final scaffold
// write, while a walked-away session still can't linger and nothing can run forever:
//   - idleExpiresAt  — a sliding window RENEWED on each authorized in-chat send. Idle
//                      inactivity for the window length ends the session.
//   - hardExpiresAt  — an absolute ceiling set once at approval and NEVER extended.
//                      A session can never outlive it, however active.
// Renewal happens ONLY when a send is actually granted build (chatId-scoped), so pasted
// text in another chat can neither authorize nor extend anything.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCAuthority = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const IDLE_MS = 30 * 60 * 1000;        // build session ends after 30 min of INACTIVITY
  const HARD_CAP_MS = 2 * 60 * 60 * 1000; // absolute ceiling: never exceeds 2 hours, ever

  function createAuthority(opts) {
    const idleMs = (opts && opts.idleMs) || IDLE_MS;
    const hardCapMs = (opts && opts.hardCapMs) || HARD_CAP_MS;

    let mode = 'read_only'; // read_only | approval_needed | authorized_running
    let pendingJob = null;  // { type, name, chatId }
    let authorizedJob = null; // { type, name, chatId, idleExpiresAt, hardExpiresAt }
    const log = [];

    function record(event, job) { log.push({ event, type: job.type, name: job.name, at: new Date().toISOString() }); }

    // A stale authorization can never linger: drop the build session to read_only once
    // EITHER deadline has passed. Called before every authority read and every send.
    function expireIfNeeded(now) {
      if (mode === 'authorized_running' && authorizedJob &&
          (now > authorizedJob.idleExpiresAt || now > authorizedJob.hardExpiresAt)) {
        record(now > authorizedJob.hardExpiresAt ? 'expired_hardcap' : 'expired_idle', authorizedJob);
        authorizedJob = null; mode = 'read_only';
      }
    }

    return {
      // Owner-initiated: request a bounded job -> approval_needed. Nothing runs yet.
      request(type, name, chatId) {
        pendingJob = { type, name: String(name || '').slice(0, 60), chatId };
        mode = 'approval_needed';
        return { chatId, job: { type, name: pendingJob.name } };
      },
      // Owner approves -> authorized_running, bound to that chatId, with BOTH deadlines set.
      approve(now) {
        if (!pendingJob) return { ok: false, message: 'Nothing to approve.' };
        authorizedJob = Object.assign({}, pendingJob, {
          idleExpiresAt: now + idleMs,
          hardExpiresAt: now + hardCapMs,
        });
        pendingJob = null; mode = 'authorized_running'; record('approved', authorizedJob);
        return { ok: true, chatId: authorizedJob.chatId, job: { type: authorizedJob.type, name: authorizedJob.name } };
      },
      // Owner cancels a pending approval -> read_only.
      cancel() { if (pendingJob) record('cancelled', pendingJob); pendingJob = null; mode = 'read_only'; return { ok: true }; },
      // Owner ends the approved build session -> read_only.
      end() { if (authorizedJob) record('ended', authorizedJob); authorizedJob = null; mode = 'read_only'; return { ok: true }; },
      // Is THIS send (for chatId) authorized to run the build profile? Renews the idle
      // window as a side effect ONLY when it grants build — the sliding window that keeps
      // an active interview alive. The hard cap is checked first (via expireIfNeeded) and
      // is NEVER extended, so a session still dies at the ceiling however active it is.
      authorizeSend(chatId, now) {
        expireIfNeeded(now);
        const ok = mode === 'authorized_running' && !!authorizedJob && chatId === authorizedJob.chatId;
        if (ok) authorizedJob.idleExpiresAt = now + idleMs;
        return ok;
      },
      // Read-only view for the badge/state channel. Mutates only via lazy expiry.
      snapshot(now) {
        expireIfNeeded(now);
        const job = authorizedJob || pendingJob;
        return { mode, job: job ? { type: job.type, name: job.name } : null };
      },
      logTail(n) { return log.slice(-(n || 20)); },
    };
  }

  return { createAuthority, IDLE_MS, HARD_CAP_MS };
});
