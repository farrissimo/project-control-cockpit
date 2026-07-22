#!/usr/bin/env node
// reconstruct-incident.js (USAGE-00) — read-only forensic. Reconstructs REAL token usage on a target
// date from the local Claude Code session JSONL files (~/.claude/projects/C--ProjectControlCockpit),
// attributing each session to a PCC operation: visible chat (session file matches a .cockpit/chats
// UUID), or an invisible one-shot (auto-name / summary / recall, identified by its first-user-message
// marker), or other/mine. Extracts real usage (input/cacheCreate/cacheRead/output) + model + model-turn
// count per session. Changes NOTHING. Usage: node tools/reconstruct-incident.js 2026-07-20
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATE = process.argv[2] || '2026-07-20';
const SESS_DIR = path.join(os.homedir(), '.claude', 'projects', 'C--ProjectControlCockpit');
const CHATS_DIR = path.join(__dirname, '..', '..', '.cockpit', 'chats');

const pccChatIds = new Set(fs.existsSync(CHATS_DIR) ? fs.readdirSync(CHATS_DIR) : []);

function firstUserText(objs) {
  for (const o of objs) {
    if (o.type === 'user' && o.message) {
      const c = o.message.content;
      if (typeof c === 'string') return c.slice(0, 300);
      if (Array.isArray(c)) { const t = c.find((x) => x.type === 'text'); if (t) return String(t.text).slice(0, 300); }
    }
  }
  return '';
}
function classify(fileId, firstText) {
  if (pccChatIds.has(fileId)) return 'pcc-visible-chat';
  const t = firstText || '';
  if (/^Give this chat a concise title/.test(t)) return 'pcc-auto-name';
  if (/^Summarize the following chat transcript/.test(t)) return 'pcc-summary';
  if (/searching their chat history/.test(t)) return 'pcc-recall-expand';
  if (/CHAT [a-z0-9-]+ \(/i.test(t) || /pick the chats that genuinely/i.test(t)) return 'pcc-recall-judge';
  return 'other-or-mine';
}

const files = fs.readdirSync(SESS_DIR).filter((f) => f.endsWith('.jsonl'));
const acc = {};
let scanned = 0;
for (const f of files) {
  const full = path.join(SESS_DIR, f);
  let mtime; try { mtime = fs.statSync(full).mtime.toISOString().slice(0, 10); } catch { continue; }
  if (mtime !== DATE) continue;                 // prefilter by mtime (session end ~= write time)
  scanned++;
  let objs = [];
  try { objs = fs.readFileSync(full, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); }
  catch { continue; }
  const fileId = f.replace('.jsonl', '');
  const cls = classify(fileId, firstUserText(objs));
  let turns = 0, cc = 0, cr = 0, inp = 0, out = 0, model = '';
  let firstTs = null, lastTs = null;
  for (const o of objs) {
    if (o.timestamp) { if (!firstTs) firstTs = o.timestamp; lastTs = o.timestamp; }
    const u = o.message && o.message.usage;
    if (o.type === 'assistant' && u) {
      turns++; inp += u.input_tokens || 0; cc += u.cache_creation_input_tokens || 0; cr += u.cache_read_input_tokens || 0; out += u.output_tokens || 0;
      if (o.message.model && !/haiku/.test(o.message.model)) model = o.message.model;
    }
  }
  const a = acc[cls] || (acc[cls] = { sessions: 0, turns: 0, ctx: 0, cc: 0, cr: 0, out: 0, models: {} });
  a.sessions++; a.turns += turns; a.ctx += inp + cc + cr; a.cc += cc; a.cr += cr; a.out += out;
  if (model) a.models[model] = (a.models[model] || 0) + 1;
}

console.log(`\n=== Incident reconstruction for ${DATE} (${scanned} sessions written that day) ===\n`);
console.log('class              | sessions | modelTurns | ctxProcessed | cacheCreate | cacheRead | output | models');
console.log('-------------------|----------|------------|--------------|-------------|-----------|--------|-------');
let T = { sessions: 0, turns: 0, ctx: 0, cc: 0, cr: 0, out: 0 };
for (const [cls, a] of Object.entries(acc).sort((x, y) => y[1].ctx - x[1].ctx)) {
  console.log(`${cls.padEnd(18)} | ${String(a.sessions).padStart(8)} | ${String(a.turns).padStart(10)} | ${String(a.ctx).padStart(12)} | ${String(a.cc).padStart(11)} | ${String(a.cr).padStart(9)} | ${String(a.out).padStart(6)} | ${Object.keys(a.models).join(',') || '-'}`);
  for (const k of Object.keys(T)) T[k] += a[k] || 0;
}
console.log(`${'TOTAL'.padEnd(18)} | ${String(T.sessions).padStart(8)} | ${String(T.turns).padStart(10)} | ${String(T.ctx).padStart(12)} | ${String(T.cc).padStart(11)} | ${String(T.cr).padStart(9)} | ${String(T.out).padStart(6)} |`);
console.log(`\nPCC-attributable context processed: ${Object.entries(acc).filter(([c]) => c.startsWith('pcc')).reduce((s, [, a]) => s + a.ctx, 0).toLocaleString()} tokens`);
console.log(`(cacheCreate = expensive fresh processing; cacheRead = discounted. Both count toward the plan limit.)`);
