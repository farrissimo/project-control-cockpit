// Restart-continuity regression (ADR-0020 T3, Blocker 1). Pins the create-vs-resume decision that
// caused a COMPLETED chat, closed normally and reopened, to falsely show "worker session is locked —
// Recover this chat". Root cause: the renderer's isFirstTurn is lost on restart, so PCC re-issued
// --session-id for a session Claude had already created -> "Session ID ... is already in use". The
// fix grounds the decision in Claude's own on-disk session store. Synthetic temp dirs only — never
// touches real ~/.claude data.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { workerSessionExists, isNewWorkerSession } = require('../../worker-session.js');

// Build a throwaway Claude "projects" dir with a session file under a project subfolder.
function fakeProjects(sessionIds) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-wsess-'));
  const proj = path.join(root, 'C--SomeProject');
  fs.mkdirSync(proj, { recursive: true });
  for (const id of sessionIds) fs.writeFileSync(path.join(proj, id + '.jsonl'), '{"type":"summary"}\n', 'utf8');
  return root;
}

test('workerSessionExists: true when Claude has the session file, false when it does not', () => {
  const root = fakeProjects(['aaaa-1111', 'bbbb-2222']);
  assert.strictEqual(workerSessionExists('aaaa-1111', { projectsDir: root }), true);
  assert.strictEqual(workerSessionExists('bbbb-2222', { projectsDir: root }), true);
  assert.strictEqual(workerSessionExists('cccc-3333', { projectsDir: root }), false);
});

test('workerSessionExists fails SAFE (false) on a missing/unreadable projects dir or bad id', () => {
  // Missing dir -> false so the caller degrades to today's isFirstTurn behavior, never throws.
  assert.strictEqual(workerSessionExists('any', { projectsDir: path.join(os.tmpdir(), 'pcc-does-not-exist-xyz') }), false);
  assert.strictEqual(workerSessionExists('', { projectsDir: os.tmpdir() }), false);
  assert.strictEqual(workerSessionExists(null, { projectsDir: os.tmpdir() }), false);
  assert.strictEqual(workerSessionExists(undefined), false);
});

test('decision table: CREATE only on a genuine first turn with no existing session', () => {
  // genuine brand-new chat / freshly re-minted recovery id (no file yet) -> CREATE (--session-id)
  assert.strictEqual(isNewWorkerSession(true, false), true);
  // THE BUG FIX: renderer thinks first turn (state lost on restart) but Claude already has the
  // session -> RESUME (--resume), NOT re-create. This is what stops the false "session locked" prompt.
  assert.strictEqual(isNewWorkerSession(true, true), false);
  // a normal continuing turn is never a first turn -> always RESUME, no disk cost incurred
  assert.strictEqual(isNewWorkerSession(false, false), false);
  assert.strictEqual(isNewWorkerSession(false, true), false);
});

test('end-to-end restart scenario: completed chat reopened -> RESUME, no re-create', () => {
  // 1) First turn created the session on disk (Claude wrote <id>.jsonl).
  const sessionId = 'dddd-4444-restart';
  const root = fakeProjects([sessionId]);
  // 2) App closed and reopened: the renderer's turnsStarted Set is gone, so isFirstTurn is TRUE.
  const isFirstTurnAfterRestart = true;
  // 3) The exact expression main.js evaluates for the create-vs-resume decision:
  const exists = isFirstTurnAfterRestart && workerSessionExists(sessionId, { projectsDir: root });
  const isNewSession = isNewWorkerSession(isFirstTurnAfterRestart, exists);
  // MUST resume the existing session, never try to create it again (which would be "already in use").
  assert.strictEqual(isNewSession, false);
});

test('genuine new / re-minted session across restart still CREATES (no false resume)', () => {
  // A re-minted recovery id or a brand-new chat has NO file yet, even if the app just restarted.
  const root = fakeProjects(['unrelated-9999']);
  const freshId = 'eeee-5555-brand-new';
  const exists = true && workerSessionExists(freshId, { projectsDir: root });
  assert.strictEqual(isNewWorkerSession(true, exists), true); // still creates the new session cleanly
});
