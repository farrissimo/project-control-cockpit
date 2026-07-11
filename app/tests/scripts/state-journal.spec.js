// Part 7 hardening I1: the paired task/project-state write is a journaled transaction.
// scripts/lib/state-journal.ps1 records both intended payloads in a write-ahead journal,
// applies both atomic writes, then clears it; an interrupted run leaves a journal that
// Resume-StateJournal replays to completion. These tests prove commit, crash-recovery,
// no-op, fail-closed-on-corrupt, and that validate-cockpit-state surfaces a lingering journal.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const HELPER = path.join(REPO, 'scripts', 'lib', 'state-journal.ps1').replace(/\\/g, '/');

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-jrn-'));
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'result'), { recursive: true });
  return dir;
}
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
// Run a PowerShell snippet with the helper dot-sourced; cwd = dir.
function ps(dir, snippet) {
  return spawnSync('pwsh', ['-NoProfile', '-Command', `$ErrorActionPreference='Stop'; . '${HELPER}'; ${snippet}`],
    { cwd: dir, encoding: 'utf8', timeout: 20000 });
}

test('Write-PairedStateAtomic commits both files and leaves NO journal', () => {
  const dir = tmp();
  try {
    const t = path.join(dir, 'task-state.json'), p = path.join(dir, 'project-state.json'), j = path.join(dir, 'jrn.json');
    const r = ps(dir, `Write-PairedStateAtomic -TaskStatePath '${t}' -ProjectStatePath '${p}' -TaskState (@{task_status='complete'}) -ProjectState (@{next_expected_action='done'}) -JournalPath '${j}'`);
    expect(r.status).toBe(0);
    expect(rd(t).task_status).toBe('complete');
    expect(rd(p).next_expected_action).toBe('done');
    expect(fs.existsSync(j)).toBe(false); // committed -> journal cleared
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Resume-StateJournal completes an interrupted paired write (task advanced, project stale)', () => {
  const dir = tmp();
  try {
    const t = path.join(dir, 'task-state.json'), p = path.join(dir, 'project-state.json'), j = path.join(dir, 'jrn.json');
    // Simulate the crash: journal records the intended NEW state; on disk task is already
    // advanced but project is still the OLD (stale) copy — the exact I1 split.
    const taskNew = { task_id: 't1', task_status: 'verified_fail', current_blocker: 'NEW defect' };
    const projNew = { current_task_id: 't1', next_expected_action: 'fix it', last_verification_verdict: 'FAIL' };
    fs.writeFileSync(j, JSON.stringify({ task_state_json: JSON.stringify(taskNew), project_state_json: JSON.stringify(projNew) }));
    fs.writeFileSync(t, JSON.stringify(taskNew));                                  // task already applied
    fs.writeFileSync(p, JSON.stringify({ current_task_id: 't1', next_expected_action: 'OLD stale' })); // project stale
    const r = ps(dir, `if (Resume-StateJournal -TaskStatePath '${t}' -ProjectStatePath '${p}' -JournalPath '${j}') { 'replayed' } else { 'noop' }`);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('replayed');
    expect(rd(p).next_expected_action).toBe('fix it');           // project completed from journal
    expect(rd(p).last_verification_verdict).toBe('FAIL');
    expect(fs.existsSync(j)).toBe(false);                        // journal cleared after replay
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Resume-StateJournal is a no-op when no journal exists', () => {
  const dir = tmp();
  try {
    const t = path.join(dir, 'task-state.json'), p = path.join(dir, 'project-state.json'), j = path.join(dir, 'jrn.json');
    fs.writeFileSync(t, '{}'); fs.writeFileSync(p, '{}');
    const r = ps(dir, `if (Resume-StateJournal -TaskStatePath '${t}' -ProjectStatePath '${p}' -JournalPath '${j}') { 'replayed' } else { 'noop' }`);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('noop');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Resume-StateJournal FAILS CLOSED on a corrupt journal (never silently skips recovery)', () => {
  const dir = tmp();
  try {
    const t = path.join(dir, 'task-state.json'), p = path.join(dir, 'project-state.json'), j = path.join(dir, 'jrn.json');
    fs.writeFileSync(j, 'this is not json {');
    const r = ps(dir, `Resume-StateJournal -TaskStatePath '${t}' -ProjectStatePath '${p}' -JournalPath '${j}'`);
    expect(r.status).not.toBe(0); // throws under $ErrorActionPreference='Stop'
    expect(fs.existsSync(j)).toBe(true); // corrupt journal left in place for inspection
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Codex secondary-review defect: a parseable-but-malformed journal whose payloads are
// NOT JSON strings (e.g. bare numbers, which [string]-coerce to valid-looking JSON, or
// nested objects) must NOT be committed. Resume validates both payloads up front and
// fails closed, leaving the canonical files and the journal untouched.
test('Resume-StateJournal FAILS CLOSED on non-string / non-JSON payloads (no garbage commit)', () => {
  for (const bad of [
    '{"task_state_json":1,"project_state_json":2}',                       // bare numbers
    '{"task_state_json":{"x":1},"project_state_json":{"y":2}}',           // nested objects
    '{"task_state_json":"not json {","project_state_json":"{}"}',         // non-JSON string
    '{"task_state_json":"1","project_state_json":"{}"}',                  // string scalar "1"
    '{"task_state_json":"[]","project_state_json":"{}"}',                 // string array "[]"
    '{"task_state_json":"null","project_state_json":"{}"}',               // string "null"
    '{"task_state_json":"\\"oops\\"","project_state_json":"{}"}',         // string literal
    '{"task_state_json":"[{\\"a\\":1}]","project_state_json":"{}"}',      // array-of-object (unwrap quirk)
  ]) {
    const dir = tmp();
    try {
      const t = path.join(dir, 'task-state.json'), p = path.join(dir, 'project-state.json'), j = path.join(dir, 'jrn.json');
      fs.writeFileSync(t, '{"canonical":"task"}'); fs.writeFileSync(p, '{"canonical":"project"}');
      fs.writeFileSync(j, bad);
      const r = ps(dir, `Resume-StateJournal -TaskStatePath '${t}' -ProjectStatePath '${p}' -JournalPath '${j}'`);
      expect(r.status).not.toBe(0);                          // fails closed
      expect(rd(t)).toEqual({ canonical: 'task' });          // canonical files UNTOUCHED
      expect(rd(p)).toEqual({ canonical: 'project' });
      expect(fs.existsSync(j)).toBe(true);                   // journal retained for inspection
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('validate-cockpit-state SURFACES a lingering journal (doctor visibility)', () => {
  const dir = tmp();
  try {
    fs.copyFileSync(path.join(REPO, 'scripts', 'validate-cockpit-state.ps1'), path.join(dir, 'validate.ps1'));
    const sp = (n) => path.join(dir, '.cockpit', 'state', n);
    fs.writeFileSync(sp('task-state.json'), JSON.stringify({ task_id: 't1', verification_verdict: 'FAIL', current_blocker: 'x' }));
    fs.writeFileSync(sp('project-state.json'), JSON.stringify({ current_task_id: 't1', last_verification_verdict: 'FAIL', current_blocker: 'x' }));
    fs.writeFileSync(path.join(dir, '.cockpit', 'result', 'verification-result.json'), JSON.stringify({ task_id: 't1', verdict: 'FAIL', state_update_allowed: false }));
    // No journal -> passes.
    let r = spawnSync('pwsh', ['-NoProfile', '-File', 'validate.ps1'], { cwd: dir, encoding: 'utf8', timeout: 20000 });
    expect(r.status).toBe(0);
    // Lingering journal -> validate fails and names the pending update.
    fs.writeFileSync(sp('.state-update.journal.json'), '{"task_state_json":"{}","project_state_json":"{}"}');
    r = spawnSync('pwsh', ['-NoProfile', '-File', 'validate.ps1'], { cwd: dir, encoding: 'utf8', timeout: 20000 });
    expect(r.status).not.toBe(0);
    expect((r.stdout + r.stderr)).toMatch(/journal|Pending state update/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
