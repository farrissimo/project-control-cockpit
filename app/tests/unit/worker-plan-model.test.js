// Live Worker Feed slice 1 — the pure plan-step model (ADR-0011 / docs/specs/owner-cockpit.md).
// Proves the honesty spine the later live UI will render on: activity is never proof, out-of-plan
// is a dominant hard stop, no plan means "no plan to compare" (never a fake "on plan"), and quiet
// is never called "stuck". No Electron, no worker spawn — pure logic under node:test.
const { test } = require('node:test');
const assert = require('node:assert');
const { deriveState } = require('../../worker-plan-model.js');

function plan() {
  return {
    steps: [
      { id: 'read',   label: 'Read the approved files', kind: 'read',   allow: ['auth-flow.md', 'auth-flow.js', 'app-routes.js'], required: 3 },
      { id: 'edit',   label: 'Change only the agreed files', kind: 'edit', allow: ['auth-flow.js', 'app-routes.js', 'auth-flow.test.js'], required: 3 },
      { id: 'checks', label: 'Run the checks', kind: 'checks', required: 1 },
      { id: 'second', label: 'Get a second-AI review', kind: 'verify', required: 1 },
      { id: 'done',   label: 'Done — after proof', kind: 'done', required: 1 },
    ],
    forbidden: ['authority-tool-profile.js'],
  };
}
const ev = (kind, x) => Object.assign({ kind, at: 0 }, x || {});
const reads3 = [ev('read', { file: 'auth-flow.md' }), ev('read', { file: 'auth-flow.js' }), ev('read', { file: 'app-routes.js' })];
const edits3 = [ev('edit', { file: 'auth-flow.js' }), ev('edit', { file: 'app-routes.js' }), ev('edit', { file: 'auth-flow.test.js' })];

// --- no-plan boundary (AC-22) ---
test('no plan => "no plan to compare", never on-plan, but still shows what it is doing', () => {
  const s = deriveState(null, [ev('edit', { file: 'x.js' })], 1000);
  assert.strictEqual(s.hasPlan, false);
  assert.strictEqual(s.status, 'no_plan');
  assert.ok(/no plan to compare/i.test(s.message));
  assert.notStrictEqual(s.status, 'on_plan');
  assert.strictEqual(s.actualNow.label, 'Changing a file'); // what, not whether-allowed
});

// --- current/done/next + progress (AC-17) ---
test('reading advances the read step and reports progress', () => {
  const s = deriveState(plan(), reads3.slice(0, 2), 100);
  assert.strictEqual(s.currentStepId, 'read');
  assert.deepStrictEqual(s.steps[0].progress, { done: 2, total: 3 });
  assert.strictEqual(s.status, 'on_plan');
});

test('once the read step is satisfied the current step advances to edit', () => {
  const s = deriveState(plan(), reads3, 100);
  assert.strictEqual(s.currentStepId, 'edit');
  assert.deepStrictEqual(s.doneStepIds, ['read']);
  assert.strictEqual(s.nextStepId, 'checks');
  assert.strictEqual(s.steps[0].state, 'done');
  assert.strictEqual(s.steps[1].state, 'current');
  assert.strictEqual(s.steps[2].state, 'upcoming');
});

test('editing an allowed file is on plan and exposes the allowed list', () => {
  const s = deriveState(plan(), reads3.concat([ev('edit', { file: 'app-routes.js' })]), 100);
  assert.strictEqual(s.currentStepId, 'edit');
  assert.strictEqual(s.status, 'on_plan');
  assert.deepStrictEqual(s.allowedNow, ['auth-flow.js', 'app-routes.js', 'auth-flow.test.js']);
  assert.ok(/allowed does not mean done or proven/i.test(s.message));
});

// --- hard stop dominates (AC-18) ---
test('editing a forbidden file is a hard stop that dominates', () => {
  const s = deriveState(plan(), [ev('edit', { file: 'authority-tool-profile.js' })], 100);
  assert.strictEqual(s.status, 'hard_stop');
  assert.strictEqual(s.problem.tier, 'hard');
  assert.strictEqual(s.problem.reason, 'forbidden_file');
  assert.strictEqual(s.problem.happened, 'authority-tool-profile.js');
  assert.ok(s.message.startsWith('STOP'));
});

test('editing a file outside every allowed list is a hard stop (outside plan)', () => {
  const s = deriveState(plan(), reads3.concat([ev('edit', { file: 'secrets.js' })]), 100);
  assert.strictEqual(s.status, 'hard_stop');
  assert.strictEqual(s.problem.reason, 'outside_plan');
});

test('a denied command is a hard stop', () => {
  const s = deriveState(plan(), [ev('denied', { name: 'rm -rf' })], 100);
  assert.strictEqual(s.status, 'hard_stop');
  assert.strictEqual(s.problem.reason, 'command_denied');
});

// --- activity is not proof (AC-20) ---
test('a "run" does NOT satisfy the checks step — running is not passing', () => {
  const s = deriveState(plan(), reads3.concat(edits3, [ev('run', { name: 'npm test' })]), 100);
  assert.strictEqual(s.currentStepId, 'checks');       // still on checks, not advanced
  assert.notStrictEqual(s.status, 'done');
  assert.strictEqual(s.steps[2].state, 'current');
  assert.deepStrictEqual(s.steps[2].progress, { done: 0, total: 1 });
});

test('a check with result "pass" satisfies the checks step', () => {
  const s = deriveState(plan(), reads3.concat(edits3, [ev('check', { result: 'pass' })]), 100);
  assert.ok(s.doneStepIds.includes('checks'));
  assert.strictEqual(s.currentStepId, 'second');
});

test('"claimed done" without proof is a soft warning, never done', () => {
  const s = deriveState(plan(), reads3.concat(edits3, [ev('claim_done')]), 100);
  assert.strictEqual(s.status, 'soft_warning');
  assert.strictEqual(s.problem.reason, 'claimed_not_proven');
  assert.ok(/claimed done/i.test(s.message));
  assert.ok(!s.doneStepIds.includes('done'));
});

test('done only when checks AND independent review both pass', () => {
  const s = deriveState(plan(), reads3.concat(edits3, [ev('check', { result: 'pass' }), ev('verify', { result: 'pass' })]), 100);
  assert.strictEqual(s.status, 'done');
  assert.ok(/ready/i.test(s.message));
  assert.ok(s.doneStepIds.includes('done'));
});

// --- quiet is never "stuck" (AC-14) ---
test('long silence with the process alive reads "looks quiet", never "stuck"', () => {
  const s = deriveState(plan(), reads3.concat([ev('edit', { file: 'auth-flow.js', at: 0 })]), 60 * 1000);
  assert.strictEqual(s.status, 'quiet');
  assert.ok(/quiet/i.test(s.message));
  assert.ok(!/stuck/i.test(s.message));
});

test('a known long-running command suppresses the quiet banner', () => {
  const s = deriveState(plan(), reads3.concat([ev('edit', { file: 'auth-flow.js', at: 0 })]), 60 * 1000, { longRunning: true });
  assert.strictEqual(s.status, 'on_plan');
});

test('silence with a dead process is a soft "may have stopped" — still not "stuck"', () => {
  const s = deriveState(plan(), reads3.concat([ev('edit', { file: 'auth-flow.js', at: 0 })]), 60 * 1000, { processAlive: false });
  assert.strictEqual(s.status, 'soft_warning');
  assert.strictEqual(s.problem.reason, 'stopped');
  assert.ok(!/stuck/i.test(s.message));
});

// --- sequencing: doing a later step early (AC-24) ---
test('editing an allowed file BEFORE the read step is satisfied is a soft sequencing warning, not on plan', () => {
  const s = deriveState(plan(), [ev('read', { file: 'auth-flow.md' }), ev('edit', { file: 'auth-flow.js' })], 100);
  assert.strictEqual(s.status, 'soft_warning');
  assert.strictEqual(s.problem.reason, 'out_of_sequence');
  assert.notStrictEqual(s.status, 'on_plan');
  assert.ok(/later step early/i.test(s.message));
  assert.strictEqual(s.currentStepId, 'read'); // still on the read step
});

// --- repeated step (AC-22 advisory) + waiting ---
test('repeating the same action with no progress is a soft warning', () => {
  // reads done first so the edits are on the CURRENT step (not out-of-sequence), isolating "repeating".
  const s = deriveState(plan(), reads3.concat([ev('edit', { file: 'auth-flow.js' }), ev('edit', { file: 'auth-flow.js' }), ev('edit', { file: 'auth-flow.js' })]), 100);
  assert.strictEqual(s.status, 'soft_warning');
  assert.strictEqual(s.problem.reason, 'repeating');
});

test('a plan with no events yet is waiting, not on-plan', () => {
  const s = deriveState(plan(), [], 100);
  assert.strictEqual(s.status, 'waiting');
  assert.strictEqual(s.actualNow, null);
  assert.ok(/waiting/i.test(s.message));
});
