// Durable PER-CHAT authority store (Phase 4 recovery). Pure logic, tested with an injectable
// clock and an in-memory storage — no Electron, no fs, no real `claude`. Proves the two flaws
// the durable store fixes (per-chat isolation so the badge can't show "authorized" on the wrong
// chat; persistence so an intended build session survives an app restart) WITHOUT weakening the
// invariants: read_only by default, approval required, sliding idle + absolute hard cap, and the
// worker-session/authority-id split (authority is keyed to the stable chat.id only).
const { test, expect } = require('@playwright/test');
const { createAuthorityStore, memStorage } = require('../../authority-store.js');

const MIN = 60 * 1000;
const IDLE = 30 * MIN;
const HARD = 2 * 60 * MIN;

// A store with a fresh, approved build session bound to chatId, approved at t0.
function approved(chatId, t0, storage) {
  const a = createAuthorityStore(storage ? { storage } : undefined);
  a.request('new_project', 'DemoProj', chatId);
  a.approve(t0);
  return a;
}

// --- defaults & self-authorization ---

test('defaults to read_only; a send in an unapproved chat is never build', () => {
  const a = createAuthorityStore();
  expect(a.stateFor('chat-1', 0).mode).toBe('read_only');
  expect(a.authorizeSend('chat-1', 0)).toBe(false);
});

test('a missing chatId is never build (older 4-arg callers stay safe)', () => {
  const a = approved('chat-1', 0);
  expect(a.authorizeSend(undefined, MIN)).toBe(false);
  expect(a.authorizeSend('', MIN)).toBe(false);
});

test('cannot self-authorize: approve with no pending request is refused', () => {
  const a = createAuthorityStore();
  expect(a.approve(0).ok).toBe(false);
  expect(a.stateFor('chat-1', 0).mode).toBe('read_only');
});

test('request -> approval_needed for THAT chat only, then approve -> authorized_running', () => {
  const a = createAuthorityStore();
  a.request('new_project', 'DemoProj', 'chat-1');
  expect(a.stateFor('chat-1', 0).mode).toBe('approval_needed');
  expect(a.stateFor('chat-2', 0).mode).toBe('read_only'); // pending is chat-scoped
  expect(a.approve(0).ok).toBe(true);
  expect(a.stateFor('chat-1', 0).mode).toBe('authorized_running');
});

// --- the desync flaw this store fixes: authority + badge are PER CHAT ---

test('per-chat isolation: enabling chat-1 leaves every other chat read_only (badge cannot leak)', () => {
  const a = approved('chat-1', 0);
  expect(a.authorizeSend('chat-1', MIN)).toBe(true);
  // The exact old bug: a DIFFERENT chat must read read_only for the badge AND spawn read-only.
  expect(a.stateFor('chat-2', MIN).mode).toBe('read_only');
  expect(a.authorizeSend('chat-2', MIN)).toBe(false);
});

test('two chats can hold independent build sessions at once', () => {
  const a = createAuthorityStore();
  a.request('new_project', 'A', 'chat-A'); a.approve(0);
  a.request('new_project', 'B', 'chat-B'); a.approve(0);
  expect(a.authorizeSend('chat-A', MIN)).toBe(true);
  expect(a.authorizeSend('chat-B', MIN)).toBe(true);
  a.disable('chat-A');
  expect(a.authorizeSend('chat-A', 2 * MIN)).toBe(false); // A off
  expect(a.authorizeSend('chat-B', 2 * MIN)).toBe(true);  // B unaffected
});

test('disable(chatId) returns that chat to read_only immediately', () => {
  const a = approved('chat-1', 0);
  expect(a.authorizeSend('chat-1', MIN)).toBe(true);
  a.disable('chat-1');
  expect(a.stateFor('chat-1', 2 * MIN).mode).toBe('read_only');
  expect(a.authorizeSend('chat-1', 2 * MIN)).toBe(false);
});

// --- the restart flaw this store fixes: build survives a restart when intended ---

test('PERSISTENCE: an approved build session survives an app restart', () => {
  const disk = memStorage();
  approved('chat-1', 0, disk);                 // session 1: approve, persisted to "disk"
  const restarted = createAuthorityStore({ storage: disk });
  restarted.load(10 * MIN);                     // session 2: fresh process loads the store
  expect(restarted.authorizeSend('chat-1', 10 * MIN)).toBe(true);  // still build
  expect(restarted.authorizeSend('other', 10 * MIN)).toBe(false);  // unrelated chat stays read_only
});

test('PERSISTENCE respects the hard cap: a session past its ceiling is dropped on load', () => {
  const disk = memStorage();
  approved('chat-1', 0, disk);
  const restarted = createAuthorityStore({ storage: disk });
  restarted.load(HARD + 1);                      // reopened after the 2h ceiling
  expect(restarted.authorizeSend('chat-1', HARD + 1)).toBe(false);
  expect(restarted.stateFor('chat-1', HARD + 1).mode).toBe('read_only');
});

test('a pending (un-approved) request is NOT restored across a restart', () => {
  const disk = memStorage();
  const a = createAuthorityStore({ storage: disk });
  a.request('new_project', 'DemoProj', 'chat-1'); // requested but never approved
  const restarted = createAuthorityStore({ storage: disk });
  restarted.load(MIN);
  expect(restarted.stateFor('chat-1', MIN).mode).toBe('read_only');
  expect(restarted.authorizeSend('chat-1', MIN)).toBe(false);
});

// --- fail closed on a malformed persisted store (I6): a corrupt entry must NOT grant build ---

test('a persisted entry missing its deadlines is DROPPED on load (never perpetual build)', () => {
  const disk = memStorage();
  // A parseable but malformed authority store: an entry with a name but NO deadlines.
  // The old code kept it (now > undefined === false => never expired) and authorizeSend
  // returned true — perpetual build authority from a corrupt file. It must fail closed.
  disk.write({ version: 1, chats: { 'chat-1': { name: 'ghost' } } });
  const a = createAuthorityStore({ storage: disk });
  a.load(MIN);
  expect(a.stateFor('chat-1', MIN).mode).toBe('read_only');
  expect(a.authorizeSend('chat-1', MIN)).toBe(false);
});

test('non-finite deadlines (NaN/Infinity) are dropped on load', () => {
  const disk = memStorage();
  disk.write({ version: 1, chats: {
    a: { name: 'x', idleExpiresAt: Infinity, hardExpiresAt: Infinity },
    b: { name: 'y', idleExpiresAt: 999, hardExpiresAt: NaN },
    ok: { name: 'z', idleExpiresAt: 10 * MIN, hardExpiresAt: HARD },
  } });
  const s = createAuthorityStore({ storage: disk });
  s.load(MIN);
  expect(s.authorizeSend('a', MIN)).toBe(false);   // Infinity deadline -> dropped
  expect(s.authorizeSend('b', MIN)).toBe(false);   // NaN deadline -> dropped
  expect(s.authorizeSend('ok', MIN)).toBe(true);   // valid entry survives
});

test('a persisted __proto__/constructor entry cannot pollute the prototype or grant build', () => {
  const disk = memStorage();
  // Own keys (computed) that would touch the prototype chain if copied to a plain object.
  disk.write({ version: 1, chats: {
    ['__proto__']: { name: 'pwn', idleExpiresAt: 60000, hardExpiresAt: 120000 },
    ['constructor']: { name: 'pwn2', idleExpiresAt: 60000, hardExpiresAt: 120000 },
    good: { name: 'ok', idleExpiresAt: 10 * MIN, hardExpiresAt: HARD },
  } });
  const s = createAuthorityStore({ storage: disk });
  s.load(1000);
  expect(s.authorizeSend('__proto__', 1000)).toBe(false);   // dropped — no prototype grant
  expect(s.authorizeSend('constructor', 1000)).toBe(false); // dropped
  expect(s.stateFor('__proto__', 1000).mode).toBe('read_only');
  expect(s.authorizeSend('good', 1000)).toBe(true);         // the legitimate entry still works
  // The global prototype was NOT mutated: an unrelated FRESH store grants nothing by default.
  const fresh = createAuthorityStore({ storage: memStorage() });
  expect(fresh.authorizeSend('anything', 1000)).toBe(false);
});

// --- retained invariants: sliding idle + absolute hard cap, chat-scoped renewal ---

test('an authorized send renews the idle window (long interview survives past the first 30 min)', () => {
  const a = approved('chat-1', 0);
  expect(a.authorizeSend('chat-1', 25 * MIN)).toBe(true); // renews to 55 min
  expect(a.authorizeSend('chat-1', 45 * MIN)).toBe(true); // past original 30, within renewed
});

test('idle expiry still fires when abandoned', () => {
  const a = approved('chat-1', 0);
  expect(a.stateFor('chat-1', 31 * MIN).mode).toBe('read_only');
  expect(a.authorizeSend('chat-1', 31 * MIN)).toBe(false);
});

test('hard cap still ends the session despite relentless activity', () => {
  const a = approved('chat-1', 0);
  for (let t = 0; t <= HARD; t += 25 * MIN) expect(a.authorizeSend('chat-1', t)).toBe(true);
  expect(a.authorizeSend('chat-1', HARD + 1)).toBe(false);
});

test('renewal is chat-scoped: a send from a different chat never renews the real session', () => {
  const a = approved('chat-1', 0);
  expect(a.authorizeSend('chat-OTHER', 10 * MIN)).toBe(false);
  expect(a.authorizeSend('chat-1', 31 * MIN)).toBe(false); // original window unrenewed -> expired
});

test('the log distinguishes idle expiry from hard-cap expiry', () => {
  const idle = approved('chat-1', 0);
  idle.stateFor('chat-1', 31 * MIN);
  expect(idle.logTail().some((e) => e.event === 'expired_idle')).toBe(true);
  const hard = approved('chat-2', 0);
  for (let t = 0; t <= HARD; t += 25 * MIN) hard.authorizeSend('chat-2', t);
  hard.authorizeSend('chat-2', HARD + 1);
  expect(hard.logTail().some((e) => e.event === 'expired_hardcap')).toBe(true);
});
