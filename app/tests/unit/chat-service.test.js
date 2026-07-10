// Unit tests for app/state/chat-service.js (Phase 2A slice 4.1).
// Runner: node:test — throwaway project paths only. No Electron, no launch, no
// production data. Proves PROJECT-IDENTITY enforcement on read + mutations,
// including the delayed-command-across-project-switch case that revision CAS
// alone cannot catch.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const svc = require('../../state/chat-service');
const boot = require('../../state/chat-bootstrap');
const atomic = require('../../state/atomic-store');

function tmpProject(projectId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-svc-'));
  const stateDir = path.join(dir, '.cockpit', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'project-state.json'), JSON.stringify({ project_id: projectId }), 'utf8');
  const chatsDir = path.join(dir, '.cockpit', 'chats');
  fs.mkdirSync(chatsDir, { recursive: true });
  return { dir, projectId, chatsFile: path.join(chatsDir, 'chats.json'), backupFile: path.join(chatsDir, 'backup.json') };
}
function bootstrap(p) {
  const r = boot.bootstrapCanonical({ chatsFile: p.chatsFile, backupFile: p.backupFile, projectDir: p.dir, legacySnapshot: [{ id: 'a', name: 'A', messages: [] }], now: 1 });
  assert.equal(r.ok, true);
  return svc.readCanonical({ chatsFile: p.chatsFile, projectDir: p.dir }).store.revision;
}

// ---- read is project-bound ----

test('readCanonical serves the store for the active project', () => {
  const p = tmpProject('proj-A');
  bootstrap(p);
  const r = svc.readCanonical({ chatsFile: p.chatsFile, projectDir: p.dir });
  assert.equal(r.ok, true);
  assert.equal(r.store.projectId, 'proj-A');
  assert.equal(r.projectId, 'proj-A');
});

test('readCanonical REJECTS a store belonging to a different project (never served as current)', () => {
  const p = tmpProject('proj-A');
  atomic.writeJsonAtomic(p.chatsFile, { schemaVersion: 1, projectId: 'proj-B', revision: 1, createdAt: 1, updatedAt: 1, activeChatId: null, chats: [] });
  const r = svc.readCanonical({ chatsFile: p.chatsFile, projectDir: p.dir });
  assert.equal(r.ok, false);
  assert.match(r.error, /project_mismatch/);
  assert.equal(r.storeProjectId, 'proj-B');
  assert.equal(r.activeProjectId, 'proj-A');
});

// ---- mutations are project-bound ----

test('a mutation whose expectedProjectId != active project is rejected', () => {
  const p = tmpProject('proj-A');
  const rev = bootstrap(p);
  const r = svc.appendMessage({
    chatsFile: p.chatsFile, projectDir: p.dir, expectedProjectId: 'proj-WRONG', expectedRevision: rev,
    args: { chatId: 'a', message: { id: 'm1', cls: 'user', text: 'hi', ts: 2 } },
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /project_mismatch/);
  assert.equal(svc.readCanonical({ chatsFile: p.chatsFile, projectDir: p.dir }).store.chats[0].messages.length, 0);
});

test('a matching-identity mutation succeeds', () => {
  const p = tmpProject('proj-A');
  const rev = bootstrap(p);
  const r = svc.appendMessage({
    chatsFile: p.chatsFile, projectDir: p.dir, expectedProjectId: 'proj-A', expectedRevision: rev,
    args: { chatId: 'a', message: { id: 'm1', cls: 'user', text: 'hi', ts: 2 } }, now: 3,
  });
  assert.equal(r.ok, true);
  assert.equal(svc.readCanonical({ chatsFile: p.chatsFile, projectDir: p.dir }).store.chats[0].messages.length, 1);
});

// ---- THE security case: delayed command across a project switch ----

test('a delayed Project-A command cannot mutate Project B after a switch, even when revisions coincide', () => {
  const A = tmpProject('proj-A');
  const revA = bootstrap(A);
  const B = tmpProject('proj-B');
  const revB = bootstrap(B);
  assert.equal(revA, revB, 'revisions coincide -> revision CAS alone would NOT catch the cross-project replay');

  // Renderer captured (expectedProjectId='proj-A', expectedRevision=revA) while on A;
  // the app then switched to B (now the active project). Replay A's command at B:
  const replay = svc.appendMessage({
    chatsFile: B.chatsFile, projectDir: B.dir, expectedProjectId: 'proj-A', expectedRevision: revA,
    args: { chatId: 'a', message: { id: 'm-from-A', cls: 'user', text: 'leak', ts: 9 } },
  });
  assert.equal(replay.ok, false);
  assert.match(replay.error, /project_mismatch/);
  assert.equal(svc.readCanonical({ chatsFile: B.chatsFile, projectDir: B.dir }).store.chats[0].messages.length, 0, 'B untouched');
});

// ---- unresolvable identity fails closed ----

test('when project identity cannot be resolved, read AND mutate fail closed', () => {
  const p = tmpProject('real-id');
  // project-state says real-id, minted id file says something else -> resolve conflict.
  fs.writeFileSync(path.join(p.dir, '.cockpit', 'state', 'project-id.json'), JSON.stringify({ projectId: 'stale-id' }), 'utf8');
  const r = svc.readCanonical({ chatsFile: p.chatsFile, projectDir: p.dir });
  assert.equal(r.ok, false);
  assert.match(r.error, /project_unresolved/);
  const m = svc.createChat({ chatsFile: p.chatsFile, projectDir: p.dir, expectedProjectId: 'real-id', expectedRevision: 1, args: { id: 'x' } });
  assert.equal(m.ok, false);
  assert.match(m.error, /project_unresolved/);
});
