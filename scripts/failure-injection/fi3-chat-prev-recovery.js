// FI-3 — a corrupt current chat store recovers from a valid prior generation, and
// mutations are blocked. Exercises the REAL app/state/chat-store.js. Expected: RECOVERED.
const path = require('path');
const fs = require('fs');
const os = require('os');
const cs = require('../../app/state/chat-store');
const atomic = require('../../app/state/atomic-store');

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: String(detail) });
let baselineOk = false, injectionTriggered = false, observed = '';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-fi3-'));
const file = path.join(dir, 'chats.json');
try {
  // ---- baseline: two valid generations. current(rev3) has c1+c2; prev(rev2) has c1. ----
  cs.initStore(file, 'proj-fi3', { now: 1 });
  cs.createChat(file, 1, { id: 'c1', name: 'Keeper One' }, { now: 2 });
  cs.createChat(file, 2, { id: 'c2', name: 'Keeper Two' }, { now: 3 });
  const base = cs.readStore(file);
  baselineOk = base.ok && base.served === 'current' && base.store.chats.length === 2;
  const prevRawBefore = fs.readFileSync(file + '.prev', 'utf8'); // rev2 (holds c1) — exact bytes

  // ---- inject: structurally corrupt the CURRENT generation ----
  fs.writeFileSync(file, 'CORRUPT{ not valid json at all', 'utf8');
  const rawNow = atomic.readJson(file);
  injectionTriggered = !rawNow.ok; // the current generation is no longer parseable
  observed = 'current chats.json corrupted (readJson.ok=' + rawNow.ok + '); .prev intact';

  // ---- read through the REAL production store path ----
  const rec = cs.readStore(file);
  add('served_prev', rec.ok && rec.served === 'prev', 'readStore recovered from the prior generation (served=' + rec.served + ')');
  add('prior_good_chats_recoverable',
    rec.ok && rec.store && Array.isArray(rec.store.chats) && rec.store.chats.some((c) => c.id === 'c1' && c.name === 'Keeper One'),
    'the prior good chat (c1 "Keeper One") is intact and recoverable');

  // ---- a mutation on the corrupt current must FAIL CLOSED (never commit from .prev) ----
  const mut = cs.appendMessage(file, 3, { chatId: 'c1', message: { id: 'm1', text: 'x' } }, { now: 5 });
  add('mutation_blocked_fail_closed',
    mut.ok === false && /store_corrupt/.test(mut.error || ''),
    'a mutation on the corrupt current is refused (' + (mut.error || 'ok?!') + '), not silently applied from .prev');

  // ---- the retained prior generation is unharmed by any of this (RAW bytes) ----
  const prevRawAfter = fs.existsSync(file + '.prev') ? fs.readFileSync(file + '.prev', 'utf8') : '<missing>';
  add('prev_generation_unharmed_raw_bytes',
    prevRawAfter === prevRawBefore,
    'the retained .prev generation is byte-for-byte identical (raw) before and after the injection');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// NOTE: the VISIBLE recovery state + disabled-mutation UI on this same served:'prev'
// signal is covered end-to-end by app/tests/e2e/chat-recovery.spec.js (real Electron).
console.log(JSON.stringify({ id: 'FI-3-chat-prev-recovery', expected: 'RECOVERED', baselineOk, injectionTriggered, observed, checks }));
