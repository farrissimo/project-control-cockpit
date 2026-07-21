// Owner's real Claude usage stat (desktop-parity R1, docs/proposals/desktop-parity.md).
//
// The owner does ZERO token math. The one thing he watches is the SAME "Plan usage limits"
// panel the Claude desktop app shows (Current session % + reset; Weekly/All-models % + reset).
// Verified live 2026-07-20: the desktop app writes its own polled samples to
// `%APPDATA%/Claude/plan-usage-history.json` ({ version, samples: [{ t, org, u: { fh, sd } }] }),
// refreshed roughly every 5 minutes — fh = five-hour (session) percent, sd = seven-day (weekly)
// percent, both 0-100. This is the SAME real number the panel displays (confirmed against a live
// owner screenshot: fh climbed 20->29 over an hour of real work while sd held at 26).
//
// Honest boundaries (no fake green):
//   - This is an undocumented, desktop-app-internal cache, not a public API. If the file is
//     missing, malformed, or empty, we report UNAVAILABLE — never a fabricated 0%.
//   - The file updates on its own ~5-minute cadence; we NEVER claim it is instantaneous. Every
//     available reading carries ageMs so the caller can show real freshness, not a fake "live".
//   - The live worker stream carries a resetsAt (the 5-hour window's reset time) via
//     `rate_limit_event`, already captured in app/stream-parser.js#getUsage. THIS module does not
//     read that; reset time is combined by the caller (main.js) from whatever the most recent
//     turn's stream actually reported. When no such reading exists yet this session, reset is
//     honestly omitted — never guessed from the percent.
//   - Assumes a single authenticated org on this machine (the samples all share one `org`); a
//     multi-org machine would need extension. Disclosed simplification, not a silent bug.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCUsageMeter = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // A reading older than this is still shown (not hidden), but flagged stale so the UI can be
  // honest about freshness rather than implying a just-now value. ~3x the observed ~5-min cadence.
  const STALE_MS = 15 * 60 * 1000;

  // A last-good reading older than this is DROPPED — too old to honestly stand in for "current"
  // when a fresh read fails. Beyond this we tell the truth ("unknown") rather than show a number
  // we can no longer vouch for. (Matches Claude Code's own /usage 60-min last-known fallback.)
  const LAST_GOOD_MAX_AGE_MS = 60 * 60 * 1000;

  // A momentary FILE LOCK while the Claude desktop app rewrites the cache is retried (these codes);
  // a genuinely missing candidate path (ENOENT) is NOT retried — it just means "try the next
  // candidate location" (see usageFileCandidates). Anything else fails fast/honest.
  const TRANSIENT_READ_CODES = ['EBUSY', 'EPERM', 'EACCES'];
  const READ_RETRY_BACKOFF_MS = [25, 75, 150]; // total < 300ms worst case, only on the lock path

  // Synchronous, no-busy-wait sleep (Node-only; Atomics.wait on a throwaway buffer). Used only on
  // the rare retry path, so blocking the poll for tens of ms is acceptable and keeps the reader sync.
  function sleepSync(ms) {
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, ms | 0)); }
    catch (e) { /* SharedArrayBuffer/Atomics unavailable: skip the wait, still retry */ }
  }

  function isPct(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100; }

  // Pure: normalize an already-parsed plan-usage-history.json object into the honest contract.
  // Never throws; any shape surprise degrades to { available:false, reason }.
  function parseUsageSample(raw, nowMs) {
    if (!raw || typeof raw !== 'object') return { ok: true, available: false, reason: 'malformed' };
    const samples = raw.samples;
    if (!Array.isArray(samples)) return { ok: true, available: false, reason: 'malformed' };
    if (samples.length === 0) return { ok: true, available: false, reason: 'empty' };
    // Pick the sample with the greatest timestamp (defensive: don't assume array order).
    let latest = null;
    for (const s of samples) {
      if (!s || typeof s !== 'object' || typeof s.t !== 'number' || !Number.isFinite(s.t)) continue;
      if (!latest || s.t > latest.t) latest = s;
    }
    if (!latest) return { ok: true, available: false, reason: 'malformed' };
    const u = latest.u;
    if (!u || typeof u !== 'object' || !isPct(u.fh) || !isPct(u.sd)) return { ok: true, available: false, reason: 'malformed' };
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    // A sample timestamped in the future is impossible for a real desktop-app-written reading —
    // clamping it to ageMs:0 would make a corrupted/clock-skewed entry look "just now" and fully
    // fresh (a fake-green found in review). Treat it as malformed instead of trusting it.
    if (latest.t > now) return { ok: true, available: false, reason: 'malformed' };
    const ageMs = now - latest.t;
    return {
      ok: true, available: true,
      sessionPercent: u.fh, weeklyPercent: u.sd,
      asOfMs: latest.t, ageMs: ageMs, stale: ageMs > STALE_MS,
    };
  }

  // Impure: locate + read the desktop app's own usage cache and normalize it. child_process-free;
  // fs/path required lazily so this module stays loadable outside Node (mirrors ci-status.js).
  //
  // appDataDir: the Roaming AppData directory. The Electron caller (main.js) MUST pass
  // app.getPath('appData'), which Electron resolves via the Windows API (SHGetKnownFolderPath) and
  // is therefore immune to a missing/mangled APPDATA env var — a REAL, reproduced-on-this-machine
  // condition (the app process had no process.env.APPDATA, so the meter permanently read "no_file"
  // even though the data was healthy; see electron#31059/#11942). The process.env.APPDATA fallback
  // is ONLY for the CLI/test path, where Electron's app API isn't available; it is a best-effort
  // convenience, never the app's source of truth.
  //
  // Reads are retried over a sub-300ms window on transient Windows file errors (see
  // TRANSIENT_READ_CODES) so a momentary atomic-replace race can't blank the meter. `deps` is a test
  // seam only: { fs, sleep } to inject a fake reader/clock; production passes nothing.
  // Ordered candidate locations for plan-usage-history.json. The Claude DESKTOP app is often an
  // MSIX/Microsoft-Store package, so %APPDATA%\Claude is only a JUNCTION into the package container
  // (%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude) that a normal session process
  // frequently CANNOT traverse — reproduced live 2026-07-21: the owner's app got ENOENT on the
  // junction while a same-session process read the DIRECT package path fine (fh:20). So we try the
  // direct package path(s) FIRST, then the plain Roaming path (non-Store installs). appDataDir is the
  // Roaming dir; its sibling "Local" holds Packages.
  function usageFileCandidates(appDataDir, fs, path) {
    const out = [];
    try {
      const pkgs = path.join(path.resolve(appDataDir, '..', 'Local'), 'Packages');
      let entries = [];
      try { entries = fs.readdirSync(pkgs); } catch (e) { entries = []; }
      for (const name of entries) {
        if (/^Claude_/i.test(name)) out.push(path.join(pkgs, name, 'LocalCache', 'Roaming', 'Claude', 'plan-usage-history.json'));
      }
    } catch (e) { /* fall through to the Roaming candidate */ }
    out.push(path.join(appDataDir, 'Claude', 'plan-usage-history.json'));
    return out;
  }

  function readPlanUsage(nowMs, appDataDir, deps) {
    const fs = (deps && deps.fs) || require('fs');
    const sleep = (deps && deps.sleep) || sleepSync;
    const path = require('path');
    const appData = (typeof appDataDir === 'string' && appDataDir) ? appDataDir : process.env.APPDATA;
    if (!appData) return { ok: true, available: false, reason: 'no_file' };
    // Try each candidate location; a missing candidate (ENOENT) falls through to the next, a momentary
    // lock is retried, and the first successful read wins.
    let raw = null;
    for (const file of usageFileCandidates(appData, fs, path)) {
      for (let attempt = 0; attempt <= READ_RETRY_BACKOFF_MS.length; attempt++) {
        try { raw = fs.readFileSync(file, 'utf8'); break; }
        catch (e) {
          const locked = e && TRANSIENT_READ_CODES.indexOf(e.code) !== -1;
          if (locked && attempt < READ_RETRY_BACKOFF_MS.length) { sleep(READ_RETRY_BACKOFF_MS[attempt]); continue; }
          break; // ENOENT / other / exhausted -> stop retrying this candidate, try the next one
        }
      }
      if (raw !== null) break;
    }
    if (raw === null) return { ok: true, available: false, reason: 'no_file' };
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return { ok: true, available: false, reason: 'malformed' }; }
    return parseUsageSample(parsed, nowMs);
  }

  // Pure: decide what to SHOW given a fresh read result and the caller's last-good reading. A fresh
  // available reading always wins (and the caller should then store it as the new last-good). When a
  // read fails, we serve the last-good reading rather than blanking to "unknown" — but ONLY if it is
  // real, not future-dated, and within LAST_GOOD_MAX_AGE_MS; and ALWAYS with its true recomputed
  // ageMs + stale flag, never a fake-live number. Past the max age we return the honest unavailable
  // result. lastGood shape: { sessionPercent, weeklyPercent, asOfMs }.
  function applyLastGood(fresh, lastGood, nowMs) {
    if (fresh && fresh.available) return fresh;
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    if (lastGood && typeof lastGood.asOfMs === 'number' && Number.isFinite(lastGood.asOfMs)
      && isPct(lastGood.sessionPercent) && isPct(lastGood.weeklyPercent)
      && lastGood.asOfMs <= now) {
      const ageMs = now - lastGood.asOfMs;
      if (ageMs <= LAST_GOOD_MAX_AGE_MS) {
        return {
          ok: true, available: true,
          sessionPercent: lastGood.sessionPercent, weeklyPercent: lastGood.weeklyPercent,
          asOfMs: lastGood.asOfMs, ageMs: ageMs, stale: ageMs > STALE_MS,
          servedFromLastGood: true,
        };
      }
    }
    return fresh;
  }

  return {
    parseUsageSample: parseUsageSample, readPlanUsage: readPlanUsage, applyLastGood: applyLastGood,
    STALE_MS: STALE_MS, LAST_GOOD_MAX_AGE_MS: LAST_GOOD_MAX_AGE_MS,
  };
});
