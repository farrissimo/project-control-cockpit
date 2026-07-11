// The lifecycle PASS gate — the core of "you can't mark work done without a
// fresh independent PASS". Runs scripts/lifecycle-advance.ps1 in throwaway
// projects (its own git repo + model + state + recorded verdict), so it proves
// the gate blocks/allows correctly without touching the real repo's pin.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-lc-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'lifecycle-advance.ps1'), path.join(dir, 'scripts', 'lifecycle-advance.ps1'));
  fs.copyFileSync(path.join(REPO, '.cockpit', 'state', 'lifecycle-model.json'), path.join(dir, '.cockpit', 'state', 'lifecycle-model.json'));
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'lifecycle-state.json'),
    JSON.stringify({ lane: 'test', current_stage: 'verify', active_task: 'x' }));
  // A git repo so the script's freshness check (git log -1 --format=%ct) works.
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@t.local'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'seed'], { cwd: dir });
  return dir;
}

// Same as makeProject but WITHOUT git init — so `git log -1 --format=%ct` fails
// (not a git repository). Used to prove the freshness gate fails CLOSED when git
// cannot report HEAD's commit time, instead of defaulting to "trivially fresh."
function makeProjectNoGit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-lc-nogit-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'lifecycle-advance.ps1'), path.join(dir, 'scripts', 'lifecycle-advance.ps1'));
  fs.copyFileSync(path.join(REPO, '.cockpit', 'state', 'lifecycle-model.json'), path.join(dir, '.cockpit', 'state', 'lifecycle-model.json'));
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'lifecycle-state.json'),
    JSON.stringify({ lane: 'test', current_stage: 'verify', active_task: 'x' }));
  return dir;
}

function advance(dir, to) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/lifecycle-advance.ps1', '-To', to, '-Json'],
    { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return JSON.parse(r.stdout.trim());
}
function recordVerdict(dir, verdict, type) {
  type = type || 'review_only';
  fs.writeFileSync(path.join(dir, 'app', 'last-verification.txt'), 'VERIFIER: test\nTYPE: ' + type + '\n\nVERDICT: ' + verdict + '\n');
}
function recordRaw(dir, text) {
  fs.writeFileSync(path.join(dir, 'app', 'last-verification.txt'), text);
}
function setPhaseKind(dir, kind) {
  const p = path.join(dir, '.cockpit', 'state', 'lifecycle-state.json');
  const st = JSON.parse(fs.readFileSync(p, 'utf8'));
  st.phase_kind = kind;
  fs.writeFileSync(p, JSON.stringify(st));
}
function currentStage(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.cockpit', 'state', 'lifecycle-state.json'), 'utf8')).current_stage;
}

test('gate BLOCKS phase_close when no verdict is recorded', () => {
  const dir = makeProject();
  try {
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_verification');
    expect(currentStage(dir)).toBe('verify'); // pin did NOT move
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('gate BLOCKS phase_close on a FAIL verdict', () => {
  const dir = makeProject();
  try {
    recordVerdict(dir, 'FAIL');
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_verification');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Owner policy: an EXECUTABLE phase (the default) can't be closed on a review-only pass —
// a reviewer reading the code is not proof it runs. It needs execution proof.
test('gate BLOCKS an executable phase closing on a review-only PASS (policy)', () => {
  const dir = makeProject();
  try {
    recordVerdict(dir, 'PASS', 'review_only'); // fresh, but nothing was run
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_execution_proof');
    expect(currentStage(dir)).toBe('verify'); // pin did NOT move
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ...but a phase EXPLICITLY declared review/docs/planning may close on review-only
// evidence (that's the "no pointless friction on docs work" half of the policy).
test('gate ALLOWS a declared review/docs phase to close on a review-only PASS (policy)', () => {
  const dir = makeProject();
  try {
    setPhaseKind(dir, 'review');
    recordVerdict(dir, 'PASS', 'review_only');
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(true);
    expect(currentStage(dir)).toBe('phase_close');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Advancing into a new work phase resets phase_kind to the strict default, so a stale
// "review" declaration can't let the next batch of real code close on a review.
test('starting a new work phase resets phase_kind to executable (strict)', () => {
  const dir = makeProject();
  try {
    setPhaseKind(dir, 'review');
    advance(dir, 'work'); // verify -> work (ungated) begins a fresh executable phase
    const st = JSON.parse(fs.readFileSync(path.join(dir, '.cockpit', 'state', 'lifecycle-state.json'), 'utf8'));
    expect(st.phase_kind).toBe('executable');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('refuses an illegal transition regardless of verdict', () => {
  const dir = makeProject();
  try {
    recordVerdict(dir, 'PASS');
    const r = advance(dir, 'milestone'); // verify -> milestone is not in the model
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('illegal_transition');
    expect(currentStage(dir)).toBe('verify');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('gate BLOCKS on INSUFFICIENT (not a PASS)', () => {
  const dir = makeProject();
  try {
    recordVerdict(dir, 'INSUFFICIENT');
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_verification');
    expect(currentStage(dir)).toBe('verify');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('gate BLOCKS on a malformed verdict (no recognizable token)', () => {
  const dir = makeProject();
  try {
    recordRaw(dir, 'I looked and it seems fine, but here is no structured verdict line at all.');
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_verification'); // malformed is NEVER treated as PASS
    expect(currentStage(dir)).toBe('verify');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Independent-review finding: a stray "PASS" in prose must NOT clear the gate. The old
// loose scan accepted any file containing the token PASS anywhere; the gate now requires
// a structured VERDICT: line.
test('gate BLOCKS a stray "PASS" in prose (no VERDICT: line)', () => {
  const dir = makeProject();
  try {
    recordRaw(dir, 'VERIFIER: someone\nTYPE: local_execution\n\nHonestly it PASSES the smell test to me, looks good and I think it PASSES.\n');
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_verification'); // "PASS" in prose is not a verdict
    expect(currentStage(dir)).toBe('verify');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// The record must declare a recognized TYPE (what KIND of proof) — an untyped PASS is
// refused, so a bare "VERDICT: PASS" file can't clear "done".
test('gate BLOCKS a PASS with no recognized TYPE: line', () => {
  const dir = makeProject();
  try {
    recordRaw(dir, 'VERIFIER: test\n\nVERDICT: PASS\n'); // no TYPE line
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_verification');
    expect(currentStage(dir)).toBe('verify');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// A fresh, well-formed local_execution PASS is the F8 escape for a local-first project:
// it clears the gate in-cockpit without CI/Codex. Confirm the gate recognizes it.
test('gate ALLOWS a fresh local_execution PASS (the local-first escape)', () => {
  const dir = makeProject();
  try {
    recordVerdict(dir, 'PASS', 'local_execution');
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(true);
    expect(currentStage(dir)).toBe('phase_close');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Origin seam (#3): app/last-verification.txt is hand-editable, so a forged "TYPE: ci_execution"
// (a clean-room claim no legitimate writer ever puts in that file) must NOT clear an executable
// phase — clean-room proof comes from a live CI observation, never a text line. Only local_execution
// (the app's own product run) is trusted from the file.
test('gate BLOCKS an executable phase closing on a FILE-claimed ci_execution (forgery guard)', () => {
  const dir = makeProject();
  try {
    recordVerdict(dir, 'PASS', 'ci_execution'); // fresh + well-formed, but a hand-editable clean-room CLAIM
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_execution_proof');
    expect(currentStage(dir)).toBe('verify'); // pin did NOT move
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('gate BLOCKS an executable phase closing on a FILE-claimed live_boundary (forgery guard)', () => {
  const dir = makeProject();
  try {
    recordVerdict(dir, 'PASS', 'live_boundary');
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_execution_proof');
    expect(currentStage(dir)).toBe('verify');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// I8 (Part 7 hardening): freshness fails CLOSED when git can't report HEAD's time.
// A fresh, well-formed local_execution PASS that WOULD clear the gate is refused
// when git cannot report HEAD's commit time — the staleness half of the gate must
// not be defeated by a git failure (the old code defaulted headEpoch=0 -> always
// "fresh"). Same record in a real git repo passes (proven by the test above), so
// this isolates the git-unknown case.
test('gate FAILS CLOSED when git cannot report HEAD time (no false-fresh)', () => {
  const dir = makeProjectNoGit();
  try {
    recordVerdict(dir, 'PASS', 'local_execution'); // would pass with a working git HEAD
    const r = advance(dir, 'phase_close');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('needs_verification');
    expect(r.fresh).toBe(false);
    expect(r.head_time_known).toBe(false);
    expect(currentStage(dir)).toBe('verify'); // pin did NOT move
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an ungated transition (verify -> work) needs no verdict', () => {
  const dir = makeProject();
  try {
    const r = advance(dir, 'work'); // sending it back to Work is always allowed
    expect(r.ok).toBe(true);
    expect(currentStage(dir)).toBe('work');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
