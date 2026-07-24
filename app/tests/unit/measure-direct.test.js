// ADR-0020 Step 2 (pre-T1 diagnostic): the direct/WARM comparison arm. This pins the require-safety and
// DECISION-003 guarantees of the harness WITHOUT running a real `claude` (the warm run is orchestration,
// exercised live during the one diagnostic run, not in CI). Pure node:test.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Requiring the module must NOT spawn a worker (the warm run is guarded behind require.main === module).
const mod = require('../../tools/measure-direct.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'measure-direct.js'), 'utf8');

test('module is require-safe and exports the warm runner + prompts (no spawn on require)', () => {
  assert.strictEqual(typeof mod.runWarm, 'function');
  assert.ok(Array.isArray(mod.PROMPTS));
});

test('uses exactly 3 non-empty prompts (identical-task diagnostic, small N)', () => {
  assert.strictEqual(mod.PROMPTS.length, 3);
  for (const p of mod.PROMPTS) assert.ok(typeof p === 'string' && p.trim().length > 0);
});

test('spawns claude via env: workerEnv() — DECISION-003, never a paid API', () => {
  // Since 2026-07-24 the launcher is spawnClaude() (app/claude-spawn.js) — no shell, so argument
  // boundaries survive. The DECISION-003 guarantee it must still carry is unchanged.
  const call = (SRC.match(/spawnClaude\([^;]*?\)/s) || [])[0] || '';
  assert.ok(call, 'a claude spawn must be present');
  assert.ok(/env:\s*workerEnv\(\)/.test(call), 'the warm-arm claude spawn must pass env: workerEnv()');
  assert.ok(!/shell:\s*true/.test(SRC), 'the warm arm must never re-enable a shell (argv mangling defect)');
});
