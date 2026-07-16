// The composer must still work after a turn finishes — i.e. you can send a SECOND message.
//
// Why this exists: every other chat spec sends ONE message and asserts the reply arrived. None
// of them ever asked whether the owner can still type the next one. That gap hid a real wedge:
// #send's disabled state is DERIVED (`inRecovery || busy`, setRecoveryState) but is only ever
// recomputed by a store read. A send sets busy=true, appends the reply (chatCmd -> refreshCanonical
// -> setRecoveryState) which latches the button disabled while busy is still true, then clears
// busy in a finally that never recomputes the button. So Send stays dead until some UNRELATED
// store read happens to fire afterwards.
//
// In a mature cockpit, chat auto-naming/summaries fire constantly and quietly unstick it, which is
// why this never showed up. In a BRAND-NEW project's first chat nothing follows the first turn —
// so the owner's first ever interaction with a new project ends with a permanently dead Send
// button and no error. Found by driving the real app as the owner (Operation Understudy).
//
// Isolation: PCC_TEST_MODE + throwaway --user-data-dir (launchApp); fake worker. Never real data.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

test('the owner can send a second message after the first turn completes', async () => {
  await page.fill('#input', 'first message');
  await page.click('#send');

  // `:not(.thinking)` is load-bearing. The in-flight placeholder is itself `.bubble.assistant
  // .thinking`, so waiting on `.bubble.assistant` matches DURING the turn — which made the first
  // version of this test assert on a still-busy composer and pass while the bug was live.
  await page.waitForSelector('.bubble.assistant:not(.thinking)', { timeout: 20000 });

  // The turn is over, so the composer must be usable again. This is the bug: the reply lands,
  // nothing is in flight, and Send is still dead with no error shown.
  await expect(page.locator('#send')).toBeEnabled({ timeout: 8000 });
  await expect(page.locator('#input')).toBeEnabled();

  // And it must actually work via the BUTTON, not merely look enabled. Enter is not a
  // substitute: form.requestSubmit() ignores a disabled submit button, so the keyboard path
  // keeps working and hides a dead button from anyone who types by habit.
  await page.fill('#input', 'second message');
  await page.click('#send');
  await expect
    .poll(async () => (await page.locator('.bubble.user').allInnerTexts()).join('\n'), { timeout: 20000 })
    .toContain('second message');
});
