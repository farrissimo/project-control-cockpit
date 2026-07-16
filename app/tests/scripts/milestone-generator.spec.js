// Honesty & anti-fake-green (ADR-0009 audit category) — the phase-progress meter itself.
//
// scripts/new-milestone-update.ps1 computes the "% complete" number that measures the
// CURRENT phase (done slices / total, from .cockpit/state/phase-manifest.json) and feeds
// the owner's trust sign-off. Its whole reason to exist is anti-fake-green: the % must be
// a real count or the honest string "UNKNOWN" — NEVER an invented number and never a silent
// 0. That fail-closed logic was proven only by inspection (zero tests) until this file. A
// regression that counted a done-without-evidence slice, or fell for PowerShell's
// truthy-string trap (the JSON string "false" casts to $true), would ship GREEN and quietly
// inflate the number that gates the owner's trust — the exact disease this phase exists to
// kill, in the tool that measures the phase. These tests pin the contract so it can't return.
//
// The generator takes -ManifestPath (documented "overridable for tests"), so each case just
// points it at a throwaway fixture — no repo copy needed. Run as main.js/CI do: pwsh -File -Json.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..'); // repo root (app/ is one below)
const SCRIPT = path.join(REPO, 'scripts', 'new-milestone-update.ps1');

// Write `content` to a temp manifest file, run the generator against it, return parsed JSON.
// `content` may be a string (written verbatim, for malformed-JSON cases) or an object.
function runManifest(content) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-milestone-'));
  const manifest = path.join(tmp, 'phase-manifest.json');
  try {
    fs.writeFileSync(manifest, typeof content === 'string' ? content : JSON.stringify(content));
    const r = spawnSync('pwsh',
      ['-NoProfile', '-File', SCRIPT, '-Json', '-ManifestPath', manifest],
      { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const stdout = (r.stdout || '').trim();
    let obj;
    expect(() => { obj = JSON.parse(stdout); }, 'generator output was not valid JSON:\n' + stdout + '\n' + r.stderr).not.toThrow();
    return obj;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Run against a path that does not exist (missing-manifest case).
function runMissing() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-milestone-'));
  const manifest = path.join(tmp, 'does-not-exist.json');
  try {
    const r = spawnSync('pwsh',
      ['-NoProfile', '-File', SCRIPT, '-Json', '-ManifestPath', manifest],
      { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
    return JSON.parse((r.stdout || '').trim());
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const valid = (slices) => ({ schema: 'phase-manifest/v1', phase: { name: 'T' }, slices });

// ── The generator ALWAYS exits 0 and ALWAYS emits parseable JSON (read-only, no throw). ──
// Covered implicitly by every runManifest() call parsing the output; asserted once here.
test('generator emits valid JSON and never throws', () => {
  const obj = runManifest(valid([{ id: 'a', done: true, evidence: 'PR #1' }]));
  expect(obj).toHaveProperty('pct');
  expect(obj).toHaveProperty('done');
  expect(obj).toHaveProperty('total');
});

// ── The one HONEST-COUNT case: real percentage from evidence-backed done slices. ──
test('counts only evidence-backed done slices (honest percentage)', () => {
  const obj = runManifest(valid([
    { id: 'a', done: true, evidence: 'PR #1' },   // counts
    { id: 'b', done: true, evidence: 'commit abc' }, // counts
    { id: 'c', done: false, evidence: '' },        // not done
    { id: 'd', done: false, evidence: '' },        // not done
  ]));
  expect(obj.pct).toBe(50);
  expect(obj.done).toBe(2);
  expect(obj.total).toBe(4);
});

// ── The core anti-fake-green defense: done WITHOUT a checkable artifact must NOT count. ──
test('refuses to count a slice marked done with EMPTY evidence -> UNKNOWN', () => {
  const obj = runManifest(valid([{ id: 'a', done: true, evidence: '' }]));
  expect(obj.pct, 'done without evidence must not produce a number').toBe('UNKNOWN');
  expect(obj.not_proven, 'reason must name the offending slice').toContain('a');
});

test('whitespace-only evidence is treated as no evidence -> UNKNOWN', () => {
  const obj = runManifest(valid([{ id: 'a', done: true, evidence: '   ' }]));
  expect(obj.pct).toBe('UNKNOWN');
});

// ── PowerShell truthy-string trap: the JSON string "false" casts to $true. A non-boolean
// `done` must be rejected, never silently counted as done. ──
test('non-boolean done (JSON string "false") -> UNKNOWN, not a fabricated count', () => {
  const obj = runManifest(valid([{ id: 'a', done: 'false', evidence: 'x' }]));
  expect(obj.pct).toBe('UNKNOWN');
});

test('missing done property -> UNKNOWN', () => {
  const obj = runManifest(valid([{ id: 'a', evidence: 'x' }]));
  expect(obj.pct).toBe('UNKNOWN');
});

// ── Structural fabrication traps: a scalar `slices` would cast to a count of 1. ──
test('scalar (string) slices -> UNKNOWN, not a count of 1', () => {
  const obj = runManifest({ schema: 'phase-manifest/v1', phase: { name: 'T' }, slices: 'all done' });
  expect(obj.pct).toBe('UNKNOWN');
});

test('empty slices array -> UNKNOWN (no denominator to invent a % from)', () => {
  const obj = runManifest(valid([]));
  expect(obj.pct).toBe('UNKNOWN');
});

// ── Schema / parse / presence failures all fail closed to UNKNOWN. ──
test('wrong schema version -> UNKNOWN', () => {
  const obj = runManifest({ schema: 'phase-manifest/v2', phase: { name: 'T' }, slices: [{ id: 'a', done: true, evidence: 'x' }] });
  expect(obj.pct).toBe('UNKNOWN');
});

test('malformed JSON -> UNKNOWN (never a silent 0 or a crash)', () => {
  const obj = runManifest('{ not valid json');
  expect(obj.pct).toBe('UNKNOWN');
});

test('missing manifest file -> UNKNOWN', () => {
  const obj = runMissing();
  expect(obj.pct).toBe('UNKNOWN');
});

// ── The rendered owner-facing header must show the honest UNKNOWN, never paint a number. ──
test('rendered header reads "UNKNOWN% complete" (not an invented number) on a bad manifest', () => {
  const obj = runManifest(valid([{ id: 'a', done: true, evidence: '' }]));
  expect(obj.text).toContain('UNKNOWN% complete');
  expect(obj.text).not.toMatch(/\b\d+% complete/); // no digits-percent slipped through
});
