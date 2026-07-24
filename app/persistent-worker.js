// persistent-worker.js — ONE global warm `claude` process for text chat turns (ADR-0020 T3).
//
// WHY: PCC used to cold-start a fresh `claude -p` process for EVERY owner message. A warm streaming
// process (`--input-format stream-json --output-format stream-json`, stdin held open) instead keeps ONE
// session alive so later turns READ the prompt cache — demonstrated on real Claude (capability gate,
// ADR-0020 Task 2: two messages, one PID, turn 2 read turn 1's cache). This is the selected emergency
// recovery architecture: it eliminates repeated process startup and removes the unresolved risk of the
// cold-per-message path. NOTE: the corrected cold path was never validly measured (the earlier cold-vs-
// warm comparison was invalidated — ADR-0020 Amendment 3), so cold restart is NOT claimed as the proven
// root-cause of the usage burn — that hypothesis remains untested.
//
// SCOPE: exactly one live worker (no pool, no concurrency). The renderer serialises sends globally, so
// at most one text turn is in flight at any moment — this module relies on that and does NOT queue.
//
// TESTABILITY: a pure lifecycle state machine. The caller injects `kill` and, per turn, a zero-arg
// `spawnThunk` that returns a child process — so unit tests drive it with a FAKE process and assert the
// real launch COUNT and every reuse/restart/stop/crash/idle transition, with no Electron, no real
// `claude`, and zero plan usage. main.js owns the argv/parse/usage logic; this module owns ONLY the
// process lifecycle and the one-result-per-send correlation.

// The identity a live worker is reused under. Any change forces a deliberate restart — these are
// process-start settings a running CLI cannot change.
function identityKey(id) {
  return JSON.stringify([
    id.cwd || '', id.chatId || '', id.sessionId || '', id.model || '',
    id.fallback || '', id.isBuild ? 'build' : 'read-only', id.channelPrompt || '',
  ]);
}

// createPersistentWorker({ kill, onSpawn, onClose }):
//   kill(child)     -> terminate the child + its tree (killWorker in prod).
//   onSpawn(child)  -> fired ONCE when a real process is spawned (prod: activeWorkers.add).
//   onClose(child)  -> fired ONCE when that process is gone, any reason (prod: activeWorkers.delete).
function createPersistentWorker(deps) {
  const kill = deps.kill || (() => {});
  const onSpawn = deps.onSpawn || (() => {});
  const onClose = deps.onClose || (() => {});

  let current = null; // { child, key, alive, buf, err, pending }
  let launches = 0;   // real process spawns — the count tests assert against

  // Kill the live process (restart / shutdown). Fires onClose exactly once, and — Defect-1 fix — SETTLES
  // any in-flight owner turn exactly once as 'cancelled', so a New-Chat / project switch / attachment
  // fallback / identity replacement / app shutdown during an active turn can never orphan the askClaude
  // promise (which would leave PCC stuck showing "Claude is working…"). Late output and the later close
  // event are ignored because `current` is already null; nothing is retried or resent.
  function teardown() {
    if (!current) return;
    const child = current.child; const p = current.pending;
    current.alive = false; current = null;
    try { kill(child); } catch (e) { /* best effort */ }
    onClose(child);
    if (p) p.resolve({ kind: 'cancelled', pid: child.pid });
  }

  function wire(child) {
    child.stdout.on('data', (d) => {
      if (!current || current.child !== child) return;
      const s = d.toString();
      current.rawOut += s;   // ALL stdout, for the on-close finish (a one-shot json blob without a
      current.buf += s;      // trailing newline is never a "line", so it is parsed from rawOut on close)
      let i;
      while ((i = current.buf.indexOf('\n')) >= 0) {
        const line = current.buf.slice(0, i); current.buf = current.buf.slice(i + 1);
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type !== 'result') continue; // one `result` per completed owner turn
        const p = current.pending; current.pending = null;
        if (p) p.resolve({ kind: 'result', jsonText: line, pid: child.pid });
        // The process stays ALIVE and idle — it performs no model work until the next send.
      }
    });
    if (child.stderr && child.stderr.on) child.stderr.on('data', (d) => { if (current && current.child === child) current.err += d.toString(); });
    child.on('error', (e) => {
      if (!current || current.child !== child) return;
      const p = current.pending; const err = current.err; const out = current.rawOut; current = null;
      onClose(child);
      if (p) p.resolve({ kind: 'spawnError', message: (e && e.message) || 'spawn error', err: err, out: out, pid: child.pid });
    });
    child.on('close', (code) => {
      if (!current || current.child !== child) return; // a killed-and-replaced child: ignore its late close
      const p = current.pending; const err = current.err; const out = current.rawOut; current = null;
      onClose(child);
      // Pending => the process exited during the turn. main parses `out` (its accumulated stdout) exactly
      // like the cold path — a clean/empty/max-turns/budget result finishes normally, a real crash is a
      // classified failure with NO retry. Idle => a silent death; the next send spawns a fresh process.
      if (p) p.resolve({ kind: 'closed', code: code, err: err, out: out, pid: child.pid });
    });
  }

  return {
    // Route one text turn. `spawnThunk()` returns a child; it is called ONLY when a fresh process must be
    // started (identity change or no live worker). `jsonlMessage` is one JSONL user-message line (no
    // trailing newline). Resolves with a discriminated outcome and NEVER rejects:
    //   {kind:'result',jsonText,pid} | {kind:'closed',code,err,pid} |
    //   {kind:'spawnError',message,err} | {kind:'stopped',pid}
    runTextTurn(id, spawnThunk, jsonlMessage) {
      return new Promise((resolve) => {
        const key = identityKey(id);
        const reusable = current && current.alive && current.key === key && !current.pending;
        if (!reusable) {
          if (current) teardown(); // deliberate restart: the old worker dies before the new one starts
          let child;
          try { child = spawnThunk(); }
          catch (e) { return resolve({ kind: 'spawnError', message: (e && e.message) || 'could not launch', err: '' }); }
          launches += 1;
          current = { child, key, alive: true, buf: '', rawOut: '', err: '', pending: null };
          onSpawn(child);
          wire(child);
        }
        // Defect-2 fix: turn-scoped output state is RESET for every explicit owner send while the process
        // identity persists — so a later turn's abnormal close carries only that turn's stdout/stderr, and
        // a prior turn's result can never be re-parsed, re-logged, or shown as the current failure.
        current.buf = ''; current.rawOut = ''; current.err = '';
        current.pending = { resolve };
        try { current.child.stdin.write(jsonlMessage + '\n'); }
        catch (e) {
          const p = current.pending; const child = current.child; const err = current.err; current = null;
          onClose(child);
          if (p) p.resolve({ kind: 'spawnError', message: 'write failed: ' + ((e && e.message) || 'unknown'), err: err, pid: child && child.pid });
        }
      });
    },

    // Owner Stop: kill the active worker, resolve any pending turn as stopped, perform no auto-restart.
    stopCurrent() {
      if (!current) return false;
      const p = current.pending; const child = current.child; current = null;
      try { kill(child); } catch (e) { /* best effort */ }
      onClose(child);
      if (p) p.resolve({ kind: 'stopped', pid: child.pid });
      return true;
    },

    // App shutdown / project switch: ensure no worker survives.
    shutdown() { teardown(); },

    // Introspection for main (Stop wiring) + tests.
    activeChild() { return current ? current.child : null; },
    isAlive() { return !!(current && current.alive); },
    launchCount() { return launches; },
  };
}

module.exports = { createPersistentWorker, identityKey };
