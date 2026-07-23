// ADR-0020 T7 — hard, deterministic caps on how much INPUT a single owner message can push into the
// Claude context. These are LLM-agnostic safety RAILS (token growth is the unit every model shares),
// fail-closed and NOT owner-tunable (unlike usage-limits.json policy knobs). They bound the per-send
// payload so one message can't balloon the context and burn the plan; when a cap trims content it
// leaves a VISIBLE marker (never a silent drop) so the owner/worker can see it happened.
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

  // Cap attachments: at most MAX_ATTACHMENTS kept (extras dropped), and the running TOTAL of text
  // content bounded to MAX_ATTACH_TOTAL_CHARS (later text attachments are trimmed once the budget is
  // spent). Pure: returns { attachments (new capped array), droppedForCount, textTruncated }. Never
  // mutates the input. Image attachments count toward the count cap but not the text budget (they have
  // their own per-file byte guard upstream).
  function capAttachments(attachments) {
    if (!Array.isArray(attachments)) return { attachments: [], droppedForCount: 0, textTruncated: false };
    const droppedForCount = Math.max(0, attachments.length - MAX_ATTACHMENTS);
    let budget = MAX_ATTACH_TOTAL_CHARS;
    let textTruncated = false;
    const kept = attachments.slice(0, MAX_ATTACHMENTS).map((a) => {
      if (a && a.kind === 'text' && typeof a.content === 'string') {
        if (a.content.length <= budget) { budget -= a.content.length; return a; }
        textTruncated = true;
        const c = a.content.slice(0, Math.max(0, budget)) + '\n\n[PCC input cap: attachment truncated to protect your usage.]';
        budget = 0;
        return Object.assign({}, a, { content: c });
      }
      return a;
    });
    return { attachments: kept, droppedForCount, textTruncated };
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
    MAX_ATTACHMENTS, MAX_ATTACH_TOTAL_CHARS, MAX_MESSAGE_CHARS, MAX_RECALL_EVIDENCE_CHARS, MAX_QUEUE,
    capMessage, capAttachments, headTail,
  };
});
