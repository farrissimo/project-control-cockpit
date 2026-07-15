// Governor "Surface" (ADR-0006) — the DETERMINISTIC view-model for the live
// change-stakes card, split from rendering so the RULES are unit-testable with crafted
// classifier output and can never drift into runtime AI. Pure: takes the JSON emitted by
// scripts/classify-stakes.ps1 and returns an owner-facing view-model. No DOM, no I/O, no LLM.
//
// Hard guardrails encoded here:
//  - Fail closed: a null / malformed / UNKNOWN result reads as UNKNOWN (treat as high-stakes),
//    NEVER a low tier — the surface must never paint a risky change as safe.
//  - "No change in flight" (a known tier but zero touched files) is its own honest empty
//    state, never a fabricated T3.
//  - Surfacing NEVER blocks; that is the whole point of this slice (the gate is later).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCStakes = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Tier metadata — owner-legible names (kept in step with the manifest) + a severity ZONE
  // that drives color (weight, not alarm) + the proof the later gate slice will expect.
  // A tier the classifier emits that is NOT listed here degrades to UNKNOWN.
  const TIER_META = {
    T0: { name: 'constitutional / trust root', zone: 'crucial', proof: 'Full proof: independent verification + CI-green on this exact commit.' },
    T1: { name: 'integrity-critical runtime', zone: 'crucial', proof: 'Strong proof: independent verification + CI-green.' },
    T2: { name: 'control-surface & binding policy', zone: 'notice', proof: 'Moderate proof: tests + review.' },
    T3: { name: 'informational / default', zone: 'info', proof: 'Normal proof; no special gate.' },
    T4: { name: 'low-consequence / noise', zone: 'clear', proof: 'Near-frictionless; no gate.' },
  };

  function stakesView(c) {
    // Fail closed: no result, or a shape we cannot read, reads as an error/UNKNOWN — never a
    // low tier. `advisory` is always true: this surface never blocks.
    if (!c || typeof c !== 'object' || typeof c.tier !== 'string') {
      return {
        state: 'error', tier: 'UNKNOWN', tierName: 'unknown', zone: 'unknown', advisory: true,
        headline: 'Change stakes: could not classify',
        detail: 'The stakes classifier did not return a readable result.',
        proof: 'Cannot classify — treat as high-stakes until the classifier is readable.',
        reasons: [], files: [], escalations: [], fileCount: 0,
        notProven: 'The stakes of the current change — the classifier could not be read.',
      };
    }
    const tier = c.tier;
    const reasons = Array.isArray(c.reasons) ? c.reasons.slice() : [];
    const files = Array.isArray(c.files) ? c.files.slice() : [];
    const escalations = Array.isArray(c.escalations) ? c.escalations.slice() : [];
    const notProven = typeof c.not_proven === 'string' ? c.not_proven : '';

    if (tier === 'UNKNOWN') {
      return {
        state: 'unknown', tier: 'UNKNOWN', tierName: 'unknown', zone: 'unknown', advisory: true,
        headline: 'Change stakes: UNKNOWN',
        proof: 'Cannot classify — treat as high-stakes until the manifest is readable.',
        reasons, files, escalations, notProven, fileCount: files.length,
      };
    }
    // A known tier but nothing touched => no change in flight. Honest empty state, not "T3".
    if (files.length === 0) {
      return {
        state: 'empty', tier, tierName: null, zone: 'info', advisory: true,
        headline: 'No change in flight',
        detail: 'Nothing uncommitted and no diff versus the baseline — nothing to classify.',
        proof: null, reasons, files: [], escalations: [], notProven, fileCount: 0,
      };
    }
    const meta = TIER_META[tier] || { name: 'unknown', zone: 'unknown', proof: 'Unrecognized tier — treat as high-stakes.' };
    return {
      state: 'classified', tier, tierName: meta.name, zone: meta.zone, advisory: true,
      headline: 'Change stakes: ' + tier + ' — ' + meta.name,
      baseTier: typeof c.base_tier === 'string' ? c.base_tier : null,
      proof: meta.proof, reasons, files, escalations, notProven, fileCount: files.length,
    };
  }

  return { stakesView: stakesView, TIER_META: TIER_META };
});
