// ADR-0020 Step 1 (T9 measurement spine): "no unattributed claude calls" made PROVABLE.
// PCC's RUNTIME spends the owner's plan usage ONLY by spawning `claude`. This guard pins that the
// app's runtime does so from EXACTLY two known, usage-logged sites — askClaude (visible chat turns)
// and oneShotWorker (background one-shots). Add a third, unguarded `spawn('claude')` anywhere in
// main.js and this test fails, so a hidden burn channel cannot be introduced silently. Pure source
// analysis under node:test — no Electron, no real `claude`, touches no data.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8');

// The function that lexically encloses a source offset = the nearest PRECEDING `function NAME(`.
function enclosingFn(src, offset) {
  const re = /function\s+(\w+)\s*\(/g;
  let name = null, m;
  while ((m = re.exec(src)) && m.index < offset) name = m[1];
  return name;
}

test('app/main.js spawns `claude` from EXACTLY the two known, attributed sites', () => {
  const re = /spawn\((['"])claude\1/g;
  const sites = [];
  let m;
  while ((m = re.exec(SRC))) sites.push(enclosingFn(SRC, m.index));

  assert.strictEqual(sites.length, 2,
    'expected exactly 2 `claude` spawn sites in main.js, found ' + sites.length +
    ' (' + sites.join(', ') + ') — a new spawn must be a known, usage-logged site');
  assert.deepStrictEqual([...sites].sort(), ['askClaude', 'oneShotWorker'],
    'every `claude` spawn must live in askClaude or oneShotWorker (the usage-logged sites), got: ' + sites.join(', '));
});

test('every `claude` spawn in main.js strips paid-API creds via workerEnv (DECISION-003)', () => {
  // A spawn that omits `env: workerEnv()` would let the child `claude` grab ANTHROPIC_API_KEY and bill a
  // PAID API — forbidden. Pin that every spawn call passes workerEnv in its options object.
  const re = /spawn\((['"])claude\1[^;]*?\)/gs;
  const calls = SRC.match(re) || [];
  assert.ok(calls.length >= 2, 'expected the known claude spawns');
  for (const call of calls) {
    assert.ok(/env:\s*workerEnv\(\)/.test(call),
      'a claude spawn is missing `env: workerEnv()` (paid-API leak risk): ' + call.replace(/\s+/g, ' ').slice(0, 120));
  }
});

test('both spawn-site functions record the call to the usage log (attribution present)', () => {
  // A coarse but real guard: each known site function body must reference usageLog.logCall, so a spawn
  // there is attributed. Slices from each function decl to the next top-level `\nfunction ` boundary.
  for (const fn of ['askClaude', 'oneShotWorker']) {
    const start = SRC.indexOf('function ' + fn + '(');
    assert.ok(start !== -1, fn + ' not found in main.js');
    const rest = SRC.slice(start + 1);
    const nextDecl = rest.indexOf('\nfunction ');
    const body = nextDecl === -1 ? rest : rest.slice(0, nextDecl);
    assert.ok(/usageLog\.logCall\(/.test(body), fn + ' must attribute its spawn via usageLog.logCall');
  }
});
