// decideAutoContinue (ADR-0026) — pure decision for running APPROVED work to completion past the
// native --max-turns cap. Proves the gate is fail-closed: only max_turns qualifies, only build-
// authorized attachment-free turns; it allows REPEATED continues under all backstops, and denies at
// each backstop independently (cumulative turns, whole-run wall clock, and the no-substantive-progress
// guard). No dollar value ever forces a stop. No I/O, no Electron, zero plan usage.
const { test } = require('node:test');
const assert = require('node:assert');
const { decideAutoContinue, DEFAULTS } = require('../../auto-continue.js');

// A base input that WOULD allow: max_turns stop of build-authorized text work, well under every ceiling.
const base = () => ({
  kind: 'max_turns', buildAuthorized: true, hasAttachments: false,
  cumulativeTurns: 30, elapsedMs: 1000, noProgressStreak: 0, perMessageMaxTurns: 30,
});

test('allow: max_turns, build-authorized, no attachments, ceilings ok -> resumeMaxTurns is a full per-message chunk (30)', () => {
  const d = decideAutoContinue(base());
  assert.equal(d.allow, true); assert.equal(d.reason, 'ok');
  // maxChatTurns 200, 30 spent -> min(30, 170) = 30 (a normal chunk, not the ADR-0023 lowered 15)
  assert.equal(d.resumeMaxTurns, 30);
});

test('run-to-completion: it allows MANY continues, not just one (no auto-continue-count ceiling)', () => {
  // Same conditions, deep into a long approved build — still allowed as long as backstops permit.
  for (const spent of [30, 60, 90, 120, 150, 180]) {
    const d = decideAutoContinue(Object.assign(base(), { cumulativeTurns: spent }));
    assert.equal(d.allow, true, 'cumulativeTurns ' + spent + ' should still allow');
  }
});

test('deny every non-max_turns kind', () => {
  for (const kind of ['budget', 'error', 'malformed', 'success', undefined]) {
    const d = decideAutoContinue(Object.assign(base(), { kind }));
    assert.equal(d.allow, false, 'kind ' + kind + ' must deny'); assert.equal(d.reason, 'not-max-turns');
    assert.equal(d.resumeMaxTurns, 0);
  }
});

test('deny when the chat is not build-authorized (read-only hard-stops)', () => {
  const d = decideAutoContinue(Object.assign(base(), { buildAuthorized: false }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'not-build-authorized');
});

test('deny when the turn carried attachments (warm text-only slice)', () => {
  const d = decideAutoContinue(Object.assign(base(), { hasAttachments: true }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'has-attachments');
});

test('backstop: deny when the cumulative-turn cap is reached (>= 200 at the default)', () => {
  const d = decideAutoContinue(Object.assign(base(), { cumulativeTurns: 200 }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'cumulative-turn-cap-reached');
});

test('backstop: deny when the whole-run wall-clock cap is exceeded (> 30 min)', () => {
  const d = decideAutoContinue(Object.assign(base(), { elapsedMs: DEFAULTS.wallClockCapMs + 1 }));
  assert.equal(d.allow, false); assert.equal(d.reason, 'wall-clock-cap-exceeded');
});

test('guard: deny after N consecutive no-substantive-progress segments (default N=2)', () => {
  const stalled = decideAutoContinue(Object.assign(base(), { noProgressStreak: 2 }));
  assert.equal(stalled.allow, false); assert.equal(stalled.reason, 'no-substantive-progress');
  // one stale segment is NOT enough — it still gets another chance to finish.
  const oneStale = decideAutoContinue(Object.assign(base(), { noProgressStreak: 1 }));
  assert.equal(oneStale.allow, true);
});

test('no dollar value ever forces a stop (dollars are advisory — ADR-0022): a huge cost input is ignored', () => {
  // There is no cost/usd field in the decision at all; passing one must not change the verdict.
  const d = decideAutoContinue(Object.assign(base(), { costUsd: 9999, cumulativeCost: 9999 }));
  assert.equal(d.allow, true); assert.equal(d.reason, 'ok');
});

test('resumeMaxTurns is clamped by the remaining cumulative budget, never below 1', () => {
  // 199 of 200 cumulative turns used -> only 1 turn of budget remains.
  const d = decideAutoContinue(Object.assign(base(), { cumulativeTurns: 199 }));
  assert.equal(d.allow, true); assert.equal(d.resumeMaxTurns, 1);
});

test('fails closed to a 30-turn per-message default when perMessageMaxTurns is missing/invalid', () => {
  const d = decideAutoContinue(Object.assign(base(), { perMessageMaxTurns: undefined }));
  assert.equal(d.allow, true); assert.equal(d.resumeMaxTurns, 30); // min(30, 200-30) = 30
});

test('maxChatTurns can be overridden (config injection from usage-limits.json)', () => {
  // A low cumulative cap of 40 with 30 already spent -> allow, resume clamped to the remaining 10.
  const d = decideAutoContinue(Object.assign(base(), { ceilings: { maxChatTurns: 40 } }));
  assert.equal(d.allow, true); assert.equal(d.resumeMaxTurns, 10);
  // and at/over that injected cap it denies.
  const d2 = decideAutoContinue(Object.assign(base(), { cumulativeTurns: 40, ceilings: { maxChatTurns: 40 } }));
  assert.equal(d2.allow, false); assert.equal(d2.reason, 'cumulative-turn-cap-reached');
});

test('an invalid injected maxChatTurns fails closed to the safe default (never "no cap")', () => {
  // 0 / negative / non-numeric must not disable the cap; it falls back to DEFAULTS.maxChatTurns (200).
  for (const bad of [0, -5, 'lots', null]) {
    const d = decideAutoContinue(Object.assign(base(), { cumulativeTurns: 200, ceilings: { maxChatTurns: bad } }));
    assert.equal(d.allow, false, 'bad cap ' + bad + ' must still enforce the 200 default');
    assert.equal(d.reason, 'cumulative-turn-cap-reached');
  }
});
