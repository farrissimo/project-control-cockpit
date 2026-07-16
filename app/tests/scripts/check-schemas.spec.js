// Schema-conformance contract (state & data integrity audit). check-schemas.ps1 is a T0 (trust-root)
// file that had NO automated test. Its exit code is dual-use: doctor.ps1 treats it as a REPORT (always
// exits 0), but the worker-handback path (finalize-worker-handback.ps1 / verify-handback-guardrails.ps1)
// HARD-GATES on it (aborts on a non-zero exit). Either way its value is that it actually DETECTS drift,
// so the audit proves it flags a schema-violating canonical file (not just that it passes).
//
// The script hard-codes the three <file, schema> path pairs it checks. We seed a temp repo with
// SYNTHETIC schema + data at exactly those paths (never the real schemas or the live .cockpit state —
// tests must not touch real data), so validity is fully under the test's control. Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-schemas.ps1');

// The exact <data, schema> pairs check-schemas.ps1 validates.
const PAIRS = [
  ['.cockpit/state/project-state.json', 'schemas/project-state.schema.json'],
  ['.cockpit/state/task-state.json', 'schemas/task-state.schema.json'],
  ['.cockpit/result/verification-result.json', 'schemas/verification-result.schema.json'],
];

// A trivial synthetic schema + a conforming instance — no real schema/data involved.
const SYNTH_SCHEMA = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean' } },
  additionalProperties: false,
});
const VALID_DATA = JSON.stringify({ ok: true });

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-schema-'));
  for (const [dataRel, schemaRel] of PAIRS) {
    const dataAbs = path.join(dir, dataRel);
    const schemaAbs = path.join(dir, schemaRel);
    fs.mkdirSync(path.dirname(dataAbs), { recursive: true });
    fs.mkdirSync(path.dirname(schemaAbs), { recursive: true });
    fs.writeFileSync(dataAbs, VALID_DATA);
    fs.writeFileSync(schemaAbs, SYNTH_SCHEMA);
  }
  return dir;
}

function run(cwd) {
  return spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT],
    { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true });
}

test('reports PASS + exits 0 when every file matches its schema', () => {
  const dir = makeRepo();
  const r = run(dir);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  expect(r.stdout).toMatch(/\[PASS\].*project-state\.json/);
  expect(r.stdout).not.toContain('[FAIL]');
  fs.rmSync(dir, { recursive: true, force: true });
});

// The load-bearing guarantee: the check must actually CATCH a schema violation.
test('detects a schema-violating file: FAIL + exit 1', () => {
  const dir = makeRepo();
  // root array violates the object schema; also try a required-field-missing to be thorough
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'project-state.json'), '[]');
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'task-state.json'), JSON.stringify({ nope: 1 }));
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*project-state\.json/);
  expect(r.stdout).toMatch(/\[FAIL\].*task-state\.json/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fails closed when a canonical file is missing: FAIL + exit 1', () => {
  const dir = makeRepo();
  fs.rmSync(path.join(dir, '.cockpit', 'state', 'task-state.json'));
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*task-state\.json.*not found/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fails closed when a schema file is missing', () => {
  const dir = makeRepo();
  fs.rmSync(path.join(dir, 'schemas', 'task-state.schema.json'));
  const r = run(dir);
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\[FAIL\].*task-state\.json.*schema file/);
  fs.rmSync(dir, { recursive: true, force: true });
});
