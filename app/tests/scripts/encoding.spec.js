// Regression guards for the "non-ASCII silently blanks a panel" bug. Three
// angles: (1) every app-parsed JSON script still carries the UTF-8 output guard,
// (2) the guard technique actually round-trips hostile characters on this
// machine's pwsh, (3) the real data that first triggered it (a § in a decision
// title) parses end-to-end.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const FIXTURE = path.join(__dirname, '..', 'fixtures', 'emit-nonascii.ps1');

// Every script main.js parses with JSON.parse must emit UTF-8, or a non-ASCII
// char corrupts the pipe and the app silently drops the data.
const JSON_SCRIPTS = [
  'detect-untracked', 'detect-drift', 'detect-stale-docs', 'detect-repo-sync',
  'detect-bloat', 'detect-high-stakes', 'lifecycle-status', 'babysitting-metrics', 'recent-decisions',
];

for (const name of JSON_SCRIPTS) {
  test('UTF-8 output guard present: ' + name, () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts', name + '.ps1'), 'utf8');
    expect(src, name + ' lost its UTF-8 output guard').toMatch(/OutputEncoding\s*=\s*\[?(System\.Text\.Encoding|Text\.Encoding)\]?::UTF8/i);
  });
}

test('hostile non-ASCII round-trips through pwsh JSON output', () => {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', FIXTURE],
    { cwd: REPO, encoding: 'utf8', timeout: 20000, windowsHide: true });
  let obj;
  expect(() => { obj = JSON.parse(r.stdout); }, 'output was not valid JSON:\n' + r.stdout).not.toThrow();
  const joined = obj.items.join('\n');
  for (const ch of ['é', 'ã', '✓', '→', '“', '”', '–', '—', '§']) {
    expect(joined, 'lost character: ' + ch).toContain(ch);
  }
});

test('real § decision title parses end-to-end (recent-decisions)', () => {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/recent-decisions.ps1', '-Json', '-Count', '5'],
    { cwd: REPO, encoding: 'utf8', timeout: 20000, windowsHide: true });
  const obj = JSON.parse(r.stdout);
  const d101 = obj.decisions.find((d) => d.num === 101);
  expect(d101, 'DECISION-101 not in the latest 5 — adjust the count').toBeTruthy();
  expect(d101.title).toContain('§');
});
