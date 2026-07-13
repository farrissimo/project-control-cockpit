// FI-6 — malformed / mismatched / unreachable CI evidence is never green; only an
// exact-SHA 'passed' is. Exercises BOTH real layers: app/ci-status.js (mapCiStatusToChip,
// in-process) and scripts/ci-status.ps1 (real pwsh authority against temp repos — copied
// in because it Set-Location's to its own repo root). Expected: CONTAINED.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { mapCiStatusToChip } = require('../../app/ci-status');

const REPO = path.join(__dirname, '..', '..');
const CI_PS1 = path.join(REPO, 'scripts', 'ci-status.ps1');
const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: String(detail) });
let baselineOk = false, injectionTriggered = false, observed = '';

const SHA = 'a'.repeat(40);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-fi6-'));

function git(dir, args) { execFileSync('git', args, { cwd: dir, stdio: 'ignore' }); }
// Run the REAL ci-status.ps1 inside a temp repo (copy it in so its $repo == the temp repo).
function runCiPs1(remoteUrl) {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'repo-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(CI_PS1, path.join(dir, 'scripts', 'ci-status.ps1'));
  git(dir, ['init']);
  if (remoteUrl) git(dir, ['remote', 'add', 'origin', remoteUrl]);
  const out = execFileSync('pwsh', ['-NoProfile', '-File', 'scripts/ci-status.ps1', '-Sha', 'c'.repeat(40), '-Json'],
    { cwd: dir, encoding: 'utf8', timeout: 30000 });
  // Capture the ACTUAL configured remote so we can prove the injected state genuinely exists.
  let remote = '';
  try { remote = String(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: dir, encoding: 'utf8' })).trim(); } catch (e) { remote = ''; }
  return Object.assign({ remote }, JSON.parse(String(out).trim()));
}

try {
  // ---- baseline: the ONE legitimate green — an exact-SHA 'passed' ----
  const green = mapCiStatusToChip({ sha: SHA, status: 'passed' }, SHA);
  baselineOk = green.available === true && green.state === 'passed';
  observed = 'baseline exact-SHA passed -> available=' + green.available + ' state=' + green.state;

  // ---- inject (mapper): malformed / mismatched / unbound / unreachable ----
  const malformedAllUnavailable = [null, undefined, {}, { status: 42 }, 'garbage', { sha: SHA }]
    .every((bad) => mapCiStatusToChip(bad, SHA).available === false);
  add('malformed_input_never_available', malformedAllUnavailable,
    'null / {} / {status:42} / no-sha / garbage -> never available (unknown, never fabricated into a verdict)');

  const mism = mapCiStatusToChip({ sha: 'b'.repeat(40), status: 'passed' }, SHA);
  add('mismatched_sha_never_green', mism.available === false && mism.reason === 'sha_mismatch',
    "a 'passed' for a DIFFERENT commit -> not available (sha_mismatch), never green");

  add('passed_without_sha_never_green', mapCiStatusToChip({ status: 'passed' }, SHA).available === false,
    "a 'passed' with no sha -> not bound -> never green");

  const failed = mapCiStatusToChip({ sha: SHA, status: 'failed' }, SHA);
  add('definite_failed_stays_failure', failed.available === true && failed.state === 'failed',
    'a definite failed/cancelled -> stays a failure (never masked to green/unknown)');

  const unreachableUnavailable = ['no_remote', 'not_github', 'unreachable']
    .every((s) => mapCiStatusToChip({ sha: SHA, status: s }, SHA).available === false);
  add('unreachable_status_unavailable', unreachableUnavailable,
    'no_remote / not_github / unreachable -> unavailable (honest unknown, never green)');

  // ---- inject (real ci-status.ps1): no-remote + non-GitHub remote ----
  const psNoRemote = runCiPs1(null);
  const psGitlab = runCiPs1('https://gitlab.com/acme/widget.git');
  // Prove the injected states genuinely exist: the mapper actually SAW a sha mismatch, the
  // no-remote repo really has no origin, and the non-GitHub repo really has a GitLab remote.
  injectionTriggered = mism.reason === 'sha_mismatch' && psNoRemote.remote === '' && /gitlab\.com/.test(psGitlab.remote || '');
  observed += ' | injected: mismatchSeen=' + (mism.reason === 'sha_mismatch') + ' noRemoteOrigin="' + psNoRemote.remote + '" nonGithubOrigin="' + psGitlab.remote + '"';

  add('ps1_no_remote_not_green', psNoRemote.status === 'no_remote',
    "real ci-status.ps1 in a no-remote repo -> status 'no_remote' (never a pass)");
  add('ps1_non_github_not_green', psGitlab.status === 'not_github',
    "real ci-status.ps1 with a non-GitHub remote -> status 'not_github' (never a pass)");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ id: 'FI-6-ci-authority-unavailable', expected: 'CONTAINED', baselineOk, injectionTriggered, observed, checks }));
