// Assurance kit travels: bootstrap-project.ps1 must birth every new project with
// the FULL cockpit engine and guardrails, not a hand-picked subset (which silently
// drifted — the CI workflow, the pre-commit gate, and several app-invoked scripts
// never travelled). See DECISION-106 ("born bulletproof-by-default"). This runs the
// real scaffolder into a temp dir and asserts the kit landed. The last test is the
// anti-drift guard: it derives the app-invoked scripts from main.js and proves ALL
// of them travel, so a future missing script fails the build instead of shipping a
// dead button.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..'); // repo root (app/ is one below)
const INBOX = path.join(REPO, '.cockpit', 'state', 'scaffolded-inbox.json');

let target, inboxBefore;

test.beforeAll(() => {
  // The scaffolder appends the new project path to the repo's inbox — preserve and
  // restore it so running this test never pollutes the real project switcher.
  inboxBefore = fs.existsSync(INBOX) ? fs.readFileSync(INBOX, 'utf8') : null;
  target = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-kit-'));
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/bootstrap-project.ps1',
    '-Target', target, '-Name', 'Kit Test', '-NoGit'],
    { cwd: REPO, encoding: 'utf8', timeout: 180000, windowsHide: true });
  if (r.status !== 0) throw new Error('bootstrap failed: ' + (r.stderr || r.stdout));
});

test.afterAll(() => {
  try { fs.rmSync(target, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  try {
    if (inboxBefore === null) fs.rmSync(INBOX, { force: true });
    else fs.writeFileSync(INBOX, inboxBefore);
  } catch (e) { /* best effort */ }
});

// The guardrails + key engine files that MUST be born with every project.
const KIT = [
  '.github/workflows/ci.yml',           // clean-machine CI (execution proof)
  '.githooks/pre-commit',               // local test gate
  'docs/BACKUP_POLICY.md',              // mandatory backup policy
  'scripts/lifecycle-advance.ps1',      // phase-close gate (no "done" without a PASS)
  'scripts/doctor.ps1',                 // health check
  'scripts/backup-protected-files.ps1', // restore-point insurance
  'scripts/detect-high-stakes.ps1',     // high-stakes signal
  'scripts/validate-cockpit-state.ps1', // doctor dependency
  'scripts/check-schemas.ps1',          // doctor dependency
  'schemas/project-state.schema.json',  // schema doctor/validate need
  'app/main.js',                        // the app (carries the proof taxonomy)
];

for (const rel of KIT) {
  test('new project is born with: ' + rel, () => {
    expect(fs.existsSync(path.join(target, rel))).toBe(true);
  });
}

// Anti-drift guard: EVERY scripts/*.ps1 the app invokes must travel, so no button
// is dead in a scaffolded project. Derived from main.js, not a hand-maintained list.
test('every script the app invokes travels into a new project', () => {
  const mainJs = fs.readFileSync(path.join(REPO, 'app', 'main.js'), 'utf8');
  const invoked = [...new Set(mainJs.match(/scripts\/[a-zA-Z0-9-]+\.ps1/g) || [])];
  expect(invoked.length).toBeGreaterThan(5); // sanity: the regex actually matched
  const missing = invoked.filter((s) => !fs.existsSync(path.join(target, s)));
  expect(missing).toEqual([]);
});
