// Run all: `npm test`. Subsets: `npm run test:e2e`, `npm run test:scripts`.
// A pre-commit hook (.githooks/pre-commit) runs this whenever app/ or scripts/
// changes are staged, so a broken button/script can't be committed as working.
// Playwright config — one unified runner for all three test layers:
//   tests/unit/*     pure-JS logic (no Electron)
//   tests/scripts/*  PowerShell detector CLI contract (spawns pwsh)
//   tests/e2e/*      real Electron app, every button, faked worker/verifier
// Electron tests can't share a browser, so we keep workers serial for them via
// fullyParallel:false (safest with a single app window + shared repo state).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testIgnore: '**/tests/external/**', // opt-in real-boundary smoke; runs via its own config
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // In-tool backstop for the whole run (defense-in-depth under scripts/run-guarded.ps1's
  // forward-progress guard). A wedged launch can never turn into a multi-hour zombie: Playwright
  // self-terminates the entire run past this bound. Generous (the suite is Electron-heavy and slow
  // on CI) but finite — the guard's 180s no-progress stall check is the real, faster hang-catcher.
  globalTimeout: 2_700_000, // 45 min
  reporter: [['list']],
  use: { trace: 'off' },
});
