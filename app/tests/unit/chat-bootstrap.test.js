// Integration tests for app/state/chat-bootstrap.js (Phase 2A slice 4).
// Runner: node:test — throwaway project/userData paths ONLY. No Electron, no
// launch, no production data. Also proves the test path cannot write the real
// production backup.json.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const boot = require('../../state/chat-bootstrap');
const cs = require('../../state/chat-store');

const msg = (cls, text, ts) => ({ cls, text, ts });

// A throwaway project with its own .cockpit/state + .cockpit/chats.
function tmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-boot-'));
  const stateDir = path.join(dir, '.cockpit', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'project-state.json'), JSON.stringify({ project_id: 'test-proj' }), 'utf8');
  const chatsDir = path.join(dir, '.cockpit', 'chats');
  fs.mkdirSync(chatsDir, { recursive: true });
  return { dir, chatsFile: path.join(chatsDir, 'chats.json'), backupFile: path.join(chatsDir, 'backup.json') };
}

// ---- bootstrap guards ----

test('bootstrap NEVER creates chats.json without a legacy snapshot', () => {
  const p = tmpProject();
  const r = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, now: 1 });
  assert.equal(r.ok, false);
  assert.match(r.error, /snapshot_required/);
  assert.equal(fs.existsSync(p.chatsFile), false, 'no chats.json created without a snapshot');
});

test('bootstrap creates chats.json from snapshot + backup exactly once', () => {
  const p = tmpProject();
  fs.writeFileSync(p.backupFile, JSON.stringify({ savedAt: 1, chats: [
    { id: 'a', name: 'A', messages: [msg('user', 'hi', 1), msg('assistant', 'yo', 2)] },
  ] }), 'utf8');
  const snapshot = [{ id: 'a', name: 'A', messages: [msg('user', 'hi', 1)] }]; // prefix of backup
  const r = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, legacySnapshot: snapshot, now: 5 });
  assert.equal(r.ok, true); assert.equal(r.created, true); assert.equal(r.revision, 1);
  const store = cs.readStore(p.chatsFile).store;
  assert.equal(store.projectId, 'test-proj');
  assert.equal(store.chats.length, 1);
  assert.equal(store.chats[0].messages.length, 2, 'longer history kept');
  // second call is a no-op — never re-migrates / overwrites an existing store
  const r2 = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, legacySnapshot: snapshot, now: 9 });
  assert.equal(r2.ok, true); assert.equal(r2.already, true);
});

test('bootstrap FAILS CLOSED on a divergence conflict and writes NO store', () => {
  const p = tmpProject();
  fs.writeFileSync(p.backupFile, JSON.stringify({ chats: [{ id: 'a', messages: [msg('user', 'A', 1)] }] }), 'utf8');
  const snapshot = [{ id: 'a', messages: [msg('user', 'B', 1)] }]; // same id, different content
  const r = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, legacySnapshot: snapshot, now: 1 });
  assert.equal(r.ok, false);
  assert.match(r.error, /divergence_conflict/);
  assert.equal(fs.existsSync(p.chatsFile), false, 'no chats.json on conflict — both sources preserved');
});

test('bootstrap FAILS CLOSED on a corrupt backup.json', () => {
  const p = tmpProject();
  fs.writeFileSync(p.backupFile, '{ corrupt backup', 'utf8');
  const r = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, legacySnapshot: [], now: 1 });
  assert.equal(r.ok, false);
  assert.match(r.error, /backup_unreadable/);
  assert.equal(fs.existsSync(p.chatsFile), false);
});

test('after bootstrap, only command mutations (with revision CAS) change the store', () => {
  const p = tmpProject();
  const r = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, legacySnapshot: [{ id: 'a', name: 'A', messages: [] }], now: 1 });
  assert.equal(r.ok, true);
  const rev = cs.readStore(p.chatsFile).store.revision;
  const stale = cs.appendMessage(p.chatsFile, rev - 1, { chatId: 'a', message: { id: 'm1', cls: 'user', text: 'hi', ts: 2 } }, { now: 3 });
  assert.equal(stale.ok, false); assert.equal(stale.conflict, true);
  const ok = cs.appendMessage(p.chatsFile, rev, { chatId: 'a', message: { id: 'm1', cls: 'user', text: 'hi', ts: 2 } }, { now: 3 });
  assert.equal(ok.ok, true);
  assert.equal(cs.readStore(p.chatsFile).store.chats[0].messages.length, 1);
});

// ---- production isolation guard ----

function fileState(p) {
  if (!fs.existsSync(p)) return { exists: false };
  const st = fs.statSync(p);
  return { exists: true, mtimeMs: st.mtimeMs, size: st.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') };
}

test('the test path CANNOT write the production backup.json (hash + mtime unchanged)', () => {
  const realBackup = path.join(__dirname, '..', '..', '..', '.cockpit', 'chats', 'backup.json');
  const before = fileState(realBackup);
  // Exercise a full bootstrap + mutation flow entirely on throwaway paths.
  const p = tmpProject();
  fs.writeFileSync(p.backupFile, JSON.stringify({ chats: [{ id: 'a', messages: [msg('user', 'hi', 1)] }] }), 'utf8');
  const r = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, legacySnapshot: [{ id: 'a', messages: [msg('user', 'hi', 1)] }], now: 1 });
  assert.equal(r.ok, true);
  const rev = cs.readStore(p.chatsFile).store.revision;
  cs.createChat(p.chatsFile, rev, { id: 'b' }, { now: 2 });
  const after = fileState(realBackup);
  assert.deepEqual(after, before, 'production backup.json must be byte- and mtime-identical after the test run');
});
