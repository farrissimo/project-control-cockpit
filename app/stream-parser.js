// Live Worker Feed slice 2 — INCREMENTAL stream-json parser (ADR-0011, docs/specs/owner-cockpit.md).
//
// Today PCC runs the worker one-shot and parses its whole stdout only AFTER it finishes
// (stream-json.js `parseStreamJson`), discarding tool events. This parser instead consumes the
// stdout in CHUNKS as they arrive, so the app can show the worker's actions live — WITHOUT
// changing the final reply the owner reads.
//
// Two hard guarantees (pinned by tests):
//   1. FINAL REPLY IS BYTE-IDENTICAL. getText() applies `parseStreamJson`'s exact per-line rule in
//      the exact line order, so for any chunk-splitting of the same stdout it returns the same text.
//   2. NO HIDDEN REASONING. `thinking` blocks are never added to the text and never emitted as an
//      event; only observable actions (Read/Edit/Bash…) become events.
//
// The emitted action events use the Live-Worker-Feed model's vocabulary ({kind, file?, name?}) so
// they feed app/worker-plan-model.js directly; the live app stamps arrival time (`at`) itself.
//
// Additively (NO effect on the two guarantees above) it also surfaces the stream's
// `rate_limit_event` — the 5-hour usage-limit status + reset time — via getUsage(), so PCC can
// mirror the owner's real Claude usage stat (docs/proposals/desktop-parity.md R1). HONEST: the
// live event carries NO numeric percent (verified 2026-07-20), so none is invented.
(function (root, factory) {
  const api = factory(root && root.PCCStreamJson);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCStreamParser = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  function firstToken(cmd) { return String(cmd || '').trim().split(/\s+/)[0] || 'a command'; }

  // Map a Claude tool_use block to a safe owner-model action, or null for tools we don't surface.
  // We NEVER invent a kind for an unknown tool (honest: no fake action).
  function mapToolUse(c) {
    const name = c.name;
    const input = c.input || {};
    switch (name) {
      case 'Read': case 'NotebookRead': return { kind: 'read', file: input.file_path || input.notebook_path || '' };
      case 'Grep': return { kind: 'read', name: 'searching', file: input.path || '' };
      case 'Glob': return { kind: 'read', name: 'finding files', file: input.path || '' };
      case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit':
        return { kind: 'edit', file: input.file_path || input.notebook_path || '' };
      case 'Bash': return { kind: 'run', name: input.description || firstToken(input.command) };
      default: return null;
    }
  }

  // A failed tool result. A permission/denial reads as a hard-stop 'denied'; anything else is a
  // neutral 'error' (the model does NOT treat a plain error as a hard stop — honest, not alarmist).
  function mapToolResult(c) {
    if (!c.is_error) return null;
    const s = typeof c.content === 'string' ? c.content : JSON.stringify(c.content || '');
    if (/permission|not allowed|denied|declin/i.test(s)) return { kind: 'denied' };
    return { kind: 'error' };
  }

  // Surface the worker stream's rate_limit_event HONESTLY: exactly the fields Claude emits
  // (the 5-hour window's status + reset time), and nothing it does not. The event carries NO
  // numeric percentage, so we never invent one (no fake green); the UI computes the reset
  // countdown from resetsAt against the current time (the parser stays clock-free).
  function normalizeUsage(info) {
    if (!info || typeof info !== 'object') return null;
    const u = {};
    if (typeof info.status === 'string') u.status = info.status;                       // 'allowed' | warning | rejected
    if (typeof info.rateLimitType === 'string') u.rateLimitType = info.rateLimitType;  // e.g. 'five_hour'
    if (typeof info.resetsAt === 'number') u.resetsAt = info.resetsAt;                 // unix seconds
    if (typeof info.isUsingOverage === 'boolean') u.isUsingOverage = info.isUsingOverage;
    return Object.keys(u).length ? u : null;
  }

  function createStreamParser() {
    let buffer = '';
    let text = '';            // mirrors parseStreamJson's accumulator EXACTLY
    const events = [];
    let usage = null;         // latest rate_limit_event (5-hour status + reset), or null — additive only

    // Apply ONE line with parseStreamJson's exact rule, plus (additively) emit action events.
    function handle(o, out) {
      if (o.type === 'assistant' && o.message && Array.isArray(o.message.content)) {
        for (const c of o.message.content) {
          if (c.type === 'text' && c.text) text += c.text;          // reply text (thinking ignored)
          else if (c.type === 'tool_use') { const e = mapToolUse(c); if (e) { events.push(e); out.push(e); } }
        }
      } else if (o.type === 'user' && o.message && Array.isArray(o.message.content)) {
        for (const c of o.message.content) {
          if (c.type === 'tool_result') { const e = mapToolResult(c); if (e) { events.push(e); out.push(e); } }
        }
      } else if (o.type === 'result' && typeof o.result === 'string' && !text) {
        text = o.result;                                            // fallback ONLY when no text yet
      } else if (o.type === 'rate_limit_event' && o.rate_limit_info) {
        const u = normalizeUsage(o.rate_limit_info); if (u) usage = u; // additive: never touches text/events
      }
    }

    function processLine(line, out) {
      const l = String(line).trim();
      if (!l) return;
      let o;
      try { o = JSON.parse(l); } catch (e) { return; }              // ignore non-JSON (banners, stderr noise, partials)
      handle(o, out);
    }

    return {
      // Feed a stdout chunk; returns the action events newly emitted by the COMPLETE lines in it.
      // A partial final line is held in the buffer until its newline arrives (or finalize()).
      push(chunk) {
        buffer += String(chunk == null ? '' : chunk);
        const out = [];
        let i;
        while ((i = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, i);
          buffer = buffer.slice(i + 1);
          processLine(line, out);
        }
        return out;
      },
      // Process any trailing line with no newline (matches split('\n')'s last segment), then done.
      // Safe on a mid-event crash: an incomplete/garbage trailing line just fails to parse and is ignored.
      finalize() {
        const out = [];
        if (buffer.length) { processLine(buffer, out); buffer = ''; }
        return { text: text.trim(), events: out, usage: usage };
      },
      getText() { return text.trim(); },
      getEvents() { return events.slice(); },
      getUsage() { return usage ? Object.assign({}, usage) : null; },
    };
  }

  // Convenience: run the parser over a whole buffer at once. Its text MUST equal parseStreamJson(raw).
  function parseAll(raw) {
    const p = createStreamParser();
    p.push(String(raw));
    const f = p.finalize();
    return { text: f.text, events: p.getEvents(), usage: p.getUsage() };
  }

  return { createStreamParser: createStreamParser, parseAll: parseAll, mapToolUse: mapToolUse, normalizeUsage: normalizeUsage };
});
