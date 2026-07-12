// single-flight.js — coalesce concurrent async calls into ONE in-flight run.
//
// WHY THIS EXISTS (soak finding W3 / DECISION-108): the Signals "Refresh" fires a
// batch that spawns 6 pwsh detector processes. A soak found rapid re-clicks spawning
// 129 concurrent pwsh because nothing shared the in-flight run. This primitive is the
// coalescing seam: while a run is pending, every caller gets the SAME promise; the
// first call AFTER it settles starts a FRESH run (so an explicit refresh is never
// stale). Pure — no Electron, no IPC — so the coalescing law is unit-provable without
// timing (see app/tests/unit/single-flight.test.js).
//
// Contract:
//   const run = singleFlight(fn);
//   run(...args) -> Promise. Concurrent calls during one in-flight run invoke `fn`
//   exactly ONCE and share its promise. A call after the previous run settles (resolve
//   OR reject) invokes `fn` again. run.pending() reports whether a run is in flight.

function singleFlight(fn) {
  if (typeof fn !== 'function') throw new TypeError('singleFlight expects a function');
  let inFlight = null;
  const run = (...args) => {
    if (inFlight) return inFlight;
    // fn is invoked NOW (eager, like the original inline pattern) so the underlying
    // work starts immediately; Promise.resolve wraps a non-promise return safely.
    // fn is invoked NOW (eager, exactly like the original inline async-IIFE). Wrapping the
    // call in an async IIFE converts a SYNCHRONOUS throw from fn into a rejected promise, so
    // run() ALWAYS returns a Promise and never throws synchronously — preserving the contract
    // (and never leaving inFlight set to a value that would wedge future refreshes).
    const p = (async () => fn(...args))();
    inFlight = p;
    // Clear on settle (resolve OR reject) so a failed run never sticks and blocks future
    // refreshes. Guard on identity so a late settle from a superseded run cannot clear a
    // newer one. Use then(settle, settle) rather than .finally so this internal cleanup
    // chain never itself becomes an UNHANDLED rejection when the run rejects — the caller
    // still receives `p` and is responsible for handling its rejection.
    const settle = () => { if (inFlight === p) inFlight = null; };
    p.then(settle, settle);
    return p;
  };
  run.pending = () => inFlight !== null;
  return run;
}

module.exports = { singleFlight };
