// ADR-0020 T7 — hard, deterministic caps on how much INPUT a single owner message can push into the
// Claude context. These are LLM-agnostic safety RAILS (token growth is the unit every model shares),
// fail-closed and NOT owner-tunable (unlike usage-limits.json policy knobs). They bound the per-send
// payload so one message can't balloon the context and burn the plan. When a cap trims content it leaves
// a marker in the WORKER's payload so the worker knows its input was trimmed — but the OWNER is told
// deterministically by PCC's own UI (main.js populates capNotices -> res.caps -> the renderer's cap-notice;
// search returns questionTruncated), NOT by relying on the worker to echo that marker back (ADR-0020 T7
// truncation-visibility correction). The functions here report WHAT they trimmed (truncated /
// droppedForCount / droppedForBudget / textTruncated) so callers can surface it directly to the owner.
//
// Values: Codex-concurred 2026-07-22. Attachment TEXT total 200K (not "still huge"); queue 5 (beyond
// that is accidental batch-fire); recall evidence 4K/candidate (prefer summary, head+tail).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCPayloadCaps = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const MAX_ATTACHMENTS = 10;            // combined text + image attachments per send
  const MAX_ATTACH_TOTAL_CHARS = 200000; // total TEXT across all attachments in one send
  // Aggregate cap on IMAGE payload per send (base64 chars ≈ the bytes actually sent). ~16 MiB of
  // base64 ≈ ~12 MB decoded — roughly one full-size 8 MB image plus headroom. This closes the gap
  // where the per-file 8 MB guard still let ten images (~80 MB) ride in a single send.
  const MAX_ATTACH_IMAGE_BASE64_CHARS = 16 * 1024 * 1024;
  const MAX_MESSAGE_CHARS = 200000;      // the typed message / paste itself (a giant paste balloons a send)
  const MAX_RECALL_EVIDENCE_CHARS = 4000; // per-candidate evidence text sent to the recall judge
  const MAX_QUEUE = 5;                    // steering: pending messages queued while a turn runs

  // Cap the typed message. Truncation is never silent — a visible marker is appended so the worker
  // (and thus the owner) can see the cap fired. Returns { text, truncated }.
  function capMessage(text) {
    const s = String(text == null ? '' : text);
    if (s.length <= MAX_MESSAGE_CHARS) return { text: s, truncated: false };
    return { text: s.slice(0, MAX_MESSAGE_CHARS) + '\n\n[PCC input cap: this message was truncated at ' + MAX_MESSAGE_CHARS + ' characters to protect your usage.]', truncated: true };
  }

  // Cap attachments per send: at most MAX_ATTACHMENTS kept (extras dropped for COUNT); the running
  // TOTAL of TEXT content bounded to MAX_ATTACH_TOTAL_CHARS (later text is trimmed once spent); and the
  // running TOTAL of IMAGE base64 bounded to MAX_ATTACH_IMAGE_BASE64_CHARS — images are NEVER truncated
  // (that would corrupt them), so whole images are kept IN ORDER until the image budget is spent and the
  // remainder is DROPPED (counted in droppedForBudget). Pure, never mutates the input. Returns
  // { attachments, droppedForCount, droppedForBudget, textTruncated }.
  function capAttachments(attachments) {
    if (!Array.isArray(attachments)) return { attachments: [], droppedForCount: 0, droppedForBudget: 0, textTruncated: false };
    const droppedForCount = Math.max(0, attachments.length - MAX_ATTACHMENTS);
    let textBudget = MAX_ATTACH_TOTAL_CHARS;
    let imageBudget = MAX_ATTACH_IMAGE_BASE64_CHARS;
    let textTruncated = false;
    let droppedForBudget = 0;
    const kept = [];
    for (const a of attachments.slice(0, MAX_ATTACHMENTS)) {
      if (a && a.kind === 'text' && typeof a.content === 'string') {
        if (a.content.length <= textBudget) { textBudget -= a.content.length; kept.push(a); }
        else {
          textTruncated = true;
          kept.push(Object.assign({}, a, { content: a.content.slice(0, Math.max(0, textBudget)) + '\n\n[PCC input cap: attachment truncated to protect your usage.]' }));
          textBudget = 0;
        }
      } else if (a && a.kind === 'image' && typeof a.dataBase64 === 'string') {
        if (a.dataBase64.length <= imageBudget) { imageBudget -= a.dataBase64.length; kept.push(a); }
        else { droppedForBudget += 1; } // whole image dropped — base64 is never truncated (would corrupt it)
      } else {
        kept.push(a); // unknown/defensive shapes pass through (count-capped above)
      }
    }
    return { attachments: kept, droppedForCount, droppedForBudget, textTruncated };
  }

  // Bound a long evidence string with HEAD + TAIL retained (the ends carry the most signal), with a
  // visible marker in the middle — never a silent head-only truncation. Returns the (possibly) capped string.
  function headTail(text, max) {
    const s = String(text == null ? '' : text);
    const cap = typeof max === 'number' && max > 0 ? max : MAX_RECALL_EVIDENCE_CHARS;
    if (s.length <= cap) return s;
    const marker = '\n…[truncated]…\n';
    const half = Math.max(0, Math.floor((cap - marker.length) / 2));
    return s.slice(0, half) + marker + s.slice(s.length - half);
  }

  return {
    MAX_ATTACHMENTS, MAX_ATTACH_TOTAL_CHARS, MAX_ATTACH_IMAGE_BASE64_CHARS, MAX_MESSAGE_CHARS,
    MAX_RECALL_EVIDENCE_CHARS, MAX_QUEUE,
    capMessage, capAttachments, headTail,
  };
});
