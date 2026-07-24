// Canonical-constraint enforcement (ADR-0020; docs/specs/canonical-constraint-enforcement.md).
// Drives the REAL scripts in throwaway git repos so production carries zero test-awareness. Covers the
// two-phase checker, the narrow preflight writer, the PreToolUse hook adapter's allow/deny decision, the
// receipt fail-closed fix, drift detection, and the bootstrap rule. Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }
function ps(dir, script, args, input) {
  return spawnSync('pwsh', ['-NoProfile', '-File', script, ...args],
    { cwd: dir, encoding: 'utf8', timeout: 60000, windowsHide: true, input: input });
}

// The exact canonical statements the shipped registry cites (must match CLAUDE.md).
const S_RESEARCH = 'Before building something new, ASSUME the problem is already solved somewhere in the world.';
const S_THRIFT = 'Prefer local, deterministic tools for mechanical work; spend the LLM only on real judgment.';
const S_BABY = 'They exist to reduce owner babysitting — the #1 rule of this project.';

function syntheticClaudeMd() {
  return [
    '# Working rules',
    '',
    'The owner is the visionary. ' + S_BABY,
    '',
    '## Work discipline',
    '- ' + S_THRIFT,
    '- ' + S_RESEARCH + ' Web-search first.',
    '',
    '## Other',
    '- unrelated.',
    ''
  ].join('\n');
}

function validPreflight(taskId, base) {
  return {
    schema: 'task-preflight/v1', generated_at: '2026-07-24T00:00:00Z', task_id: taskId,
    task_title: 'test', base: base,
    constraints_applied: ['RESEARCH_FIRST', 'TOKEN_THRIFT_LOCAL_FIRST', 'REDUCE_OWNER_BABYSITTING'],
    prior_art: [{ source: 'existing prior-art source', finding: 'a real recorded finding here' }],
    reuse_decision: { decision: 'custom', rationale: 'a real ten-plus char rationale' },
    deterministic_work: ['all of it'], llm_work: [], duplication_avoidance: 'single fixture reused',
    usage_plan: { expected_model_ops: 0, expected_local_ops: 1, max_authorized_usage: '0', stopping_conditions: ['n/a'], matched_benchmark_required: false },
    exceptions: []
  };
}

// Build a throwaway repo carrying the REAL canonical machinery, with a baseline commit that DOES contain
// the checker (so Phase Land / bootstrap treat the mechanism as already present) unless withCheckerInBase
// is false.
function makeRepo({ checkerInBase = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-canon-'));
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'preflight'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app', 'state'), { recursive: true });

  const copy = (rel) => fs.copyFileSync(path.join(REPO, rel), path.join(dir, rel));
  const canonScripts = [
    'scripts/check-canonical-constraints.ps1', 'scripts/write-task-preflight.ps1',
    'scripts/hooks/canonical-preflight.ps1', 'scripts/run-governance-gate.ps1',
    'scripts/write-verification-receipt.ps1', 'scripts/classify-stakes.ps1',
    'scripts/lib/change-identity.ps1', 'scripts/lib/receipt-check.ps1', 'scripts/lib/atomic-write.ps1'
  ];
  const schemaFiles = ['schemas/canonical-constraints.schema.json', 'schemas/task-preflight.schema.json', 'schemas/verification-receipt.schema.json'];
  for (const f of [...schemaFiles]) copy(f);
  copy('.cockpit/state/canonical-constraints.json');
  copy('.cockpit/state/stakes-manifest.json');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), syntheticClaudeMd());
  fs.writeFileSync(path.join(dir, '.gitignore'), '.cockpit/evidence/\n.cockpit/preflight/.active-lock.json\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\n');

  git(dir, ['init', '-q']);
  git(dir, ['checkout', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@t']); git(dir, ['config', 'user.name', 't']);
  // Baseline commit. Include the checker in base unless the test wants the pre-mechanism state.
  for (const f of canonScripts) { if (f === 'scripts/check-canonical-constraints.ps1' && !checkerInBase) continue; copy(f); }
  git(dir, ['add', '-A']); git(dir, ['commit', '-qm', 'baseline']);
  // If the checker was withheld from base, add it now (uncommitted infra the tests still call).
  if (!checkerInBase) copy('scripts/check-canonical-constraints.ps1');
  return dir;
}
function base(dir) { return git(dir, ['rev-parse', 'HEAD']); }
function checker(dir, phase) {
  const r = ps(dir, 'scripts/check-canonical-constraints.ps1', ['-Phase', phase, '-Json']);
  let j = null; try { j = JSON.parse((r.stdout || '').trim()); } catch (e) {}
  return { status: r.status, j };
}
function writePreflight(dir, taskId, obj) {
  fs.writeFileSync(path.join(dir, '.cockpit', 'preflight', taskId + '.json'), JSON.stringify(obj, null, 2) + '\n');
}
function lock(dir, taskId) { return ps(dir, 'scripts/write-task-preflight.ps1', ['-TaskId', taskId, '-Json']); }
function hook(dir, payload) {
  const r = ps(dir, 'scripts/hooks/canonical-preflight.ps1', [], JSON.stringify(payload));
  return r.status;
}

test('AC1/AC2/AC3: no lock denies; a valid lock passes; tampering the preflight breaks the lock', () => {
  const dir = makeRepo();
  try {
    expect(checker(dir, 'Preflight').status).toBe(1); // no lock

    const id = 'demo-task';
    writePreflight(dir, id, validPreflight(id, base(dir)));
    const lk = lock(dir, id);
    expect(lk.status).toBe(0);
    expect(checker(dir, 'Preflight').j.ok).toBe(true);

    // Hand-edit the preflight after locking -> digest mismatch -> blocked.
    fs.appendFileSync(path.join(dir, '.cockpit', 'preflight', id + '.json'), '\n');
    const after = checker(dir, 'Preflight');
    expect(after.j.ok).toBe(false);
    expect(after.j.state).toBe('digest_mismatch');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC4: drift — rewording a cited canonical statement fails closed', () => {
  const dir = makeRepo();
  try {
    const id = 'drift-task';
    writePreflight(dir, id, validPreflight(id, base(dir)));
    expect(lock(dir, id).status).toBe(0);
    expect(checker(dir, 'Preflight').j.ok).toBe(true);
    // Remove the research-first sentence from CLAUDE.md without touching the registry.
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), syntheticClaudeMd().replace(S_RESEARCH, 'Just build it.'));
    const drift = checker(dir, 'Preflight');
    expect(drift.j.ok).toBe(false);
    expect(drift.j.state).toBe('drift');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC5: the preflight writer refuses a traversal task_id', () => {
  const dir = makeRepo();
  try {
    const r = ps(dir, 'scripts/write-task-preflight.ps1', ['-TaskId', '../evil', '-Json']);
    expect(r.status).toBe(1);
    // and no file escaped
    expect(fs.existsSync(path.join(dir, 'evil.json'))).toBe(false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC1 (hook): denies source mutation, permits the two narrow preflight operations, permits rm never', () => {
  const dir = makeRepo();
  try {
    // no lock yet
    expect(hook(dir, { tool_name: 'Write', tool_input: { file_path: 'app/foo.js', content: 'x' } })).toBe(2);
    expect(hook(dir, { tool_name: 'Write', tool_input: { file_path: '.cockpit/preflight/newt.json', content: 'x' } })).toBe(0);
    expect(hook(dir, { tool_name: 'Write', tool_input: { file_path: '.cockpit/preflight/../../app/evil.js', content: 'x' } })).toBe(2);
    expect(hook(dir, { tool_name: 'Bash', tool_input: { command: 'pwsh scripts/write-task-preflight.ps1 -TaskId newt' } })).toBe(0);
    expect(hook(dir, { tool_name: 'Bash', tool_input: { command: 'rm -rf app' } })).toBe(2);
    // codex-caught bypass: a command that MENTIONS the writer but chains other work must NOT be allowed.
    expect(hook(dir, { tool_name: 'Bash', tool_input: { command: 'pwsh scripts/write-task-preflight.ps1 -TaskId x; rm -rf app' } })).toBe(2);
    expect(hook(dir, { tool_name: 'Bash', tool_input: { command: 'echo write-task-preflight.ps1 && rm -rf app' } })).toBe(2);
    expect(hook(dir, { tool_name: 'PowerShell', tool_input: { command: 'write-task-preflight.ps1 | Out-Null; Remove-Item app -Recurse' } })).toBe(2);
    // codex-caught (2nd): a command that MENTIONS the writer path but does not INVOKE it must be denied.
    expect(hook(dir, { tool_name: 'PowerShell', tool_input: { command: 'Remove-Item scripts/write-task-preflight.ps1' } })).toBe(2);
    expect(hook(dir, { tool_name: 'Bash', tool_input: { command: 'cp evil.ps1 scripts/write-task-preflight.ps1' } })).toBe(2);
    // codex-caught (3rd): a DIFFERENT script whose name merely ends with the writer name must be denied.
    expect(hook(dir, { tool_name: 'PowerShell', tool_input: { command: 'pwsh evilwrite-task-preflight.ps1 -TaskId x' } })).toBe(2);
    expect(hook(dir, { tool_name: 'PowerShell', tool_input: { command: 'pwsh mywrite-task-preflight.ps1 -TaskId x' } })).toBe(2);
    // ...and the legitimate lone invocation forms still pass.
    expect(hook(dir, { tool_name: 'PowerShell', tool_input: { command: 'pwsh -NoProfile -File scripts/write-task-preflight.ps1 -TaskId real-task -Json' } })).toBe(0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC6 (integrity): Land validates the STAGED preflight, not a valid working-tree decoy (codex-caught)', () => {
  const dir = makeRepo();
  try {
    const id = 'decoy-task';
    const pfPath = path.join(dir, '.cockpit', 'preflight', id + '.json');
    // Stage an INVALID preflight...
    fs.writeFileSync(pfPath, JSON.stringify({ schema: 'task-preflight/v1' }) + '\n');
    git(dir, ['add', '-A']);
    // ...then replace ONLY the working copy with a valid one (staged blob stays invalid).
    fs.writeFileSync(pfPath, JSON.stringify(validPreflight(id, base(dir)), null, 2) + '\n');
    const land = checker(dir, 'Land');
    expect(land.j.ok).toBe(false); // must judge the staged blob, which is invalid
    expect(land.j.state).toBe('invalid_preflight');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC2 (hook): with a valid lock, ordinary mutation is permitted', () => {
  const dir = makeRepo();
  try {
    const id = 'ok-task';
    writePreflight(dir, id, validPreflight(id, base(dir)));
    expect(lock(dir, id).status).toBe(0);
    expect(hook(dir, { tool_name: 'Write', tool_input: { file_path: 'app/foo.js', content: 'x' } })).toBe(0);
    expect(hook(dir, { tool_name: 'PowerShell', tool_input: { command: 'Remove-Item x' } })).toBe(0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC7: receipt writer fails closed when nothing is staged (the base==head/NONE defect)', () => {
  const dir = makeRepo();
  try {
    const r = ps(dir, 'scripts/write-verification-receipt.ps1', ['-Verifier', 'codex exec', '-Verdict', 'PASS', '-Json']);
    expect(r.status).toBe(2);
    expect(fs.existsSync(path.join(dir, '.cockpit', 'evidence', 'verification-receipt.json'))).toBe(false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC6/AC8: a staged preflight passes Land and (once staged) binds a receipt digest', () => {
  const dir = makeRepo();
  try {
    // No preflight staged -> Land fails.
    fs.writeFileSync(path.join(dir, 'app', 'state', 'thing.js'), '// change\n');
    git(dir, ['add', '-A']);
    expect(checker(dir, 'Land').j.ok).toBe(false);

    // Stage a valid preflight -> Land passes and the receipt binds its full digest.
    const id = 'land-task';
    writePreflight(dir, id, validPreflight(id, base(dir)));
    git(dir, ['add', '-A']);
    const land = checker(dir, 'Land');
    expect(land.j.ok).toBe(true);
    expect(land.j.preflight_digest).toMatch(/^[0-9a-f]{64}$/);

    const rc = ps(dir, 'scripts/write-verification-receipt.ps1', ['-Verifier', 'codex exec', '-Verdict', 'PASS', '-Json']);
    expect(rc.status).toBe(0);
    const receipt = JSON.parse(fs.readFileSync(path.join(dir, '.cockpit', 'evidence', 'verification-receipt.json'), 'utf8'));
    expect(receipt.preflight_task_id).toBe(id);
    expect(receipt.preflight_digest).toBe(land.j.preflight_digest);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC9: bootstrap — when the checker is absent from the baseline, the gate does not require a preflight', () => {
  const dir = makeRepo({ checkerInBase: false });
  try {
    // Stage a T0 change PLUS the new mechanism, with NO preflight. Gate must not block on canonical.
    fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// touched T0\n');
    git(dir, ['add', '-A']);
    const r = ps(dir, 'scripts/run-governance-gate.ps1', ['-Json']);
    let j = null; try { j = JSON.parse((r.stdout || '').trim()); } catch (e) {}
    expect(j).not.toBeNull();
    expect(j.canonical).toBe('bootstrap_skipped');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
