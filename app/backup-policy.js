// Backup-tier decision (owner policy 2026-07-09: projects EARN off-machine backup).
// Pure logic, unit-testable with no Electron and no git — main.js supplies the two facts
// (declared policy mode + whether an upstream remote exists) and this decides whether the
// Backup button should push, and what to say when it does not.
//
// Tiers:
//   local-only   — local commits ARE the accepted checkpoint; never push; not a failure.
//   remote-backed— local commit + push; a real remote is expected; push failure is real.
//   setup        — no declared policy AND no remote yet; commit locally, don't push, don't
//                  call it broken (the project simply hasn't chosen a tier).
// Precedence is POLICY-DRIVEN, never inferred from folder name. A missing policy with an
// upstream already set behaves as remote-backed (so an existing remote is still honored).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCBackupPolicy = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const LOCAL_ONLY_MSG = 'Local checkpoint saved. No remote configured by decision; this project is not off-machine protected.';
  const SETUP_MSG = 'Local checkpoint saved. No remote configured yet.';

  // mode: 'local-only' | 'remote-backed' | null/undefined (no policy)
  // hasUpstream: boolean — does the current branch have an upstream remote?
  // Returns { push, tier, noPushMessage } — noPushMessage is used only when push === false.
  function decideBackup(mode, hasUpstream) {
    if (mode === 'local-only') {
      return { push: false, tier: 'local-only', noPushMessage: LOCAL_ONLY_MSG };
    }
    if (mode === 'remote-backed') {
      // Declared remote-backed: push is required; a push failure (incl. no remote) is a REAL warning.
      return { push: true, tier: 'remote-backed', noPushMessage: null };
    }
    // No declared policy:
    if (hasUpstream) {
      // A remote already exists — honor it (implicit remote-backed) so existing repos still push.
      return { push: true, tier: 'remote-backed', noPushMessage: null };
    }
    // No policy and no remote — undecided setup state, not a failure.
    return { push: false, tier: 'setup', noPushMessage: SETUP_MSG };
  }

  return { decideBackup, LOCAL_ONLY_MSG, SETUP_MSG };
});
