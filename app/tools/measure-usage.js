#!/usr/bin/env node
// measure-usage.js — REAL per-turn usage measurement of PCC's ACTUAL read-only chat invocation.
//
// Purpose: get hard data (not theory) on how a PCC chat consumes the owner's PLAN USAGE turn over
// turn — the fixed per-turn baseline, how it grows with the conversation, and how Claude's prompt
// cache behaves (cheap cache-reads vs expensive cache-creation, and whether an idle gap forces
// re-creation). This proves or kills the "~252K fixed baseline / >5-10 min compounding" theory.
//
// It replicates askClaude()'s EXACT argv (app/main.js): the read-only tool profile
// (authority-tool-profile.js), the CHANNEL_PROMPT append, --model, --output-format json, and
// --session-id (turn 1) then --resume (every later turn) against ONE pinned session — so what it
// measures is what the owner's real chat actually sends. Faithfulness caveat: CHANNEL_PROMPT is
// copied verbatim from main.js:773 (not exported); if that string changes, update this too.
//
// Usage:  node tools/measure-usage.js [--turns N] [--gap SECONDS] [--model ID] [--label NAME]
//   --turns   how many turns to send (default 6)
//   --gap     seconds to wait BEFORE each turn after the first (default 0 = rapid). Set >300 to
//             test 5-min cache expiry, >3600 to test 1-hour expiry.
//   --model   model id (default: from .cockpit/state/models.json, i.e. the real chat default)
// Writes one JSON record per turn to .cockpit/evidence/usage-diagnostics.jsonl and prints a table.

const { spawnClaude } = require('../claude-spawn'); // no shell — every argument boundary preserved
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { toolFlagsFor } = require('../authority-tool-profile');

// Verbatim from app/main.js:773 (CHANNEL_PROMPT). Keep in sync.
const CHANNEL_PROMPT = 'You are replying inside PCC\'s text-only chat panel: there is no interactive UI, no clickable pickers or buttons you can present. Never use interactive tools such as AskUserQuestion; if you need to ask the owner something, ask it as plain text with the options listed inline. Never narrate internal tool, prompt, or mechanism failures to the owner (e.g. do not say a tool "isn\'t working") - just answer or ask plainly. The owner is a non-coder product lead: be concise and plain-language.';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const REPO_ROOT = path.join(__dirname, '..', '..');          // C:\ProjectControlCockpit — loads this repo's CLAUDE.md/AGENTS.md, exactly like the real chat
const STATE_DIR = path.join(REPO_ROOT, '.cockpit', 'state');
const EVIDENCE_DIR = path.join(REPO_ROOT, '.cockpit', 'evidence');
const LOG = path.join(EVIDENCE_DIR, 'usage-diagnostics.jsonl');

function readDefaultModel() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'models.json'), 'utf8'));
    return { def: cfg.default || 'claude-sonnet-5', chain: cfg.fallback_chain || cfg.default };
  } catch { return { def: 'claude-sonnet-5', chain: 'claude-sonnet-5' }; }
}

const TURNS = parseInt(arg('turns', '6'), 10);
const GAP = parseInt(arg('gap', '0'), 10);
const label = arg('label', 'run');
const mode = arg('mode', 'short');
const models = readDefaultModel();
const MODEL = arg('model', models.def);
const sessionId = crypto.randomUUID();

// SHORT prompts: one-line replies -> isolates the fixed baseline + cache behavior from growth.
const SHORT_PROMPTS = [
  'In one short sentence, what is PCC?',
  'Name one failure mode PCC tries to prevent. One line.',
  'What file holds the current project brief? Just the filename.',
  'One word: is the worker Claude Code or Codex?',
  'Give one standing rule from CLAUDE.md, briefly.',
  'What does the trust proving window measure? One sentence.',
  'Name one honest detector PCC ships. One word is fine.',
  'What is the #1 rule of this project? Briefly.',
];
// REAL prompts: elicit substantive, multi-paragraph replies like actual product/design chat. This
// makes the conversation GROW each turn (the leading hypothesis for the owner's felt compounding).
const REAL_PROMPTS = [
  'Explain in detail how PCC prevents fake completion by an LLM worker. Walk through the mechanisms.',
  'Now compare that to how a normal Claude Code session would handle the same risk. Give the tradeoffs.',
  'Given everything you just said, design a better verification flow. Be thorough and specific.',
  'Critique your own design above. What are its three biggest weaknesses and how would you fix each?',
  'Rewrite the design incorporating those fixes, and explain every change and why it matters.',
  'Walk me through a concrete end-to-end example of that flow with a realistic bug, step by step.',
  'What edge cases does that example miss? Enumerate them and how the system should handle each.',
  'Summarize this entire conversation so far into a detailed handoff a fresh chat could continue from.',
];
// WORK prompts: force the worker to READ real files (the read-only profile allows Read/Grep/Glob).
// Real work pulls file contents into the conversation, which then re-sends every later turn — the
// most likely real-world compounding mechanism, invisible to trivia prompts.
const WORK_PROMPTS = [
  'Read app/main.js in full and list every function name you find, one per line.',
  'Now read app/renderer/renderer.js in full and summarize what it does in a short paragraph.',
  'Read docs/adr/0019-context-auto-rollover-new-chat.md and app/renderer/chat-health.js. Explain how they relate.',
  'Read PROJECT.md in full and tell me the current phase.',
  'Grep the app/ folder for every use of spawn( and show the matching lines.',
  'Read app/authority-tool-profile.js and app/usage-limits.js and summarize each.',
  'Given everything you have read so far, list the files now in your context and their rough sizes.',
  'Summarize this whole session into a handoff a fresh chat could continue from.',
];
const PROMPTS = mode === 'work' ? WORK_PROMPTS : (mode === 'real' ? REAL_PROMPTS : SHORT_PROMPTS);

function runTurn(prompt, isFirst) {
  return new Promise((resolve) => {
    const args = ['-p', '--model', MODEL, ...toolFlagsFor(false), '--append-system-prompt', CHANNEL_PROMPT];
    if (models.chain) args.push('--fallback-model', models.chain);
    args.push(isFirst ? '--session-id' : '--resume', sessionId);
    args.push('--output-format', 'json');
    let out = '', err = '';
    // 2026-07-24 CORRECTION. Two defects fixed together, both of which made every prior cold-arm
    // measurement INVALID:
    //   (1) this spawned with shell:true, which concatenated the args array unquoted — so
    //       `--append-system-prompt CHANNEL_PROMPT` became `--append-system-prompt You` and the rest
    //       leaked out as stray positionals. spawnClaude() removes the shell entirely.
    //   (2) the prompt was passed as a POSITIONAL argv (args.push(prompt)) while production
    //       (main.js askClaude) sends it over STDIN. Combined with (1), `claude -p` took the stray
    //       word "are" as the whole prompt — the worker literally replied "only 'are' is coming
    //       through each time". Independently of (1), argv-vs-stdin also meant this harness was never
    //       a faithful proxy for PCC. The prompt now goes over stdin, exactly as production does.
    const child = spawnClaude(args, { cwd: REPO_ROOT, env: require('../worker-env').workerEnv() }); // DECISION-003: never a paid API
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', (code) => resolve({ code, out, err }));
    child.on('error', (e) => resolve({ code: -1, out, err: String(e) }));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function extract(raw) {
  try {
    const o = JSON.parse(raw);
    const u = o.usage || {};
    const input = Number(u.input_tokens) || 0;
    const cacheCreate = Number(u.cache_creation_input_tokens) || 0;
    const cacheRead = Number(u.cache_read_input_tokens) || 0;
    const output = Number(u.output_tokens) || 0;
    const eph = u.cache_creation || {};
    return {
      ok: !o.is_error, model: MODEL,
      input, cacheCreate, cacheRead, output,
      promptTokens: input + cacheCreate + cacheRead,          // total context sent THIS turn (what turn-output.js calls contextTokens)
      eph5m: Number(eph.ephemeral_5m_input_tokens) || 0,
      eph1h: Number(eph.ephemeral_1h_input_tokens) || 0,
      // ADR-0020 Step 1 (T9 spine): the real agentic-turn count — how far this one message fanned out.
      // Non-negative finite only, else null (never a fabricated count), matching usage-log/turn-output.
      numTurns: (typeof o.num_turns === 'number' && Number.isFinite(o.num_turns) && o.num_turns >= 0) ? o.num_turns : null,
      costUsd: Number(o.total_cost_usd) || 0,
      durationMs: Number(o.duration_ms) || 0,
      result: (o.result || '').slice(0, 60),
    };
  } catch { return null; }
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const rows = [];
  let prevEndMs = null;
  console.log(`\nMeasuring PCC's real read-only chat invocation — model=${MODEL}, turns=${TURNS}, gap=${GAP}s, session=${sessionId.slice(0, 8)}`);
  console.log('turn | gap(s) | promptTok | input | cacheCreate | cacheRead | output | turns | cost$ | dur(s)');
  console.log('-----|--------|-----------|-------|-------------|-----------|--------|-------|-------|-------');
  for (let i = 0; i < TURNS; i++) {
    if (i > 0 && GAP > 0) await sleep(GAP * 1000);
    const gapSec = prevEndMs !== null ? Math.round((Date.now() - prevEndMs) / 1000) : 0;
    const prompt = PROMPTS[i % PROMPTS.length];
    const { code, out, err } = await runTurn(prompt, i === 0);
    prevEndMs = Date.now();
    const m = extract(out) || extract(err);
    if (!m) {
      console.log(`${String(i + 1).padStart(4)} | FAILED (code ${code}) — ${(err || out).slice(0, 120).replace(/\n/g, ' ')}`);
      const rec = { ts: new Date().toISOString(), label, turn: i + 1, gapSec, failed: true, code, raw: (err || out).slice(0, 300) };
      rows.push(rec); fs.appendFileSync(LOG, JSON.stringify(rec) + '\n');
      continue;
    }
    const rec = { ts: new Date().toISOString(), label, turn: i + 1, gapSec, ...m };
    rows.push(rec);
    fs.appendFileSync(LOG, JSON.stringify(rec) + '\n');
    console.log(
      `${String(i + 1).padStart(4)} | ${String(gapSec).padStart(6)} | ${String(m.promptTokens).padStart(9)} | ${String(m.input).padStart(5)} | ${String(m.cacheCreate).padStart(11)} | ${String(m.cacheRead).padStart(9)} | ${String(m.output).padStart(6)} | ${String(m.numTurns == null ? '?' : m.numTurns).padStart(5)} | ${m.costUsd.toFixed(4)} | ${(m.durationMs / 1000).toFixed(1)}`
    );
  }
  // Summary: baseline = turn-1 total context; growth = climb across turns; cache split.
  const good = rows.filter((r) => !r.failed);
  if (good.length) {
    const t1 = good[0];
    const last = good[good.length - 1];
    const growth = last.promptTokens - t1.promptTokens;
    const totalCreate = good.reduce((a, r) => a + r.cacheCreate, 0);
    const totalRead = good.reduce((a, r) => a + r.cacheRead, 0);
    console.log('\n--- SUMMARY ---');
    console.log(`Turn-1 baseline (fixed overhead sent before any conversation): ${t1.promptTokens.toLocaleString()} tokens`);
    console.log(`Growth across ${good.length} turns: ${growth.toLocaleString()} tokens (${(growth / Math.max(1, good.length - 1)).toFixed(0)}/turn avg)`);
    console.log(`Cache: ${totalCreate.toLocaleString()} created (expensive) vs ${totalRead.toLocaleString()} read (cheap) — read ratio ${(100 * totalRead / Math.max(1, totalCreate + totalRead)).toFixed(0)}%`);
    console.log(`Total notional cost this run: $${good.reduce((a, r) => a + r.costUsd, 0).toFixed(4)} (phantom — flat plan, not billed; a proxy for tokens=usage)`);
    console.log(`Log: ${LOG}`);
  }
}

// Require-safe (ADR-0020 Step 1 test hook): the measurement — which spawns a REAL `claude` per turn
// and appends to the evidence log — runs ONLY when this file is executed directly as a CLI. Requiring
// the module (e.g. from a unit test) exposes the PURE extract() with NO spawn and NO evidence write.
if (require.main === module) main();

// Gate 0: the prompt SETS are exported so the direct/warm arm (measure-direct.js) sends the byte-identical
// task sequence instead of its own copy. "Same task sequence" is a locked Gate 0 rule — sharing the arrays
// makes equivalence structural rather than something copy-paste drift can silently break.
module.exports = { extract, SHORT_PROMPTS, REAL_PROMPTS, WORK_PROMPTS };
