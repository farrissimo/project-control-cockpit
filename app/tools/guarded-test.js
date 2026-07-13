// CANONICAL guarded entrypoint for the Playwright suites.
//
// `npm test`, `npm run test:e2e`, `npm run test:scripts` all go THROUGH here so the long Electron
// suite — the exact run that once wedged for ~7h — can never silently run unguarded. This wrapper
// routes the real suite through scripts/run-guarded.ps1 (reaps stale test Electrons, aborts on no
// forward progress, writes a machine-readable heartbeat/verdict). The raw runner stays available as
// `npm run test:raw` (a clearly-named implementation detail the guard invokes) so nothing recurses.
//
// Recursion / double-guard safety: run-guarded.ps1 sets PCC_GUARDED=1 for its child subtree. When
// this wrapper sees that, it runs the suite RAW (it is already inside a guard — e.g. the release gate
// wraps its own guard around test:raw). So a guarded command never wraps itself in a second guard.
//
// Extractability: if scripts/run-guarded.ps1 is absent (a copy shipped without scripts/), the suite
// still runs — but with a LOUD warning to stderr, never a silent unguarded run.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.join(__dirname, '..'); // app/
const REPO = path.join(APP_DIR, '..');
const guard = path.join(REPO, 'scripts', 'run-guarded.ps1');
const passthru = process.argv.slice(2); // e.g. "tests/e2e" for the e2e subset

// Argument forwarding is done through a PowerShell -EncodedCommand (base64 UTF-16LE), NOT a hand-quoted
// cmd string. Why: the guard runs its child via `cmd.exe /c`, and cmd expands `%VAR%` even inside
// double quotes — so a subset arg like `--grep "100%done"` would be mutated before Playwright saw it.
// A base64 token is only [A-Za-z0-9+/=]: cmd passes it through untouched, and the decoded PowerShell
// invokes `npm run test:raw` with the subset args as a real argument array, so spaces, %, quotes, and
// & | > < all survive to Playwright exactly as the caller typed them. '--' is quoted so PowerShell
// forwards it to npm literally instead of consuming it as its own end-of-parameters token.
function psQuote(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }
const psInner = 'npm run test:raw' + (passthru.length ? " '--' " + passthru.map(psQuote).join(' ') : '');
const enc = Buffer.from(psInner, 'utf16le').toString('base64');

// PCC_GUARD_INNER overrides the whole inner command verbatim (used by the guard's own contract tests to
// prove the canonical entrypoint cannot bypass the guard, and to reuse this wrapper for other suites).
const innerOverride = process.env.PCC_GUARD_INNER || null;
const innerCmd = innerOverride || ('pwsh -NoProfile -EncodedCommand ' + enc);

function runRaw(reasonWarn) {
  if (reasonWarn) console.error('[pcc][guarded-test] WARNING: ' + reasonWarn);
  const r = innerOverride
    ? spawnSync(innerOverride, { cwd: APP_DIR, stdio: 'inherit', shell: true })
    : spawnSync('pwsh', ['-NoProfile', '-EncodedCommand', enc], { cwd: APP_DIR, stdio: 'inherit' });
  process.exit(r.status == null ? 1 : r.status);
}

// Already guarded, or no guard script present -> run raw (loudly, in the missing-guard case).
if (process.env.PCC_GUARDED === '1') runRaw(null);
if (!fs.existsSync(guard)) runRaw('scripts/run-guarded.ps1 not found — running the suite UNGUARDED (no hang protection).');

// Label names the guard's evidence files (<label>.out.log / .verdict.json / .heartbeat.json). Default
// 'suite' (+ any subset arg). PCC_GUARD_LABEL overrides it so a nested invocation never collides with
// an outer guard's open log handles (used by the guard's own contract tests, which run inside the
// guarded suite).
const label = process.env.PCC_GUARD_LABEL
  || ('suite' + (passthru.length ? '-' + passthru.join('_').replace(/[^A-Za-z0-9._-]/g, '_') : ''));
const g = spawnSync('pwsh', ['-NoProfile', '-File', guard, '-Label', label, '-WorkDir', APP_DIR, '-Command', innerCmd],
  { cwd: REPO, stdio: 'inherit' });
// pwsh unavailable (spawn error) -> fall back loudly rather than fail the whole suite on infra.
if (g.error) runRaw('could not launch pwsh for the guard (' + g.error.message + ') — running the suite UNGUARDED.');
// Propagate the guard's exit code verbatim: 0 pass; 1 fail; 2 guard-setup-error; 3 HUNG; 4 CAP. Any
// nonzero fails the caller (CI, pre-commit) — a guard that could not run is never a silent green.
process.exit(g.status == null ? 1 : g.status);
