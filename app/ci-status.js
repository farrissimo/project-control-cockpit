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
  // returned are already for the current commit — freshness is inherent). The verdict is tied ONLY
  // to our OWN test suite's check (`expectedName`, the CI job name, default 'test'): an unrelated
  // successful check (a bot, CodeQL, a second workflow) must NEVER read as "the test suite passed"
  // — that would be a fabricated green. Conservative on purpose:
  //   'passed'  — our test check ran, completed, and succeeded.
  //   'failed'  — our test check ran and finished in a failure state.
  //   'pending' — our test check exists but has not finished yet.
  //   'none'    — our test check has not reported for this commit (or only neutral/skipped),
  //               so there is no honest claim to make; the chip falls back to the local record.
  const FAILURE_CONCLUSIONS = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'];
  function decideCiStatus(checkRuns, expectedName) {
    const want = String(expectedName || 'test').toLowerCase();
    if (!Array.isArray(checkRuns) || checkRuns.length === 0) return 'none';
    // Only our named test check can justify a pass/fail claim. Unrelated checks are ignored.
    const mine = checkRuns.filter((r) => r && String(r.name || '').toLowerCase() === want);
    if (mine.length === 0) return 'none';                                        // our suite hasn't reported
    if (mine.some((r) => r.status !== 'completed')) return 'pending';
    if (mine.some((r) => FAILURE_CONCLUSIONS.indexOf(r.conclusion) !== -1)) return 'failed';
    if (mine.some((r) => r.conclusion === 'success')) return 'passed';
    return 'none';                                                               // ran but neutral/skipped
  }

  // The CI job/check name that IS the execution proof (.github/workflows/ci.yml -> jobs.test).
  const CI_CHECK_NAME = 'test';

  return { parseGitHubRepo: parseGitHubRepo, decideCiStatus: decideCiStatus, CI_CHECK_NAME: CI_CHECK_NAME };
});
