// CI-status decision (DECISION-114 follow-on / roadmap "surface CI into the Verified chip").
// Pure, unit-testable logic — NO network, NO Electron. main.js supplies the two facts it can't
// compute here (the git remote URL and the GitHub check-runs payload for the current commit) and
// this decides owner/repo and whether CI passed. Kept pure so the honesty rules (green only for a
// real, current, clean-room pass; never a fabricated green/red) are provable in tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCCiStatus = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Parse an `origin` remote URL into { owner, repo }, or null if it isn't a GitHub remote.
  // Handles https (https://github.com/owner/repo(.git)) and ssh (git@github.com:owner/repo(.git)).
  function parseGitHubRepo(remoteUrl) {
    const url = String(remoteUrl || '').trim();
    if (!url) return null;
    let m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
    if (!m) m = url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
    if (!m) m = url.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
  }

  // Decide CI state from a GitHub check-runs array (the API is queried BY commit sha, so any runs
  // returned are already for the current commit — freshness is inherent). Conservative on purpose:
  //   'passed'  — every run finished and at least one succeeded, with NO failures.
  //   'failed'  — a run finished in a failure state.
  //   'pending' — at least one run has not finished yet.
  //   'none'    — no runs, or only neutral/skipped runs (nothing to claim either way).
  const FAILURE_CONCLUSIONS = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'];
  function decideCiStatus(checkRuns) {
    if (!Array.isArray(checkRuns) || checkRuns.length === 0) return 'none';
    if (checkRuns.some((r) => r && r.status !== 'completed')) return 'pending';
    if (checkRuns.some((r) => r && FAILURE_CONCLUSIONS.indexOf(r.conclusion) !== -1)) return 'failed';
    if (checkRuns.some((r) => r && r.conclusion === 'success')) return 'passed';
    return 'none'; // all neutral/skipped — no honest claim to make
  }

  return { parseGitHubRepo: parseGitHubRepo, decideCiStatus: decideCiStatus };
});
