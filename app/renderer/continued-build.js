// continued-build.js (ADR-0021, Task 1.1) — decide whether "Continue in fresh chat" should carry a
// build re-approval into the continued chat. PURE + unit-testable (no DOM/electron/IPC).
//
// Authority's core law (app/authority-store.js) is unchanged: build is granted ONLY by an explicit
// owner approve, bound to one chat.id, always expiring; message content can never grant it. So a
// continued chat (a NEW chat.id) must NOT silently inherit the grant. This module only decides
// whether to OFFER a one-click, in-flow re-approval — the actual grant still goes through the owner
// confirm + approveJob path. Carry ONLY when the source chat is ACTIVELY authorized right now
// (authorized_running); never for approval_needed, read_only, or an expired/absent source.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCContinuedBuild = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // sourceAuthState: the source chat's authority snapshot { mode, job:{ name } } (from pcc.authorityState).
  // Returns { offer:boolean, name:string|null }. offer=true ONLY for an actively-authorized source.
  function planContinuedBuild(sourceAuthState) {
    if (sourceAuthState && sourceAuthState.mode === 'authorized_running') {
      const name = (sourceAuthState.job && typeof sourceAuthState.job.name === 'string' && sourceAuthState.job.name.trim())
        ? sourceAuthState.job.name.trim()
        : 'this chat';
      return { offer: true, name: name };
    }
    return { offer: false, name: null };
  }

  return { planContinuedBuild };
});
