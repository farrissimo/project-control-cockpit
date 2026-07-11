// Layer 2 (Phase 2A slice 4.1) — canonical chat store through the REAL preload
// bridge + main-process handlers. Every assertion goes through window.pcc.* so it
// exercises the ACTUAL IPC wiring (a bypass that talked to the store module
// directly would not catch a broken/renamed handler or a dropped identity arg).
//
// Isolation: launchApp runs Electron with PCC_TEST_MODE and a throwaway
// --user-data-dir, so chatsDir() is rooted under disposable userData and can never
// touch the real project's .cockpit/chats. Worker/verifier are faked on PATH.
//
// NOTE: this spec launches a TEST-MODE Electron instance (throwaway data), not the
// owner's real app. It is intentionally NOT run in the recovery sandbox ("do not
// launch PCC"); it runs in an Electron-capable environment / CI.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

const call = (method, ...args) =>
  page.evaluate(([m, a]) => window.pcc[m](...a), [method, args]);

test('read -> mutate through IPC, with identity + revision enforcement', async () => {
  // The S5 renderer bootstraps + seeds + sets-active the store during boot; let
  // those async mutations settle so the revision we read is stable (poll until two
  // consecutive reads agree), otherwise our create would race the boot revision.
  let rev0 = -1;
  for (let i = 0; i < 40; i++) {
    const a = (await call('chatsRead')).store.revision;
    await page.waitForTimeout(150);
    const b = (await call('chatsRead')).store.revision;
    if (a === b) { rev0 = b; break; }
  }
  expect(rev0).toBeGreaterThanOrEqual(0);

  const read = await call('chatsRead');
  expect(read.ok).toBe(true);
  expect(read.store).toBeTruthy();
  const pid = read.projectId;
  expect(typeof pid).toBe('string');
  expect(read.store.projectId).toBe(pid);
  const rev = read.store.revision;

  // Create a chat through IPC with the correct identity + revision.
  const created = await call('chatsCreate', pid, rev, { id: 'c2', name: 'Second' });
  expect(created.ok).toBe(true);
  expect(created.chatId).toBe('c2');

  // Append a message to that chat through IPC.
  const appended = await call('chatsAppend', pid, created.revision, { chatId: 'c2', message: { id: 'm1', cls: 'user', text: 'hi', ts: 1 } });
  expect(appended.ok).toBe(true);

  // A stale expectedRevision is rejected (conflict).
  const stale = await call('chatsCreate', pid, rev, { id: 'c3' });
  expect(stale.ok).toBe(false);
  expect(stale.conflict).toBe(true);

  // A wrong expectedProjectId is rejected even with a valid revision.
  const wrongPid = await call('chatsCreate', 'WRONG-project', appended.revision, { id: 'c4' });
  expect(wrongPid.ok).toBe(false);
  expect(String(wrongPid.error)).toMatch(/project_mismatch/);

  // The store reflects only the legitimate mutations.
  const after = await call('chatsRead');
  expect(after.store.chats.some((c) => c.id === 'c2')).toBe(true);
  expect(after.store.chats.some((c) => c.id === 'c3' || c.id === 'c4')).toBe(false);
});

test('the old whole-array backup writer stays disabled through IPC', async () => {
  const r = await call('saveChatsBackup', [{ id: 'x', name: 'x', started: true, messages: [{ cls: 'user', text: 'hi' }] }]);
  expect(r.ok).toBe(false);
  expect(r.error).toBe('disabled_canonical_store');
});
