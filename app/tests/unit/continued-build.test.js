// continued-build unit tests (ADR-0021, Task 1.1). Proves the guard that decides whether
// "Continue in fresh chat" carries a build re-approval forward — the exact edge cases Codex
// flagged: only an ACTIVELY authorized source carries; expired/read_only/approval_needed never do
// (no silent inheritance). Pure; no DOM/electron.
const { test } = require('node:test');
const assert = require('node:assert');
const { planContinuedBuild } = require('../../renderer/continued-build.js');

test('an actively-authorized source offers a carried re-approval with its job name', () => {
  const r = planContinuedBuild({ mode: 'authorized_running', job: { name: 'Land Evaluator' } });
  assert.strictEqual(r.offer, true);
  assert.strictEqual(r.name, 'Land Evaluator');
});

test('a read_only source carries nothing (no silent inheritance)', () => {
  assert.deepStrictEqual(planContinuedBuild({ mode: 'read_only', job: null }), { offer: false, name: null });
});

test('an approval_needed (pending, not yet approved) source carries nothing', () => {
  assert.deepStrictEqual(planContinuedBuild({ mode: 'approval_needed', job: { name: 'X' } }), { offer: false, name: null });
});

test('an expired/absent source (null snapshot) carries nothing', () => {
  assert.deepStrictEqual(planContinuedBuild(null), { offer: false, name: null });
  assert.deepStrictEqual(planContinuedBuild(undefined), { offer: false, name: null });
  assert.deepStrictEqual(planContinuedBuild({}), { offer: false, name: null });
});

test('an authorized source with a missing/blank job name falls back to a safe label', () => {
  assert.strictEqual(planContinuedBuild({ mode: 'authorized_running', job: null }).name, 'this chat');
  assert.strictEqual(planContinuedBuild({ mode: 'authorized_running', job: { name: '   ' } }).name, 'this chat');
});
