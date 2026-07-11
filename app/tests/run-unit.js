// Cross-Node-version unit-suite runner (Part 7 closeout / CI fix).
//
// WHY: `node --test "tests/unit/**/*.test.js"` relies on command-line GLOB support,
// which Node only added in v21. CI pins Node 20, so that form errors there (and the
// step's failure silently skipped the rest of the CI job). Passing EXPLICIT file
// paths to `node --test` works on Node 18+, so it runs identically on CI's Node 20 and
// a Node 24 dev machine.
//
// It enumerates the node:test files at runtime (rather than a hardcoded list, which
// already silently dropped mutex.test.js) and runs ONLY *.test.js — the *.spec.js
// files in tests/unit are Playwright specs and must not be run under node:test.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const unitDir = path.join(__dirname, 'unit');
// Recurse — the pattern this replaces was `tests/unit/**/*.test.js`, so a *.test.js in
// a SUBDIRECTORY must not be silently dropped. readdirSync's `recursive` option is
// Node >=18.17 / >=20.1 (CI's Node 20.x supports it), returning paths relative to
// unitDir. statSync().isFile() guards the absurd case of a dir named "*.test.js".
const files = fs.readdirSync(unitDir, { recursive: true })
  .map((rel) => path.join(unitDir, rel))
  .filter((p) => p.endsWith('.test.js') && fs.statSync(p).isFile())
  .sort();

// Fail closed: an empty file set must never look like a passing run.
if (files.length === 0) {
  console.error('run-unit: no *.test.js files found in ' + unitDir + ' — refusing to report success.');
  process.exit(1);
}

const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (r.error) {
  console.error('run-unit: failed to spawn node --test: ' + r.error.message);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
