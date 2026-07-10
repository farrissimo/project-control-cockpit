// Origin seam (roadmap #3) — the new-chat handoff must not present a hand-editable clean-room
// TYPE claim as real proof. generate-handoff.ps1 reads app/last-verification.txt (editable), so a
// forged "TYPE: ci_execution" must be labeled a CLAIM, not echoed as if CI actually ran. Runs the
// real script in a throwaway repo (sandbox), so it never touches the real handoff.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ho-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'generate-handoff.ps1'), path.join(dir, 'scripts', 'generate-handoff.ps1'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@t.local'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: dir });
  return dir;
}
function handoff(dir) {
  return spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/generate-handoff.ps1'],
    { cwd: dir, encoding: 'utf8', timeout: 20000 }).stdout;
}
function record(dir, type) {
  fs.writeFileSync(path.join(dir, 'app', 'last-verification.txt'), 'TYPE: ' + type + '\n\nVERDICT: PASS\n');
}

test('handoff labels a FILE-claimed ci_execution as an unverified claim, not real CI proof', () => {
  const dir = makeRepo();
  try {
    record(dir, 'ci_execution');
    const out = handoff(dir);
    expect(out).toMatch(/claimed ci_execution/i);        // honestly flagged as a claim
    expect(out).not.toMatch(/PASS \[ci_execution\]/);    // never presented as a bare clean-room proof
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('handoff shows a trusted local_execution label plainly', () => {
  const dir = makeRepo();
  try {
    record(dir, 'local_execution');
    const out = handoff(dir);
    expect(out).toMatch(/PASS \[local_execution\]/);      // trusted-from-file → plain label
    expect(out).not.toMatch(/claimed/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
