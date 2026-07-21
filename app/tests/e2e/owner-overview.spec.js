// Owner/Visionary Overview (DECISION-107) rendered in the REAL app. Proves the
// Project page now LEADS with the meaning layer, that a code-review pass never
// reads as executed proof, and that the journey comes from the real lifecycle.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

test('Project page leads with the Owner Overview (condition + honest proof)', async () => {
  await page.locator('.nav[data-view="project"]').click();
  const ov = page.locator('#owner-overview');
  // Generous timeout: the overview waits on real detectors (several pwsh spawns).
  await expect(ov.locator('.ov-condition')).toHaveCount(1, { timeout: 25000 });

  // Condition is one of the known deterministic labels — never a fake percentage.
  const cond = (await ov.locator('.ov-condition').textContent()).trim();
  expect(['Healthy', 'Needs proof', 'Needs attention', 'Blocked', 'Unknown']).toContain(cond);

  // Honest proof language: a code review must never read as executed proof. CI IS surfaced in the
  // Verified chip (the old "not yet wired into PCC" claim was corrected — see overview-ci-claim.spec.js).
  await expect(ov).toContainText('Executed proof in app: not surfaced in the app yet');
  await expect(ov).toContainText('surfaced in the "Verified" chip');

  // The two owner-answer cards exist.
  await expect(page.locator('.ov-card-title', { hasText: 'Needs you' })).toHaveCount(1);
  await expect(page.locator('.ov-card-title', { hasText: 'Next best move' })).toHaveCount(1);

  // Journey strip renders the real lifecycle (exactly one "now" chip).
  await expect(ov.locator('.ov-step.now')).toHaveCount(1);
});

test('vision promises render as declared self-assessment, not proof', async () => {
  await page.locator('.nav[data-view="project"]').click();
  const ov = page.locator('#owner-overview');
  // PCC's own promises appear as cards, each with a clearly-labelled "declared:" badge.
  await expect(ov.locator('.ov-promise').first()).toBeVisible();
  await expect(ov.locator('.ov-declared').first()).toContainText('declared:');
});
