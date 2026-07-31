const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnCodex, quoteWindowsArg, resolveCodexCommand } = require('../../codex-spawn');

const CAPTURE = path.join(__dirname, '..', 'fixtures', 'spawn', 'capture-argv.js');

function capture(codexArgs, stdinText, opts) {
  return new Promise((resolve, reject) => {
    const child = spawnCodex([CAPTURE, ...codexArgs],
      Object.assign({ commandPath: process.execPath }, opts));
    let out = '';
    let err = '';
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

test('codex output-path args survive the process boundary intact', async () => {
  const args = ['exec', '--sandbox', 'read-only', '--model', 'gpt-5-codex', '-o', 'C:\\Temp Folder\\out file.txt', '-'];
  const seen = await capture(args, 'hello');
  assert.deepStrictEqual(seen.argv, args);
  assert.strictEqual(seen.stdin, 'hello');
});

test('codex shim path preserves argument boundaries', async () => {
  if (process.platform !== 'win32') return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-codex-spawn-'));
  const shim = path.join(dir, 'codex.cmd');
  fs.writeFileSync(shim, '@echo off\r\n"' + process.execPath + '" "' + CAPTURE + '" %*\r\n');
  try {
    const args = ['exec', '--sandbox', 'workspace-write', '--model', 'gpt-5-codex', '-o', 'C:\\Temp Folder\\out file.txt', '-'];
    const seen = await new Promise((resolve, reject) => {
      const child = spawnCodex(args, { commandPath: shim });
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.on('error', reject);
      child.on('close', () => { try { resolve(JSON.parse(out)); } catch (e) { reject(new Error('shim capture failed: ' + out.slice(0, 300))); } });
      child.stdin.end();
    });
    assert.deepStrictEqual(seen.argv, args);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('spawnCodex fails closed when codex is absent', () => {
  assert.throws(() => spawnCodex(['exec'], { env: { PATH: path.join(os.tmpdir(), 'definitely-not-here') } }),
    /Could not find the `codex` CLI/);
  assert.strictEqual(quoteWindowsArg('plain'), 'plain');
  assert.strictEqual(quoteWindowsArg('has space'), '"has space"');
});

test('codex resolves to a real executable on this machine when installed', () => {
  const resolved = resolveCodexCommand();
  if (!resolved) return;
  assert.ok(fs.statSync(resolved).isFile(), 'resolved codex path is not a file: ' + resolved);
});
