// Governor Gate (ADR-0006 "Gate"; docs/specs/governor-gate.md) — the diff-bound verification
// receipt + commit gate. These drive the REAL scripts (run-governance-gate.ps1 + the receipt
// writer + the shipped classifier) in throwaway git repos with the real stakes manifest, so the
// production scripts carry ZERO test-awareness. Every test asserts the honest verdict + exit code
// (0 = allow, 1 = block). Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }

function ps(dir, script, args) {
  return spawnSync('pwsh', ['-NoProfile', '-File', script, ...args],
    { cwd: dir, encoding: 'utf8', timeout: 60000, windowsHide: true });
}
function runGate(dir, extra = []) {
  const r = ps(dir, 'scripts/run-governance-gate.ps1', ['-Json', ...extra]);
  let json = null;
  try { json = JSON.parse((r.stdout || '').trim()); } catch (e) { /* leave null */ }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
}
function runWriter(dir, { verifier = 'codex exec', verdict = 'PASS', expiresInHours = null } = {}) {
  const args = ['-Json', '-Verifier', verifier, '-Verdict', verdict];
  if (expiresInHours !== null) args.push('-ExpiresInHours', String(expiresInHours));
  const r = ps(dir, 'scripts/write-verification-receipt.ps1', args);
  let json = null;
  try { json = JSON.parse((r.stdout || '').trim()); } catch (e) { /* leave null */ }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
}
const RECEIPT = '.cockpit/evidence/verification-receipt.json';
function readReceipt(dir) { return JSON.parse(fs.readFileSync(path.join(dir, RECEIPT), 'utf8')); }
function writeReceipt(dir, obj) { fs.writeFileSync(path.join(dir, RECEIPT), JSON.stringify(obj, null, 2)); }

// Build a throwaway repo carrying the REAL governor machinery + the REAL manifest, with one
// baseline commit on `main`. Changes are then staged (not committed) to simulate a pre-commit.
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-gate-'));
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backlog'), { recursive: true });

  const copy = (rel) => fs.copyFileSync(path.join(REPO, rel), path.join(dir, rel));
  copy('scripts/run-governance-gate.ps1');
  copy('scripts/write-verification-receipt.ps1');
  copy('scripts/classify-stakes.ps1');
  copy('scripts/lib/change-identity.ps1');
  copy('scripts/lib/receipt-check.ps1');
  copy('scripts/lib/atomic-write.ps1');
  copy('schemas/verification-receipt.schema.json');
  copy('.cockpit/state/stakes-manifest.json');

  fs.writeFileSync(path.join(dir, '.gitignore'), '.cockpit/evidence/\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\n');
  fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// baseline T0 file\n');
  fs.writeFileSync(path.join(dir, 'backlog', 'IDEAS.md'), '# ideas\n');

  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@pcc.local']);
  git(dir, ['config', 'user.name', 'pcc-test']);
  git(dir, ['branch', '-M', 'main']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'baseline']);
  return dir;
}
function stage(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  git(dir, ['add', rel]);
}
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

// AC-1: T3/T4 changes pass the commit gate with no receipt required.
test('AC-1: a T3 change passes with no receipt', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/some-ordinary-module.js', '// new ordinary module\n'); // unmatched -> default T3
    const g = runGate(dir);
    expect(g.json.tier).toBe('T3');
    expect(g.json.verdict).toBe('PASS');
    expect(g.status).toBe(0);
  } finally { cleanup(dir); }
});
test('AC-1: a T4 (noise) change passes with no receipt', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'backlog/IDEAS.md', '# ideas\n- another idea\n');
    const g = runGate(dir);
    expect(g.json.tier).toBe('T4');
    expect(g.json.verdict).toBe('PASS');
    expect(g.status).toBe(0);
  } finally { cleanup(dir); }
});

// AC-2: a T0 change with no receipt is BLOCKED.
test('AC-2: a T0 change with no receipt is blocked (exit 1)', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// a real change to the durable-write primitive\n');
    const g = runGate(dir);
    expect(g.json.tier).toBe('T0');
    expect(g.json.verdict).toBe('BLOCK');
    expect(g.json.receipt_state).toBe('missing');
    expect(g.status).toBe(1);
  } finally { cleanup(dir); }
});

// AC-3 + AC-8: writer -> gate passes on the exact diff, and the two agree on identity.
test('AC-3/AC-8: a receipt written for the exact staged diff makes the gate pass', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// verified change\n');
    const w = runWriter(dir, { verifier: 'codex exec', verdict: 'PASS' });
    expect(w.status).toBe(0);
    expect(w.json.tier).toBe('T0');
    const g = runGate(dir);
    expect(g.json.verdict).toBe('PASS');
    expect(g.status).toBe(0);
    // AC-8: writer and gate computed the SAME change identity.
    expect(w.json.diff_id).toBe(g.json.diff_id);
    expect(w.json.base).toBe(g.json.base);
  } finally { cleanup(dir); }
});

// AC-4: any subsequent change invalidates the receipt (yesterday's green, today's diff).
test('AC-4: staging one more line after the receipt makes it stale -> blocked', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// verified change\n');
    runWriter(dir, { verdict: 'PASS' });
    expect(runGate(dir).json.verdict).toBe('PASS'); // valid now
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// verified change\n// ONE more line, unverified\n');
    const g = runGate(dir);
    expect(g.json.verdict).toBe('BLOCK');
    expect(g.json.receipt_state).toBe('stale_diff');
    expect(g.status).toBe(1);
  } finally { cleanup(dir); }
});

// AC-5: expired / non-PASS / schema-invalid / lower-tier receipts are all blocked.
test('AC-5: an expired receipt is blocked', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n');
    runWriter(dir, { verdict: 'PASS' });
    const r = readReceipt(dir);
    r.expires_at = new Date(Date.now() - 3600 * 1000).toISOString(); // 1h in the past
    writeReceipt(dir, r);
    const g = runGate(dir);
    expect(g.json.verdict).toBe('BLOCK');
    expect(g.json.receipt_state).toBe('expired');
  } finally { cleanup(dir); }
});
test('AC-5: a non-PASS verdict receipt is blocked', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n');
    const w = runWriter(dir, { verdict: 'FAIL' });
    expect(w.status).toBe(0); // writing a FAIL receipt is allowed; the gate rejects it
    const g = runGate(dir);
    expect(g.json.verdict).toBe('BLOCK');
    expect(g.json.receipt_state).toBe('not_pass');
  } finally { cleanup(dir); }
});
test('AC-5: a schema-invalid receipt is blocked', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n');
    runWriter(dir, { verdict: 'PASS' });
    const r = readReceipt(dir);
    delete r.verifier; // required by the schema
    writeReceipt(dir, r);
    const g = runGate(dir);
    expect(g.json.verdict).toBe('BLOCK');
    expect(g.json.receipt_state).toBe('schema_invalid');
  } finally { cleanup(dir); }
});
test('AC-5: a receipt covering a lower tier than the change is blocked', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n');
    runWriter(dir, { verdict: 'PASS' });
    const r = readReceipt(dir);
    r.tier = 'T3'; // pretend a lower-tier receipt (still bound to the exact diff)
    writeReceipt(dir, r);
    const g = runGate(dir);
    expect(g.json.verdict).toBe('BLOCK');
    expect(g.json.receipt_state).toBe('lower_tier');
  } finally { cleanup(dir); }
});
test('AC-5: a malformed expires_at fails closed (blocked, not accepted)', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n');
    runWriter(dir, { verdict: 'PASS' });
    const r = readReceipt(dir);
    r.expires_at = 'not-a-real-date'; // garbage must NOT read as "no expiry"
    writeReceipt(dir, r);
    const g = runGate(dir);
    expect(g.json.verdict).toBe('BLOCK'); // expired (or schema_invalid) — either way, fail closed
  } finally { cleanup(dir); }
});

// AC-6: no manifest -> classifier UNKNOWN -> fail closed -> blocked.
test('AC-6: a missing manifest fails closed (UNKNOWN -> block)', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n');
    fs.rmSync(path.join(dir, '.cockpit', 'state', 'stakes-manifest.json'));
    const g = runGate(dir);
    expect(g.json.tier).toBe('UNKNOWN');
    expect(g.json.verdict).toBe('BLOCK');
    expect(g.status).toBe(1);
  } finally { cleanup(dir); }
});

// Empty-history repo (a project's very first commit): the verified path must still work — the
// receipt is schema-valid (base/head fall back to git's null-sha, not '') and the gate accepts it.
test('empty-history repo: a first-commit T0 change can still be verified (receipt valid + gate passes)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-gate0-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app', 'state'), { recursive: true });
    const copy = (rel) => fs.copyFileSync(path.join(REPO, rel), path.join(dir, rel));
    copy('scripts/run-governance-gate.ps1');
    copy('scripts/write-verification-receipt.ps1');
    copy('scripts/classify-stakes.ps1');
    copy('scripts/lib/change-identity.ps1');
    copy('scripts/lib/receipt-check.ps1');
    copy('scripts/lib/atomic-write.ps1');
    copy('schemas/verification-receipt.schema.json');
    copy('.cockpit/state/stakes-manifest.json');
    fs.writeFileSync(path.join(dir, '.gitignore'), '.cockpit/evidence/\n');
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'test@pcc.local']);
    git(dir, ['config', 'user.name', 'pcc-test']);
    git(dir, ['branch', '-M', 'main']);
    // NO baseline commit — HEAD is unresolved. Stage a T0 file as the very first commit's content.
    stage(dir, 'app/state/atomic-store.js', '// first-ever T0 file\n');
    const blocked = runGate(dir);
    expect(blocked.json.tier).toBe('T0');
    expect(blocked.json.verdict).toBe('BLOCK'); // no receipt yet, still fails closed
    const NULL_SHA = '0000000000000000000000000000000000000000';
    expect(blocked.json.base).toBe(NULL_SHA);
    expect(blocked.json.head).toBe(NULL_SHA);
    const w = runWriter(dir, { verdict: 'PASS' });
    expect(w.status).toBe(0);
    const g = runGate(dir);
    expect(g.json.verdict, 'the verified path must work with no history').toBe('PASS');
    expect(g.status).toBe(0);
  } finally { cleanup(dir); }
});

// AC-7: a disclosed, exact-diff_id bypass allows the commit — but ONLY when it is STAGED (so it
// lands in git history, auditable). An unstaged/working-tree-only ledger must grant no bypass.
const LEDGER = '.cockpit/state/governance-gate-exceptions.json';
test('AC-7: a STAGED exact-diff_id bypass allows + discloses; an UNSTAGED one does not', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change needing a bypass\n');
    const blocked = runGate(dir);
    expect(blocked.json.verdict).toBe('BLOCK');
    const diffId = blocked.json.diff_id;
    const ledger = JSON.stringify({
      exceptions_id: 'governance-gate-exceptions-v1',
      exceptions: [{ diff_id: diffId, reason: 'owner-approved emergency fix', authorized_by: 'owner', tier: 'T0' }],
    });
    // written to the working tree but NOT staged -> must remain BLOCKED (invisible bypass closed)
    fs.writeFileSync(path.join(dir, LEDGER), ledger);
    const stillBlocked = runGate(dir);
    expect(stillBlocked.json.verdict, 'an unstaged ledger must not grant a bypass').toBe('BLOCK');
    // now STAGE it -> the bypass applies, and staging the (excluded) ledger did NOT change diff_id
    git(dir, ['add', LEDGER]);
    const allowed = runGate(dir);
    expect(allowed.json.diff_id).toBe(diffId);
    expect(allowed.json.verdict).toBe('PASS');
    expect(allowed.status).toBe(0);
    expect(allowed.json.bypass).toBeTruthy();
    expect(allowed.json.bypass.authorized_by).toBe('owner');
    // EXACT: changing the real content yields a new diff_id the entry does not excuse
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change needing a bypass\n// now different\n');
    expect(runGate(dir).json.verdict).toBe('BLOCK');
  } finally { cleanup(dir); }
});
