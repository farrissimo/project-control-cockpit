// FI-4 — an atomic-write .prev preserve/install failure fails closed without destroying
// data. Exercises the REAL app/state/atomic-store.js writeJsonAtomic, deterministically
// intercepting the SAME fs.renameSync it uses (fs is a cached singleton — the pattern the
// module's own unit tests use). Expected: CONTAINED.
//
// SCOPE (honest): this proves handling of the injected fs.renameSync(.prev) failure — NOT
// universal power-loss durability across every OS/filesystem.
const path = require('path');
const fs = require('fs');
const os = require('os');
const atomic = require('../../app/state/atomic-store');

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: String(detail) });
let baselineOk = false, injectionTriggered = false, observed = '';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-fi4-'));
const file = path.join(dir, 'data.json');
try {
  // ---- baseline: a valid current (gen 2) with a valid prior generation (gen 1) ----
  const w1 = atomic.writeJsonAtomic(file, { gen: 1, keep: 'good' });
  const w2 = atomic.writeJsonAtomic(file, { gen: 2, keep: 'good' });
  baselineOk = w1.ok && w2.ok && atomic.readJson(file).data.gen === 2 && atomic.readPrevJson(file).data.gen === 1;
  const curBefore = JSON.stringify(atomic.readJson(file).data);
  const prevBefore = JSON.stringify(atomic.readPrevJson(file).data);

  // ---- inject: force fs.renameSync to fail when INSTALLING the .prev generation ----
  const origRename = fs.renameSync;
  let firedOnPrev = false;
  fs.renameSync = (from, to, ...rest) => {
    if (String(to).endsWith('.prev')) { firedOnPrev = true; throw Object.assign(new Error('inject: .prev install failed'), { code: 'EPERM' }); }
    return origRename(from, to, ...rest);
  };
  let w3;
  try { w3 = atomic.writeJsonAtomic(file, { gen: 3, keep: 'good' }); }
  finally { fs.renameSync = origRename; }
  injectionTriggered = firedOnPrev;
  observed = 'fs.renameSync forced to fail installing .prev; writeJsonAtomic ok=' + (w3 && w3.ok);

  add('write_reported_failure',
    w3 && w3.ok === false && /prev_(install|preserve)_failed/.test(w3.error || ''),
    'writeJsonAtomic returned ok:false — no false success (' + (w3 && w3.error) + ')');
  add('current_readable_and_unchanged',
    JSON.stringify(atomic.readJson(file).data) === curBefore,
    'the current generation is still readable and unchanged (gen 2)');
  add('prior_generation_not_destroyed',
    JSON.stringify(atomic.readPrevJson(file).data) === prevBefore,
    'the already-valid prior generation (.prev, gen 1) was preserved, not destroyed');

  const leftovers = fs.readdirSync(dir).filter((f) => /\.(new|prev)-/.test(f) || f.includes('.tmp-'));
  add('temp_artifacts_cleaned', leftovers.length === 0, 'no staging temp files left behind (' + leftovers.join(',') + ')');

  // ---- recovery: once the fault clears, a normal write succeeds ----
  const w4 = atomic.writeJsonAtomic(file, { gen: 3, keep: 'good' });
  add('subsequent_normal_write_succeeds',
    w4.ok && atomic.readJson(file).data.gen === 3,
    'after the injected fault clears, a normal write succeeds (recovers)');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(JSON.stringify({ id: 'FI-4-atomic-install-failure', expected: 'CONTAINED', baselineOk, injectionTriggered, observed, checks }));
