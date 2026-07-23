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
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { toolFlagsFor } = require('../authority-tool-profile');
const { workerEnv } = require('../worker-env');
const { extract } = require('./measure-usage.js'); // reuse the exact usage/num_turns extraction

const REPO_ROOT = path.join(__dirname, '..', '..');
const EVIDENCE_DIR = path.join(REPO_ROOT, '.cockpit', 'evidence');
const LOG = path.join(EVIDENCE_DIR, 'usage-diagnostics.jsonl');
const MODEL = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : 'claude-sonnet-5';

// Verbatim from measure-usage.js (which copied it from main.js CHANNEL_PROMPT) so both arms send the
// SAME system prefix — keep in sync. The comparison is only fair if the two arms differ ONLY in warmth.
const CHANNEL_PROMPT = 'You are replying inside PCC\'s text-only chat panel: there is no interactive UI, no clickable pickers or buttons you can present. Never use interactive tools such as AskUserQuestion; if you need to ask the owner something, ask it as plain text with the options listed inline. Never narrate internal tool, prompt, or mechanism failures to the owner (e.g. do not say a tool "isn\'t working") - just answer or ask plainly. The owner is a non-coder product lead: be concise and plain-language.';
// The first 3 SHORT_PROMPTS from measure-usage.js, verbatim — identical tasks to the cold arm's first 3.
const PROMPTS = [
  'In one short sentence, what is PCC?',
  'Name one failure mode PCC tries to prevent. One line.',
  'What file holds the current project brief? Just the filename.',
];

function runWarm() {
  return new Promise((resolve) => {
    const sid = crypto.randomUUID();
    const args = ['-p', '--model', MODEL, ...toolFlagsFor(false), '--append-system-prompt', CHANNEL_PROMPT,
      '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--session-id', sid];
    const child = spawn('claude', args, { cwd: REPO_ROOT, shell: true, env: workerEnv() }); // DECISION-003
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
        const rec = { ts: new Date().toISOString(), label: 'warm-direct', turn: turn + 1, gapSec, ...(m || { failed: true, raw: line.slice(0, 200) }) };
        rows.push(rec);
        console.log(`${String(turn + 1).padStart(4)} | ${String(gapSec).padStart(6)} | ${String(m ? m.promptTokens : '?').padStart(9)} | ${String(m ? m.input : '?').padStart(5)} | ${String(m ? m.cacheCreate : '?').padStart(11)} | ${String(m ? m.cacheRead : '?').padStart(9)} | ${String(m ? m.output : '?').padStart(6)} | ${String(m && m.numTurns == null ? '?' : (m ? m.numTurns : '?')).padStart(5)} | ${m && !m.ok ? 'ERR' : ''}`);
        turn++;
        if (turn < PROMPTS.length) send(PROMPTS[turn]);
        else child.stdin.end();
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', (e) => { console.log('spawn error: ' + e.message); resolve(rows); });
    child.on('close', () => resolve(rows));
    send(PROMPTS[0]);
    setTimeout(() => { try { child.kill(); } catch {} }, 180000);
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
