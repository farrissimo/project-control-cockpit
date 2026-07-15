// Governor slice 1 (ADR-0006): the stakes classifier decides a change's tier from WHICH
// files it touches (a git fact) against the declared manifest — not an LLM's self-rating.
// These run the script exactly as the app/gate will (pwsh -File ... -Json) and assert the
// contract. Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function classify(args) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/classify-stakes.ps1', '-Json', ...args],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  const out = (r.stdout || '').trim();
  try { return JSON.parse(out); } catch (e) { throw new Error('non-JSON output:\n' + out + '\n' + (r.stderr || '')); }
}

test('valid JSON contract shape', () => {
  const o = classify(['-Files', 'app/state/atomic-store.js']);
  expect(o.schema).toBe('stakes-classification/v1');
  expect(typeof o.tier).toBe('string');
  expect(Array.isArray(o.reasons)).toBe(true);
  expect(Array.isArray(o.files)).toBe(true);
  expect(Array.isArray(o.escalations)).toBe(true);
  expect(typeof o.not_proven).toBe('string');
});

test('T0 integrity floor: the durable-write primitive', () => {
  expect(classify(['-Files', 'app/state/atomic-store.js']).tier).toBe('T0');
});
test('T0: execution authority', () => {
  expect(classify(['-Files', 'app/authority-store.js']).tier).toBe('T0');
});
test('T2: an auto-loaded agent-instruction doc', () => {
  expect(classify(['-Files', 'AGENTS.md']).tier).toBe('T2');
});
test('T3: an ordinary product module (the default tier)', () => {
  expect(classify(['-Files', 'app/chat-summary.js']).tier).toBe('T3');
});
test('T4: noise (backlog / proposals) can sit BELOW the default', () => {
  expect(classify(['-Files', 'backlog/IDEAS.md']).tier).toBe('T4');
  expect(classify(['-Files', 'docs/proposals/x.md']).tier).toBe('T4');
});

test('mixed change takes the HIGHEST tier among its files', () => {
  expect(classify(['-Files', 'backlog/IDEAS.md,app/authority-logic.js']).tier).toBe('T0');
});

test('an unknown NEW file is the default tier, never noise', () => {
  const o = classify(['-Added', 'some/brand/new/thing.xyz']);
  expect(o.tier).toBe('T3');
});

test('a deletion escalates to at least T1', () => {
  const o = classify(['-Deleted', 'README.md']);
  expect(o.tier).toBe('T1');
  expect(o.escalations.some((e) => e.id === 'delete_or_rename')).toBe(true);
});
test('a schema change escalates to at least T1', () => {
  const o = classify(['-Files', 'schemas/handoff-packet.schema.json']);
  expect(o.escalations.some((e) => e.id === 'schema_change')).toBe(true);
  expect(['T0', 'T1']).toContain(o.tier);
});
test('the governed entity cannot quietly downgrade its own governor (self-edit -> T0)', () => {
  const o = classify(['-Files', '.cockpit/state/stakes-manifest.json']);
  expect(o.tier).toBe('T0');
  expect(o.escalations.some((e) => e.id === 'governor_self_edit')).toBe(true);
});
test('CI/hooks changes escalate to T0', () => {
  expect(classify(['-Files', '.github/workflows/ci.yml']).tier).toBe('T0');
});

// Fail closed: with no manifest present, classification is UNKNOWN — never a low tier.
test('missing manifest -> UNKNOWN (fail closed)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-stakes-'));
  try {
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'classify-stakes.ps1'), path.join(tmp, 'scripts', 'classify-stakes.ps1'));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/classify-stakes.ps1', '-Json', '-Files', 'app/state/atomic-store.js'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const o = JSON.parse((r.stdout || '').trim());
    expect(o.tier, 'no manifest must be UNKNOWN, not a low tier:\n' + r.stdout).toBe('UNKNOWN');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
