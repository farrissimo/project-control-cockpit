// Backup-tier decision (owner policy 2026-07-09). Pure logic, no Electron/git — proves the
// push decision honors the declared tier and never turns a deliberate local-only project into
// a "Push FAILED" error. Precedence is policy-driven, not folder-name-driven.
const { test, expect } = require('@playwright/test');
const { decideBackup, LOCAL_ONLY_MSG, SETUP_MSG } = require('../../backup-policy.js');

test('local-only NEVER pushes, even if an upstream happens to exist', () => {
  for (const up of [false, true]) {
    const d = decideBackup('local-only', up);
    expect(d.push).toBe(false);
    expect(d.tier).toBe('local-only');
    expect(d.noPushMessage).toBe(LOCAL_ONLY_MSG);
    expect(d.noPushMessage).not.toMatch(/fail/i);
  }
});

test('remote-backed always pushes (a missing remote then surfaces as a REAL failure)', () => {
  for (const up of [false, true]) {
    const d = decideBackup('remote-backed', up);
    expect(d.push).toBe(true);
    expect(d.tier).toBe('remote-backed');
  }
});

test('no policy + existing upstream behaves as remote-backed (existing remotes still push)', () => {
  const d = decideBackup(null, true);
  expect(d.push).toBe(true);
  expect(d.tier).toBe('remote-backed');
});

test('no policy + no upstream is an undecided SETUP state, not a failure or a push', () => {
  const d = decideBackup(null, false);
  expect(d.push).toBe(false);
  expect(d.tier).toBe('setup');
  expect(d.noPushMessage).toBe(SETUP_MSG);
  expect(d.noPushMessage).not.toMatch(/fail/i);
});

test('undefined mode is treated the same as no policy', () => {
  expect(decideBackup(undefined, true).push).toBe(true);
  expect(decideBackup(undefined, false).push).toBe(false);
  expect(decideBackup(undefined, false).tier).toBe('setup');
});
