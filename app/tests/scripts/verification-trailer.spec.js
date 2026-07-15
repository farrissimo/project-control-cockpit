// Verification Trailer (ADR-0007; docs/specs/verification-trailer.md) — durable, CI-audited proof.
// Drives the REAL emitter, the REAL commit-msg hook (via real `git commit`), and the REAL audit in
// throwaway git repos with the real manifest/classifier. Production scripts carry zero test-awareness.
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
function emit(dir) { return (ps(dir, 'scripts/emit-verification-trailer.ps1', []).stdout || '').trim(); }
function audit(dir, range) {
  const r = ps(dir, 'scripts/audit-verification-trailers.ps1', ['-Json', '-Range', range]);
  let json = null; try { json = JSON.parse((r.stdout || '').trim()); } catch (e) { /* leave null */ }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
}
function writeReceipt(dir, { verdict = 'PASS', verifier = 'codex exec' } = {}) {
  return ps(dir, 'scripts/write-verification-receipt.ps1', ['-Verifier', verifier, '-Verdict', verdict]);
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-trail-'));
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backlog'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.githooks'), { recursive: true });
  const copy = (rel) => fs.copyFileSync(path.join(REPO, rel), path.join(dir, rel));
  for (const f of [
    'scripts/emit-verification-trailer.ps1', 'scripts/audit-verification-trailers.ps1',
    'scripts/write-verification-receipt.ps1', 'scripts/run-governance-gate.ps1', 'scripts/classify-stakes.ps1',
    'scripts/lib/change-identity.ps1', 'scripts/lib/receipt-check.ps1', 'scripts/lib/atomic-write.ps1',
    'schemas/verification-receipt.schema.json', '.cockpit/state/stakes-manifest.json',
    '.githooks/commit-msg',
  ]) copy(f);
  fs.writeFileSync(path.join(dir, '.gitignore'), '.cockpit/evidence/\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\n');
  fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// baseline T0 file\n');
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@pcc.local']);
  git(dir, ['config', 'user.name', 'pcc-test']);
  git(dir, ['config', 'core.hooksPath', '.githooks']); // only commit-msg installed — isolates the trailer
  git(dir, ['branch', '-M', 'main']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--no-verify', '-m', 'baseline']); // baseline is the audit base, never audited
  return dir;
}
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
function stage(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  git(dir, ['add', rel]);
}
function lastMsg(dir) { return git(dir, ['show', '-s', '--format=%B', 'HEAD']); }
function gateId(dir) { // base + diff_id of the current staged change, via the gate's JSON
  const r = ps(dir, 'scripts/run-governance-gate.ps1', ['-Json']);
  return JSON.parse((r.stdout || '').trim());
}
const LEDGER = '.cockpit/state/governance-gate-exceptions.json';

// AC-1: a verified T0 change emits a PASS trailer with base/diff_id/verdict/verifier (no commit SHA).
test('AC-1: emitter prints a PASS trailer for a verified T0 change', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n');
    writeReceipt(dir, { verdict: 'PASS', verifier: 'codex exec' });
    const line = emit(dir);
    expect(line).toMatch(/^Verified-Receipt: base=[0-9a-f]{40} diff_id=[0-9a-f]{64} verdict=PASS verifier=codex exec$/);
    expect(line).not.toContain('head=');
  } finally { cleanup(dir); }
});

// AC-2: no receipt -> no trailer; a T3 change -> no trailer.
test('AC-2: emitter prints nothing without a valid receipt, or for a non-crucial change', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change\n'); // T0, but no receipt
    expect(emit(dir)).toBe('');
    git(dir, ['reset', '-q', '--hard']);
    stage(dir, 'app/ordinary.js', '// a T3 module\n'); // T3
    writeReceipt(dir, { verdict: 'PASS' });
    expect(emit(dir)).toBe(''); // T3 needs no trailer
  } finally { cleanup(dir); }
});

// AC-3: `git commit` injects the trailer exactly once (idempotent across amend).
test('AC-3: commit-msg injects the trailer once, idempotently', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// verified change\n');
    writeReceipt(dir, { verdict: 'PASS', verifier: 'codex exec' });
    git(dir, ['commit', '-q', '-m', 'a verified T0 change']);
    const msg = lastMsg(dir);
    const count = (msg.match(/^Verified-Receipt:/gm) || []).length;
    expect(count).toBe(1);
    // amend (message retained) must not add a second trailer
    git(dir, ['commit', '-q', '--amend', '--no-edit']);
    const count2 = (lastMsg(dir).match(/^Verified-Receipt:/gm) || []).length;
    expect(count2).toBe(1);
  } finally { cleanup(dir); }
});

// AC-4 + AC-7: the audit PASSES a real verified commit (trailer written at commit time re-derives).
test('AC-4/AC-7: audit passes a verified commit; the trailer re-derives at audit time', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// verified change\n');
    writeReceipt(dir, { verdict: 'PASS' });
    git(dir, ['commit', '-q', '-m', 'verified T0']);
    const a = audit(dir, 'main~1..HEAD');
    expect(a.json.overall).toBe('PASS');
    expect(a.json.attested).toBe(1);
    expect(a.status).toBe(0);
  } finally { cleanup(dir); }
});

// AC-5: audit FAILS a T0 commit with no trailer, and one whose code no longer matches its trailer.
test('AC-5: audit fails a T0 commit missing a trailer', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// UNVERIFIED change\n'); // no receipt
    git(dir, ['commit', '-q', '-m', 'unverified T0']); // commit-msg emits nothing -> no trailer
    expect(lastMsg(dir)).not.toMatch(/Verified-Receipt:/);
    const a = audit(dir, 'main~1..HEAD');
    expect(a.json.overall).toBe('FAIL');
    expect(a.json.failed).toBe(1);
    expect(a.status).toBe(1);
  } finally { cleanup(dir); }
});
test('AC-5: audit fails a commit whose content was amended after the trailer (diff_id mismatch)', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// verified\n');
    writeReceipt(dir, { verdict: 'PASS' });
    git(dir, ['commit', '-q', '-m', 'verified T0']);
    expect(audit(dir, 'main~1..HEAD').json.overall).toBe('PASS');
    // tamper: change the committed content but keep the (now-stale) trailer; --no-verify so the hook
    // does not refresh it
    fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// baseline T0 file\n// verified\n// SShh tampered\n');
    git(dir, ['add', 'app/state/atomic-store.js']);
    git(dir, ['commit', '-q', '--amend', '--no-edit', '--no-verify']);
    expect(lastMsg(dir)).toMatch(/Verified-Receipt:/); // stale trailer still present
    const a = audit(dir, 'main~1..HEAD');
    expect(a.json.overall).toBe('FAIL');
    expect(a.json.commits.find((c) => c.status === 'FAIL').detail).toContain('does not match');
  } finally { cleanup(dir); }
});

// Root/first commit (a spawned project's very first commit): a verified T0 commit's trailer
// (base = null-sha) must RE-DERIVE at audit time via the empty tree — not the literal null-sha.
test('root commit: a verified first-ever T0 commit passes the audit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-trail0-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app', 'state'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.githooks'), { recursive: true });
    const copy = (rel) => fs.copyFileSync(path.join(REPO, rel), path.join(dir, rel));
    for (const f of [
      'scripts/emit-verification-trailer.ps1', 'scripts/audit-verification-trailers.ps1',
      'scripts/write-verification-receipt.ps1', 'scripts/classify-stakes.ps1',
      'scripts/lib/change-identity.ps1', 'scripts/lib/receipt-check.ps1', 'scripts/lib/atomic-write.ps1',
      'schemas/verification-receipt.schema.json', '.cockpit/state/stakes-manifest.json', '.githooks/commit-msg',
    ]) copy(f);
    fs.writeFileSync(path.join(dir, '.gitignore'), '.cockpit/evidence/\n');
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'test@pcc.local']);
    git(dir, ['config', 'user.name', 'pcc-test']);
    git(dir, ['config', 'core.hooksPath', '.githooks']);
    git(dir, ['branch', '-M', 'main']);
    // The FIRST commit — scripts + a T0 file, no prior history. base falls back to the null-sha.
    fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// first-ever T0 file\n');
    git(dir, ['add', '-A']);
    writeReceipt(dir, { verdict: 'PASS' });
    git(dir, ['commit', '-q', '-m', 'first-ever verified T0']);
    expect(lastMsg(dir)).toMatch(/Verified-Receipt: base=0{40} diff_id=[0-9a-f]{64} verdict=PASS/);
    // -Last mode (no range) includes the root commit
    const r = ps(dir, 'scripts/audit-verification-trailers.ps1', ['-Json', '-Last', '5']);
    const j = JSON.parse((r.stdout || '').trim());
    expect(j.overall).toBe('PASS');
    expect(j.attested).toBe(1);
  } finally { cleanup(dir); }
});

// A hand-written BYPASS trailer with NO matching disclosed exception in the committed ledger must
// NOT pass the audit (closes the `--no-verify` + forged-BYPASS hole).
test('forged BYPASS: a BYPASS trailer with no committed ledger entry fails the audit', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// sneaky change\n');
    const id = gateId(dir); // correct base + diff_id for this staged change
    const trailer = `Verified-Receipt: base=${id.base} diff_id=${id.diff_id} verdict=BYPASS verifier=attacker`;
    // commit with a correct-diff_id BYPASS trailer but NO ledger entry, skipping hooks
    git(dir, ['commit', '-q', '--no-verify', '-m', `sneaky T0\n\n${trailer}`]);
    const a = audit(dir, 'main~1..HEAD');
    expect(a.json.overall).toBe('FAIL');
    expect(a.json.commits.find((c) => c.status === 'FAIL').detail).toContain('no matching disclosed exception');
  } finally { cleanup(dir); }
});

// A genuine disclosed bypass (a matching, committed ledger entry) DOES pass the audit as 'bypass'.
test('disclosed BYPASS: a committed ledger entry lets the audit pass it as a bypass', () => {
  const dir = makeRepo();
  try {
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// change needing a bypass\n');
    const id = gateId(dir);
    fs.writeFileSync(path.join(dir, LEDGER), JSON.stringify({
      exceptions_id: 'governance-gate-exceptions-v1',
      exceptions: [{ diff_id: id.diff_id, reason: 'owner-approved', authorized_by: 'owner', tier: 'T0' }],
    }));
    git(dir, ['add', LEDGER]); // staging the ledger does NOT change diff_id (it is excluded)
    git(dir, ['commit', '-q', '-m', 'bypassed T0']); // commit-msg emits a BYPASS trailer
    expect(lastMsg(dir)).toMatch(/verdict=BYPASS/);
    const a = audit(dir, 'main~1..HEAD');
    expect(a.json.overall).toBe('PASS');
    expect(a.json.bypassed).toBe(1);
  } finally { cleanup(dir); }
});

// AC-6: T3 commit needs no trailer; a merge commit is skipped (never flagged).
test('AC-6: a T3 commit needs no trailer and a merge commit is skipped', () => {
  const dir = makeRepo();
  try {
    // a plain T3 commit on main — no trailer, must be 'not_required'
    stage(dir, 'app/ordinary.js', '// T3 module\n');
    git(dir, ['commit', '-q', '-m', 'ordinary T3']);
    // a side branch with a verified T0, merged with --no-ff to force a merge commit
    git(dir, ['checkout', '-q', '-b', 'side']);
    stage(dir, 'app/state/atomic-store.js', '// baseline T0 file\n// side change\n');
    writeReceipt(dir, { verdict: 'PASS' });
    git(dir, ['commit', '-q', '-m', 'verified T0 on side']);
    git(dir, ['checkout', '-q', 'main']);
    git(dir, ['merge', '--no-ff', '--no-verify', '-m', 'merge side', 'side']);
    const root = git(dir, ['rev-list', '--max-parents=0', 'HEAD']); // the baseline (audit base)
    const a = audit(dir, `${root}..HEAD`); // spans the T3, the merged T0, and the merge commit
    expect(a.json.overall).toBe('PASS'); // T3 not_required, T0 attested, merge skipped
    expect(a.json.attested).toBe(1);
    expect(a.json.not_required).toBeGreaterThanOrEqual(1);
  } finally { cleanup(dir); }
});
