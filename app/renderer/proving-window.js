// The two-week trust proving window (ADR-0016, owner-locked 2026-07-21 -> 2026-08-04). Pure date
// math, zero LLM, zero guessing — the SAME honesty rule as everything else in this app: a real
// number computed from a real clock, never a vibe. Deliberately simple (the owner's own framing:
// "a very low bar"), not a mechanized "shock detector" — grading whether PCC actually earned trust
// is the owner's judgment call by design, not something this module claims to know.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCProvingWindow = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const START_MS = Date.UTC(2026, 6, 21); // 2026-07-21 (month is 0-indexed)
  const WINDOW_DAYS = 14;
  const END_MS = START_MS + WINDOW_DAYS * 24 * 60 * 60 * 1000; // 2026-08-04

  // nowMs: injectable clock (tests never depend on the real Date). Returns a plain-language,
  // honest snapshot — never a fake precise "on track", since only the owner can judge that.
  function provingWindowStatus(nowMs) {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const elapsedDays = Math.floor((now - START_MS) / (24 * 60 * 60 * 1000));
    const dayNumber = Math.min(WINDOW_DAYS, Math.max(0, elapsedDays) + 1); // "Day 1" on the lock date itself
    const remainingMs = Math.max(0, END_MS - now);
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return {
      startDate: '2026-07-21',
      endDate: '2026-08-04',
      windowDays: WINDOW_DAYS,
      dayNumber: dayNumber,
      remainingDays: remainingDays,
      ended: now >= END_MS,
      bar: 'PCC must be usable for one full week of regular use without shocking the owner in a serious way.',
    };
  }

  return { provingWindowStatus: provingWindowStatus, START_MS: START_MS, END_MS: END_MS };
});
