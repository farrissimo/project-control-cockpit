// codex-spawn.js — the safe way PCC launches the `codex` CLI.
//
// This mirrors the established claude-spawn boundary discipline so Codex uses
// the same Windows-safe launch path instead of raw spawn('codex', ...), which
// can fail on .cmd shims.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveCodexCommand(env) {
  const e = env || process.env;
  const isWin = process.platform === 'win32';
  const exts = isWin ? (e.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  const dirs = (e.PATH || e.Path || '').split(isWin ? ';' : ':').filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, 'codex' + ext);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* keep looking */ }
    }
  }
  return null;
}

function quoteWindowsArg(arg) {
  const s = String(arg);
  if (s !== '' && !/[\s"^&|<>()]/.test(s)) return s;
  let out = '"';
  let backslashes = 0;
  for (const ch of s) {
    if (ch === '\\') { backslashes++; continue; }
    if (ch === '"') { out += '\\'.repeat(backslashes * 2 + 1) + '"'; backslashes = 0; continue; }
    out += '\\'.repeat(backslashes) + ch;
    backslashes = 0;
  }
  return out + '\\'.repeat(backslashes * 2) + '"';
}

function spawnCodex(args, opts) {
  const options = Object.assign({}, opts);
  const commandPath = options.commandPath || resolveCodexCommand(options.env);
  delete options.commandPath;
  if (!commandPath) throw new Error('Could not find the `codex` CLI on PATH.');
  options.shell = false;

  if (/\.(cmd|bat)$/i.test(commandPath)) {
    const offender = args.find((a) => String(a).includes('%'));
    if (offender !== undefined) {
      throw new Error('Refusing to launch codex through a .cmd/.bat shim with a `%` in an argument: '
        + String(offender).slice(0, 80));
    }
    const line = [commandPath, ...args].map(quoteWindowsArg).join(' ');
    const comspec = (options.env && options.env.ComSpec) || process.env.ComSpec || 'cmd.exe';
    return spawn(comspec, ['/d', '/s', '/v:off', '/c', '"' + line + '"'],
      Object.assign({}, options, { windowsVerbatimArguments: true }));
  }
  return spawn(commandPath, args, options);
}

module.exports = { spawnCodex, resolveCodexCommand, quoteWindowsArg };
