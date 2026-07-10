// Parsers pinned to REAL captured output (roadmap #2: "real captures, not invented shapes").
// The two parsers that consume STRUCTURED agent output — parseStreamJson (the attachments/image
// reply path) and parseVerification (the verdict reader) — are the one place where a guessed shape
// could silently break a shipped feature. These fixtures are genuine, secret-redacted captures of
// real `claude -p --output-format stream-json` and real `codex exec` runs (see the fixtures README),
// and they carry shapes the simplified test fakes never emit: thinking blocks, rate_limit_event and
// system lines, and Codex's preamble + duplicated body. The parsers must handle all of it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { parseStreamJson } = require('../../stream-json');
const { parseVerification } = require('../../renderer/verification-parse');

const REAL = (n) => fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'real', n), 'utf8');

test('parseStreamJson extracts the reply from a REAL stream-json envelope (ignores thinking/system/rate_limit)', () => {
  const raw = REAL('claude-streamjson-success.txt');
  // Sanity: the capture really does carry the complex shapes the fake omits.
  expect(raw).toContain('"type":"thinking"');
  expect(raw).toContain('"type":"rate_limit_event"');
  expect(raw).toContain('"type":"system"');
  // The parser must ignore all of that and return only the assistant's text.
  expect(parseStreamJson(raw)).toBe('PONG');
});

test('parseStreamJson never leaks a thinking block or a signature into the reply', () => {
  const out = parseStreamJson(REAL('claude-streamjson-success.txt'));
  expect(out).not.toMatch(/signature|thinking/i);
  expect(out).toBe('PONG');
});

test('parseVerification reads the verdict from a REAL codex envelope (preamble + duplicated body)', () => {
  const raw = REAL('codex-verdict-pass.txt');
  // Sanity: this is the real Codex CLI shape, not a clean one line.
  expect(raw).toContain('OpenAI Codex');
  expect(raw.match(/VERDICT: PASS/g).length).toBeGreaterThan(1); // body is echoed twice by the CLI
  const parsed = parseVerification(raw);
  expect(parsed.verdict).toBe('PASS');
  expect(parsed.type).toBeNull(); // Codex does not declare a proof TYPE; verify-work.ps1 stamps it
});
