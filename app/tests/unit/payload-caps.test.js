// ADR-0020 T7: pure, deterministic caps on per-send input growth. Pins the ONE thing that must always
// hold: a single owner message can never push unbounded text into the Claude context, and no cap ever
// drops content SILENTLY (a visible marker is left). No Electron, no fs.
const { test } = require('node:test');
const assert = require('node:assert');
const pc = require('../../payload-caps.js');

test('capMessage: text within the cap is returned unchanged and not flagged', () => {
  const r = pc.capMessage('hello world');
  assert.strictEqual(r.text, 'hello world');
  assert.strictEqual(r.truncated, false);
});

test('capMessage: an over-cap paste is truncated to the cap and marked (never silent), null/undefined safe', () => {
  const big = 'x'.repeat(pc.MAX_MESSAGE_CHARS + 5000);
  const r = pc.capMessage(big);
  assert.strictEqual(r.truncated, true);
  assert.ok(r.text.startsWith('x'.repeat(pc.MAX_MESSAGE_CHARS)));
  assert.ok(/PCC input cap/.test(r.text)); // visible marker, not a silent drop
  assert.ok(r.text.length < big.length);
  assert.deepStrictEqual(pc.capMessage(null), { text: '', truncated: false });
  assert.deepStrictEqual(pc.capMessage(undefined), { text: '', truncated: false });
});

test('capAttachments: within count and total text is unchanged', () => {
  const att = [{ kind: 'text', content: 'a'.repeat(1000), name: 'f1' }, { kind: 'image', dataBase64: 'zzz' }];
  const r = pc.capAttachments(att);
  assert.strictEqual(r.droppedForCount, 0);
  assert.strictEqual(r.textTruncated, false);
  assert.strictEqual(r.attachments.length, 2);
  assert.strictEqual(r.attachments[0].content, 'a'.repeat(1000)); // untouched
});

test('capAttachments: more than MAX_ATTACHMENTS keeps the first N and reports the dropped count', () => {
  const att = Array.from({ length: pc.MAX_ATTACHMENTS + 4 }, (_, i) => ({ kind: 'text', content: 'x', name: 'f' + i }));
  const r = pc.capAttachments(att);
  assert.strictEqual(r.attachments.length, pc.MAX_ATTACHMENTS);
  assert.strictEqual(r.droppedForCount, 4);
});

test('capAttachments: total text is bounded to MAX_ATTACH_TOTAL_CHARS, later text trimmed + marked', () => {
  const att = [
    { kind: 'text', content: 'a'.repeat(pc.MAX_ATTACH_TOTAL_CHARS - 100), name: 'f1' },
    { kind: 'text', content: 'b'.repeat(5000), name: 'f2' },
  ];
  const r = pc.capAttachments(att);
  assert.strictEqual(r.textTruncated, true);
  const total = r.attachments.filter((a) => a.kind === 'text').reduce((n, a) => n + a.content.replace(/\n\n\[PCC input cap:[^\]]*\]/g, '').length, 0);
  assert.ok(total <= pc.MAX_ATTACH_TOTAL_CHARS, 'text budget respected: ' + total);
  assert.ok(/PCC input cap/.test(r.attachments[1].content)); // the trimmed one is marked
  assert.strictEqual(r.attachments[0].content, 'a'.repeat(pc.MAX_ATTACH_TOTAL_CHARS - 100)); // first one within budget untouched
});

test('capAttachments: a small image is not charged against the TEXT budget; non-array is safe', () => {
  // 200K of text already spends the text budget; a small image after it is still kept (not a text cost).
  const att = [{ kind: 'text', content: 'a'.repeat(pc.MAX_ATTACH_TOTAL_CHARS), name: 'f1' }, { kind: 'image', dataBase64: 'img' }];
  const r = pc.capAttachments(att);
  assert.strictEqual(r.attachments.length, 2);
  assert.strictEqual(r.attachments[1].kind, 'image');
  assert.deepStrictEqual(pc.capAttachments(null), { attachments: [], droppedForCount: 0, droppedForBudget: 0, textTruncated: false });
});

test('capAttachments: an aggregate IMAGE budget drops WHOLE images in order — base64 is never truncated', () => {
  const fullBudgetImg = () => ({ kind: 'image', dataBase64: 'A'.repeat(pc.MAX_ATTACH_IMAGE_BASE64_CHARS) }); // each = the whole image budget
  const att = [fullBudgetImg(), fullBudgetImg(), { kind: 'text', content: 'hi', name: 't' }];
  const r = pc.capAttachments(att);
  assert.strictEqual(r.droppedForBudget, 1);            // the 2nd image is over budget -> dropped whole
  const images = r.attachments.filter((a) => a.kind === 'image');
  assert.strictEqual(images.length, 1);                 // exactly one image kept
  assert.strictEqual(images[0].dataBase64.length, pc.MAX_ATTACH_IMAGE_BASE64_CHARS); // WHOLE, not truncated (truncated base64 corrupts)
  assert.ok(r.attachments.some((a) => a.kind === 'text' && a.content === 'hi')); // text still passes
  // the 10x8MB (~80MB) scenario the per-file guard alone allowed is now bounded:
  const many = Array.from({ length: 10 }, () => fullBudgetImg());
  const capped = pc.capAttachments(many);
  assert.strictEqual(capped.attachments.filter((a) => a.kind === 'image').length, 1);
  assert.strictEqual(capped.droppedForBudget, 9);
});

test('capAttachments: never mutates the caller\'s input objects', () => {
  const original = { kind: 'text', content: 'z'.repeat(pc.MAX_ATTACH_TOTAL_CHARS + 100), name: 'f1' };
  const before = original.content;
  pc.capAttachments([original]);
  assert.strictEqual(original.content, before); // original untouched (a copy was trimmed)
});

test('headTail: within the cap unchanged; over the cap keeps head+tail with a visible marker', () => {
  assert.strictEqual(pc.headTail('short', 4000), 'short');
  const big = 'H'.repeat(3000) + 'M'.repeat(3000) + 'T'.repeat(3000);
  const r = pc.headTail(big, 4000);
  assert.ok(r.length < big.length);
  assert.ok(r.startsWith('H'));         // head kept
  assert.ok(r.endsWith('T'));           // tail kept
  assert.ok(/truncated/.test(r));       // visible middle marker, not head-only
  assert.strictEqual(pc.headTail(null, 4000), '');
});

test('the caps are sane, positive, LLM-agnostic constants (guard against silent drift)', () => {
  for (const v of [pc.MAX_ATTACHMENTS, pc.MAX_ATTACH_TOTAL_CHARS, pc.MAX_MESSAGE_CHARS, pc.MAX_RECALL_EVIDENCE_CHARS, pc.MAX_QUEUE]) {
    assert.ok(typeof v === 'number' && Number.isFinite(v) && v > 0);
  }
  assert.strictEqual(pc.MAX_QUEUE, 5);            // Codex-concurred
  assert.strictEqual(pc.MAX_ATTACH_TOTAL_CHARS, 200000);
});
