// Layer 2 — IPC contract. Every window.pcc.* channel is exercised through the
// real preload bridge into the real main-process handler, and its return shape
// is asserted. Worker/verifier are faked on PATH; the PowerShell detectors and
// git run for real. This catches a broken/renamed handler or a changed contract
// that the button-level E2E might mask.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// The owner's REAL PROJECT.md (HOME_DIR = repo root = app/..). Write tests must NEVER touch it.
const REAL_PROJECT_MD = path.join(__dirname, '..', '..', '..', 'PROJECT.md');
function sha256(f) { return fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null; }
function makeTempPccProject(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-mem-'));
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Rules\n');
  fs.writeFileSync(path.join(dir, 'PROJECT.md'), 'ORIGINAL BRIEF ' + name + '\n');
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'project-state.json'), JSON.stringify({ project_name: name }));
  return dir;
}

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

const call = (method, ...args) =>
  page.evaluate(([m, a]) => window.pcc[m](...a), [method, args]);

test('bridge exposes exactly the expected channels', async () => {
  const keys = await page.evaluate(() => Object.keys(window.pcc).sort());
  expect(keys).toEqual([
    'addProject', 'approveJob', 'authorityLog', 'authorityState', 'autoNameChat', 'backup', 'buildInfo', 'cancelJob',
    'chatsAppend', 'chatsBootstrap', 'chatsCreate', 'chatsDelete', 'chatsRead', 'chatsRename', 'chatsSetActive', 'chatsUpdateMeta', 'ciStatus',
    'createFlowCancel', 'createFlowPickLocation', 'createFlowSave', 'createFlowSend', 'createFlowStart',
    'deleteChatFiles', 'detections', 'endJob', 'engineStatus', 'getActiveProject', 'getMemory', 'getModels',
    'getRules', 'getState', 'handoff', 'hardChecks', 'lifecycle', 'lifecycleAdvance',
    'listProjects', 'loadChatsBackup', 'metrics', 'newChat', 'persistChat', 'pickFolder', 'pull', 'recentDecisions', 'requestJob',
    'runProduct', 'saveChatsBackup', 'saveMemory', 'searchChats', 'secondOpinion', 'send', 'setActiveProject', 'setPhaseKind',
    'stakes', 'summarizeChat', 'syncStatus', 'toolStatus', 'trustExtras', 'verify', 'verifyProduct', 'visionPromises',
  ]);
});

// Build identity: the app must be able to say WHICH build it is. Under test it runs from the
// dev checkout, so it derives live from git and must name a real commit — never a bare version
// (which proves nothing) and never a blank. The fail-closed branches are unit-proven in
// tests/unit/build-identity.test.js; this pins the real wiring end to end.
test('buildInfo names a real commit and always renders a non-empty identity', async () => {
  const r = await call('buildInfo');
  expect(['stamped', 'dev']).toContain(r.status); // a dev checkout can always identify itself
  expect(r.sha).toMatch(/^[0-9a-f]{40}$/);
  expect(r.shortSha).toBe(r.sha.slice(0, 7));
  expect(typeof r.display).toBe('string');
  expect(r.display.trim().length).toBeGreaterThan(0);
  expect(r.display).toContain(r.shortSha); // the owner-visible line names the commit, not just a version
});

test('the build identity is visible in the app, not buried', async () => {
  const el = page.locator('#build-id');
  await expect(el).toBeVisible();
  await expect(el).not.toHaveText(/^\s*$/);
  await expect(el).toContainText(/build [0-9a-f]{7}|Unknown build/);
});

// CI status (surface CI into the Verified chip): must be safe + honest. In test mode it never
// hits the network and reports available:false — so it can never fabricate a green/red, and the
// trust chip falls back to the local record. The channel must always resolve, never throw.
test('ciStatus is offline-safe in tests and never fabricates a verdict', async () => {
  const r = await call('ciStatus');
  expect(r.ok).toBe(true);
  expect(r.available).toBe(false);      // test mode: no network, no claim
  expect(r.reason).toBe('test_mode');
  expect(r.state).toBeUndefined();      // no state means the chip uses the local record, not a fake
});

// Soak fix F3: verifyProduct must never fake a green. With no declared product-run
// config (PCC itself has none), it returns ok:false with an honest reason — it does not
// invent a PASS. (Behavior check, not just channel exposure.)
test('verifyProduct does not fabricate a pass without a declared config', async () => {
  const r = await call('verifyProduct');
  expect(r.ok).toBe(false);
  expect(['no_config', 'no_verify_command']).toContain(r.reason);
});

// Upgrade Existing Project (DECISION-111) slice 1: engineStatus reports current/old/
// unknown honestly. The home cockpit compared against itself is 'current'.
test('engineStatus reports the home cockpit as current', async () => {
  const r = await call('engineStatus');
  expect(r.ok).toBe(true);
  expect(r.status).toBe('current');
  expect(typeof r.homeVersion).toBe('number');
  expect(r.projectVersion).toBe(r.homeVersion);
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

// I5: saveMemory WRITE tests run against a THROWAWAY project (own app instance) so they
// never touch the owner's real PROJECT.md — and they assert the real one is untouched.
// The write is atomic (retains PROJECT.md.prev) and rejects a non-string.
test('saveMemory writes atomically to the ACTIVE project only, never the real PROJECT.md (I5)', async () => {
  const proj = makeTempPccProject('MemProj');
  const realBefore = sha256(REAL_PROJECT_MD);
  const { app: app2, page: page2 } = await launchApp();
  try {
    const call2 = (m, ...a) => page2.evaluate(([mm, aa]) => window.pcc[mm](...aa), [m, a]);
    await call2('addProject', proj);
    await call2('setActiveProject', proj);
    const before = (await call2('getMemory')).text;
    expect(before).toContain('ORIGINAL BRIEF');
    // Round-trip an edit against the THROWAWAY project's PROJECT.md.
    const w = await call2('saveMemory', before + 'EDITED');
    expect(w.ok).toBe(true);
    expect((await call2('getMemory')).text).toBe(before + 'EDITED');
    // Atomic write retained a prior generation.
    expect(fs.existsSync(path.join(proj, 'PROJECT.md.prev'))).toBe(true);
    // A non-string is rejected without touching the file.
    const neg = await page2.evaluate(() => window.pcc.saveMemory(null));
    expect(neg.ok).toBe(false);
    expect((await call2('getMemory')).text).toBe(before + 'EDITED');
  } finally {
    await closeApp(app2);
    try { fs.rmSync(proj, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
  // The owner's REAL PROJECT.md was never touched by these writes.
  expect(sha256(REAL_PROJECT_MD)).toBe(realBefore);
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

// First-class chat history (docs/CHAT_RECALL_SPEC.md): the auto-name channel turns a
// transcript into a title via the (faked) worker; an empty transcript is refused.
test('autoNameChat returns a title from a transcript and refuses an empty one', async () => {
  const ok = await call('autoNameChat', [{ cls: 'user', text: 'hi' }, { cls: 'bot', text: 'hello' }]);
  expect(ok.ok).toBe(true);
  expect(typeof ok.title).toBe('string');
  expect(ok.title.length).toBeGreaterThan(0);
  const empty = await call('autoNameChat', []);
  expect(empty.ok).toBe(false);
});

// summarizeChat refuses an empty chat, and reports honestly when the worker returns
// non-JSON (the default fake) instead of fabricating a card.
test('summarizeChat refuses an empty chat and never fakes a card from non-JSON', async () => {
  const empty = await call('summarizeChat', 'chat-x', []);
  expect(empty.ok).toBe(false);
  const nonJson = await call('summarizeChat', 'chat-x', [{ cls: 'user', text: 'hi' }]);
  expect(nonJson.ok).toBe(false); // fake returns "FAKE-CLAUDE-REPLY...", not JSON -> honest failure
});

// persistChat writes a transcript (no AI) and refuses empty; deleteChatFiles is safe to call
// even when nothing exists — the recall corpus lifecycle must never throw.
test('persistChat persists a transcript and refuses empty; deleteChatFiles is safe', async () => {
  const ok = await call('persistChat', 'chat-persist-test', [{ cls: 'user', text: 'remember this line' }]);
  expect(ok.ok).toBe(true);
  const empty = await call('persistChat', 'chat-persist-test', []);
  expect(empty.ok).toBe(false);
  const del = await call('deleteChatFiles', 'chat-persist-test');
  expect(del.ok).toBe(true);
  const delMissing = await call('deleteChatFiles', 'never-existed');
  expect(delMissing.ok).toBe(true); // removing a non-existent record is a no-op, not an error
});

// Phase 2A S4: the old whole-array backup WRITER is DISABLED. saveChatsBackup is a
// hard no-op so a partial renderer list can never overwrite backup.json; the
// canonical main-owned store (chats.json) is the only writer. loadChatsBackup
// still READS any pre-existing backup (migration input), it just can't be written.
test('the old saveChatsBackup writer is disabled and cannot overwrite backup.json', async () => {
  const chats = [{ id: 'x1', name: 'Kept chat', started: true, messages: [{ cls: 'user', text: 'hi' }] }];
  const saved = await call('saveChatsBackup', chats);
  expect(saved.ok).toBe(false);
  expect(saved.error).toBe('disabled_canonical_store');
  const loaded = await call('loadChatsBackup'); // read path still works
  expect(loaded.ok).toBe(true);
  expect(Array.isArray(loaded.chats)).toBe(true);
});

// searchChats: validates input, returns an honest empty on no corpus, and never throws when the
// (faked) worker returns non-JSON — it yields no matches rather than fabricating any.
test('searchChats validates input and degrades honestly', async () => {
  const blank = await call('searchChats', '   ', []);
  expect(blank.ok).toBe(false);
  const noCorpus = await call('searchChats', 'where did we decide X', []);
  expect(noCorpus.ok).toBe(true);
  expect(noCorpus.matches).toEqual([]);
  const nonJson = await call('searchChats', 'find it', [{ id: 'x', name: 'X', messages: [{ cls: 'user', text: 'hi' }] }]);
  expect(nonJson.ok).toBe(true);              // fake worker returns non-JSON -> no matches, not a crash
  expect(Array.isArray(nonJson.matches)).toBe(true);
});

test('detections returns all five detector results in four-part format', async () => {
  const d = await call('detections');
  for (const key of ['untracked', 'drift', 'staleDocs', 'repoSync', 'bloat', 'highStakes']) {
    expect(d, 'missing detector: ' + key).toHaveProperty(key);
    expect(d[key]).toHaveProperty('signal');
    expect(d[key]).toHaveProperty('observed');
  }
});

// Governor "Surface" (ADR-0006): the stakes channel classifies the current change live and
// must ALWAYS resolve with a readable verdict (the classifier exits 0) — surfacing never
// blocks. It returns the classifier's shape verbatim; the app never overrides the tier.
test('stakes returns a live change-stakes verdict and never blocks (governor Surface)', async () => {
  const s = await call('stakes');
  expect(typeof s.tier).toBe('string');       // T0..T4 or UNKNOWN — always a readable verdict
  expect(Array.isArray(s.reasons)).toBe(true);
  expect(Array.isArray(s.files)).toBe(true);
  expect(Array.isArray(s.escalations)).toBe(true);
  expect(s).toHaveProperty('not_proven');
});

test('trustExtras reports rulesLoaded + verification + head epoch', async () => {
  const x = await call('trustExtras');
  expect(x.rulesLoaded).toBe(true);
  expect(x).toHaveProperty('verification');
  expect(typeof x.headCommitEpoch).toBe('number');
  // Commit-bound freshness is computed and surfaced (boolean when a record is present).
  if (x.verification && x.verification.present) {
    expect(typeof x.verification.matchesCurrent).toBe('boolean');
  }
  // Working-tree state is surfaced so the CI-green chip can refuse to verify over uncommitted edits.
  expect(typeof x.dirty).toBe('boolean');
  expect(typeof x.gitKnown).toBe('boolean');
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
