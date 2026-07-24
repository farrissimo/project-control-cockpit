// One-shot worker call for the prototype's AI stages.
//
// Mirrors how the real app talks to the worker (main.js): drives Claude Code
// through the claude.ai LOGIN (not a paid API key) via headless `claude -p`,
// with the ANTHROPIC_* env scrubbed so the login is used. Unlike the app this is
// STATELESS - no --session-id/--resume - because each recall stage is an
// independent text->text call, not a continuing conversation. No tools are
// granted; these stages only read the text we hand them and reply.
//
// askAI(prompt, { model }) -> Promise<string>  (the worker's stdout, trimmed)

'use strict';
// codex-caught (2026-07-24): this prototype was a SIXTH raw `claude` launch — spawn('claude', …,
// {shell:true}) — outside the five sites the spawn-contract correction covered. Its args happen to be
// single words today, so nothing was being mangled, but it is a real usage-spending channel and it
// mutated the PARENT process.env to scrub credentials. Routed through the one launcher (no shell) and
// switched to workerEnv(), which returns a scrubbed COPY instead (DECISION-003).
const { spawnClaude } = require('../../claude-spawn');
const { workerEnv } = require('../../worker-env');

function askAI(prompt, opts = {}) {
  const model = opts.model || 'claude-sonnet-5';
  return new Promise((resolve, reject) => {
    // No tool flags: a pure text->text call. The prompt goes over stdin, never argv.
    const child = spawnClaude(['-p', '--model', model], {
      windowsHide: true,
      env: workerEnv(),
    });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error('claude exited ' + code + ': ' + err.trim()));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

module.exports = { askAI };
