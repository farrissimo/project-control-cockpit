// mutex.js — a serial async mutex (single-lane queue) for the main process.
//
// WHY THIS EXISTS: some single-authority files have MORE THAN ONE in-process
// mutation path. lifecycle-state.json is written both by the pcc:setPhaseKind
// handler (a direct read-modify-write) and by the pcc:lifecycleAdvance handler
// (which spawns lifecycle-advance.ps1, whose child reads AND writes the file).
// Both are driven only from this single main process (the app takes Electron's
// single-instance lock), so the only real lost-update race is these two paths
// overlapping. atomic-store.js gives per-CALL atomicity but explicitly relies on a
// single writer; this serializes the two paths so that premise holds.
//
// runExclusive(fn) runs fn only after every previously-queued fn has settled, so
// two critical sections can never overlap WITHIN this process. It returns fn's
// result (and propagates its rejection), while keeping the internal chain alive so
// one rejecting section does not wedge the queue.
//
// SCOPE (honest): this is IN-PROCESS serialization only. It does not guard against
// a separate process (e.g. lifecycle-advance.ps1 run by hand in a terminal while
// the app is live) — that is out of normal operation (the pin is moved via the
// app, which is single-instance). A cross-process lock is the upgrade if that ever
// becomes a real workflow; it was deliberately not added here (see atomic-store.js
// on why a correct cross-process lock is its own, easy-to-get-wrong concern).

function createMutex() {
  let tail = Promise.resolve();
  function runExclusive(fn) {
    const run = tail.then(() => fn());
    // Keep the chain alive even if this section rejects, so a failure never wedges
    // the queue; the caller still receives the rejection via `run`.
    tail = run.then(() => {}, () => {});
    return run;
  }
  return { runExclusive };
}

// Run `fn` under `mutex`, but BOUND to the context captured NOW (at request time),
// not when the queue finally opens. `read()` is sampled synchronously before
// enqueueing; if it differs by the time the section starts (e.g. the switchable
// active project changed while this waited behind another lifecycle op), `onChanged`
// is returned INSTEAD of running fn — so a queued operation never acts on a context
// it was not requested for. This closes the "serialization delays the context read
// past a project switch" race that plain runExclusive would introduce for handlers
// that read a mutable global (projectDir). fn receives the captured context.
function runExclusiveBound(mutex, read, fn, onChanged) {
  const captured = read();
  return mutex.runExclusive(() => {
    if (read() !== captured) return onChanged(captured, read());
    return fn(captured);
  });
}

module.exports = { createMutex, runExclusiveBound };
