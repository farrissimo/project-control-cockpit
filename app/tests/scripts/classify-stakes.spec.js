// Governor slice 1 (ADR-0006): the stakes classifier decides a change's tier from WHICH
// files it touches (a git fact) against the declared manifest — not an LLM's self-rating.
// These run the script exactly as the app/gate will (pwsh -File ... -Json) and assert the
// contract. Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function classify(args) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/classify-stakes.ps1', '-Json', ...args],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  const out = (r.stdout || '').trim();
  try { return JSON.parse(out); } catch (e) { throw new Error('non-JSON output:\n' + out + '\n' + (r.stderr || '')); }
}

test('valid JSON contract shape', () => {
  const o = classify(['-Files', 'app/state/atomic-store.js']);
  expect(o.schema).toBe('stakes-classification/v1');
  expect(typeof o.tier).toBe('string');
  expect(Array.isArray(o.reasons)).toBe(true);
  expect(Array.isArray(o.files)).toBe(true);
  expect(Array.isArray(o.escalations)).toBe(true);
  expect(typeof o.not_proven).toBe('string');
});

test('T0 integrity floor: the durable-write primitive', () => {
  expect(classify(['-Files', 'app/state/atomic-store.js']).tier).toBe('T0');
});
test('T0: execution authority', () => {
  expect(classify(['-Files', 'app/authority-store.js']).tier).toBe('T0');
});
test('T2: an auto-loaded agent-instruction doc', () => {
  expect(classify(['-Files', 'AGENTS.md']).tier).toBe('T2');
});
test('T3: an ordinary product module (the default tier)', () => {
  expect(classify(['-Files', 'app/chat-summary.js']).tier).toBe('T3');
});
test('T4: noise (backlog / proposals) can sit BELOW the default', () => {
  expect(classify(['-Files', 'backlog/IDEAS.md']).tier).toBe('T4');
  expect(classify(['-Files', 'docs/proposals/x.md']).tier).toBe('T4');
});

test('mixed change takes the HIGHEST tier among its files', () => {
  expect(classify(['-Files', 'backlog/IDEAS.md,app/authority-logic.js']).tier).toBe('T0');
});

test('an unknown NEW file is the default tier, never noise', () => {
  const o = classify(['-Added', 'some/brand/new/thing.xyz']);
  expect(o.tier).toBe('T3');
});

test('a deletion escalates to at least T1', () => {
  const o = classify(['-Deleted', 'README.md']);
  expect(o.tier).toBe('T1');
  expect(o.escalations.some((e) => e.id === 'delete_or_rename')).toBe(true);
});
test('a schema change escalates to at least T1', () => {
  const o = classify(['-Files', 'schemas/handoff-packet.schema.json']);
  expect(o.escalations.some((e) => e.id === 'schema_change')).toBe(true);
  expect(['T0', 'T1']).toContain(o.tier);
});
test('the governed entity cannot quietly downgrade its own governor (self-edit -> T0)', () => {
  const o = classify(['-Files', '.cockpit/state/stakes-manifest.json']);
  expect(o.tier).toBe('T0');
  expect(o.escalations.some((e) => e.id === 'governor_self_edit')).toBe(true);
});
test('CI/hooks changes escalate to T0', () => {
  expect(classify(['-Files', '.github/workflows/ci.yml']).tier).toBe('T0');
});

// --- Rename classification (docs/specs/governor-rename-classification.md) -------------------
// The tests above HAND the classifier its change lists, so they only prove the RULE fires once
// something else has spotted the removal. They cannot prove the classifier DERIVES a removal from
// real git — and that derivation is where it failed: `--diff-filter=D` misses a rename, because
// git reports one as `R`, which is neither A nor D. These drive REAL git in a throwaway repo.
//
// The classifier does `$repo = Split-Path -Parent $PSScriptRoot; Set-Location $repo`, so it always
// classifies the repo CONTAINING it. It must therefore be COPIED INTO the fixture (the proven
// makeRepo pattern from governance-gate.spec.js); pointing PCC's own copy at a fixture cwd would
// silently classify PCC's working tree and prove nothing. AC-6 pins that with a unique marker path.
const MARK_BEFORE = 'docs/rename-fixture-marker-before.md';
const MARK_AFTER = 'docs/rename-fixture-marker-after.md';

// `renames` pins the fixture's diff.renames config. It must NEVER be left to the machine: with
// rename detection OFF git reports a rename as plain D+A, which the PRE-FIX code already caught —
// so a test that doesn't pin this could pass against the broken classifier and prove nothing.
// AC-1/AC-4 pin it TRUE (the exact condition that was broken); AC-5 pins it FALSE as the
// config-independence guard.
function makeClassifyRepo({ renames = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-classify-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'classify-stakes.ps1'), path.join(dir, 'scripts', 'classify-stakes.ps1'));
  fs.copyFileSync(path.join(REPO, '.cockpit', 'state', 'stakes-manifest.json'),
    path.join(dir, '.cockpit', 'state', 'stakes-manifest.json'));
  // Long enough that git's rename detection has real content to match on.
  fs.writeFileSync(path.join(dir, MARK_BEFORE), 'fixture marker file\n'.repeat(40));
  fixGit(dir, ['init', '-q']);
  fixGit(dir, ['config', 'user.email', 'test@pcc.local']);
  fixGit(dir, ['config', 'user.name', 'pcc-test']);
  fixGit(dir, ['config', 'diff.renames', renames ? 'true' : 'false']);
  fixGit(dir, ['branch', '-M', 'main']);
  fixGit(dir, ['add', '-A']);
  fixGit(dir, ['commit', '-q', '-m', 'baseline']);
  return dir;
}
// Assert git really did report the rename as `R` — the precondition the fix exists for. Without
// this the test could be exercising a D+A change and silently proving the wrong thing.
function expectGitReportsRename(dir, ref) {
  const status = fixGit(dir, ['diff', '-M', '--name-status', ...(ref ? [ref] : ['HEAD'])]);
  expect(status, 'fixture precondition: git must report this as R, else the test is vacuous')
    .toMatch(/^R\d*\t/m);
}
function fixGit(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }

// Run the fixture's OWN copy of the classifier, from inside the fixture, in git mode.
function classifyInFixture(dir, extra = []) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/classify-stakes.ps1', '-Json', ...extra],
    { cwd: dir, encoding: 'utf8', timeout: 30000, windowsHide: true });
  const out = (r.stdout || '').trim();
  try { return JSON.parse(out); } catch (e) { throw new Error('non-JSON output:\n' + out + '\n' + (r.stderr || '')); }
}
function withRepo(fn, opts) {
  const dir = makeClassifyRepo(opts);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const renamed = (o) => o.escalations.some((e) => e.id === 'delete_or_rename');

// AC-1 + AC-6: a staged tracked rename is SEEN, escalates to T1, and the fixture is what got classified.
test('AC-1/AC-6: a real staged git RENAME escalates to T1 (git reports R: neither A nor D)', () => {
  withRepo((dir) => {
    fixGit(dir, ['mv', MARK_BEFORE, MARK_AFTER]);
    expectGitReportsRename(dir);
    const o = classifyInFixture(dir);
    // AC-6 first: if this fails, the test is classifying the wrong repo and every other
    // assertion in it is meaningless.
    const paths = o.files.map((f) => f.path);
    expect(paths, 'must classify the FIXTURE, not PCC: ' + JSON.stringify(paths)).toContain(MARK_AFTER);
    expect(renamed(o), 'delete_or_rename must fire for a rename: ' + JSON.stringify(o.escalations)).toBe(true);
    expect(o.tier).toBe('T1');
  });
});

// The old path must be reported as removed under its OWN name — not just "something changed".
test('AC-1: the rename reports the OLD path as deleted (not merely the new path as added)', () => {
  withRepo((dir) => {
    fixGit(dir, ['mv', MARK_BEFORE, MARK_AFTER]);
    const o = classifyInFixture(dir);
    const esc = o.escalations.find((e) => e.id === 'delete_or_rename');
    expect(esc, 'delete_or_rename must fire').toBeTruthy();
    expect(esc.detail, 'the vanished path must be named: ' + esc.detail).toContain(MARK_BEFORE);
  });
});

// A tracked path may legitimately contain a comma. The classifier's -Files/-Added/-Deleted params
// are comma-separated by contract, so their tokenizer splits on ','. Rename status lines are
// TAB-delimited and must NOT go through that splitter, or one real path becomes two fake ones.
test('AC-7: a renamed path containing a comma is not split into fake paths', () => {
  withRepo((dir) => {
    const oddBefore = 'docs/rename, with comma.md';
    const oddAfter = 'docs/renamed, with comma.md';
    fs.writeFileSync(path.join(dir, oddBefore), 'comma path fixture\n'.repeat(40));
    fixGit(dir, ['add', '-A']);
    fixGit(dir, ['commit', '-q', '-m', 'add comma path']);
    fixGit(dir, ['mv', oddBefore, oddAfter]);
    expectGitReportsRename(dir);
    const o = classifyInFixture(dir);
    expect(renamed(o)).toBe(true);
    const paths = o.files.map((f) => f.path);
    expect(paths, 'the comma path must survive intact: ' + JSON.stringify(paths)).toContain(oddBefore);
    expect(paths).toContain(oddAfter);
    // Asserting the real paths are PRESENT is not enough — a comma-splitting derivation reports
    // them intact from the rename status line AND emits the fragments from --name-only. The bug
    // only shows up as fragments that must NOT be there.
    const fakes = paths.filter((p) => !p.includes(',') && /(^|\/)(rename|renamed)$|^with comma\.md$/.test(p));
    expect(fakes, 'a comma path must not be split into fragments: ' + JSON.stringify(paths)).toEqual([]);
    expect(o.files.length, 'exactly the 2 real paths, no invented ones: ' + JSON.stringify(paths)).toBe(2);
  });
});

// AC-2: deletions keep working (the half that was never broken).
test('AC-2: a real git DELETION still escalates to T1', () => {
  withRepo((dir) => {
    fixGit(dir, ['rm', '-q', MARK_BEFORE]);
    const o = classifyInFixture(dir);
    expect(renamed(o)).toBe(true);
    expect(o.tier).toBe('T1');
  });
});

// AC-3: an ordinary content edit must NOT be mistaken for a rename.
test('AC-3: an ordinary content edit gets NO false rename escalation', () => {
  withRepo((dir) => {
    fs.writeFileSync(path.join(dir, MARK_BEFORE), 'edited content\n');
    const o = classifyInFixture(dir);
    expect(renamed(o), 'a content edit is not a rename: ' + JSON.stringify(o.escalations)).toBe(false);
    expect(o.tier).toBe('T3');
  });
});

// AC-5: the verdict must not depend on the machine's git config. `diff.renames false` makes git
// report the rename as D+A instead of R; either way the answer is T1.
test('AC-5: a rename escalates to T1 even when diff.renames is disabled locally', () => {
  withRepo((dir) => {
    fixGit(dir, ['mv', MARK_BEFORE, MARK_AFTER]);
    const o = classifyInFixture(dir);
    expect(renamed(o), 'must not depend on diff.renames: ' + JSON.stringify(o.escalations)).toBe(true);
    expect(o.tier).toBe('T1');
  }, { renames: false });
});

// AC-4: the deadlock. CI's auditor derives a commit's lists with `git diff-tree` (plumbing =
// rename detection OFF) and calls a rename T1. The local gate derives from `git diff` (porcelain =
// rename detection ON) and saw T3 -> no receipt required -> no trailer -> CI FAILs a commit the
// local gate can never make compliant. Both sides must land on T1.
test('AC-4: local git-mode and CI diff-tree derivation agree on a committed rename (T1)', () => {
  withRepo((dir) => {
    fixGit(dir, ['checkout', '-q', '-b', 'feat']);
    fixGit(dir, ['mv', MARK_BEFORE, MARK_AFTER]);
    fixGit(dir, ['commit', '-q', '-m', 'rename the marker']);
    expectGitReportsRename(dir, 'main...HEAD');

    // The LOCAL gate's path: git mode, baseline main.
    const local = classifyInFixture(dir, ['-Baseline', 'main']);

    // CI's auditor path, reproduced exactly as audit-verification-trailers.ps1 derives it.
    const dt = (filter) => fixGit(dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root',
      ...(filter ? ['--diff-filter=' + filter] : []), 'HEAD']).split('\n').filter(Boolean);
    const ci = classifyInFixture(dir, ['-Files', dt('').join('\n'), '-Added', dt('A').join('\n'),
      '-Deleted', dt('D').join('\n')]);

    expect(ci.tier, 'CI already calls a rename T1 — that half was never broken').toBe('T1');
    expect(local.tier, 'local must agree with CI, or the commit cannot be made compliant').toBe('T1');
  });
});

// Fail closed: with no manifest present, classification is UNKNOWN — never a low tier.
test('missing manifest -> UNKNOWN (fail closed)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-stakes-'));
  try {
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'classify-stakes.ps1'), path.join(tmp, 'scripts', 'classify-stakes.ps1'));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/classify-stakes.ps1', '-Json', '-Files', 'app/state/atomic-store.js'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const o = JSON.parse((r.stdout || '').trim());
    expect(o.tier, 'no manifest must be UNKNOWN, not a low tier:\n' + r.stdout).toBe('UNKNOWN');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
