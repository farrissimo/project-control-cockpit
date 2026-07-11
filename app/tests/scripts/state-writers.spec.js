// I1 (Part 7 hardening): the canonical task/project-state writers persist through
// Write-JsonAtomic (atomic + retained .prev) instead of two bare Set-Content writes.
// advance-cockpit-state.ps1 is exercised end-to-end (its post-update validator /
// refresher calls are Test-Path-guarded, so omitting those scripts skips them,
// isolating the state write). finalize-worker-handback.ps1 runs an unconditional
// downstream pipeline, so it gets a parse-check here; its write mechanism is the
// identical Save-State -> Write-JsonAtomic path proven by atomic-write.spec.js.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function makeCockpit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-sw-'));
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'result'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'advance-cockpit-state.ps1'), path.join(dir, 'scripts', 'advance-cockpit-state.ps1'));
  fs.copyFileSync(path.join(REPO, 'scripts', 'lib', 'atomic-write.ps1'), path.join(dir, 'scripts', 'lib', 'atomic-write.ps1'));
  return dir;
}

function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function seedState(dir, verdict) {
  const statePath = (n) => path.join(dir, '.cockpit', 'state', n);
  writeJson(statePath('task-state.json'), {
    task_id: 't1', task_status: 'returned_for_verification', attempts: 1,
    verification_verdict: null, current_blocker: null, next_action: 'pending',
    current_directive_path: '.cockpit/handoff/directive.md', updated_at: 'seed',
  });
  writeJson(statePath('project-state.json'), {
    last_verification_verdict: null, current_blocker: null,
    next_expected_action: 'pending', last_verified_handoff: null, updated_at: 'seed',
  });
  writeJson(path.join(dir, '.cockpit', 'result', 'verification-result.json'), {
    task_id: 't1', verdict, state_update_allowed: verdict === 'PASS',
    summary: 'verifier summary', next_action: 'do the next thing',
  });
}

function runAdvance(dir) {
  return spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/advance-cockpit-state.ps1'],
    { cwd: dir, encoding: 'utf8', timeout: 20000 });
}

test('advance-cockpit-state (PASS): advances task_status AND retains .prev on both files', () => {
  const dir = makeCockpit();
  try {
    seedState(dir, 'PASS');
    const taskPath = path.join(dir, '.cockpit', 'state', 'task-state.json');
    const projPath = path.join(dir, '.cockpit', 'state', 'project-state.json');
    const r = runAdvance(dir);
    expect(r.status).toBe(0);
    // new state written
    expect(readJson(taskPath).task_status).toBe('complete');
    expect(readJson(projPath).last_verification_verdict).toBe('PASS');
    // prior generation retained and recoverable (the pre-advance state)
    expect(fs.existsSync(taskPath + '.prev')).toBe(true);
    expect(readJson(taskPath + '.prev').task_status).toBe('returned_for_verification');
    expect(fs.existsSync(projPath + '.prev')).toBe(true);
    expect(readJson(projPath + '.prev').last_verification_verdict).toBe(null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('advance-cockpit-state (FAIL): records verified_fail and still retains .prev', () => {
  const dir = makeCockpit();
  try {
    seedState(dir, 'FAIL');
    const taskPath = path.join(dir, '.cockpit', 'state', 'task-state.json');
    const r = runAdvance(dir);
    expect(r.status).toBe(0);
    expect(readJson(taskPath).task_status).toBe('verified_fail');
    expect(readJson(taskPath + '.prev').task_status).toBe('returned_for_verification');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Guards the dot-source + Save-State edits in the handback writers against syntax /
// parse breakage (finalize runs a heavy downstream pipeline not exercised here).
for (const script of ['finalize-worker-handback.ps1', 'advance-cockpit-state.ps1']) {
  test(`${script} parses with no PowerShell syntax errors`, () => {
    const full = path.join(REPO, 'scripts', script).replace(/\\/g, '/');
    const r = spawnSync('pwsh', ['-NoProfile', '-Command',
      `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${full}',[ref]$t,[ref]$e);if($e -and $e.Count){$e|ForEach-Object{$_.Message};exit 1}else{exit 0}`],
      { encoding: 'utf8', timeout: 20000 });
    expect(r.stdout.trim() + r.stderr.trim()).toBe('');
    expect(r.status).toBe(0);
  });
}
