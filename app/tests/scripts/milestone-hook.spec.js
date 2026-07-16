// Milestone-on-merge PostToolUse hook (comms channel-1 enforcement, ADR-0009). When a PR is merged to
// main, this hook injects the FIXED-format milestone-update skeleton so the worker relays a templated
// update instead of freeforming. These feed the hook synthetic PostToolUse stdin and assert: it fires
// ONLY on an actual `gh pr merge <number>`, emits the additionalContext template, and is fail-safe
// (never non-zero, never output) on non-merge / malformed input. Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const HOOK = path.join(REPO, 'scripts', 'hooks', 'milestone-on-merge.ps1');

// Run the hook with a synthetic PostToolUse stdin payload.
function runHook(command) {
  const stdin = JSON.stringify({ tool_name: 'Bash', tool_input: command === null ? {} : { command } });
  return spawnSync('pwsh', ['-NoProfile', '-File', HOOK],
    { cwd: REPO, input: command === undefined ? 'not json at all' : stdin, encoding: 'utf8', timeout: 30000, windowsHide: true });
}

test('fires on an actual `gh pr merge <number>` — injects the templated skeleton, exit 0', () => {
  const r = runHook('gh pr merge 24 --merge --delete-branch');
  expect(r.status).toBe(0);
  const o = JSON.parse(r.stdout.trim());
  expect(o.hookSpecificOutput.hookEventName).toBe('PostToolUse');
  expect(o.hookSpecificOutput.additionalContext).toContain('🏁');
  expect(o.hookSpecificOutput.additionalContext).toContain('% complete');
  expect(o.hookSpecificOutput.additionalContext).toMatch(/milestone update/i);
});

test('does NOT fire on a non-merge command — no output, exit 0', () => {
  const r = runHook('git status --short');
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe('');
});

test('does NOT fire on `gh pr merge` without a PR number (incidental mention)', () => {
  const r = runHook('gh pr merge --help');
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe('');
});

// Command-position match, not substring: a MENTION of a merge command must not fire the hook. Also
// requires a real numeric PR token + a merge-method flag, so `5abc` and flagless prose don't fire.
test('does NOT fire on mentions, non-numeric tokens, or flagless prose', () => {
  const noFire = [
    'echo gh pr merge 5 --merge',              // mention (segment starts with echo)
    'git commit -m "gh pr merge 5 --merge"',   // quoted arg
    'Write-Output "gh pr merge 5 --merge"',    // quoted arg
    'gh pr merge 5abc --merge',                // non-numeric PR token
    'gh pr merge 5 is the command you should run', // prose, no merge flag
  ];
  for (const cmd of noFire) {
    const r = runHook(cmd);
    expect(r.status).toBe(0);
    expect(r.stdout.trim(), `should not fire on: ${cmd}`).toBe('');
  }
});

test('DOES fire on real compound merge forms (leading cd, trailing pipe)', () => {
  for (const real of ['cd /repo; gh pr merge 24 --merge --delete-branch', 'gh pr merge 24 --merge 2>&1 | tail -1']) {
    const r = runHook(real);
    expect(r.status).toBe(0);
    const o = JSON.parse(r.stdout.trim());
    expect(o.hookSpecificOutput.additionalContext, `should fire on: ${real}`).toContain('🏁');
  }
});

test('fail-safe: malformed stdin → exit 0, no output (never wedges a session)', () => {
  const r = runHook(undefined); // sends non-JSON
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe('');
});

test('fail-safe: missing tool_input.command → exit 0, no output', () => {
  const r = runHook(null); // empty tool_input
  expect(r.status).toBe(0);
  expect(r.stdout.trim()).toBe('');
});

// The hook must NEVER use exit code 2 (the only blocking code) — it must never be able to stop the agent.
test('never emits the blocking exit code 2', () => {
  for (const cmd of ['gh pr merge 5 --merge', 'echo hi', 'gh pr view 5']) {
    expect(runHook(cmd).status).not.toBe(2);
  }
});
