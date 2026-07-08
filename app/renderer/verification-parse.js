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

  // A proof TYPE that means the code was actually RUN (not just read). local_execution
  // counts — it ran on this machine — but it is labeled honestly elsewhere as local,
  // never as a clean-room CI run.
  function isExecutedType(type) {
    return type === 'ci_execution' || type === 'live_boundary' || type === 'local_execution';
  }

  return { parseVerification: parseVerification, isExecutedType: isExecutedType };
});
