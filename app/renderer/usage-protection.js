// Automatic usage protection from the REAL 5-hour usage % (ADR-0020 T4). Pure, unit-testable, no DOM.
//
// The owner does zero token math. app/usage-meter.js already reads his REAL 5-hour session % from the
// Claude desktop app's own cache; today that number is display-only. T4 turns it into ACTION:
//   • 70-89%  -> warn (the meter reads amber and the "Continue in fresh chat" action is offered);
//               the send is NOT intercepted.
//   • >=90%   -> intercept the next worker invocation and let the OWNER choose (fresh chat / send
//               anyway / cancel). PCC never switches chats by itself.
//
// The 70/90 numbers are NOT invented here — they are the SAME established five-hour severity
// thresholds the meter already uses (renderer usageSeverity: >=90 'bad', >=70 'warn'). This module is
// the single source so the meter and the protection can never drift apart.
//
// FAIL HONEST (the whole reason the meter exists): protection acts ONLY on a fresh, available reading.
// An unavailable or stale reading returns 'none' — the owner is never held on a number PCC cannot
// vouch for; the meter shows that state as "unknown" separately. A rollover to a fresh chat lowers
// usage PER FUTURE MESSAGE (a smaller context is re-sent); it does NOT lower the CURRENT 5-hour % —
// the caller's copy must never imply otherwise.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCUsageProtection = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const WARN_PCT = 70; // matches usageSeverity 'warn'
  const HOLD_PCT = 90; // matches usageSeverity 'bad' — the interception threshold

  // Pure. reading is the shape app/usage-meter.js produces and window.pcc.usage() returns:
  // { available, stale, sessionPercent, ... }. Returns 'hold' | 'warn' | 'none'.
  //   - not available OR stale        -> 'none' (fail honest: never hold on an untrusted number)
  //   - available & fresh & >=90      -> 'hold'  (intercept the next worker invocation)
  //   - available & fresh & 70..89    -> 'warn'  (warn + offer rollover, never intercept)
  //   - available & fresh & <70       -> 'none'
  function usageProtectionAction(reading) {
    if (!reading || reading.available !== true || reading.stale === true) return 'none';
    const p = reading.sessionPercent;
    if (typeof p !== 'number' || !Number.isFinite(p)) return 'none';
    if (p >= HOLD_PCT) return 'hold';
    if (p >= WARN_PCT) return 'warn';
    return 'none';
  }

  return { usageProtectionAction: usageProtectionAction, WARN_PCT: WARN_PCT, HOLD_PCT: HOLD_PCT };
});
