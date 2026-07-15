// Owner milestone-update generator (comms spec channel 1 / ADR-0009 category 1). The generator
// assembles the FIXED owner milestone-update block set, computes the phase '% complete' from the
// declared phase manifest (done/total), and refuses to invent the number: a missing/malformed manifest
// or a slice marked done WITHOUT evidence yields pct="UNKNOWN". These run the script exactly as it is
// used (pwsh -File ... -Json) against synthetic temp manifests. Pure CLI, no Electron.
// Spec: docs/specs/milestone-update-generator.md.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function writeManifest(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-phase-'));
  const p = path.join(dir, 'phase-manifest.json');
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
  return p;
}

function gen(args) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/new-milestone-update.ps1', '-Json', ...args],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  const out = (r.stdout || '').trim();
  try { return JSON.parse(out); } catch (e) { throw new Error('non-JSON output:\n' + out + '\n' + (r.stderr || '')); }
}

const slice = (id, done, evidence) => ({ id, title: id, workstream: 'audit-category', done, evidence: evidence || '' });
const validManifest = (slices) => ({
  schema: 'phase-manifest/v1',
  phase: { id: 'test-phase', name: 'Test Phase', adr: 'x', tagline: 'y' },
  slices,
});

test('JSON contract shape', () => {
  const p = writeManifest(validManifest([slice('a', false)]));
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.schema).toBe('milestone-update/v1');
  expect(Array.isArray(o.block_order)).toBe(true);
  expect(typeof o.text).toBe('string');
  expect(typeof o.not_proven).toBe('string');
});

// AC-1: computed % = round(done/total*100)
test('AC-1: computes pct = round(done/total*100) from evidence-backed done slices', () => {
  const p = writeManifest(validManifest([
    slice('a', true, 'PR #1'), slice('b', true, 'abc123'), slice('c', false), slice('d', false),
  ]));
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.done).toBe(2);
  expect(o.total).toBe(4);
  expect(o.pct).toBe(50);
});

test('AC-1: rounds (1 of 3 done => 33)', () => {
  const p = writeManifest(validManifest([slice('a', true, 'x'), slice('b', false), slice('c', false)]));
  expect(gen(['-ManifestPath', p, '-Since', 'HEAD']).pct).toBe(33);
});

// AC-2: never invented — fail closed to UNKNOWN
test('AC-2: missing manifest => UNKNOWN, not a fabricated number', () => {
  const o = gen(['-ManifestPath', path.join(os.tmpdir(), 'does-not-exist-xyz.json'), '-Since', 'HEAD']);
  expect(o.pct).toBe('UNKNOWN');
  expect(o.not_proven).toMatch(/not found/i);
});

test('AC-2: malformed JSON => UNKNOWN', () => {
  const p = writeManifest('{ not valid json');
  expect(gen(['-ManifestPath', p, '-Since', 'HEAD']).pct).toBe('UNKNOWN');
});

test('AC-2: wrong schema => UNKNOWN', () => {
  const p = writeManifest({ schema: 'something-else/v1', slices: [slice('a', false)] });
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.pct).toBe('UNKNOWN');
  expect(o.not_proven).toMatch(/schema/i);
});

test('AC-2: empty slices => UNKNOWN', () => {
  const p = writeManifest(validManifest([]));
  expect(gen(['-ManifestPath', p, '-Since', 'HEAD']).pct).toBe('UNKNOWN');
});

test('AC-2: slices as a string (not an array) => UNKNOWN, not a fabricated 0%', () => {
  const p = writeManifest({ schema: 'phase-manifest/v1', phase: { name: 'X' }, slices: 'oops' });
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.pct).toBe('UNKNOWN');
  expect(o.not_proven).toMatch(/must be a json array/i);
});

test('AC-2: an array containing a non-object slice => UNKNOWN ("malformed")', () => {
  const p = writeManifest({ schema: 'phase-manifest/v1', phase: { name: 'X' }, slices: ['oops', { id: 'a', done: false, evidence: '' }] });
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.pct).toBe('UNKNOWN');
  expect(o.not_proven).toMatch(/malformed/i);
});

test('AC-2: slices as a single object (not an array) => UNKNOWN, not a phantom 1-slice count', () => {
  const p = writeManifest('{ "schema": "phase-manifest/v1", "phase": { "name": "X" }, "slices": { "id": "a", "done": false, "evidence": "" } }');
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.pct).toBe('UNKNOWN');
  expect(o.not_proven).toMatch(/must be a json array/i);
});

test('AC-2: a non-boolean "done" (JSON string) => UNKNOWN (never truthy-cast into a count)', () => {
  // Raw JSON so `done` stays the STRING "false" (any non-empty string casts to $true in PowerShell).
  const p = writeManifest('{ "schema": "phase-manifest/v1", "phase": { "name": "X" }, "slices": [ { "id": "a", "done": "false", "evidence": "PR #1" } ] }');
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.pct).toBe('UNKNOWN');
  expect(o.not_proven).toMatch(/non-boolean/i);
});

// AC-3: done requires evidence, and the generator names the offender
test('AC-3: a slice marked done WITHOUT evidence => UNKNOWN and names the slice', () => {
  const p = writeManifest(validManifest([slice('good', true, 'PR #1'), slice('sneaky', true, '')]));
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.pct).toBe('UNKNOWN');
  expect(o.not_proven).toMatch(/sneaky/);
});

// AC-4: the fixed block set
test('AC-4: emits exactly the six fixed blocks in order, header carries pct (done/total)', () => {
  const p = writeManifest(validManifest([slice('a', true, 'x'), slice('b', false)]));
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.block_order).toEqual(['header', 'what_just_happened', 'where_it_fits', 'why_its_better', 'principles_check', 'needs_you']);
  expect(o.text).toContain('What just happened');
  expect(o.text).toContain('Where it fits');
  expect(o.text).toContain("Why it's better");
  expect(o.text).toContain('Principles check');
  expect(o.text).toContain('Needs you');
  expect(o.text).toContain('50% complete** (1/2 slices)');
});

// AC-5: judgment slots surfaced as explicit placeholders
test('AC-5: unfilled judgment slots are explicit <<fill: ...>> placeholders', () => {
  const p = writeManifest(validManifest([slice('a', false)]));
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.text).toContain('<<fill:');
});

// AC-6: git context, non-blocking
test('AC-6: valid ref => git context present', () => {
  const p = writeManifest(validManifest([slice('a', false)]));
  const o = gen(['-ManifestPath', p, '-Since', 'HEAD']);
  expect(o.git.available).toBe(true);
  expect(typeof o.git.changed_files).toBe('number');
});

test('AC-6: bogus ref => context unavailable but blocks still emitted', () => {
  const p = writeManifest(validManifest([slice('a', false)]));
  const o = gen(['-ManifestPath', p, '-Since', 'zzz-no-such-ref-9999']);
  expect(o.git.available).toBe(false);
  expect(o.text).toContain('What just happened'); // blocks still emitted
  // the reason must actually render in the text (guards the $gitReason_ interpolation bug)
  expect(o.text).toMatch(/git context unavailable:\s+ref 'zzz-no-such-ref-9999'/);
});
