// SPAWN CONTRACT — proves, at the REAL Windows process boundary, that every argument PCC hands the
// `claude` CLI arrives whole. This is the regression guard for the 2026-07-24 defect where
// `spawn('claude', args, { shell: true })` concatenated the args array without quoting, so
// `--append-system-prompt <CHANNEL_PROMPT>` degraded to `--append-system-prompt You` and the rest of the
// prompt became stray positional arguments (measured: 15 args in, 55 out). That silently corrupted the
// tool/authority profile strings too, and made `claude -p` treat the stray word "are" as the prompt.
//
// These tests spawn a REAL process (node.exe running a capture fixture) through the SAME spawnClaude()
// helper production uses, and assert on what the child actually received. A test that merely inspected
// main.js source for the expected array would NOT have caught this defect — the array was always right;
// the process boundary was what mangled it. Zero plan usage: no model is ever contacted.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnClaude, quoteWindowsArg, resolveClaudeCommand } = require('../../claude-spawn');
const { toolFlagsFor, READ_ONLY, BUILD } = require('../../authority-tool-profile');

const CAPTURE = path.join(__dirname, '..', 'fixtures', 'spawn', 'capture-argv.js');

// Verbatim from main.js — the exact string whose spaces triggered the defect.
const CHANNEL_PROMPT = 'You are replying inside PCC\'s text-only chat panel: there is no interactive UI, no clickable pickers or buttons you can present. Never use interactive tools such as AskUserQuestion; if you need to ask the owner something, ask it as plain text with the options listed inline. Never narrate internal tool, prompt, or mechanism failures to the owner (e.g. do not say a tool "isn\'t working") - just answer or ask plainly. The owner is a non-coder product lead: be concise and plain-language.';

// Run args through the real helper against a real child process; return what the child saw.
function capture(claudeArgs, stdinText, opts) {
  return new Promise((resolve, reject) => {
    const child = spawnClaude([CAPTURE, ...claudeArgs],
      Object.assign({ commandPath: process.execPath }, opts));
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', () => {
      try { resolve(JSON.parse(out)); }
      catch (e) { reject(new Error('capture failed: ' + e.message + ' out=' + out.slice(0, 300) + ' err=' + err.slice(0, 300))); }
    });
    if (stdinText !== undefined && stdinText !== null) child.stdin.write(stdinText);
    child.stdin.end();
  });
}

test('CHANNEL_PROMPT arrives as ONE complete argument (the exact defect)', async () => {
  const seen = await capture(['--append-system-prompt', CHANNEL_PROMPT]);
  const i = seen.argv.indexOf('--append-system-prompt');
  assert.notStrictEqual(i, -1, '--append-system-prompt flag did not survive');
  assert.strictEqual(seen.argv[i + 1], CHANNEL_PROMPT,
    'CHANNEL_PROMPT was split across arguments (this is the shell:true defect)');
  assert.strictEqual(seen.argv.length, 2, // the capture script path is stripped; flag + value only
    'extra arguments appeared — words leaked out as stray positionals: ' + JSON.stringify(seen.argv));
});

test('no words become stray positional arguments (15 in -> 15 out, not 55)', async () => {
  const args = ['-p', '--model', 'claude-sonnet-5', ...toolFlagsFor(false),
    '--append-system-prompt', CHANNEL_PROMPT, '--session-id', 'abc-123'];
  const seen = await capture(args);
  assert.deepStrictEqual(seen.argv, args,
    'argv did not survive the process boundary intact');
});

test('READ_ONLY and BUILD tool profiles arrive exactly as toolFlagsFor generates them', async () => {
  for (const [isBuild, profile] of [[false, READ_ONLY], [true, BUILD]]) {
    const flags = toolFlagsFor(isBuild);
    const seen = await capture(flags);
    assert.deepStrictEqual(seen.argv, flags,
      (isBuild ? 'BUILD' : 'READ_ONLY') + ' profile flags were mangled');
    // Each profile string is multi-word — the exact shape that used to split.
    const a = seen.argv;
    assert.strictEqual(a[a.indexOf('--tools') + 1], profile.tools, 'tools string split');
    assert.strictEqual(a[a.indexOf('--allowedTools') + 1], profile.allowed, 'allowedTools string split');
    assert.strictEqual(a[a.indexOf('--disallowedTools') + 1], profile.disallowed, 'disallowedTools string split');
  }
});

test('the read-only deny backstop survives as a single argument (authority integrity)', async () => {
  const seen = await capture(toolFlagsFor(false));
  const disallowed = seen.argv[seen.argv.indexOf('--disallowedTools') + 1];
  for (const tool of ['Bash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit']) {
    assert.ok(disallowed.split(' ').includes(tool),
      tool + ' missing from the deny list as received by the child');
  }
});

test('the owner/task prompt arrives byte-identically over STDIN, never as argv', async () => {
  const prompt = 'Read app/main.js in full and list every function name.\nSecond line — with "quotes", & ampersand, | pipe.';
  const seen = await capture(['-p', '--output-format', 'json'], prompt);
  assert.strictEqual(seen.stdin, prompt, 'stdin prompt was altered in transit');
  assert.ok(!seen.argv.some((a) => a.includes('Read app/main.js')),
    'the prompt leaked into argv — it must travel on stdin only');
});

test('session/resume, model, fallback, budget and max-turns values remain intact', async () => {
  const args = ['-p', '--model', 'claude-sonnet-5', '--fallback-model', 'claude-sonnet-5',
    '--max-budget-usd', '0.5', '--max-turns', '30', '--resume', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'];
  const seen = await capture(args);
  assert.deepStrictEqual(seen.argv, args);
});

test('oneShotWorker-style restrictions arrive intact', async () => {
  // The exact multi-word restriction strings oneShotWorker passes (main.js).
  const args = ['-p', '--model', 'claude-sonnet-5',
    '--tools', 'Read Glob Grep', '--strict-mcp-config',
    '--allowedTools', 'Read Glob Grep',
    '--disallowedTools', 'AskUserQuestion Bash BashOutput KillBash PowerShell Edit Write NotebookEdit Agent Monitor Skill ToolSearch Task WebSearch WebFetch',
    '--output-format', 'json'];
  const seen = await capture(args);
  assert.deepStrictEqual(seen.argv, args);
  assert.strictEqual(seen.argv[seen.argv.indexOf('--tools') + 1], 'Read Glob Grep');
});

test('arguments with shell metacharacters survive (no shell re-parsing)', async () => {
  const nasty = ['--append-system-prompt', 'a & b | c > d < e ^ f "quoted" \'single\' (paren) %VAR%'];
  const seen = await capture(nasty);
  assert.deepStrictEqual(seen.argv, nasty,
    'a shell interpreted metacharacters — spawn must not go through a shell');
});

test('a .cmd/.bat shim also preserves argument boundaries', async () => {
  // Node cannot spawn a .cmd without a shell, so spawnClaude routes it via cmd.exe using our own
  // quoting. Prove that path too, with a real shim, so the contract is not machine-specific.
  if (process.platform !== 'win32') return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-spawn-'));
  const shim = path.join(dir, 'claude.cmd');
  fs.writeFileSync(shim, '@echo off\r\n"' + process.execPath + '" "' + CAPTURE + '" %*\r\n');
  try {
    const args = ['--append-system-prompt', CHANNEL_PROMPT, ...toolFlagsFor(false)];
    const seen = await new Promise((resolve, reject) => {
      const child = spawnClaude(args, { commandPath: shim });
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.on('error', reject);
      child.on('close', () => { try { resolve(JSON.parse(out)); } catch (e) { reject(new Error('shim capture failed: ' + out.slice(0, 300))); } });
      child.stdin.end();
    });
    assert.deepStrictEqual(seen.argv, args, 'the .cmd shim path mangled arguments');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('shim path: `!` stays literal, and a `%` argument fails closed rather than expanding', async () => {
  // codex-caught. cmd.exe expands %VAR% while PARSING, before the shim sees it, so quoting cannot save
  // it — we refuse instead. `!` is handled structurally by /v:off, so it must survive verbatim.
  if (process.platform !== 'win32') return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-spawn-pct-'));
  const shim = path.join(dir, 'claude.cmd');
  fs.writeFileSync(shim, '@echo off\r\n"' + process.execPath + '" "' + CAPTURE + '" %*\r\n');
  try {
    // A `%` argument must THROW, not silently mutate.
    assert.throws(() => spawnClaude(['--append-system-prompt', 'literal %PATH% here'], { commandPath: shim }),
      /Refusing to launch claude through a \.cmd\/\.bat shim with a `%`/);

    // `!` must arrive untouched (delayed expansion disabled).
    const args = ['--append-system-prompt', 'bang ! and !VAR! stay literal'];
    const seen = await new Promise((resolve, reject) => {
      const child = spawnClaude(args, { commandPath: shim });
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.on('error', reject);
      child.on('close', () => { try { resolve(JSON.parse(out)); } catch (e) { reject(new Error('capture failed: ' + out.slice(0, 200))); } });
      child.stdin.end();
    });
    assert.deepStrictEqual(seen.argv, args, 'delayed expansion altered an argument');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('spawnClaude never enables a shell, and fails closed when claude is absent', () => {
  assert.throws(() => spawnClaude(['-p'], { env: { PATH: path.join(os.tmpdir(), 'definitely-not-here') } }),
    /Could not find the `claude` CLI/, 'must fail closed rather than silently mis-spawn');
  // quoteWindowsArg is only a helper for the shim path; pin its escaping of the dangerous cases.
  assert.strictEqual(quoteWindowsArg('plain'), 'plain');
  assert.strictEqual(quoteWindowsArg('has space'), '"has space"');
  assert.strictEqual(quoteWindowsArg('say "hi"'), '"say \\"hi\\""');
});

test('claude resolves to a real executable on this machine (documents the target)', () => {
  const resolved = resolveClaudeCommand();
  if (!resolved) return; // CI without the CLI installed — the contract tests above still hold
  assert.ok(fs.statSync(resolved).isFile(), 'resolved claude path is not a file: ' + resolved);
});
