#!/usr/bin/env node
// measure-operations.js — measures the REAL per-operation token cost of PCC's INVISIBLE background
// LLM calls (auto-name, summary, search), using PCC's OWN prompt-builders (chat-summary.js,
// chat-recall.js) and the EXACT oneShotWorker invocation from main.js (Sonnet default, Read/Glob/Grep,
// --strict-mcp-config, --output-format json, a FRESH --session-id per call, prompt over stdin, cwd=repo).
// This is not a chat simulation — it is the deterministic cost of each operation, byte-faithful to what
// the app sends. LLM-agnostic: reports TOKENS. Hard-capped: runs a fixed, small set of calls.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chatSummary = require('../chat-summary');
const chatRecall = require('../chat-recall');

const REPO_ROOT = path.join(__dirname, '..', '..');
const MODEL = 'claude-sonnet-5'; // PCC's default; oneShotWorker uses cfg.default. Sonnet by owner's request.

// oneShotWorker's exact argv (main.js:1033), minus the model which we pin to Sonnet.
function oneShotArgs() {
  return ['-p', '--model', MODEL,
    '--tools', 'Read Glob Grep', '--strict-mcp-config',
    '--allowedTools', 'Read Glob Grep',
    '--disallowedTools', 'AskUserQuestion Bash BashOutput KillBash PowerShell Edit Write NotebookEdit Agent Monitor Skill ToolSearch Task WebSearch WebFetch',
    '--output-format', 'json',
    '--session-id', crypto.randomUUID()];
}

function runOneShot(prompt) {
  return new Promise((resolve) => {
    let out = '', err = '';
    const child = spawn('claude', oneShotArgs(), { cwd: REPO_ROOT, shell: true, env: require('../worker-env').workerEnv() }); // DECISION-003: never a paid API
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', () => resolve({ out, err }));
    child.on('error', (e) => resolve({ out, err: String(e) }));
    child.stdin.write(prompt); child.stdin.end();
  });
}

function usage(raw) {
  try {
    const o = JSON.parse(raw); const u = o.usage || {};
    const input = Number(u.input_tokens) || 0, cc = Number(u.cache_creation_input_tokens) || 0,
      cr = Number(u.cache_read_input_tokens) || 0, out = Number(u.output_tokens) || 0;
    return { prompt: input + cc + cr, cacheCreate: cc, cacheRead: cr, output: out, cost: Number(o.total_cost_usd) || 0 };
  } catch { return null; }
}

// A realistic message: ~180 words of plausible product/design back-and-forth (~250 tokens).
function msg(cls, i) {
  const body = `This is turn ${i} of a realistic PCC working session. ` + (
    'We are discussing how the cockpit prevents fake completion, drift, and lost context between chats. '
    + 'The owner is a non-coder product lead who wants milestone-level updates in plain language, not file dumps. '
    + 'We weigh whether a change reduces babysitting, whether it needs an ADR, and what evidence proves it is done. '
    + 'The worker is Claude Code driven headless; the verifier is Codex in a read-only sandbox. '
    + 'We keep asking: does this reduce the chance PCC itself interrupts real work during the trust window? '
    + 'If the answer is unclear we pause, record a decision, and prove one small thing on the real screen first. ').repeat(2);
  return { cls, text: body };
}
function transcript(n) { return Array.from({ length: n }, (_, i) => msg(i % 2 === 0 ? 'user' : 'ai', i + 1)); }

(async () => {
  const small = transcript(2);   // auto-name fires early — small transcript
  const big = transcript(40);    // summary/name of a LONG chat — the #1 suspect
  const candidates = [
    { id: 'chat-a', name: 'Verification flow', messages: transcript(20) },
    { id: 'chat-b', name: 'Usage diagnostics', messages: transcript(20) },
  ];

  // Hard-capped batch: exactly these calls (<= 8).
  const jobs = [
    ['auto-name (early, small chat)', chatSummary.buildNamePrompt(small)],
    ['auto-name (LONG 40-msg chat)', chatSummary.buildNamePrompt(big)],
    ['summary (LONG 40-msg chat)', chatSummary.buildSummaryPrompt(big)],
    ['search: recall-expand', chatRecall.buildExpandPrompt('where did we discuss the usage diagnostic and the baseline tokens?')],
    ['search: recall-judge (2 candidate chats)', chatRecall.buildJudgePrompt('usage diagnostic baseline tokens', candidates)],
  ];

  console.log(`\nPer-operation token cost of PCC's INVISIBLE background calls — model=${MODEL}, ${jobs.length} calls, fresh session each (no cache reuse, like the app)`);
  console.log('operation                                   | promptTok | cacheCreate | cacheRead | output | cost$');
  console.log('--------------------------------------------|-----------|-------------|-----------|--------|------');
  const rows = [];
  for (const [label, prompt] of jobs) {
    const { out, err } = await runOneShot(prompt);
    const u = usage(out) || usage(err);
    if (!u) { console.log(`${label.padEnd(43)} | FAILED: ${(err || out).slice(0, 80).replace(/\n/g, ' ')}`); continue; }
    rows.push([label, u]);
    console.log(`${label.padEnd(43)} | ${String(u.prompt).padStart(9)} | ${String(u.cacheCreate).padStart(11)} | ${String(u.cacheRead).padStart(9)} | ${String(u.output).padStart(6)} | ${u.cost.toFixed(4)}`);
  }
  if (rows.length) {
    const totalPrompt = rows.reduce((a, [, u]) => a + u.prompt, 0);
    console.log('\n--- READ THIS ---');
    console.log(`Each background call is a FRESH session -> pays its whole prompt as cache CREATION (no cheap reuse).`);
    const nameSmall = rows.find((r) => r[0].includes('early'));
    const nameLong = rows.find((r) => r[0].includes('LONG 40-msg chat)') && r[0].includes('auto-name'));
    const sumLong = rows.find((r) => r[0].includes('summary'));
    if (nameSmall && nameLong) console.log(`Auto-name cost grows with chat length: ${nameSmall[1].prompt.toLocaleString()} (small) -> ${nameLong[1].prompt.toLocaleString()} tokens (40-msg chat).`);
    if (sumLong) console.log(`Summary of a 40-msg chat: ${sumLong[1].prompt.toLocaleString()} tokens in ONE hidden call.`);
    console.log(`Batch total prompt tokens across ${rows.length} hidden calls: ${totalPrompt.toLocaleString()}.`);
    console.log(`(For reference, one cached visible chat turn measured earlier ~24,400 prompt tokens, ~91% cheap reads.)`);
  }
})();
