// decideAutoContinue (ADR-0023 / Task 1.2) — pure decision for auto-continuing approved work ONCE
// past the native --max-turns cap. Proves the gate is fail-closed: only max_turns qualifies, only
// build-authorized attachment-free turns, and every ceiling (one continue, cumulative turns, wall
// clock) denies. No I/O, no Electron, zero plan usage.
const { test } = require('node:test');
const assert = require('node:assert');
const { decideAutoContinue, DEFAULTS } = require('../../auto-continue.js');

// A base input that WOULD allow (default 30-turn config, first stop at 30 cumulative turns).
const base = () => ({
  kind: 'max_turns', buildAuthorized: true, hasAttachments: false,
  autoContinuesSoFar: 0, cumulativeTurns: 30, elapsedMs: 1000, perMessageMaxTurns: 30,
});

test('AC-1/AC-3 allow: max_turns, build-authorized, no attachments, ceilings ok -> resumeMaxTurns 15 (30 -> 45)', () => {
  const d = decideAutoContinue(base());
  assert.equal(d.allow, true); assert.equal(d.reason, 'ok'); assert.equal(d.resumeMaxTurns, 15);
});

test('AC-5 deny every non-max_turns kind', () => {
  for (const kind of ['budget', 'error', 'malformed', 'success', undefined]) {
    const d = decideAutoContinue(Object.assign(base(), { kind }));
    assert.equal(d.allow, false, 'kind ' + kind + ' must deny'); assert.equal(d.reason, 'not-max-turns');
    assert.equal(d.resumeMaxTurns, 0);
  }
});

test('AC-6 deny when the chat is not build-authorized', () => {
  const d = decideAutoContinue(Object.assign(base(), { buildAuthorized: false }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'not-build-authorized');
});

test('AC-6 deny when the turn carried attachments (warm text-only slice)', () => {
  const d = decideAutoContinue(Object.assign(base(), { hasAttachments: true }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'has-attachments');
});

test('AC-7 deny once one auto-continue has already been used', () => {
  const d = decideAutoContinue(Object.assign(base(), { autoContinuesSoFar: 1 }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'auto-continue-limit-reached');
});

test('AC-7 deny when the cumulative-turn ceiling is reached (>= 45 at the default)', () => {
  const d = decideAutoContinue(Object.assign(base(), { cumulativeTurns: 45 }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'cumulative-turn-cap-reached');
});

test('AC-7 deny when the wall-clock ceiling is exceeded', () => {
  const d = decideAutoContinue(Object.assign(base(), { elapsedMs: DEFAULTS.wallClockCapMs + 1 }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'wall-clock-cap-exceeded');
});

test('resumeMaxTurns is clamped by the remaining cumulative budget, never below 1', () => {
  // 44 of 45 cumulative turns used -> only 1 turn of budget remains.
  const d = decideAutoContinue(Object.assign(base(), { cumulativeTurns: 44 }));
  assert.equal(d.allow, true); assert.equal(d.resumeMaxTurns, 1);
});

test('fails closed to a 30-turn default when perMessageMaxTurns is missing/invalid', () => {
  const d = decideAutoContinue(Object.assign(base(), { perMessageMaxTurns: undefined, cumulativeTurns: 30 }));
  assert.equal(d.allow, true); assert.equal(d.resumeMaxTurns, 15); // cap 45, 30 used -> 15
});

test('ceilings can be overridden (config injection) — maxAutoContinues 0 denies immediately', () => {
  const d = decideAutoContinue(Object.assign(base(), { ceilings: { maxAutoContinues: 0 } }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'auto-continue-limit-reached');
});
