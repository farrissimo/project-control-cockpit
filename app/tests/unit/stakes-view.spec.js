// Governor "Surface" (ADR-0006) deterministic view-model. Pure function, so we test the
// RULES directly with crafted classifier output — no Electron. Proves the guardrails hold:
// a real change surfaces its tier + reasons + files; "no change in flight" is its own honest
// state (never a fabricated T3); a null / malformed / UNKNOWN result fails closed to UNKNOWN
// (never a low tier); escalations pass through. Mirrors the spec docs/specs/governor-surface.md.
const { test, expect } = require('@playwright/test');
const { stakesView, TIER_META } = require('../../renderer/stakes-view.js');

// A T1 change (app/main.js is T1 in the manifest) with one escalation, as the classifier emits it.
const classified = {
  schema: 'stakes-classification/v1', tier: 'T1', base_tier: 'T1',
  reasons: ['path tier: T1 (highest of 2 touched file(s))', 'escalated to >= T1: dependency_or_lockfile — a dependency manifest or lockfile changed'],
  files: [{ path: 'app/main.js', tier: 'T1' }, { path: 'app/package.json', tier: 'T1' }],
  escalations: [{ id: 'dependency_or_lockfile', min_tier: 'T1', detail: 'a dependency manifest or lockfile changed' }],
  source: 'git', not_proven: 'This classifies WHICH files a change touches, not whether it is correct.',
};

test('AC-1: a change in flight surfaces the tier, reasons and touched files', () => {
  const v = stakesView(classified);
  expect(v.state).toBe('classified');
  expect(v.tier).toBe('T1');
  expect(v.tierName).toBe(TIER_META.T1.name);
  expect(v.zone).toBe('crucial');            // T0/T1 carry the crucial weight
  expect(v.proof).toBe(TIER_META.T1.proof);
  expect(v.fileCount).toBe(2);
  expect(v.files.map((f) => f.path)).toContain('app/main.js');
  expect(v.reasons.length).toBeGreaterThan(0);
  expect(v.advisory).toBe(true);             // AC-4: surfacing never blocks
});

test('AC-5: escalation rules that fired are surfaced', () => {
  const v = stakesView(classified);
  expect(v.escalations).toHaveLength(1);
  expect(v.escalations[0].id).toBe('dependency_or_lockfile');
  expect(v.escalations[0].min_tier).toBe('T1');
});

test('AC-2: no change in flight is its own honest state, not a fabricated tier', () => {
  const v = stakesView({
    schema: 'stakes-classification/v1', tier: 'T3', base_tier: 'T3',
    reasons: ['no files in this change — default tier T3'], files: [], escalations: [],
    not_proven: 'x',
  });
  expect(v.state).toBe('empty');
  expect(v.headline).toBe('No change in flight');
  expect(v.fileCount).toBe(0);
  expect(v.tierName).toBeNull();             // does NOT present "T3" as a real verdict
});

test('AC-3: UNKNOWN from the classifier fails closed to UNKNOWN, never a low tier', () => {
  const v = stakesView({
    schema: 'stakes-classification/v1', tier: 'UNKNOWN', base_tier: 'UNKNOWN',
    reasons: ['no stakes manifest — cannot classify honestly'], files: [], escalations: [],
    not_proven: 'The stakes of this change — the manifest is missing.',
  });
  expect(v.state).toBe('unknown');
  expect(v.tier).toBe('UNKNOWN');
  expect(v.zone).toBe('unknown');
});

test('AC-3: a null / malformed result fails closed to an error UNKNOWN, never a low tier', () => {
  for (const bad of [null, undefined, {}, { tier: 42 }, 'nope', { reasons: [] }]) {
    const v = stakesView(bad);
    expect(v.state === 'error' || v.state === 'unknown').toBe(true);
    expect(v.zone).toBe('unknown');
    expect(['UNKNOWN']).toContain(v.tier);   // never T0..T4
    expect(v.advisory).toBe(true);
  }
});

test('an unrecognized tier string degrades to the unknown zone, not a low tier', () => {
  const v = stakesView({ tier: 'T9', reasons: [], files: [{ path: 'x', tier: 'T9' }], escalations: [], not_proven: '' });
  expect(v.zone).toBe('unknown');
});
