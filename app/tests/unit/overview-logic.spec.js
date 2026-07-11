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
const unknownSync = { _error: 'git_unreadable' }; // syncStatus fails closed when git can't read the tree
const rulesX = (verif) => ({ verification: verif, headCommitEpoch: 100, rulesLoaded: true });
// Freshness is now COMMIT-BOUND: main sets verification.matchesCurrent (VERIFIED_SHA == HEAD and clean tree).
const freshReview = { present: true, verdict: 'PASS', type: 'review_only', matchesCurrent: true };
const freshForgedCi = { present: true, verdict: 'PASS', type: 'ci_execution', matchesCurrent: true }; // a file CANNOT prove ci_execution
const freshLocal = { present: true, verdict: 'PASS', type: 'local_execution', matchesCurrent: true };
const staleLocal = { present: true, verdict: 'PASS', type: 'local_execution', matchesCurrent: false }; // executed PASS, but code moved since (new commit or uncommitted edits)
// Live CI (clean-room execution proof of the current commit). x carries the git state the
// CI-precedence needs (same gate as the trust strip: known git + clean tree).
const ciPass = { available: true, state: 'passed' };
const xCI = (verif, git) => Object.assign({ verification: verif, headCommitEpoch: 100, rulesLoaded: true }, git);
const gitClean = { gitKnown: true, dirty: false };
const gitDirty = { gitKnown: true, dirty: true };

// Soak fix F3: a local_execution PASS is REAL execution proof (Healthy), but labeled
// honestly as local (this machine), never as a clean-room CI run.
test('local_execution PASS counts as executed proof but is labeled honestly (F3)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Healthy');
  expect(m.proof.exec).toContain('this machine');
  expect(m.proof.exec).not.toContain('clean machine'); // must not overclaim CI
});

// CRIT-1 fix: an executed (local_execution) PASS whose VERIFIED_SHA no longer matches
// HEAD or whose tree is dirty (matchesCurrent:false) must NOT read as Healthy — the old
// mtime-vs-commit-time proxy stayed green over uncommitted edits.
test('an executed PASS that no longer matches current code is NOT Healthy (commit-bound freshness)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(staleLocal), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Needs proof');            // not Healthy — the proof no longer covers current code
  expect(m.proof.exec).toBe('not surfaced in the app yet'); // a stale executed PASS is NOT surfaced as current execution proof
  expect(m.cond.why.toLowerCase()).toContain('current code');
});

// CRIT-2 fix: when git can't be read, syncStatus fails closed (_error) and the Overview
// must NOT fall through to "Healthy — backed up" over a backup state it could not confirm.
test('unknown backup status (git unreadable) is NOT Healthy — never a false "backed up" (CRIT-2)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX(freshLocal), sync: unknownSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Needs attention');
  expect(m.cond.why.toLowerCase()).toContain('backed up');
  expect(m.needs.main.toLowerCase()).toContain('backup');
});

// I7: a detector that CRASHED (signal:'unknown') must not be treated as "no signal" and
// let the ladder reach Healthy — an errored check is not an all-clear.
test('a crashed detector (signal unknown) is NOT an all-clear — never Healthy (I7)', () => {
  const detCrashed = Object.assign({}, noNotices, { drift: { signal: 'unknown' } });
  const m = computeOverview({ lc: lcOk, det: detCrashed, x: rulesX(freshLocal), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Needs attention');
  expect(m.cond.why.toLowerCase()).toContain('could not run');
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

// FIX (Owner Overview <-> trust strip agreement): live CI is clean-room execution proof of
// the CURRENT commit and takes precedence over the local record — exactly like the trust
// strip's "Verified (ran in CI)" light. Before this, the Overview showed "Needs proof" while
// the trust light showed green for the same passing-CI commit (two surfaces disagreeing).
test('live CI pass on a clean tree is executed proof → Healthy, even over a review-only local record', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: xCI(freshReview, gitClean), sync: cleanSync, state: {}, vp: null, ci: ciPass });
  expect(m.cond.label).toBe('Healthy');
  expect(m.proof.exec).toContain('CI');
  expect(m.needs.attn).toBe(false);
});

test('live CI pass counts even with NO local verification record → Healthy', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: xCI(null, gitClean), sync: cleanSync, state: {}, vp: null, ci: ciPass });
  expect(m.cond.label).toBe('Healthy');
});

// Same gate as the trust strip: CI ran the COMMIT, not uncommitted local edits — a dirty
// tree must NOT let CI light the Overview green.
test('CI pass with a DIRTY tree does not count (uncommitted changes CI never saw)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: xCI(freshReview, gitDirty), sync: cleanSync, state: {}, vp: null, ci: ciPass });
  expect(m.cond.label).toBe('Needs proof');
  expect(m.proof.exec).toBe('not surfaced in the app yet');
});

// Backward compatible: no CI input → unchanged local-record behavior (review-only = Needs proof).
test('no CI input leaves the local-record behavior unchanged (review-only = Needs proof)', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: xCI(freshReview, gitClean), sync: cleanSync, state: {}, vp: null });
  expect(m.cond.label).toBe('Needs proof');
});

test('a FAIL verdict is Blocked', () => {
  const m = computeOverview({ lc: lcOk, det: noNotices, x: rulesX({ present: true, verdict: 'FAIL', type: 'review_only', matchesCurrent: true }), sync: cleanSync, state: {}, vp: null });
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
