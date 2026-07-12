// CI status for Electron — CONSUMES the single CI authority, scripts/ci-status.ps1.
//
// This module deliberately NO LONGER parses the git remote, calls GitHub, or interprets a
// check-runs array. All exact-SHA GitHub CI truth lives in scripts/ci-status.ps1. This file only:
//   1. maps that authority's status vocabulary to the renderer's Verified-chip contract
//      (mapCiStatusToChip — pure, unit-tested); and
//   2. orchestrates the exact-SHA invocation of the ACTIVE project's ci-status.ps1 (fetchCiChip).
// Kept pure/thin so the honesty rules (green only for a real, current pass; a result for another
// sha is never green; unknown never fabricated) are provable in tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCCiStatus = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Map scripts/ci-status.ps1's { sha, status } result to the renderer contract
  // { available, state, reason }. Owner-visible behavior is preserved EXACTLY: the Verified chip
  // goes GREEN only on state 'passed', RED only on 'failed', and otherwise falls through to the
  // local record. Exact-SHA binding: a result whose sha != the requested commit can NEVER be green.
  // Missing / malformed input -> not available (an unknown is never fabricated into a pass/fail).
  function mapCiStatusToChip(ps, requestedSha) {
    if (!ps || typeof ps !== 'object' || typeof ps.status !== 'string') {
      return { ok: true, available: false, reason: 'unavailable' };
    }
    // Exact-SHA binding for ANY available result: the helper must report a sha, and it must equal the
    // requested commit. A missing sha (malformed/broken helper) or a different sha can NEVER surface
    // as available — so a stray 'passed' without a bound sha is never green.
    const bound = !!requestedSha && !!ps.sha && String(ps.sha) === String(requestedSha);
    switch (ps.status) {
      case 'passed':                return bound ? { ok: true, available: true, state: 'passed', sha: ps.sha } : { ok: true, available: false, reason: 'sha_mismatch' };
      case 'failed':
      case 'cancelled':             return bound ? { ok: true, available: true, state: 'failed', sha: ps.sha } : { ok: true, available: false, reason: 'sha_mismatch' };
      case 'pending':               return bound ? { ok: true, available: true, state: 'pending', sha: ps.sha } : { ok: true, available: false, reason: 'sha_mismatch' };
      case 'skipped':
      case 'missing':
      case 'ambiguous':             return bound ? { ok: true, available: true, state: 'none', sha: ps.sha } : { ok: true, available: false, reason: 'sha_mismatch' };
      case 'no_remote':             return { ok: true, available: false, reason: 'no_remote' };
      case 'not_github':            return { ok: true, available: false, reason: 'not_github' };
      case 'unreachable':           return { ok: true, available: false, reason: 'unreachable' };
      default:                      return { ok: true, available: false, reason: 'unknown' };
    }
  }

  // Orchestrate the exact-SHA invocation of a project's OWN ci-status.ps1 (main-process only).
  // Reads the project's HEAD, runs <projectDir>/scripts/ci-status.ps1 -Sha <HEAD>, maps the result.
  // Honest UNKNOWN (available:false) for missing git, a missing script, malformed output, or a
  // timeout. No network here — all network truth is inside ci-status.ps1, which degrades offline-safe.
  // child_process is required lazily so this module stays loadable outside Node.
  function fetchCiChip(projectDir) {
    const { execFile } = require('child_process');
    const runGitHead = () => new Promise((resolve) => {
      execFile('git', ['rev-parse', 'HEAD'], { cwd: projectDir, timeout: 15000, windowsHide: true },
        (err, out) => resolve(err ? null : String(out).trim()));
    });
    const runScript = (sha) => new Promise((resolve) => {
      execFile('pwsh', ['-NoProfile', '-File', 'scripts/ci-status.ps1', '-Sha', sha],
        { cwd: projectDir, timeout: 15000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
        (err, out) => {
          if (err) return resolve(null); // nonzero exit / timeout / spawn failure -> unknown, never trusted
          const s = String(out || '').trim();
          if (!s) return resolve(null);
          try { resolve(JSON.parse(s)); } catch (e) { resolve(null); }
        });
    });
    return runGitHead().then((sha) => {
      if (!sha) return { ok: true, available: false, reason: 'no_git' };
      return runScript(sha).then((raw) => mapCiStatusToChip(raw, sha));
    });
  }

  return { mapCiStatusToChip: mapCiStatusToChip, fetchCiChip: fetchCiChip };
});
