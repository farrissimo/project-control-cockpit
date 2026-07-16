// Extract the OWNER's real turns from Claude Code .jsonl archives.
// No interpretation here — just get his actual words out, so the behaviour model is
// built from what he really did, not what I imagine he'd do.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const outPath = process.argv[3];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));

const turns = [];
for (const f of files) {
  const full = path.join(dir, f);
  let lines;
  try { lines = fs.readFileSync(full, 'utf8').split('\n'); } catch (e) { continue; }
  for (const line of lines) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { continue; }
    if (o.type !== 'user') continue;
    const m = o.message;
    if (!m || m.role !== 'user') continue;
    let text = '';
    if (typeof m.content === 'string') text = m.content;
    else if (Array.isArray(m.content)) {
      // skip tool_result turns — those are the harness talking, not him
      if (m.content.some((c) => c.type === 'tool_result')) continue;
      text = m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    }
    text = (text || '').trim();
    if (!text) continue;
    if (text.startsWith('<')) continue;               // system reminders / injected context
    if (text.includes('[Request interrupted')) continue;
    if (text.startsWith('Caveat:')) continue;
    turns.push({ session: f.replace('.jsonl', '').slice(0, 8), ts: o.timestamp || '', text });
  }
}
turns.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
fs.writeFileSync(outPath, JSON.stringify(turns, null, 1), 'utf8');
console.log('owner turns extracted: ' + turns.length + ' -> ' + outPath);
const lens = turns.map((t) => t.text.length).sort((a, b) => a - b);
console.log('median length: ' + (lens[Math.floor(lens.length / 2)] || 0) + ' chars; max ' + (lens[lens.length - 1] || 0));
