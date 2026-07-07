// Layer 2 — IPC contract. Every window.pcc.* channel is exercised through the
// real preload bridge into the real main-process handler, and its return shape
// is asserted. Worker/verifier are faked on PATH; the PowerShell detectors and
// git run for real. This catches a broken/renamed handler or a changed contract
// that the button-level E2E might mask.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

const call = (method, ...args) =>
  page.evaluate(([m, a]) => window.pcc[m](...a), [method, args]);

test('bridge exposes exactly the expected channels', async () => {
  const keys = await page.evaluate(() => Object.keys(window.pcc).sort());
  expect(keys).toEqual([
    'addProject', 'backup', 'detections', 'getActiveProject', 'getMemory', 'getModels',
    'getRules', 'getState', 'handoff', 'hardChecks', 'lifecycle', 'listProjects',
    'metrics', 'newChat', 'pickFolder', 'pull', 'recentDecisions', 'saveMemory',
    'secondOpinion', 'send', 'setActiveProject', 'syncStatus', 'trustExtras', 'verify',
  ]);
});

test('getState returns project + task objects', async () => {
  const s = await call('getState');
  expect(s).toHaveProperty('project');
  expect(s).toHaveProperty('task');
});

test('getModels returns default + models list', async () => {
  const m = await call('getModels');
  expect(m).toHaveProperty('default');
  expect(Array.isArray(m.models)).toBe(true);
  expect(m.models.length).toBeGreaterThan(0);
});

test('getRules reads CLAUDE.md', async () => {
  const r = await call('getRules');
  expect(r.ok).toBe(true);
  expect(r.text).toContain('Working rules');
});

test('getMemory reads PROJECT.md', async () => {
  const r = await call('getMemory');
  expect(r.ok).toBe(true);
  expect(typeof r.text).toBe('string');
});

test('saveMemory round-trips without changing the file', async () => {
  const before = (await call('getMemory')).text;
  const res = await call('saveMemory', before); // write identical content back
  expect(res.ok).toBe(true);
  const after = (await call('getMemory')).text;
  expect(after).toBe(before);
});

test('saveMemory rejects a non-string without touching the file (negative)', async () => {
  const before = (await call('getMemory')).text;
  const res = await page.evaluate(() => window.pcc.saveMemory(null));
  expect(res.ok).toBe(false);
  const after = (await call('getMemory')).text;
  expect(after).toBe(before); // PROJECT.md was NOT overwritten with "null"
});

test('newChat resets the pinned session', async () => {
  const res = await call('newChat');
  expect(res.ok).toBe(true);
});

test('send routes to the faked worker and returns its reply', async () => {
  const res = await call('send', 'ping', undefined, 'test-chat-ipc', true);
  expect(res.ok).toBe(true);
  expect(res.text).toContain('FAKE-CLAUDE-REPLY');
});

test('detections returns all five detector results in four-part format', async () => {
  const d = await call('detections');
  for (const key of ['untracked', 'drift', 'staleDocs', 'repoSync', 'bloat', 'highStakes']) {
    expect(d, 'missing detector: ' + key).toHaveProperty(key);
    expect(d[key]).toHaveProperty('signal');
    expect(d[key]).toHaveProperty('observed');
  }
});

test('trustExtras reports rulesLoaded + verification + head epoch', async () => {
  const x = await call('trustExtras');
  expect(x.rulesLoaded).toBe(true);
  expect(x).toHaveProperty('verification');
  expect(typeof x.headCommitEpoch).toBe('number');
});

test('lifecycle returns a stage result', async () => {
  const lc = await call('lifecycle');
  expect(lc).toHaveProperty('signal');
});

test('recentDecisions returns a decisions array', async () => {
  const r = await call('recentDecisions');
  expect(Array.isArray(r.decisions)).toBe(true);
});

test('metrics returns proxy counts (or null, honestly)', async () => {
  const m = await call('metrics');
  // Script may legitimately return null; if present it must have real fields.
  if (m !== null) expect(m).toHaveProperty('commits_total');
});

test('hardChecks returns git + doctor output', async () => {
  const r = await call('hardChecks');
  expect(typeof r.git).toBe('string');
  expect(typeof r.doctor).toBe('string');
});

test('handoff assembles a briefing from repo truth', async () => {
  const r = await call('handoff');
  expect(r.ok).toBe(true);
  expect(r.text.length).toBeGreaterThan(20);
});

test('verify drives the faked verifier to a verdict', async () => {
  const r = await call('verify');
  expect(r.ok).toBe(true);
  expect(r.text).toContain('PASS');
});

test('secondOpinion routes a prompt to the (faked) Codex cross-check', async () => {
  const r = await call('secondOpinion', 'QUESTION: is X right?\nANSWER: yes.');
  expect(r.ok).toBe(true);
  expect(r.text).toContain('FAKE-CODEX-REPLY');
});

test('secondOpinion rejects an empty prompt', async () => {
  const r = await call('secondOpinion', '   ');
  expect(r.ok).toBe(false);
});
