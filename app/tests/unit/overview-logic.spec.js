// Owner Overview deterministic logic (DECISION-107). Pure function, so we test the
// RULES directly with crafted facts — no Electron. Proves the guardrails hold:
// review-only never reads as executed, the journey/next-move follow the real
// lifecycle, urgent items override, and missing/malformed promises degrade cleanly.
const { test, expect } = require('@playwright/test');
const { computeOverview } = require('../../renderer/overview-logic.js');

const lcOk = {
  signal: 'ok',
  all_stages: [
    { label: 'Define', is_current: false },
    { label: 'Plan', is_current: false },
    { label: 'Work a task', is_current: true },
    { label: 'Verify', is_current: false },
  ],
  next: [{ label: 'Verify', what_to_do: 'Run the checks and record an honest verdict.' }],
};
const noNotices = { drift: { signal: 'clear' }, highStakes: { signal: 'clear' }, staleDocs: { signal: 'clear' }, bloat: { signal: 'clear' }, untracked: { signal: 'clear' }, repoSync: { signal: 'clear' } };
const cleanSync = { clean: true };
const rulesX = (verif) => ({ verification: verif, headCommitEpoch: 100, rulesLoaded: true });
const freshReview = { present: true, verdict: 'PASS', type: 'review_only', mtimeEpoch: 200 };
const freshForgedCi = { present: true, verdict: 'PASS', type: 'ci_execution', mtimeEpoch: 200 }; // a file CANNOT prove ci_execution
const freshLocal = { present: true, verdict: 'PASS', type: 'local_execution', mtimeEpoch: 200 };

// Soak fix F3: a local_execution PASS is REAL execution proof (Healthy), but labeled
// honestly as local (this machine), never as a clean-room CI run.
test('local_execution PASS counts as executed proof but is labeled honestly (F3)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Healthy');
  expect(m.proof.exec).toContain('this machine');
  expect(m.proof.exec).not.toContain('clean machine'); // must not overclaim CI
});

test('review-only PASS is NOT executed proof and yields "Needs proof"', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshReview), sync: cleanSync, state: { project: { project_name: 'X' } }, vp: null });
  expect(m.cond.label).toBe('Needs proof');
  expect(m.proof.exec).toBe('not surfaced in the app yet');
  expect(m.proof.review).toContain('available');
  expect(m.proof.exec).not.toContain('clean machine');
});

test('local_execution fresh PASS + backed up + no notices + rules → Healthy', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Healthy');
  expect(m.proof.exec).toContain('this machine');
});

// Origin seam: a hand-editable record claiming ci_execution is NOT trusted as executed proof —
// so a forged clean-room claim can't reach "Healthy"; it reads as needing real proof.
test('a FILE claiming ci_execution is not trusted as executed proof (forgery guard)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshForgedCi), sync: cleanSync, state: { project: { project_name: 'X' } }, vp: null });
  expect(m.cond.label).toBe('Needs proof');       // not Healthy — the forged CI claim earns nothing
  expect(m.proof.exec).toBe('not surfaced in the app yet');
});

test('a FAIL verdict is Blocked', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX({ present: true, verdict: 'FAIL', type: 'review_only', mtimeEpoch: 200 }), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Blocked');
  expect(m.cond.safe.toLowerCase()).toContain('no');
});

test('journey strip follows the lifecycle (current marked "now", earlier "done")', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null });
  expect(m.journey.map((s) => s.label)).toEqual(['Define', 'Plan', 'Work a task', 'Verify']);
  expect(m.journey[2].cls).toBe('now');
  expect(m.journey[0].cls).toBe('done');
  expect(m.journey[3].cls).toBe('');
});

test('next best move defers to the lifecycle when nothing urgent', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null });
  expect(m.move.main).toBe('Verify');
  expect(m.move.fromLifecycle).toBe(true);
});

test('urgent items override the lifecycle next step (dirty sync → back up)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: { clean: false }, state: {}, vp: null });
  expect(m.move.main).toBe('Back up the project');
  expect(m.move.fromLifecycle).toBe(false);
  expect(m.cond.label).toBe('Needs attention');
});

test('drift notice drives review, high-stakes drives second opinion', () => {
  const drift = Object.assign({}, noNotices, { drift: { signal: 'notice' } });
  expect(computeOverview({ lc: lcOk, det: drift, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null }).move.main).toBe('Review scope drift');
  const hs = Object.assign({}, noNotices, { highStakes: { signal: 'notice' } });
  expect(computeOverview({ lc: lcOk, det: hs, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null }).move.main).toBe('Get a second opinion');
});

test('missing or malformed vision promises degrade gracefully', () => {
  for (const vp of [null, { _error: 'boom' }, { promises: [] }, {}]) {
    const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp });
    expect(m.vision.status).toBe('missing');
    expect(m.vision.cards).toEqual([]);
  }
});

test('placeholder promises flag needs-review; declared status is never called proof', () => {
  const vp = { review_status: 'needs_owner_review', last_reviewed: null, promises: [{ id: 'primary-outcome', label: '(Define outcome)', declared_status: 'needs_owner_review', not_proven: 'not reviewed yet' }] };
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp });
  expect(m.vision.status).toBe('ok');
  expect(m.vision.needsReview).toBe(true);
  expect(m.vision.cards[0].status).toBe('needs_owner_review');
  // the model keeps declared status separate from the proof card
  expect(m.proof.review).not.toContain('needs_owner_review');
});

// Soak fix F1: a pre-Work project (define/plan) has nothing built to verify, so the
// Overview must NOT demand "get execution proof" (which contradicts the lifecycle) —
// it defers to the lifecycle's own next step.
const lcPlan = {
  signal: 'ok',
  all_stages: [
    { id: 'define', label: 'Define', is_current: false },
    { id: 'plan', label: 'Plan', is_current: true },
    { id: 'work', label: 'Work a task', is_current: false },
    { id: 'verify', label: 'Verify', is_current: false },
  ],
  next: [{ label: 'Work a task', what_to_do: 'Pick the single next bounded task.' }],
};

test('pre-Work project does not demand proof; defers to the lifecycle (F1)', () => {
  const m = computeOverview({ lc: lcPlan, det: noNotices, x: rulesX(null), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).not.toBe('Needs proof');
  expect(m.cond.label).toBe('Getting set up');
  expect(m.move.main).toBe('Work a task'); // the lifecycle's next step, not "Get execution proof"
  expect(m.move.fromLifecycle).toBe(true);
  expect(m.needs.main).not.toBe('Verification needed');
});

// Soak fix F2: unconfirmed (declared-but-not-reviewed) vision promises surface as an
// owner "needs you" item, so the visionary is actually asked to confirm intent.
test('unconfirmed vision promises surface as a needs item (F2)', () => {
  const vp = { review_status: 'needs_owner_review', last_reviewed: null, promises: [{ id: 'x', label: 'do the thing', declared_status: 'needs_owner_review' }] };
  const m = computeOverview({ lc: lcPlan, det: noNotices, x: rulesX(null), sync: cleanSync, state: {}, vp });
  expect(m.needs.main.toLowerCase()).toContain('vision');
  expect(m.needs.attn).toBe(true);
});

test('unreadable facts → Unknown, never a fake green', () => {
  const m = computeOverview({ lc: null, det: null, x: null, sync: null, state: {}, vp: null });
  expect(m.cond.label).toBe('Unknown');
  expect(m.cond.cls).not.toBe('good');
});
