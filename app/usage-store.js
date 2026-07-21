// PCC's OWN durable copy of the owner's last real Claude usage reading (desktop-parity R1 hardening,
// 2026-07-21). The meter's data lives in the Claude DESKTOP app's cache (%APPDATA%\Claude\
// plan-usage-history.json), which PCC can only read cross-process and which intermittently fails a
// single read on the owner's machine (reproduced live: ENOENT at launch while the file exists),
// blanking the meter to "unknown". The fix (owner's design): whenever a cross-app read SUCCEEDS, mirror
// the value into a file PCC fully owns and can always read; the meter shows PCC's copy. A failed
// cross-app read then just means "don't update", never "blank". Survives app restarts, so even the
// first read at launch has a real number to fall back on (honestly aged).
//
// Fail-safe by construction (this is a SAFETY net — it must never itself break the app): load returns
// null on any read/parse/validation error; save is best-effort and swallows errors. Values are
// validated on load so a corrupted file can never inject a bogus percent or a fake-fresh timestamp.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCUsageStore = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  function isPct(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100; }

  // Pure: accept only a fully-valid reading, else null. asOfMs must be a finite positive epoch ms
  // (never trusted if non-numeric); percents must be real 0-100. No partial/fabricated readings.
  function sanitizeReading(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (!isPct(obj.sessionPercent) || !isPct(obj.weeklyPercent)) return null;
    if (typeof obj.asOfMs !== 'number' || !Number.isFinite(obj.asOfMs) || obj.asOfMs <= 0) return null;
    return { sessionPercent: obj.sessionPercent, weeklyPercent: obj.weeklyPercent, asOfMs: obj.asOfMs };
  }

  // `dir` is the EXACT directory usage-cache.json lives in — the caller (main.js) passes
  // app.getPath('userData'), a location PCC owns and can always read/write.
  function filePath(pathMod, dir) { return pathMod.join(dir, 'usage-cache.json'); }

  // Impure: load PCC's mirrored reading, or null on any failure. Never throws.
  function loadUsageCache(dir) {
    const fs = require('fs');
    const path = require('path');
    try { return sanitizeReading(JSON.parse(fs.readFileSync(filePath(path, dir), 'utf8'))); }
    catch (e) { return null; }
  }

  // Impure: best-effort atomic persist (temp + rename so a crash mid-write can't leave a torn file).
  // Never throws; a failed save just means the mirror is momentarily stale, never a broken app.
  function saveUsageCache(dir, reading) {
    const fs = require('fs');
    const path = require('path');
    const clean = sanitizeReading(reading);
    if (!clean) return false; // never persist a bogus reading
    try {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* exists */ }
      const target = filePath(path, dir);
      const tmp = target + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(clean, null, 2), 'utf8');
      fs.renameSync(tmp, target);
      return true;
    } catch (e) { return false; }
  }

  return { sanitizeReading: sanitizeReading, loadUsageCache: loadUsageCache, saveUsageCache: saveUsageCache };
});
