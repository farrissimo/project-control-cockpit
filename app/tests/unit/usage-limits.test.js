// Per-turn hard cost cap (desktop-parity R3). Pins the ONE thing that must always hold: a
// missing/malformed/hostile config can NEVER disable or weaken the safety cap — it always
// degrades to the safe default, never to "no cap" or a negative/zero/non-finite value.
const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeLimits, isBudgetExceeded, isUsageLimitError, isAuthError, DEFAULT_MAX_TURN_USD, DEFAULT_MAX_CHAT_USD, DEFAULT_MAX_TURNS } = require('../../usage-limits.js');

test('well-formed positive caps (all fields) are used as-is', () => {
  assert.deepStrictEqual(normalizeLimits({ max_turn_usd: 5, max_chat_usd: 20, max_turns: 40 }), { maxTurnUsd: 5, maxChatUsd: 20, maxTurns: 40 });
});

test('missing/null/non-object config -> all safe defaults, never unbounded', () => {
  const def = { maxTurnUsd: DEFAULT_MAX_TURN_USD, maxChatUsd: DEFAULT_MAX_CHAT_USD, maxTurns: DEFAULT_MAX_TURNS };
  assert.deepStrictEqual(normalizeLimits(null), def);
  assert.deepStrictEqual(normalizeLimits(undefined), def);
  assert.deepStrictEqual(normalizeLimits('not an object'), def);
  assert.deepStrictEqual(normalizeLimits({}), def);
});

test('zero, negative, or non-finite values are rejected per-field -> that field\'s safe default (never disables any cap)', () => {
  for (const bad of [0, -1, -0.0001, NaN, Infinity, -Infinity]) {
    assert.deepStrictEqual(normalizeLimits({ max_turn_usd: bad, max_chat_usd: 20, max_turns: 40 }), { maxTurnUsd: DEFAULT_MAX_TURN_USD, maxChatUsd: 20, maxTurns: 40 }, 'turn:' + bad);
    assert.deepStrictEqual(normalizeLimits({ max_turn_usd: 5, max_chat_usd: bad, max_turns: 40 }), { maxTurnUsd: 5, maxChatUsd: DEFAULT_MAX_CHAT_USD, maxTurns: 40 }, 'chat:' + bad);
    assert.deepStrictEqual(normalizeLimits({ max_turn_usd: 5, max_chat_usd: 20, max_turns: bad }), { maxTurnUsd: 5, maxChatUsd: 20, maxTurns: DEFAULT_MAX_TURNS }, 'turns:' + bad);
  }
});

test('max_turns: sub-1 and fractional values fail closed to the safe default or floor (never "no cap")', () => {
  // Below one whole turn is meaningless -> safe default, never disabled.
  assert.strictEqual(normalizeLimits({ max_turns: 0.5 }).maxTurns, DEFAULT_MAX_TURNS);
  assert.strictEqual(normalizeLimits({ max_turns: 0 }).maxTurns, DEFAULT_MAX_TURNS);
  // A valid cap is floored to a whole number of turns.
  assert.strictEqual(normalizeLimits({ max_turns: 40.9 }).maxTurns, 40);
  // Non-numeric -> safe default.
  for (const bad of ['40', null, {}, [], true]) assert.strictEqual(normalizeLimits({ max_turns: bad }).maxTurns, DEFAULT_MAX_TURNS, JSON.stringify(bad));
});

test('non-numeric values (string, null, object) are rejected per-field -> that field\'s safe default', () => {
  for (const bad of ['5', null, {}, [], true]) {
    assert.deepStrictEqual(normalizeLimits({ max_turn_usd: bad, max_chat_usd: 20 }).maxTurnUsd, DEFAULT_MAX_TURN_USD, JSON.stringify(bad));
    assert.deepStrictEqual(normalizeLimits({ max_turn_usd: 5, max_chat_usd: bad }).maxChatUsd, DEFAULT_MAX_CHAT_USD, JSON.stringify(bad));
  }
});

test('isBudgetExceeded recognizes the REAL CLI abort text (verified live 2026-07-20), case-insensitively', () => {
  assert.strictEqual(isBudgetExceeded('Error: Exceeded USD budget (0.0001)'), true);
  assert.strictEqual(isBudgetExceeded('error: exceeded usd budget (3)'), true);
});

test('isBudgetExceeded is false for ordinary output/errors, never a false positive', () => {
  assert.strictEqual(isBudgetExceeded('FAKE-CLAUDE-REPLY: received 12 chars.'), false);
  assert.strictEqual(isBudgetExceeded('Session ID ... is already in use'), false);
  assert.strictEqual(isBudgetExceeded(''), false);
  assert.strictEqual(isBudgetExceeded(null), false);
  assert.strictEqual(isBudgetExceeded(undefined), false);
});

test('isUsageLimitError matches the REAL claude-code plan-limit strings (extracted from the 2.1.215 binary)', () => {
  assert.strictEqual(isUsageLimitError('usage limit reached'), true);
  assert.strictEqual(isUsageLimitError("You've reached your Fable 5 limit."), true);
  assert.strictEqual(isUsageLimitError('Out of usage credits. Contact your admin to add more.'), true);
  assert.strictEqual(isUsageLimitError('You have reached your weekly limit'), true);
});

test('isUsageLimitError does NOT misclassify transient overload or the per-turn budget cap (they have their own messaging)', () => {
  // The worker-nonzero fixture: momentary overload, a retry — NOT a plan-limit block.
  assert.strictEqual(isUsageLimitError('Error: the model is temporarily overloaded (rate limited). Please try again in a moment.'), false);
  // The per-turn budget cap is a PCC-set limit, handled by isBudgetExceeded — never reframed as a plan limit.
  assert.strictEqual(isUsageLimitError('Error: Exceeded USD budget (3)'), false);
  assert.strictEqual(isUsageLimitError('Reached maximum budget ($0.0001)'), false);
});

test('isUsageLimitError is false for ordinary output and empty/nullish input', () => {
  assert.strictEqual(isUsageLimitError('FAKE-CLAUDE-REPLY: received 12 chars.'), false);
  assert.strictEqual(isUsageLimitError(''), false);
  assert.strictEqual(isUsageLimitError(null), false);
  assert.strictEqual(isUsageLimitError(undefined), false);
});

test('isAuthError matches the REAL claude-code auth/login failure strings (extracted from the binary)', () => {
  assert.strictEqual(isAuthError('Invalid credentials: you are not logged in. Run `claude login` and try again.'), true);
  assert.strictEqual(isAuthError('Run /login to re-authenticate, then retry.'), true);
  assert.strictEqual(isAuthError('Your session expired. /login to sign in again.'), true);
  assert.strictEqual(isAuthError('Please /login to reconnect.'), true);
});

test('isAuthError does NOT fire on ordinary output, a usage-limit, or a budget message', () => {
  assert.strictEqual(isAuthError('FAKE-CLAUDE-REPLY: received 12 chars.'), false);
  assert.strictEqual(isAuthError('usage limit reached'), false);          // routed to usageLimit, not auth
  assert.strictEqual(isAuthError('Error: Exceeded USD budget (3)'), false);
  assert.strictEqual(isAuthError('the model is temporarily overloaded (rate limited)'), false);
  assert.strictEqual(isAuthError(''), false);
  assert.strictEqual(isAuthError(null), false);
});
