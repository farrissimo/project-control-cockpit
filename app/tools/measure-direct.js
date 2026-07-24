#!/usr/bin/env node
// measure-direct.js (ADR-0020 Step 2 — pre-T1 LIMITED DIAGNOSTIC, direct/WARM arm).
//
// The counterpart to measure-usage.js's PCC arm. measure-usage.js spawns a COLD `claude` process per
// turn (exactly what PCC does today). THIS runs the SAME prompts in ONE WARM, continuous session
// (stream-json input over a persistent process) — the "direct Claude Code" baseline. The ONLY variable
// that differs between the two arms is cold-per-message vs warm-continuous, so comparing their per-turn
// cache_creation vs cache_read is what answers: is PCC's cold restart forcing cache rebuilds, or does a
// cold `--resume` read the server-side (content-addressed) cache just like a warm session?
//
// This is a DIAGNOSTIC, not a Gate 0 proof: one back-to-back run, small N, result is OBSERVED or
// INCONCLUSIVE, never a PASS. LLM-agnostic (raw tokens). DECISION-003: spawns via workerEnv() so it can
// NEVER use a paid API. Require-safe: the real run happens only when executed directly as a CLI.
const { spawnClaude } = require('../claude-spawn'); // no shell — every argument boundary preserved
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { toolFlagsFor } = require('../authority-tool-profile');
const { workerEnv } = require('../worker-env');
const { extract } = require('./measure-usage.js'); // reuse the exact usage/num_turns extraction

const REPO_ROOT = path.join(__dirname, '..', '..');
const EVIDENCE_DIR = path.join(REPO_ROOT, '.cockpit', 'evidence');
const LOG = path.join(EVIDENCE_DIR, 'usage-diagnostics.jsonl');
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const MODEL = arg('model', 'claude-sonnet-5');
// Gate 0 parameters. The cold arm (measure-usage.js) already took --mode/--turns/--gap/--label; the warm
// arm was fixed at 3 short prompts with no gap control, so the two arms could not be run on the SAME task
// sequence or the SAME gap schedule. Both are locked Gate 0 rules ("same task sequence", "deliberately
// varied inter-message gaps"), and a mismatch would make every ratio materially false — so the warm arm
// takes the same knobs. Nothing about how a turn is sent changed; only which prompts and when.
const MODE = arg('mode', 'short');
const GAP = parseInt(arg('gap', '0'), 10);      // seconds to wait BEFORE each turn after the first
const LABEL = arg('label', 'warm-direct');

// Verbatim from measure-usage.js (which copied it from main.js CHANNEL_PROMPT) so both arms send the
// SAME system prefix — keep in sync. The comparison is only fair if the two arms differ ONLY in warmth.
const CHANNEL_PROMPT = 'You are replying inside PCC\'s text-only chat panel: there is no interactive UI, no clickable pickers or buttons you can present. Never use interactive tools such as AskUserQuestion; if you need to ask the owner something, ask it as plain text with the options listed inline. Never narrate internal tool, prompt, or mechanism failures to the owner (e.g. do not say a tool "isn\'t working") - just answer or ask plainly. The owner is a non-coder product lead: be concise and plain-language.';
// The prompt sets are IMPORTED from measure-usage.js (not copied) so both arms send byte-identical tasks.
const { SHORT_PROMPTS, REAL_PROMPTS, WORK_PROMPTS } = require('./measure-usage.js');
const SET = MODE === 'work' ? WORK_PROMPTS : (MODE === 'real' ? REAL_PROMPTS : SHORT_PROMPTS);
const TURNS = parseInt(arg('turns', '3'), 10);
const PROMPTS = SET.slice(0, TURNS);

// codex-caught (Gate 0 pre-run review): the cold arm passes --fallback-model (measure-usage.js mirrors
// main.js askClaude, which sets it from models.json's fallback_chain) but the warm arm did not. That is an
// asymmetry OTHER than warmth, so it breaks the "the arms differ only in warmth" premise the whole ratio
// rests on. Resolve the same way the cold arm does, from the same file, so both arms match by construction.
function readFallbackChain() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.cockpit', 'state', 'models.json'), 'utf8'));
    return cfg.fallback_chain || cfg.default || MODEL;
  } catch { return MODEL; }
}
const FALLBACK = readFallbackChain();

function runWarm() {
  return new Promise((resolve) => {
    const sid = crypto.randomUUID();
    const args = ['-p', '--model', MODEL, ...toolFlagsFor(false), '--append-system-prompt', CHANNEL_PROMPT,
      '--fallback-model', FALLBACK, // codex-caught: match the cold arm / askClaude — see readFallbackChain
      '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--session-id', sid];
    const child = spawnClaude(args, { cwd: REPO_ROOT, env: workerEnv() }); // DECISION-003; no shell (arg boundaries intact)
    const rows = [];
    let buf = '', turn = 0, prevEndMs = null;
    const send = (t) => child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: t }] } }) + '\n');
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type !== 'result') continue;
        const gapSec = prevEndMs !== null ? Math.round((Date.now() - prevEndMs) / 1000) : 0;
        prevEndMs = Date.now();
        const m = extract(line); // the result line IS a --output-format json-shaped object
        const rec = { ts: new Date().toISOString(), label: LABEL, turn: turn + 1, gapSec, ...(m || { failed: true, raw: line.slice(0, 200) }) };
        rows.push(rec);
        console.log(`${String(turn + 1).padStart(4)} | ${String(gapSec).padStart(6)} | ${String(m ? m.promptTokens : '?').padStart(9)} | ${String(m ? m.input : '?').padStart(5)} | ${String(m ? m.cacheCreate : '?').padStart(11)} | ${String(m ? m.cacheRead : '?').padStart(9)} | ${String(m ? m.output : '?').padStart(6)} | ${String(m && m.numTurns == null ? '?' : (m ? m.numTurns : '?')).padStart(5)} | ${m && !m.ok ? 'ERR' : ''}`);
        turn++;
        // Honour the gap schedule: wait GAP seconds BEFORE sending the next turn. This is what makes the
        // ~65-min post-TTL probe possible on the warm arm (the session stays open across the wait, which
        // is exactly the warm-vs-cold contrast being measured).
        if (turn < PROMPTS.length) { if (GAP > 0) setTimeout(() => send(PROMPTS[turn]), GAP * 1000); else send(PROMPTS[turn]); }
        else child.stdin.end();
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', (e) => { console.log('spawn error: ' + e.message); resolve(rows); });
    child.on('close', () => resolve(rows));
    send(PROMPTS[0]);
    // Hard timeout was a FIXED 3 minutes, which would have silently killed any gapped run mid-flight and
    // produced a truncated (INVALID, but easy to mistake for complete) result. Scale it to the schedule:
    // the total gap budget plus 3 minutes of model time per turn.
    const budgetMs = (GAP * 1000 * Math.max(0, PROMPTS.length - 1)) + (180000 * PROMPTS.length);
    setTimeout(() => { try { child.kill(); } catch {} }, budgetMs);
  });
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  console.log(`\nDIRECT (warm continuous session) arm — model=${MODEL}, turns=${PROMPTS.length}`);
  console.log('turn | gap(s) | promptTok | input | cacheCreate | cacheRead | output | turns | err');
  console.log('-----|--------|-----------|-------|-------------|-----------|--------|-------|----');
  const rows = await runWarm();
  for (const r of rows) fs.appendFileSync(LOG, JSON.stringify(r) + '\n');
  const good = rows.filter((r) => r.ok);
  if (good.length) {
    const totalCreate = good.reduce((a, r) => a + r.cacheCreate, 0);
    const totalRead = good.reduce((a, r) => a + r.cacheRead, 0);
    console.log(`\nWARM totals: cacheCreate=${totalCreate.toLocaleString()} cacheRead=${totalRead.toLocaleString()} (read ratio ${(100 * totalRead / Math.max(1, totalCreate + totalRead)).toFixed(0)}%)`);
  } else {
    console.log('\nNo successful turns (see rows for errors).');
  }
  console.log('Log: ' + LOG);
}

if (require.main === module) main();
module.exports = { runWarm, PROMPTS };
