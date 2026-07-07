// OPT-IN real-boundary smoke. Run manually: `npm run test:external-smoke`.
// NOT part of `npm test` / the commit hook — it touches the real binaries.
//
// It deliberately does NOT run a real (paid, non-deterministic) worker/verifier
// turn. It only proves the executables the app depends on are actually present
// and launchable — the one thing the faked suite can't tell you, and the thing
// most likely to be silently broken before a release (missing/renamed binary,
// not on PATH). Uses the REAL PATH (no fakebin injection).
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');

function version(bin) {
  const r = spawnSync(bin, ['--version'],
    { encoding: 'utf8', timeout: 25000, shell: true, windowsHide: true });
  return { code: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim(), error: r.error };
}

test('Claude worker binary is installed and launchable', () => {
  const r = version('claude');
  expect(r.error, 'claude not found on PATH — the worker cannot run').toBeFalsy();
  expect(r.code, 'claude --version exited non-zero:\n' + r.out).toBe(0);
  expect(r.out.length).toBeGreaterThan(0);
});

test('Codex verifier binary is installed and launchable', () => {
  const r = version('codex');
  expect(r.error, 'codex not found on PATH — independent verification cannot run').toBeFalsy();
  expect(r.code, 'codex --version exited non-zero:\n' + r.out).toBe(0);
});

test('pwsh (PowerShell 7) is installed — the scripts require it', () => {
  const r = version('pwsh');
  expect(r.error, 'pwsh not found on PATH — the detector scripts cannot run').toBeFalsy();
  expect(r.code).toBe(0);
});
