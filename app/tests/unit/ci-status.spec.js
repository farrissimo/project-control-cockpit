// Unit tests for the pure CI-status MAPPER (app/ci-status.js -> mapCiStatusToChip). This is where
// the HONESTY of the "Verified (ran in CI)" chip is proven now that all GitHub interpretation lives
// in the single authority scripts/ci-status.ps1: the mapper turns that authority's status vocabulary
// into the renderer contract, going GREEN only for a real 'passed', RED only for 'failed', and never
// fabricating a pass/red from an unknown or from a result bound to a different commit.
const { test, expect } = require('@playwright/test');
const { mapCiStatusToChip } = require('../../ci-status');

const SHA = 'a'.repeat(40);

test('passed → available + state passed (the only green)', () => {
  expect(mapCiStatusToChip({ sha: SHA, status: 'passed' }, SHA)).toEqual({ ok: true, available: true, state: 'passed', sha: SHA });
});

test('failed and cancelled → available + state failed (honest red)', () => {
  expect(mapCiStatusToChip({ sha: SHA, status: 'failed' }, SHA)).toMatchObject({ available: true, state: 'failed' });
  expect(mapCiStatusToChip({ sha: SHA, status: 'cancelled' }, SHA)).toMatchObject({ available: true, state: 'failed' });
});

test('pending → available + state pending (never a premature green)', () => {
  expect(mapCiStatusToChip({ sha: SHA, status: 'pending' }, SHA)).toMatchObject({ available: true, state: 'pending' });
});

test('skipped / missing / ambiguous → available + state none (nothing positive proven, not green)', () => {
  for (const status of ['skipped', 'missing', 'ambiguous']) {
    const r = mapCiStatusToChip({ sha: SHA, status }, SHA);
    expect(r.available).toBe(true);
    expect(r.state).toBe('none');
  }
});

test('no_remote / not_github / unreachable / unknown → NOT available (honest unknown)', () => {
  for (const status of ['no_remote', 'not_github', 'unreachable', 'unknown']) {
    const r = mapCiStatusToChip({ sha: SHA, status }, SHA);
    expect(r.available).toBe(false);
    expect(r.state).toBeUndefined();
  }
});

// The exact-SHA honesty rule: a pass reported for a DIFFERENT commit must never light the chip green.
test('a passed result bound to a different sha → NOT available (sha_mismatch, never green)', () => {
  const r = mapCiStatusToChip({ sha: 'b'.repeat(40), status: 'passed' }, SHA);
  expect(r.available).toBe(false);
  expect(r.reason).toBe('sha_mismatch');
  expect(r.state).toBeUndefined();
});

test('null / malformed input → NOT available (never fabricated into a verdict)', () => {
  for (const bad of [null, undefined, {}, { status: 42 }, 'garbage', { sha: SHA }]) {
    const r = mapCiStatusToChip(bad, SHA);
    expect(r.available).toBe(false);
  }
});

// The Codex-caught hole: a 'passed' with NO sha at all must not slip past the binding into green.
test('a passed/failed result with NO sha is not bound → NOT available', () => {
  expect(mapCiStatusToChip({ status: 'passed' }, SHA).available).toBe(false);
  expect(mapCiStatusToChip({ status: 'failed' }, SHA).available).toBe(false);
  // and with no requestedSha to bind against, nothing can go green either
  expect(mapCiStatusToChip({ sha: SHA, status: 'passed' }, null).available).toBe(false);
});
