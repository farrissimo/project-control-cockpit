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

// The verdict is tied to our named 'test' check (default expectedName). These use name:'test'.
test('decideCiStatus: no runs → none (no claim either way)', () => {
  expect(decideCiStatus([])).toBe('none');
  expect(decideCiStatus(null)).toBe('none');
  expect(decideCiStatus(undefined)).toBe('none');
});

test('decideCiStatus: our test check unfinished → pending (never a premature green)', () => {
  expect(decideCiStatus([{ name: 'test', status: 'in_progress' }])).toBe('pending');
  expect(decideCiStatus([{ name: 'test', status: 'queued' }])).toBe('pending');
});

test('decideCiStatus: our test check failed → failed (honest red)', () => {
  expect(decideCiStatus([{ name: 'test', status: 'completed', conclusion: 'failure' }])).toBe('failed');
  expect(decideCiStatus([{ name: 'test', status: 'completed', conclusion: 'timed_out' }])).toBe('failed');
});

test('decideCiStatus: our test check ran + succeeded → passed', () => {
  expect(decideCiStatus([{ name: 'test', status: 'completed', conclusion: 'success' }])).toBe('passed');
});

// The hole Codex caught: an UNRELATED successful check must NEVER read as "the test suite passed".
test('decideCiStatus: unrelated success but our test check absent → none (no fabricated green)', () => {
  expect(decideCiStatus([{ name: 'CodeQL', status: 'completed', conclusion: 'success' }])).toBe('none');
  expect(decideCiStatus([{ name: 'Dependabot', status: 'completed', conclusion: 'success' }])).toBe('none');
});

test('decideCiStatus: unrelated checks are ignored; only our test check drives the verdict', () => {
  // our test passed; an unrelated bot failed → still passed (claim is specifically "test suite passed")
  expect(decideCiStatus([
    { name: 'test', status: 'completed', conclusion: 'success' },
    { name: 'some-bot', status: 'completed', conclusion: 'failure' },
  ])).toBe('passed');
  // our test still running while an unrelated check finished → pending, not green
  expect(decideCiStatus([
    { name: 'test', status: 'in_progress' },
    { name: 'CodeQL', status: 'completed', conclusion: 'success' },
  ])).toBe('pending');
});

test('decideCiStatus: our test check ran but neutral/skipped → none (nothing actually proven)', () => {
  expect(decideCiStatus([{ name: 'test', status: 'completed', conclusion: 'neutral' }])).toBe('none');
  expect(decideCiStatus([{ name: 'test', status: 'completed', conclusion: 'skipped' }])).toBe('none');
});

test('decideCiStatus: expectedName is honored (case-insensitive)', () => {
  expect(decideCiStatus([{ name: 'build', status: 'completed', conclusion: 'success' }], 'build')).toBe('passed');
  expect(decideCiStatus([{ name: 'TEST', status: 'completed', conclusion: 'success' }])).toBe('passed');
});
