// Durable per-chat cost accumulation (desktop-parity R3, ADR-0015 residue closed).
//
// ADR-0015's cross-turn cost rollover tracked each chat's running cost IN MEMORY only — an app
// restart mid-chat reset the counter to $0, so a long chat resumed after a restart could balloon
// again with no rollover. During the 2026-07-20 crisis the owner restarted repeatedly, so that
// gap is real, not theoretical. This persists the running totals to a git-ignored file so the
// protection survives a restart.
//
// Fail-safe by construction (this is a SAFETY net — it must never itself become a failure): load
// returns {} on any read/parse error (a fresh start, never a crash); save is best-effort and
// swallows errors (a missed save just means one chat's total is slightly stale, never a broken
// app). Values are validated on load — only finite, non-negative per-chat numbers survive, so a
// corrupted file can never inject a bogus (e.g. negative, forcing endless no-rollover) total.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCChatCostStore = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Pure: turn a parsed file object into a clean { chatId: number } map, dropping anything invalid.
  function sanitize(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    const src = obj.costs && typeof obj.costs === 'object' ? obj.costs : null;
    if (!src) return out;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (typeof k === 'string' && k && typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  }

  // `dir` is the EXACT directory chat-costs.json lives in — the caller decides isolation (in test
  // mode PCC points this at a throwaway userData dir, never real project state; in production it is
  // the git-ignored .cockpit/evidence). This module never assumes a subfolder.
  function filePath(pathMod, dir) { return pathMod.join(dir, 'chat-costs.json'); }

  // Impure: load the persisted map, or {} on any failure. Never throws.
  function loadChatCosts(dir) {
    const fs = require('fs');
    const path = require('path');
    try { return sanitize(JSON.parse(fs.readFileSync(filePath(path, dir), 'utf8'))); }
    catch (e) { return {}; }
  }

  // Impure: best-effort persist. Never throws; a failed write is swallowed (the in-memory total
  // still holds for this run — degrades to exactly the pre-persistence behavior, never worse).
  function saveChatCosts(dir, costs) {
    const fs = require('fs');
    const path = require('path');
    try {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* exists */ }
      const clean = sanitize({ costs: costs });
      fs.writeFileSync(filePath(path, dir), JSON.stringify({ costs: clean }, null, 2), 'utf8');
      return true;
    } catch (e) { return false; }
  }

  return { sanitize: sanitize, loadChatCosts: loadChatCosts, saveChatCosts: saveChatCosts };
});
