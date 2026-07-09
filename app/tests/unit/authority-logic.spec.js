// Authority state-machine RULES (DECISION-112 + Task 2L timeout fix). Pure logic,
// tested with an injectable clock — no Electron, no real `claude`, no 30-min waits.
// Proves the regression fix: an approved build session RENEWS its idle window on each
// authorized in-chat send (so a long New-Project interview keeps its build tools right
// up to the final scaffold write), while STILL idle-expiring when abandoned and STILL
// dying at an absolute hard cap it can never extend. Also re-proves the invariants the
// fix must not weaken: approval required, one-chat scoping, read_only by default.
const { test, expect } = require('@playwright/test');
const { createAuthority } = require('../../authority-logic.js');

const MIN = 60 * 1000;
const IDLE = 30 * MIN;      // default idle window
const HARD = 2 * 60 * MIN;  // default hard cap

// Fresh, approved build session bound to a known chatId, approved at t0.
function approvedAt(t0) {
  const a = createAuthority();
  a.request('new_project', 'DemoProj', 'chat-1');
  a.approve(t0);
  return a;
}

test('defaults to read_only; a send in an unapproved chat is never build', () => {
  const a = createAuthority();
  expect(a.snapshot(0).mode).toBe('read_only');
  expect(a.authorizeSend('chat-1', 0)).toBe(false);
  expect(a.snapshot(0).mode).toBe('read_only');
});

test('cannot self-authorize: approve with no pending request is refused', () => {
  const a = createAuthority();
  expect(a.approve(0).ok).toBe(false);
  expect(a.snapshot(0).mode).toBe('read_only');
});

test('request -> approval_needed, then approve -> authorized_running bound to the chatId', () => {
  const a = createAuthority();
  const r = a.request('new_project', 'DemoProj', 'chat-1');
  expect(r.chatId).toBe('chat-1');
  expect(a.snapshot(0).mode).toBe('approval_needed');
  const appr = a.approve(0);
  expect(appr.ok).toBe(true);
  expect(appr.chatId).toBe('chat-1');
  expect(a.snapshot(0).mode).toBe('authorized_running');
});

// --- the regression fix ---

test('an authorized send RENEWS the idle window (interview survives past the original 30 min)', () => {
  const a = approvedAt(0);
  // 25 min in: still authorized -> build, and this renews the window from t=25min.
  expect(a.authorizeSend('chat-1', 25 * MIN)).toBe(true);
  // 45 min in (past the ORIGINAL 30-min deadline, but only 20 min since the last send):
  // under the OLD fixed timeout this was read_only; now it must still be build.
  expect(a.authorizeSend('chat-1', 45 * MIN)).toBe(true);
  expect(a.snapshot(45 * MIN).mode).toBe('authorized_running');
});

test('simulated long interview: repeated sends every 20 min keep build through the scaffold write', () => {
  const a = approvedAt(0);
  // kickoff + interview turns spread across ~80 min, each within the idle window.
  for (const t of [0, 20 * MIN, 40 * MIN, 60 * MIN, 80 * MIN]) {
    expect(a.authorizeSend('chat-1', t)).toBe(true); // the final one is the scaffold write
  }
});

test('idle expiry STILL fires: an abandoned session drops to read_only after the idle window', () => {
  const a = approvedAt(0);
  // No sends. 31 min later a read observes it expired.
  expect(a.snapshot(31 * MIN).mode).toBe('read_only');
  // And a send at that point is not build.
  const b = approvedAt(0);
  expect(b.authorizeSend('chat-1', 31 * MIN)).toBe(false);
});

test('idle expiry fires even after activity, once a gap exceeds the window', () => {
  const a = approvedAt(0);
  expect(a.authorizeSend('chat-1', 20 * MIN)).toBe(true); // renews to 50 min
  // Then a 31-min gap of silence (past 50 min): the next send is no longer build.
  expect(a.authorizeSend('chat-1', 51 * MIN + 1)).toBe(false);
  expect(a.snapshot(51 * MIN + 1).mode).toBe('read_only');
});

test('HARD CAP still ends the session: relentless activity cannot extend past the ceiling', () => {
  const a = approvedAt(0);
  // Send every 25 min (always within the idle window) right up to the cap: all build.
  for (let t = 0; t <= HARD; t += 25 * MIN) {
    expect(a.authorizeSend('chat-1', t)).toBe(true);
  }
  // Just past the 2-hour hard cap, despite continuous activity, it must be read_only.
  expect(a.authorizeSend('chat-1', HARD + 1)).toBe(false);
  expect(a.snapshot(HARD + 1).mode).toBe('read_only');
});

test('renewal is chat-SCOPED: a matching-mode send from a DIFFERENT chat is never build and never renews', () => {
  const a = approvedAt(0);
  // A send from the wrong chat: not build, and it must not extend the real session.
  expect(a.authorizeSend('chat-OTHER', 10 * MIN)).toBe(false);
  // The real chat is still on its ORIGINAL 30-min window (unrenewed by the other chat),
  // so past that window with no legitimate send it has expired.
  expect(a.authorizeSend('chat-1', 31 * MIN)).toBe(false);
});

test('end() drops an active build session back to read_only immediately', () => {
  const a = approvedAt(0);
  expect(a.authorizeSend('chat-1', MIN)).toBe(true);
  a.end();
  expect(a.snapshot(2 * MIN).mode).toBe('read_only');
  expect(a.authorizeSend('chat-1', 2 * MIN)).toBe(false);
});

test('the log distinguishes idle expiry from hard-cap expiry (owner-visible reason)', () => {
  const idle = approvedAt(0);
  idle.snapshot(31 * MIN); // trigger idle expiry
  expect(idle.logTail().some((e) => e.event === 'expired_idle')).toBe(true);

  const hard = approvedAt(0);
  for (let t = 0; t <= HARD; t += 25 * MIN) hard.authorizeSend('chat-1', t);
  hard.authorizeSend('chat-1', HARD + 1); // trigger hard-cap expiry
  expect(hard.logTail().some((e) => e.event === 'expired_hardcap')).toBe(true);
});
