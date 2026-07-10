// Unit tests for the pure CI-status logic (app/ci-status.js). This is where the HONESTY of the
// "Verified (ran in CI)" chip is proven: parse only real GitHub remotes, and claim 'passed' ONLY
// for a genuine, complete, failure-free run — never fabricate green, never a false red.
const { test, expect } = require('@playwright/test');
const { parseGitHubRepo, decideCiStatus } = require('../../ci-status');

test('parseGitHubRepo reads https, ssh, and .git variants', () => {
  expect(parseGitHubRepo('https://github.com/farrissimo/project-control-cockpit.git'))
    .toEqual({ owner: 'farrissimo', repo: 'project-control-cockpit' });
  expect(parseGitHubRepo('https://github.com/farrissimo/project-control-cockpit'))
    .toEqual({ owner: 'farrissimo', repo: 'project-control-cockpit' });
  expect(parseGitHubRepo('git@github.com:farrissimo/pcc.git'))
    .toEqual({ owner: 'farrissimo', repo: 'pcc' });
  expect(parseGitHubRepo('ssh://git@github.com/owner/repo'))
    .toEqual({ owner: 'owner', repo: 'repo' });
});

test('parseGitHubRepo returns null for non-GitHub or empty remotes (local-only projects)', () => {
  expect(parseGitHubRepo('')).toBeNull();
  expect(parseGitHubRepo(null)).toBeNull();
  expect(parseGitHubRepo('https://gitlab.com/owner/repo.git')).toBeNull();
  expect(parseGitHubRepo('/some/local/path')).toBeNull();
});

test('decideCiStatus: no runs → none (no claim either way)', () => {
  expect(decideCiStatus([])).toBe('none');
  expect(decideCiStatus(null)).toBe('none');
  expect(decideCiStatus(undefined)).toBe('none');
});

test('decideCiStatus: any unfinished run → pending (never a premature green)', () => {
  expect(decideCiStatus([{ status: 'in_progress' }])).toBe('pending');
  expect(decideCiStatus([{ status: 'completed', conclusion: 'success' }, { status: 'queued' }])).toBe('pending');
});

test('decideCiStatus: a failure conclusion → failed (honest red)', () => {
  expect(decideCiStatus([{ status: 'completed', conclusion: 'failure' }])).toBe('failed');
  expect(decideCiStatus([
    { status: 'completed', conclusion: 'success' },
    { status: 'completed', conclusion: 'timed_out' },
  ])).toBe('failed');
});

test('decideCiStatus: all complete + a success + no failures → passed', () => {
  expect(decideCiStatus([{ status: 'completed', conclusion: 'success' }])).toBe('passed');
  expect(decideCiStatus([
    { status: 'completed', conclusion: 'success' },
    { status: 'completed', conclusion: 'skipped' },
  ])).toBe('passed');
});

test('decideCiStatus: only neutral/skipped → none (nothing was actually proven)', () => {
  expect(decideCiStatus([{ status: 'completed', conclusion: 'neutral' }])).toBe('none');
  expect(decideCiStatus([{ status: 'completed', conclusion: 'skipped' }])).toBe('none');
});
