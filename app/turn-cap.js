// ADR-0020 T2: count a worker's AGENTIC turns as they stream, so PCC can kill a single message
// that fans out into hundreds of model turns (the 2026-07-20 forensics saw 300–1096 turns for ONE
// message). The installed Claude CLI (2.1.186) has no --max-turns flag — verified against its full
// flag list — so PCC enforces the cap itself off the `--output-format stream-json` event stream.
//
// What counts as a "turn": each `{"type":"assistant",...}` line in the stream is one model turn in
// the agentic loop (tool_result lines come back as `type:"user"` and are NOT counted). This is an
// honest proxy for the CLI's own `num_turns` (carried on the final `result` event), computed live so
// the cap can PREVENT a runaway rather than only observe it after the tokens are already spent.
//
// Pure and stateless-per-instance: createTurnCounter() returns a small stateful counter that buffers
// partial lines (stdout chunks split mid-line), so it is safe to feed raw `data` chunks directly.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCTurnCap = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Is this one stream-json line a new assistant (model) turn? Non-JSON lines (init banners, blank
  // lines, partial flushes) and non-assistant events (system, result, user/tool_result) are not.
  function isAssistantTurnLine(line) {
    const l = String(line).trim();
    if (!l) return false;
    try {
      const o = JSON.parse(l);
      return !!(o && o.type === 'assistant');
    } catch (e) {
      return false; // not a complete JSON line — ignore (never miscount a banner as a turn)
    }
  }

  // A live agentic-turn counter. Feed raw stdout chunks; it splits on newlines, counts assistant
  // turns, and keeps any trailing partial line buffered for the next chunk.
  function createTurnCounter() {
    let buffer = '';
    let turns = 0;
    return {
      // Returns the running turn count after consuming this chunk.
      feed: function (chunk) {
        buffer += String(chunk == null ? '' : chunk);
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (isAssistantTurnLine(line)) turns++;
        }
        return turns;
      },
      count: function () { return turns; },
    };
  }

  // The cap is breached when the agentic-turn count reaches the limit. maxTurns is expected to be a
  // sane positive integer (usage-limits.normalizeLimits guarantees that); a non-finite/<1 cap is
  // treated as "never breached" here rather than killing every turn, because the config layer is the
  // one place that fails a bad value closed to the safe default.
  function isBreached(count, maxTurns) {
    if (!(typeof maxTurns === 'number' && Number.isFinite(maxTurns) && maxTurns >= 1)) return false;
    return count >= maxTurns;
  }

  return {
    isAssistantTurnLine: isAssistantTurnLine,
    createTurnCounter: createTurnCounter,
    isBreached: isBreached,
  };
});
