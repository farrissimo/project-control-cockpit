// Parser for Claude Code's `--output-format stream-json` output, used for the attachments/image
// path (main spawns stream-json in+out so images/files ride as content blocks). Extracted from
// main.js into a pure, UMD module so it can be unit-tested against a REAL captured envelope, not
// just the simplified test fake — the real stream also carries system/rate_limit/thinking lines
// that the fake never emits, and this parser must ignore all of them and return only the reply text.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCStreamJson = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Turn the raw stream-json stdout into the assistant's plain reply text.
  // Rules (proven against a real capture): concatenate every assistant `text` content block
  // (ignore `thinking` blocks and non-assistant lines); fall back to the final `result` string
  // only if no assistant text was seen. Non-JSON lines are ignored.
  function parseStreamJson(raw) {
    let text = '';
    for (const line of String(raw).split('\n')) {
      const l = line.trim();
      if (!l) continue;
      try {
        const o = JSON.parse(l);
        if (o.type === 'assistant' && o.message && Array.isArray(o.message.content)) {
          for (const c of o.message.content) if (c.type === 'text' && c.text) text += c.text;
        } else if (o.type === 'result' && typeof o.result === 'string' && !text) {
          text = o.result;
        }
      } catch (e) { /* ignore non-JSON lines (init banners, partial flushes, etc.) */ }
    }
    return text.trim();
  }

  // The REAL per-turn cost from a stream-json stream's `result` event (same total_cost_usd field
  // as --output-format json). Lets attachment/image turns — which use this path, and are the MOST
  // token-expensive turn type — count toward the per-chat cost cap too, so the most expensive turns
  // are not the one blind spot in the runaway protection (desktop-parity R3). Honest, like
  // turn-output.js: only a finite, non-negative number is a real cost; anything else is null and
  // the caller simply doesn't advance the total (never a fabricated cost).
  function parseStreamCost(raw) {
    for (const line of String(raw).split('\n')) {
      const l = line.trim();
      if (!l) continue;
      try {
        const o = JSON.parse(l);
        if (o && o.type === 'result' && typeof o.total_cost_usd === 'number' && Number.isFinite(o.total_cost_usd) && o.total_cost_usd >= 0) {
          return o.total_cost_usd;
        }
      } catch (e) { /* ignore non-JSON lines */ }
    }
    return null;
  }

  // The REAL token usage from a stream-json stream's `result` event — same `usage` shape as the
  // plain --output-format json path. Attachment/image turns are the MOST token-expensive type yet
  // were the one path reporting NO token usage (only cost); this closes that blind spot so the usage
  // diagnostic sees every turn type. Returns the raw usage object (or null), for usage-log.usageFrom.
  function parseStreamUsage(raw) {
    for (const line of String(raw).split('\n')) {
      const l = line.trim();
      if (!l) continue;
      try {
        const o = JSON.parse(l);
        if (o && o.type === 'result' && o.usage && typeof o.usage === 'object') return o.usage;
      } catch (e) { /* ignore non-JSON lines */ }
    }
    return null;
  }

  // ADR-0020 Step 1 (T9 spine): the REAL agentic-turn count from a stream-json stream's `result` event
  // (same top-level `num_turns` field as the --output-format json path). Lets attachment/image turns —
  // which use this path — report how far one message fanned out, closing the last num_turns blind spot.
  // Honest, like the sibling parsers: only a finite, non-negative number is returned; anything else null.
  function parseStreamTurns(raw) {
    for (const line of String(raw).split('\n')) {
      const l = line.trim();
      if (!l) continue;
      try {
        const o = JSON.parse(l);
        if (o && o.type === 'result' && typeof o.num_turns === 'number' && Number.isFinite(o.num_turns) && o.num_turns >= 0) {
          return o.num_turns;
        }
      } catch (e) { /* ignore non-JSON lines */ }
    }
    return null;
  }

  return { parseStreamJson: parseStreamJson, parseStreamCost: parseStreamCost, parseStreamUsage: parseStreamUsage, parseStreamTurns: parseStreamTurns };
});
