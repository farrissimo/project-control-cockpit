const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const FAKEBIN = path.join(REPO, 'app', 'tests', 'fakebin');

function runSecondOpinion({ provider = 'ag', prompt, argvFile }) {
  const env = {
    ...process.env,
    PCC_TEST_MODE: '1',
    PCC_FAKE_AGY_ARGV_FILE: argvFile,
    PATH: FAKEBIN + path.delimiter + process.env.PATH,
    Path: FAKEBIN + path.delimiter + (process.env.Path || process.env.PATH || ''),
  };
  return spawnSync(
    'pwsh',
    ['-NoProfile', '-File', 'scripts/second-opinion.ps1', '-Provider', provider],
    { cwd: REPO, input: prompt, env, encoding: 'utf8', timeout: 30000, windowsHide: true },
  );
}

test('AG review bridge preserves a multiline review-only prompt through --print', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-second-opinion-'));
  const argvFile = path.join(dir, 'agy-argv.json');
  const prompt = [
    'Review this answer only.',
    'Do no editing, no implementation, no file changes, and no direct work on the codebase.',
    'Begin your reply with EXACTLY one of: AGREE / PARTIALLY AGREE / DISAGREE.',
    'Line four proves the multiline payload survives the bridge.',
  ].join('\n');

  const r = runSecondOpinion({ prompt, argvFile });

  expect(r.status, r.stdout + r.stderr).toBe(0);
  expect(r.stdout).toContain('FAKE-AGY-REPLY');

  const record = JSON.parse(fs.readFileSync(argvFile, 'utf8'));
  expect(record.argv).toContain('--print');
  const seenPrompt = record.argv[record.argv.length - 1] || '';
  expect(seenPrompt).toContain('Review this answer only.');
  expect(seenPrompt).toContain('Do no editing, no implementation, no file changes, and no direct work on the codebase.');
  expect(seenPrompt).toContain('Begin your reply with EXACTLY one of: AGREE / PARTIALLY AGREE / DISAGREE.');
  expect(seenPrompt).toContain('Line four proves the multiline payload survives the bridge.');
});

