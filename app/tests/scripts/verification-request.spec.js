// Verification-request generator (comms spec channels 3 & 4 / ADR-0009 category 1). Assembles the two
// fixed verification-request copy blocks (Codex independent request; GPT secondary block) with computed
// facts (review target, remote URL, pushed state) and leaves only judgment slots for the LLM. These run
// the script exactly as used (pwsh -File ... -Json). Pure CLI, no Electron.
// Spec: docs/specs/verification-request-generator.md.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function gen(args) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/new-verification-request.ps1', '-Json', ...args],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  const out = (r.stdout || '').trim();
  try { return JSON.parse(out); } catch (e) { throw new Error('non-JSON output:\n' + out + '\n' + (r.stderr || '')); }
}

// AC-1: codex request shape
test('AC-1: codex channel emits read-only role, review target, verdict shape, piped run line', () => {
  const o = gen(['-Channel', 'codex']);
  expect(o.channel).toBe('codex');
  expect(o.text).toMatch(/independent verifier/i);
  expect(o.text).toContain('git diff --cached main');
  expect(o.text).toMatch(/do NOT run/i);
  expect(o.text).toContain('VERDICT: PASS | FAIL | INSUFFICIENT | BLOCKED | OUT_OF_SCOPE');
  expect(o.text).toContain('NOT PROVEN:');
  expect(o.run_line).toContain('< /dev/null');
});

// AC-2: codex base override
test('AC-2: codex channel uses -Base for the review target', () => {
  const o = gen(['-Channel', 'codex', '-Base', 'origin/main']);
  expect(o.text).toContain('git diff --cached origin/main');
});

// AC-3: gpt request shape
test('AC-3: gpt channel emits computed remote URL, HEAD ref, verdict shape', () => {
  const o = gen(['-Channel', 'gpt', '-TriggerReason', 'touches T0 governance']);
  expect(o.channel).toBe('gpt');
  expect(o.text).toContain('https://github.com/'); // computed from origin
  expect(o.text).toMatch(/COMMIT:/);
  expect(o.text).toContain('VERDICT: PASS | FAIL | INSUFFICIENT | BLOCKED | OUT_OF_SCOPE');
});

// AC-5: gpt trigger discipline
test('AC-5: gpt without -TriggerReason warns the trigger must be stated', () => {
  const o = gen(['-Channel', 'gpt']);
  expect(o.warnings.join(' ')).toMatch(/trigger/i);
  expect(o.text).toContain('<<fill:'); // trigger fill slot present
});

test('AC-5: gpt with -TriggerReason includes it and does not warn about the trigger', () => {
  const o = gen(['-Channel', 'gpt', '-TriggerReason', 'condition (2): changes evidence standard']);
  expect(o.text).toContain('condition (2): changes evidence standard');
  expect(o.warnings.join(' ')).not.toMatch(/trigger/i);
});

// AC-6: judgment slots surfaced
test('AC-6: omitted Context/Judge become explicit <<fill: ...>> placeholders (codex)', () => {
  const o = gen(['-Channel', 'codex']);
  expect(o.text).toContain('<<fill:');
});

test('AC-6: provided Context/Judge are used verbatim (codex)', () => {
  const o = gen(['-Channel', 'codex', '-Context', 'ADDS_THE_THING', '-Judge', 'JUDGE_THE_THING']);
  expect(o.text).toContain('ADDS_THE_THING');
  expect(o.text).toContain('JUDGE_THE_THING');
  expect(o.text).not.toContain('<<fill:'); // both slots filled
});

// contract shape
test('JSON contract shape', () => {
  const o = gen(['-Channel', 'codex']);
  expect(o.schema).toBe('verification-request/v1');
  expect(Array.isArray(o.warnings)).toBe(true);
  expect(typeof o.text).toBe('string');
});

// invalid channel is rejected by ValidateSet (non-zero / no JSON)
test('an invalid channel is rejected (ValidateSet)', () => {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/new-verification-request.ps1', '-Json', '-Channel', 'bogus'],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  expect((r.stdout || '').trim()).not.toContain('"schema": "verification-request/v1"');
});
