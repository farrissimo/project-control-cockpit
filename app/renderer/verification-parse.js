// ONE structured parser for app/last-verification.txt, shared by every JS surface
// (main-process trustExtras + renderer trust strip + verifyThenAdvance) so they can
// never diverge from each other or from the PowerShell phase-close gate.
//
// An independent review found the app read the verdict with a LOOSE token scan
// (/\b(PASS|...)\b/), so a stray or hand-edited "PASS" in prose read as a real PASS on
// the trust strip / Owner Overview — even though the hardened gate (lifecycle-advance.ps1)
// rejected the same file. This parser mirrors the gate: the verdict must be on its own
// VERDICT: line and the TYPE must be on its own TYPE: line. A "PASS" buried in a sentence
// no longer counts.
//
// Pure, no I/O, UMD so main.js can require() it and the renderer can load it as a script.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCVerification = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const VERDICTS = 'PASS|FAIL|INSUFFICIENT|BLOCKED|OUT_OF_SCOPE';
  const TYPES = 'review_only|local_execution|ci_execution|live_boundary';

  // Extract {verdict, type} from a verification record. Both come from their own
  // structured lines; either is null if not present as a real field.
  function parseVerification(text) {
    text = String(text || '');
    const mv = text.match(new RegExp('^[ \\t]*VERDICT:[ \\t]*(' + VERDICTS + ')\\b', 'im'));
    const mt = text.match(new RegExp('^[ \\t]*TYPE:[ \\t]*(' + TYPES + ')\\b', 'im'));
    return { verdict: mv ? mv[1].toUpperCase() : null, type: mt ? mt[1].toLowerCase() : null };
  }

  // A proof TYPE that means the code was actually RUN (not just read). Semantic only — describes
  // the KIND of a type, not whether a given RECORD claiming it can be trusted. local_execution
  // counts (it ran on this machine), but it is labeled honestly elsewhere as local, never as a
  // clean-room CI run.
  function isExecutedType(type) {
    return type === 'ci_execution' || type === 'live_boundary' || type === 'local_execution';
  }

  // Verification-origin seam (the fake-green hole): app/last-verification.txt is a HAND-EDITABLE
  // record, so it can only be TRUSTED to claim proof the app itself can produce locally —
  // local_execution (the app's own product-run via verify-product.ps1). A clean-room/CI proof
  // (ci_execution / live_boundary) must come from a LIVE, un-forgeable observation (the GitHub CI
  // check surfaced in the trust chip), NEVER from a TYPE: line a human or the worker could type.
  // No legitimate writer ever puts ci_execution/live_boundary in that file, so trusting them from
  // it is pure forgery surface. Use THIS (not isExecutedType) for any executed-green trust decision
  // read from a record file.
  function isTrustedLocalProof(type) {
    return type === 'local_execution';
  }

  return { parseVerification: parseVerification, isExecutedType: isExecutedType, isTrustedLocalProof: isTrustedLocalProof };
});
