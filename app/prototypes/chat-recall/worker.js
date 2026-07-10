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
const { spawn } = require('child_process');

// Same scrub as app/main.js:86 so `claude -p` falls back to the claude.ai login.
for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']) delete process.env[k];

function askAI(prompt, opts = {}) {
  const model = opts.model || 'claude-sonnet-5';
  return new Promise((resolve, reject) => {
    // No tool flags: a pure text->text call. shell:true matches the app's spawn
    // on Windows so `claude` resolves the same way.
    const child = spawn('claude', ['-p', '--model', model], {
      shell: true,
      windowsHide: true,
      env: process.env,
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
