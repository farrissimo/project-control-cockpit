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

  return { parseStreamJson: parseStreamJson };
});
