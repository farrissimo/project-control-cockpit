// ADR-format contract (change-governance & decisions audit). check-adr.ps1 is a T0 (trust-root,
// stakes-manifest) file that gates EVERY commit (.githooks/pre-commit) and CI (ci.yml) — yet it had
// NO automated test, while every peer governance script (governance-gate, classify-stakes,
// verification-trailer) is pinned. ADR-0000 claims the validator was "proven to BITE" via a one-time
// manual malformed-ADR demo that was never regression-locked — the exact self-certified-not-tested
// anti-pattern PCC exists to kill. This encodes that proof durably: a future edit that silently breaks
// the validator (so a malformed decision record slips through the gate) now fails the suite.
//
// check-adr.ps1 reads `docs/adr/*.md` relative to cwd, so we run the REAL script against a temp repo
// seeded with synthetic ADR fixtures — never the live docs/adr. Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-adr.ps1');

// A minimal ADR that passes every check: valid front matter (status+date), an ADR-NNNN title,
// and all five required section headers (incl. the two PCC-specific ones: Confirmation, Engagement).
const VALID_ADR = `---
status: Accepted
date: 2026-07-16
---

# ADR-0001: A well-formed test decision

## Context and Problem
Body.

## Decision
Body.

## Consequences
Body.

## Confirmation
Body.

## Engagement
Body.
`;

function makeRepo(adrByName) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-adr-'));
  const adrDir = path.join(dir, 'docs', 'adr');
  fs.mkdirSync(adrDir, { recursive: true });
  for (const [name, text] of Object.entries(adrByName)) {
    fs.writeFileSync(path.join(adrDir, name), text);
  }
  return dir;
}
function run(cwd) {
  return spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT],
    { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true });
}

test('PASS + exit 0 for a well-formed ADR', () => {
  const dir = makeRepo({ '0001-valid.md': VALID_ADR });
  const r = run(dir);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  expect(r.stdout).toMatch(/\[PASS\].*0001-valid\.md/);
  expect(r.stdout).not.toContain('[FAIL]');
  fs.rmSync(dir, { recursive: true, force: true });
});

// The load-bearing guarantee: the validator must actually BITE on each defect class.
test('FAIL + exit 1 when YAML front matter is missing', () => {
  const dir = makeRepo({ '0001-bad.md': VALID_ADR.replace(/^---[\s\S]*?---\n\n/, '') });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*front matter/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FAIL + exit 1 on an invalid status', () => {
  const dir = makeRepo({ '0001-bad.md': VALID_ADR.replace('status: Accepted', 'status: Vibes') });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*invalid status/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FAIL + exit 1 when the date is missing', () => {
  const dir = makeRepo({ '0001-bad.md': VALID_ADR.replace(/date: \d{4}-\d{2}-\d{2}\n/, '') });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*date/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FAIL + exit 1 when the ADR-NNNN title is missing', () => {
  const dir = makeRepo({ '0001-bad.md': VALID_ADR.replace('# ADR-0001: A well-formed test decision', '# Some decision') });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*ADR-NNNN.*heading/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// The two PCC-specific pillars (Confirmation/Engagement) are mandatory — dropping one must FAIL.
test('FAIL + exit 1 when a required section (Confirmation) is missing', () => {
  const dir = makeRepo({ '0001-bad.md': VALID_ADR.replace('## Confirmation\nBody.\n\n', '') });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*Confirmation/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// One bad ADR in a set fails the whole batch (exit 1) — the gate can't be diluted by a valid sibling.
test('one malformed ADR fails the batch even beside a valid one', () => {
  const dir = makeRepo({
    '0001-valid.md': VALID_ADR,
    '0002-bad.md': VALID_ADR.replace('## Decision\nBody.\n\n', ''),
  });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[PASS\].*0001-valid\.md/);
  expect(r.stdout).toMatch(/\[FAIL\].*0002-bad\.md/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// Pin the DELIBERATE "validate-if-present" boundary (disclosed in the audit grid): an empty docs/adr
// PASSes — the validator checks the ADRs that exist, it does not REQUIRE that a change wrote one.
// Encoding it makes the boundary intentional + known, so a future change to it is a conscious decision.
test('empty docs/adr PASSes (validate-if-present is the documented, accepted boundary)', () => {
  const dir = makeRepo({});
  const r = run(dir);
  expect(r.status).toBe(0);
  expect(r.stdout).toMatch(/nothing to validate/);
  fs.rmSync(dir, { recursive: true, force: true });
});
