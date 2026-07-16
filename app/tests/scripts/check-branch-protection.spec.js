// Branch-protection checker contract (verification & proof-of-done audit, ADR-0009). PCC's server-side
// "un-bypassable" guarantee rests on GitHub branch protection actually being ON — previously an
// owner-asserted precondition (O1) that nothing checked. check-branch-protection.ps1 verifies the real
// protection contract via the rulesets API and FAILS CLOSED (UNKNOWN when it can't tell, never a fake
// green). These drive the deterministic verdict logic through the -FixtureRuleset seam (synthetic
// ruleset-detail JSON — no live API, no real data). Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-branch-protection.ps1');

// A fully-protecting ruleset detail (mirrors the real `protect-main`).
function fullProtection() {
  return {
    name: 'protect-main',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'] } },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'pull_request' },
      { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'test' }] } },
    ],
  };
}

function writeFixture(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-bp-'));
  const p = path.join(dir, 'ruleset.json');
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
  return p;
}

function check(fixturePath) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Json', '-FixtureRuleset', fixturePath],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  let obj;
  try { obj = JSON.parse((r.stdout || '').trim()); } catch (e) { throw new Error('non-JSON: ' + r.stdout + r.stderr); }
  return { ...obj, exit: r.status };
}

test('PASS + exit 0 on a fully-protecting ruleset', () => {
  const o = check(writeFixture(fullProtection()));
  expect(o.verdict).toBe('PASS');
  expect(o.exit).toBe(0);
  expect(o.reasons).toEqual([]);
});

test('FAIL + exit 1 when the bypass list is non-empty', () => {
  const rs = fullProtection();
  rs.bypass_actors = [{ actor_id: 5, actor_type: 'Team' }];
  const o = check(writeFixture(rs));
  expect(o.verdict).toBe('FAIL');
  expect(o.exit).toBe(1);
  expect(o.reasons.join(' ')).toMatch(/bypass/i);
});

test('FAIL when the required check is not the `test` check', () => {
  const rs = fullProtection();
  rs.rules.find((x) => x.type === 'required_status_checks').parameters.required_status_checks = [{ context: 'something-else' }];
  const o = check(writeFixture(rs));
  expect(o.verdict).toBe('FAIL');
  expect(o.reasons.join(' ')).toMatch(/test/);
});

test('FAIL when a pull request is not required', () => {
  const rs = fullProtection();
  rs.rules = rs.rules.filter((x) => x.type !== 'pull_request');
  const o = check(writeFixture(rs));
  expect(o.verdict).toBe('FAIL');
  expect(o.reasons.join(' ')).toMatch(/pull_request/);
});

test('FAIL when force-push / deletion are not blocked', () => {
  const rs = fullProtection();
  rs.rules = rs.rules.filter((x) => x.type !== 'non_fast_forward');
  const o = check(writeFixture(rs));
  expect(o.verdict).toBe('FAIL');
  expect(o.reasons.join(' ')).toMatch(/non_fast_forward/);
});

test('FAIL when the ruleset is not active (enforcement disabled/evaluate)', () => {
  const rs = fullProtection();
  rs.enforcement = 'disabled';
  const o = check(writeFixture(rs));
  expect(o.verdict).toBe('FAIL');
  expect(o.reasons.join(' ')).toMatch(/active/);
});

// Fail closed: a malformed input is UNKNOWN (exit 2), never a fabricated PASS.
test('UNKNOWN + exit 2 on a malformed fixture (cannot tell, not green)', () => {
  const o = check(writeFixture('{ not json'));
  expect(o.verdict).toBe('UNKNOWN');
  expect(o.exit).toBe(2);
});

// --- classification of the rulesets LIST (the fail-closed distinction Codex flagged) ---
function checkList(fixturePath) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Json', '-FixtureRulesetsList', fixturePath],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  return { ...JSON.parse((r.stdout || '').trim()), exit: r.status };
}

// A successful read we cannot PARSE must be UNKNOWN — never a definitive "unprotected" FAIL.
test('UNKNOWN when the rulesets LIST is unparseable (a read failure is not "unprotected")', () => {
  const o = checkList(writeFixture('{ broken list'));
  expect(o.verdict).toBe('UNKNOWN');
  expect(o.exit).toBe(2);
});

// A parseable list with zero active branch rulesets is a real answer: unprotected → FAIL.
test('FAIL when the list is valid but has no active branch ruleset (genuinely unprotected)', () => {
  const o = checkList(writeFixture([{ id: 1, name: 'x', target: 'tag', enforcement: 'active' }]));
  expect(o.verdict).toBe('FAIL');
  expect(o.exit).toBe(1);
  expect(o.reasons.join(' ')).toMatch(/unprotected/i);
});
