// Config for the OPT-IN real-boundary smoke tests (npm run test:external-smoke).
// Kept separate from the default suite so `npm test` / the commit hook never
// touch the real worker/verifier binaries.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/external',
  workers: 1,
  timeout: 40_000,
  reporter: [['list']],
});
