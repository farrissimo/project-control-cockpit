// DECISION-003 (No Paid API Dependence) enforced at the process boundary. Proves workerEnv() removes the
// paid-API credentials so a spawned `claude` (or any LLM CLI) can only authenticate via the regular
// session login — never a paid API. Pure node:test.
const { test } = require('node:test');
const assert = require('node:assert');
const { workerEnv, PAID_API_ENV_VARS } = require('../../worker-env');

test('workerEnv strips ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN, keeps everything else', () => {
  const base = { PATH: '/usr/bin', ANTHROPIC_API_KEY: 'sk-ant-secret', ANTHROPIC_AUTH_TOKEN: 'tok', ANTHROPIC_BASE_URL: 'https://api.anthropic.com', FOO: 'bar' };
  const env = workerEnv(base);
  assert.strictEqual(env.ANTHROPIC_API_KEY, undefined);
  assert.strictEqual(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.strictEqual(env.ANTHROPIC_BASE_URL, 'https://api.anthropic.com'); // base url is not a paid credential
  assert.strictEqual(env.PATH, '/usr/bin');
  assert.strictEqual(env.FOO, 'bar');
});

test('workerEnv never mutates the caller\'s env object', () => {
  const base = { ANTHROPIC_API_KEY: 'sk-ant-secret' };
  workerEnv(base);
  assert.strictEqual(base.ANTHROPIC_API_KEY, 'sk-ant-secret'); // original untouched (a copy was stripped)
});

test('every declared paid-API var is actually removed (guards against list drift)', () => {
  const base = {};
  for (const k of PAID_API_ENV_VARS) base[k] = 'x';
  const env = workerEnv(base);
  for (const k of PAID_API_ENV_VARS) assert.strictEqual(env[k], undefined, k + ' must be stripped');
  assert.ok(PAID_API_ENV_VARS.includes('ANTHROPIC_API_KEY')); // the specific var seen in the owner's env
});

test('defaults to process.env when no base is given, and returns a plain object', () => {
  const env = workerEnv();
  assert.strictEqual(typeof env, 'object');
  assert.strictEqual(env.ANTHROPIC_API_KEY, undefined); // stripped even from the real process env
});
