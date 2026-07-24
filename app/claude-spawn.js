// claude-spawn.js — the ONE way PCC launches the `claude` CLI.
//
// WHY THIS EXISTS (defect found 2026-07-24, ADR-0020 Gate 0). Every claude spawn used
// `spawn('claude', argsArray, { shell: true })`. On Windows, `shell: true` makes Node CONCATENATE the
// args array into a single command string WITHOUT quoting (this is what Node's own DEP0190 warning is
// about). Any argument containing a space is therefore split into many. Measured with an argv probe:
// 15 args in -> 55 args out. Concretely, `--append-system-prompt <CHANNEL_PROMPT>` (which begins "You
// are replying inside PCC's...") degraded to:
//     --append-system-prompt You      <- the flag received ONE word
//     are replying inside PCC's ...   <- the remainder became STRAY POSITIONAL ARGUMENTS
// and `claude -p` took the first stray positional, "are", as the entire prompt. The same corruption
// applied to --tools / --allowedTools / --disallowedTools, i.e. to PCC's read-only vs build AUTHORITY
// PROFILE, so those arriving intact was unproven. (No authority breach is claimed — the deny-list words
// still arrived, just as separate arguments — but it was not proven either, which is the point.)
//
// THE FIX: never use `shell: true`. Resolve the real executable ourselves and spawn it directly, which
// makes Node quote each argument for CreateProcess so every boundary survives. Prompts continue to go
// over STDIN (see the call sites) — never as positional argv.
//
// Fail-closed: if the resolved command is not something we can spawn with argument boundaries intact,
// we throw a clear error rather than silently mis-quoting and corrupting the authority profile again.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Resolve `claude` on PATH ourselves instead of leaning on a shell. Returns an absolute path.
// On this project's Windows-first target `claude` is a real claude.exe; a .cmd/.bat shim is handled
// separately below because Node (>=18.20, after CVE-2024-27980) refuses to spawn those without a shell.
function resolveClaudeCommand(env) {
  const e = env || process.env;
  const isWin = process.platform === 'win32';
  const exts = isWin ? (e.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  const dirs = (e.PATH || e.Path || '').split(isWin ? ';' : ':').filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, 'claude' + ext);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* keep looking */ }
    }
  }
  return null;
}

// Windows command-line quoting for a single argument (the CreateProcess/MSVCRT rules): wrap in double
// quotes, backslash-escape any embedded double quote, and double up backslashes that immediately
// precede a quote or the closing quote. Only used for the .cmd/.bat shim path.
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

// Spawn the claude CLI with EVERY argument boundary preserved. `args` is a normal array; `opts` is
// passed through to child_process.spawn (cwd, env, stdio, ...). `shell` is never enabled.
// opts.commandPath (test seam) overrides resolution so the contract can be proven against a real
// process boundary without invoking the actual CLI (and without spending plan usage).
function spawnClaude(args, opts) {
  const options = Object.assign({}, opts);
  const commandPath = options.commandPath || resolveClaudeCommand(options.env);
  delete options.commandPath;
  if (!commandPath) throw new Error('Could not find the `claude` CLI on PATH.');
  options.shell = false; // the whole point — never let a shell re-parse our arguments

  if (/\.(cmd|bat)$/i.test(commandPath)) {
    // A shim, not an executable. Node cannot spawn it without a shell, so go through cmd.exe with
    // OUR OWN quoting and windowsVerbatimArguments, rather than letting anything re-split the args.
    //
    // codex-caught (2026-07-24): quoting alone is NOT sufficient here. cmd.exe performs `%VAR%`
    // environment expansion while PARSING the command line — before the shim ever sees the argument —
    // so a `%` cannot be neutralised by quoting the way a space or a quote can. Rather than pretend
    // otherwise, FAIL CLOSED: no legitimate PCC argument contains `%` (flags, model ids, session UUIDs,
    // the channel prompt), so a `%` here means either a new argument shape that needs deliberate
    // thought, or an injection attempt. Silently corrupting an authority-profile argument is exactly
    // the class of failure this whole correction exists to end.
    // `!` (delayed expansion) is handled structurally instead: /v:off guarantees it stays literal.
    const offender = args.find((a) => String(a).includes('%'));
    if (offender !== undefined) {
      throw new Error('Refusing to launch claude through a .cmd/.bat shim with a `%` in an argument ' +
        '(cmd.exe would expand it before the shim sees it): ' + String(offender).slice(0, 80));
    }
    const line = [commandPath, ...args].map(quoteWindowsArg).join(' ');
    const comspec = (options.env && options.env.ComSpec) || process.env.ComSpec || 'cmd.exe';
    return spawn(comspec, ['/d', '/s', '/v:off', '/c', '"' + line + '"'],
      Object.assign({}, options, { windowsVerbatimArguments: true }));
  }
  // The normal case: a real executable. Node quotes each argument for CreateProcess itself.
  return spawn(commandPath, args, options);
}

module.exports = { spawnClaude, resolveClaudeCommand, quoteWindowsArg };
