// Durable per-chat cost accumulation (ADR-0015 residue closed). Pins the fail-safe contract: a
// corrupted/hostile file can never inject a bogus total or break the app — only clean, finite,
// non-negative per-chat numbers survive, everything else is dropped, and load never throws.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sanitize, loadChatCosts, saveChatCosts } = require('../../chat-cost-store.js');

test('sanitize keeps only valid { chatId: finite non-negative number } entries', () => {
  const clean = sanitize({ costs: {
    a: 5, b: 0, c: 12.5,           // valid
    d: -1, e: NaN, f: Infinity,    // invalid numbers
    g: '5', h: null, i: {},        // non-numbers
  } });
  assert.deepStrictEqual(clean, { a: 5, b: 0, c: 12.5 });
});

test('sanitize returns {} for missing/wrong-shape input, never throws', () => {
  assert.deepStrictEqual(sanitize(null), {});
  assert.deepStrictEqual(sanitize(undefined), {});
  assert.deepStrictEqual(sanitize('nope'), {});
  assert.deepStrictEqual(sanitize({}), {});
  assert.deepStrictEqual(sanitize({ costs: 'not-an-object' }), {});
  assert.deepStrictEqual(sanitize({ costs: null }), {});
});

test('save then load round-trips a real cost map', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-cost-'));
  try {
    assert.strictEqual(saveChatCosts(dir, { chatX: 9.5, chatY: 0 }), true);
    assert.deepStrictEqual(loadChatCosts(dir), { chatX: 9.5, chatY: 0 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('load returns {} when the file does not exist (a fresh start, never a crash)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-cost-'));
  try { assert.deepStrictEqual(loadChatCosts(dir), {}); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('load returns {} on a corrupted (non-JSON) file, never throws', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-cost-'));
  try {
    fs.writeFileSync(path.join(dir, 'chat-costs.json'), '{ corrupt not json', 'utf8');
    assert.deepStrictEqual(loadChatCosts(dir), {});
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a persisted file with hostile/negative values loads sanitized, never a poison total', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-cost-'));
  try {
    fs.writeFileSync(path.join(dir, 'chat-costs.json'),
      JSON.stringify({ costs: { good: 7, poison: -999999, bad: 'x' } }), 'utf8');
    assert.deepStrictEqual(loadChatCosts(dir), { good: 7 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
