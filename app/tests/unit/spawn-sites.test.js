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

// These guards scan SOURCE TEXT, so they must ignore comments — several files deliberately quote the
// old, defective `spawn('claude', args, {shell:true})` pattern while explaining why it was removed, and
// a naive scan would flag that documentation as the defect itself.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const APP_DIR = path.join(__dirname, '..', '..');

// Every .js under app/, excluding dependencies and the deliberate fake `claude` the e2e suite puts on
// PATH (tests/fakebin/claude.js IS the stand-in CLI — it does not launch the real one).
function walkAppJs(dir, acc, base) {
  acc = acc || []; base = base || APP_DIR; dir = dir || APP_DIR;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'fakebin') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAppJs(full, acc, base);
    else if (entry.name.endsWith('.js')) acc.push(path.relative(base, full));
  }
  return acc;
}

const SRC = stripComments(fs.readFileSync(path.join(APP_DIR, 'main.js'), 'utf8'));

// The function that lexically encloses a source offset = the nearest PRECEDING `function NAME(`.
function enclosingFn(src, offset) {
  const re = /function\s+(\w+)\s*\(/g;
  let name = null, m;
  while ((m = re.exec(src)) && m.index < offset) name = m[1];
  return name;
}

test('app/main.js spawns `claude` ONLY from the known, attributed sites', () => {
  // Since 2026-07-24 the launcher is spawnClaude() (app/claude-spawn.js), not spawn('claude', …).
  // ADR-0020 T3: askClaude now has TWO spawnClaude calls — the persistent WARM text worker and the COLD
  // one-shot (attachment / create-flow) path — both inside askClaude and both usage-logged. The guard
  // that matters is: every spawn site is enclosed by a known attributed function (askClaude or
  // oneShotWorker), so a NEW hidden burn channel in any other function still fails this test.
  const re = /spawnClaude\(/g;
  const sites = [];
  let m;
  while ((m = re.exec(SRC))) sites.push(enclosingFn(SRC, m.index));

  assert.ok(sites.length >= 2,
    'expected at least the known `claude` spawn sites in main.js, found ' + sites.length);
  const allowed = new Set(['askClaude', 'oneShotWorker']);
  for (const s of sites) {
    assert.ok(allowed.has(s),
      'a `claude` spawn lives OUTSIDE the usage-logged sites (in ' + s + ') — every spawn must be attributed');
  }
  assert.deepStrictEqual([...new Set(sites)].sort(), ['askClaude', 'oneShotWorker'],
    'the set of enclosing functions must be exactly {askClaude, oneShotWorker}, got: ' + [...new Set(sites)].join(', '));
});

test('main.js never spawns the claude CLI by name — it must go through the safe launcher', () => {
  // Regression guard for the 2026-07-24 argv-mangling defect: a raw spawn('claude', args, {shell:true})
  // silently corrupted the system prompt and the tool/authority profile strings. Route every launch
  // through spawnClaude() (which never enables a shell), so the boundary is proven by spawn-contract.test.js.
  assert.ok(!/spawn\((['"])claude\1/.test(SRC),
    'main.js spawns `claude` directly — use spawnClaude() from app/claude-spawn.js instead');
});

test('every `claude` spawn in main.js strips paid-API creds via workerEnv (DECISION-003)', () => {
  // A spawn that omits `env: workerEnv()` would let the child `claude` grab ANTHROPIC_API_KEY and bill a
  // PAID API — forbidden. Pin that every spawn call passes workerEnv in its options object.
  const re = /spawnClaude\([^;]*?\)/gs;
  const calls = SRC.match(re) || [];
  assert.ok(calls.length >= 2, 'expected the known claude spawns');
  for (const call of calls) {
    assert.ok(/env:\s*workerEnv\(\)/.test(call),
      'a claude spawn is missing `env: workerEnv()` (paid-API leak risk): ' + call.replace(/\s+/g, ' ').slice(0, 120));
  }
});

test('no claude launcher anywhere re-enables a shell (app + measurement tools)', () => {
  // shell:true is what mangled the args. Pin its absence at every launcher, including the Gate 0 tools,
  // so a future edit cannot quietly reintroduce the defect that invalidated Step 2's measurements.
  // codex-caught: a hand-written file list missed app/prototypes/chat-recall/worker.js, a SIXTH raw
  // launcher. Walk the whole app tree instead, so a new one cannot hide behind an out-of-date list.
  for (const rel of walkAppJs()) {
    const src = stripComments(fs.readFileSync(path.join(APP_DIR, rel), 'utf8'));
    for (const m of src.match(/spawnClaude\([^;]*?\)/gs) || []) {
      assert.ok(!/shell:\s*true/.test(m), rel + ' passes shell:true to spawnClaude: ' + m.replace(/\s+/g, ' ').slice(0, 120));
    }
    assert.ok(!/spawn\((['"])claude\1/.test(src), rel + ' still spawns `claude` directly — use spawnClaude()');
  }
});

test('the Gate 0 cold arm sends its prompt over STDIN, like production — not as positional argv', () => {
  // The cold arm used args.push(prompt) while production writes the message to stdin. That mismatch (plus
  // the shell mangling) is why every prior cold-arm measurement was invalid. Pin the corrected contract.
  const src = stripComments(fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'measure-usage.js'), 'utf8'));
  assert.ok(/child\.stdin\.write\(prompt\)/.test(src),
    'measure-usage.js must write the prompt to stdin');
  assert.ok(!/args\.push\(prompt\)/.test(src),
    'measure-usage.js still passes the prompt as a positional argument');
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
