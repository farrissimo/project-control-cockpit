// S6.1 finding 2 — when the canonical read serves the PRIOR generation (recovery),
// the renderer must expose it VISIBLY and block mutations: it must not present
// previous-generation data as ordinary current state, and it must keep the store
// read-only until the damaged current generation is deliberately recovered.
// Isolation: PCC_TEST_MODE + throwaway --user-data-dir (launchApp); fake worker.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { launchApp, closeApp } = require('../helpers/launch');

// Locate the throwaway canonical store: <userData>/chats/<projectHash>/chats.json.
function findChatsFile(app) {
  const root = path.join(app._pccUserDataDir, 'chats');
  const subs = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'chats.json')));
  expect(subs.length).toBe(1);
  return path.join(root, subs[0], 'chats.json');
}

test('a served .prev generation is shown as a visible RECOVERY state with mutations blocked', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });

    // Send a message and let the full turn complete, so the canonical store has
    // real history AND a valid prior generation (.prev) exists.
    await page.fill('#input', 'recover me please');
    await page.click('#send');
    await page.waitForSelector('.bubble.assistant:not(.thinking)', { timeout: 20000 });

    const chatsFile = findChatsFile(app);
    const prevFile = chatsFile + '.prev';
    expect(fs.existsSync(prevFile)).toBe(true);
    // Sanity: the prior generation is itself valid JSON (a real good generation).
    JSON.parse(fs.readFileSync(prevFile, 'utf8'));

    // Damage the CURRENT generation only (unparseable), leaving .prev intact.
    const corrupt = '{ not valid json at all';
    fs.writeFileSync(chatsFile, corrupt, 'utf8');

    // Reload: boot re-reads the store. current is damaged -> the read serves .prev.
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // 1. The read is served from the prior generation.
    const read = await page.evaluate(() => window.pcc.chatsRead());
    expect(read.ok).toBe(true);
    expect(read.served).toBe('prev');

    // 2. It is exposed as a VISIBLE recovery state (not passed off as current).
    await expect(page.locator('[data-testid="recovery-banner"]')).toBeVisible({ timeout: 10000 });

    // 3. Recovered history is shown (not a false-empty), and the composer is blocked.
    await expect(page.locator('.bubble.user', { hasText: 'recover me please' })).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('#send')).toBeDisabled();
    await expect(page.locator('#input')).toBeDisabled();

    // 4. Mutations stay blocked: the damaged current file is NEVER rewritten by the
    //    recovery view — it is byte-for-byte the corruption we wrote.
    expect(fs.readFileSync(chatsFile, 'utf8')).toBe(corrupt);
  } finally {
    await closeApp(app);
  }
});

test('recovery with an EMPTY prior generation does NOT seed a chat (the empty-project seed is gated)', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.fill('#input', 'make a store'); await page.click('#send');
    await page.waitForSelector('.bubble.assistant:not(.thinking)', { timeout: 20000 });

    const chatsFile = findChatsFile(app);
    const real = JSON.parse(fs.readFileSync(chatsFile, 'utf8'));
    // Force a VALID-but-EMPTY prior generation (same project) and damage the current.
    // On recovery the view is empty AND read-only: the loadChats "empty project ->
    // seed a first chat" branch must NOT fire (it calls chatsCreate directly, outside
    // the chatCmd recovery gate).
    const emptyPrev = { schemaVersion: 1, projectId: real.projectId, revision: 1, createdAt: 1, updatedAt: 1, activeChatId: null, chats: [] };
    fs.writeFileSync(chatsFile + '.prev', JSON.stringify(emptyPrev), 'utf8');
    const corrupt = '{ broken current';
    fs.writeFileSync(chatsFile, corrupt, 'utf8');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const read = await page.evaluate(() => window.pcc.chatsRead());
    expect(read.served).toBe('prev');
    expect(read.store.chats.length).toBe(0);
    await expect(page.locator('[data-testid="recovery-banner"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#send')).toBeDisabled();
    // No seed fired: the damaged current is untouched (no new chat was written).
    expect(fs.readFileSync(chatsFile, 'utf8')).toBe(corrupt);
  } finally {
    await closeApp(app);
  }
});
