// Durable, best-effort app-error log.
//
// PCC's integrity contract (docs/ENGINEERING_ASSURANCE_PLAN.md Part 1) forbids
// SWALLOWED failures: a `catch (e) { /* best effort */ }` that drops an error with
// no trace leaves a non-coder owner nothing to diagnose when the app misbehaves
// (a failed authority write, a dropped request, a durable-mirror write that never
// landed). This module is the last-resort recorder for those otherwise-silent
// failures — an append-only JSONL line per error under `.cockpit/logs/app-error.log`,
// which `scripts/doctor.ps1` surfaces so the owner actually SEES that something failed.
//
// It NEVER throws. A logger that can crash the code it logs for is worse than no
// logger — every caller is already inside a failure path, so on its own failure it
// falls back to console and returns false rather than propagating.

const fs = require('fs');
const path = require('path');

/**
 * Append one error record to <logsDir>/app-error.log (JSONL). Best-effort, never throws.
 * @param {string} logsDir - directory for app-error.log (created if missing)
 * @param {string} context - short label for WHERE it failed (e.g. 'authority-store.write')
 * @param {*} err - the caught error (Error or any value)
 * @returns {boolean} true if the record was written, false if even logging failed
 */
function logAppError(logsDir, context, err) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      context: String(context == null ? 'unknown' : context),
      message: (err && err.message) ? String(err.message) : String(err),
    };
    if (err && err.stack) entry.stack = String(err.stack);
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, 'app-error.log'), JSON.stringify(entry) + '\n', 'utf8');
    return true;
  } catch (e) {
    // Last resort only — never rethrow; the caller is already handling a failure.
    try { console.error('[app-error-log] could not record error for', context, '-', e && e.message); } catch (_) { /* nothing left to do */ }
    return false;
  }
}

module.exports = { logAppError };
