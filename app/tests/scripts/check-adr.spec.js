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

// ---------------------------------------------------------------------------
// ADR-0027: feature ADRs must carry an Expected-Behavior Map (RTM), and when
// Accepted the map's Definition-of-Done bites. These tests prove the teeth.
// ---------------------------------------------------------------------------

// A feature ADR = same as VALID_ADR but front matter carries `feature: true` and it gains the map.
// `status` and `map` are injected per-scenario so each test exercises one behavior.
function featureAdr({ status = 'Accepted', map }) {
  const front = `---
status: ${status}
date: 2026-07-16
feature: true
---

# ADR-0100: A feature decision

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
  return map == null ? front : front + '\n' + map + '\n';
}
// A well-formed map with one built+tested (A) row — the happy path.
const MAP_A_TESTED = `## Expected-Behavior Map

| behavior | control | expected result | source | status | test |
|---|---|---|---|---|---|
| switch chat while busy | chat tab | loads the other chat | STATED chat-abc | A | switch-chat.spec.js |`;

test('feature ADR PASSES when it carries a well-formed Expected-Behavior Map', () => {
  const dir = makeRepo({ '0100-feature.md': featureAdr({ status: 'Accepted', map: MAP_A_TESTED }) });
  const r = run(dir);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  expect(r.stdout).toMatch(/\[PASS\].*0100-feature\.md/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FAIL when a feature ADR has NO Expected-Behavior Map section', () => {
  const dir = makeRepo({ '0100-feature.md': featureAdr({ status: 'Proposed', map: null }) });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*Expected-Behavior Map/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FAIL when the Expected-Behavior Map section has no behavior rows', () => {
  const emptyMap = `## Expected-Behavior Map\n\n(to be filled in)`;
  const dir = makeRepo({ '0100-feature.md': featureAdr({ status: 'Proposed', map: emptyMap }) });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*no behavior rows/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// The Definition-of-Done tooth: a PROPOSED feature ADR may legitimately still have untested (C)
// behaviors mid-build — that must PASS (work in progress is not a violation).
test('PASS: a Proposed feature ADR may carry a built-but-untested (C) behavior', () => {
  const mapC = `## Expected-Behavior Map

| behavior | control | expected result | source | status | test |
|---|---|---|---|---|---|
| switch chat while busy | chat tab | loads the other chat | STATED chat-abc | C | — |`;
  const dir = makeRepo({ '0100-feature.md': featureAdr({ status: 'Proposed', map: mapC }) });
  const r = run(dir);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ...but the SAME map at Accepted (= claimed done) must FAIL: done means every behavior tested.
test('FAIL: an Accepted feature ADR with a built-but-untested (C) behavior violates Definition of Done', () => {
  const mapC = `## Expected-Behavior Map

| behavior | control | expected result | source | status | test |
|---|---|---|---|---|---|
| switch chat while busy | chat tab | loads the other chat | STATED chat-abc | C | — |`;
  const dir = makeRepo({ '0100-feature.md': featureAdr({ status: 'Accepted', map: mapC }) });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*(status C|Definition of Done)/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// A built behavior (A/B) at Accepted with an empty test reference also fails DoD.
test('FAIL: an Accepted feature ADR with a built (A) behavior and no test reference violates DoD', () => {
  const mapNoTest = `## Expected-Behavior Map

| behavior | control | expected result | source | status | test |
|---|---|---|---|---|---|
| switch chat while busy | chat tab | loads the other chat | STATED chat-abc | A | — |`;
  const dir = makeRepo({ '0100-feature.md': featureAdr({ status: 'Accepted', map: mapNoTest }) });
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*(no test reference|Definition of Done)/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// The B class (built+tested but NARROWER than expected — the #2/#3 defect class) is NOT machine-blocked
// when it names a test: it's a real, honestly-recorded state that the human/verifier weighs. Pin that so
// the map can express the very class it exists to surface without the gate rejecting it.
test('PASS: an Accepted feature ADR may record a class-B (narrower-than-expected) behavior that names a test', () => {
  const mapB = `## Expected-Behavior Map

| behavior | control | expected result | source | status | test |
|---|---|---|---|---|---|
| search jumps to match | search box | scrolls to the hit | REFERENCE claude-desktop | B | search.spec.js |`;
  const dir = makeRepo({ '0100-feature.md': featureAdr({ status: 'Accepted', map: mapB }) });
  const r = run(dir);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  fs.rmSync(dir, { recursive: true, force: true });
});

// Backward-compatibility guard: a NON-feature ADR (no `feature: true`) needs no map — the whole
// existing corpus (ADR-0000..0026) must keep passing. This is the promise that the tooth is additive.
test('PASS: a non-feature ADR needs no Expected-Behavior Map (backward compatible)', () => {
  const dir = makeRepo({ '0001-valid.md': VALID_ADR });
  const r = run(dir);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  expect(r.stdout).not.toContain('Expected-Behavior Map');
  fs.rmSync(dir, { recursive: true, force: true });
});
