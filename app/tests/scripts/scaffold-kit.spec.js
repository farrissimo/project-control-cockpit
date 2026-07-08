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
  'scripts/engine-version.json',        // engine-kit version marker (upgrade detection)
  'docs/BACKUP_POLICY.md',              // mandatory backup policy
  'scripts/lifecycle-advance.ps1',      // phase-close gate (no "done" without a PASS)
  'scripts/doctor.ps1',                 // health check
  'scripts/backup-protected-files.ps1', // restore-point insurance
  'scripts/detect-high-stakes.ps1',     // high-stakes signal
  'scripts/validate-cockpit-state.ps1', // doctor dependency
  'scripts/check-schemas.ps1',          // doctor dependency
  'schemas/project-state.schema.json',  // schema doctor/validate need
  'schemas/vision-promises.schema.json',// vision-promises schema
  'app/main.js',                        // the app (carries the proof taxonomy)
  'app/renderer/overview-logic.js',     // Owner Overview deterministic logic
];

for (const rel of KIT) {
  test('new project is born with: ' + rel, () => {
    expect(fs.existsSync(path.join(target, rel))).toBe(true);
  });
}

// The Owner Overview needs a FRESH, project-specific vision-promises.json — never
// PCC's own promises copied in (DECISION-107). It must be a clearly-incomplete
// placeholder marked for owner review.
test('new project gets a fresh vision-promises.json (placeholder, not PCC\'s)', () => {
  const p = path.join(target, '.cockpit', 'state', 'vision-promises.json');
  expect(fs.existsSync(p)).toBe(true);
  const vp = JSON.parse(fs.readFileSync(p, 'utf8'));
  expect(vp.review_status).toBe('needs_owner_review'); // must ask the owner to confirm
  expect(vp.last_reviewed).toBeNull();
  const ids = (vp.promises || []).map((x) => x.id);
  // none of PCC's own promise ids may have leaked into the new project
  for (const pccId of ['reduce-babysitting', 'no-fake-done', 'survive-dead-chats', 'local-first']) {
    expect(ids).not.toContain(pccId);
  }
  // declared_status, not "status" — it must not read as machine proof
  expect(vp.promises[0]).toHaveProperty('declared_status');
});

// Soak fix F7: a freshly-scaffolded project must PASS its own health check. It used
// to fail on day one ("4 issues — don't trust current state") because doctor demanded
// retired-track files the scaffolder deliberately omits. doctor is now scaffold-aware,
// so a clean new project reports zero ISSUEs (warnings like "no git upstream" are fine).
test('a freshly-scaffolded project passes doctor with no ISSUEs', () => {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/doctor.ps1'],
    { cwd: target, encoding: 'utf8', timeout: 120000, windowsHide: true });
  const out = (r.stdout || '') + (r.stderr || '');
  expect(out, 'doctor produced no output').not.toHaveLength(0);
  const issueLines = out.split(/\r?\n/).filter((l) => l.includes('[ISSUE]'));
  expect(issueLines, 'fresh scaffold should have no [ISSUE] findings:\n' + out).toEqual([]);
  expect(out).toMatch(/Overall: no issues/);
});

// Soak fix F9 (config half): the drift/stale-docs baseline must be a ref that actually
// exists in a fresh project (a stable tag), not the non-existent 'main'; and the product
// area must be in scope so building it isn't flagged as drift.
test('generated scope + doc-map use a coherent baseline and include product/**', () => {
  const scope = JSON.parse(fs.readFileSync(path.join(target, '.cockpit', 'state', 'app-build-scope.json'), 'utf8'));
  const map = JSON.parse(fs.readFileSync(path.join(target, '.cockpit', 'state', 'doc-freshness-map.json'), 'utf8'));
  expect(scope.compare_baseline).toBe('pcc-baseline');
  expect(map.compare_baseline).toBe('pcc-baseline');
  expect(scope.allowed_globs).toContain('product/**');
});

// Soak fix F10: the generated bloat config must scope to the owner's product and
// exclude the copied PCC engine, so a new project never gets a bloat warning about
// app/renderer.js (PCC's tool). It must NOT be a copy of PCC's engine-scoped config.
test('generated bloat config is product-scoped and excludes the copied engine (F10)', () => {
  const b = JSON.parse(fs.readFileSync(path.join(target, '.cockpit', 'state', 'bloat-thresholds.json'), 'utf8'));
  expect(b.exclude_globs).toEqual(expect.arrayContaining(['app/**', 'scripts/**']));
  expect(b.source_globs.some((g) => g.startsWith('product/'))).toBe(true);
  expect(b.dependency_manifests).toContain('product/package.json');
  // must not still be scanning PCC's engine as the product
  expect(b.source_globs).not.toContain('app/*.js');
});

// Soak fix F3/F4: a new project declares how to run and verify ITS product, so the
// cockpit's "Run the product" / "Verify product behavior" buttons work without a terminal.
test('new project declares product run + verify commands (F3/F4)', () => {
  const p = JSON.parse(fs.readFileSync(path.join(target, '.cockpit', 'state', 'product-run.json'), 'utf8'));
  expect(p.run).toBeTruthy();
  expect(p.verify).toBeTruthy();
});

// Upgrade detection (DECISION-111): a fresh scaffold carries the CURRENT engine version,
// so a newly-created project reads as 'current', and only older/unknown projects flag for
// upgrade.
test('a fresh scaffold is stamped with the current engine version', () => {
  const home = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts', 'engine-version.json'), 'utf8'));
  const proj = JSON.parse(fs.readFileSync(path.join(target, 'scripts', 'engine-version.json'), 'utf8'));
  expect(proj.engine_version).toBe(home.engine_version);
});

// Anti-drift guard: EVERY scripts/*.ps1 the app invokes must travel, so no button
// is dead in a scaffolded project. Derived from main.js, not a hand-maintained list.
test('every script the app invokes travels into a new project', () => {
  const mainJs = fs.readFileSync(path.join(REPO, 'app', 'main.js'), 'utf8');
  const invoked = [...new Set(mainJs.match(/scripts\/[a-zA-Z0-9-]+\.ps1/g) || [])];
  expect(invoked.length).toBeGreaterThan(5); // sanity: the regex actually matched
  const missing = invoked.filter((s) => !fs.existsSync(path.join(target, s)));
  expect(missing).toEqual([]);
});
