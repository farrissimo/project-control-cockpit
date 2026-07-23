// worker-env.js — enforce DECISION-003 (No Paid API Dependence) at the process boundary.
//
// Claude Code, if it sees ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in its environment, will bill the
// owner's PAID API instead of the regular session (subscription) login. That is a hard, forbidden path:
// the owner's rule is that NO PCC call — worker or tooling — may ever use a paid API. This is the ONE
// place that guarantees it: every `claude` (and any LLM CLI) MUST be spawned with `env: workerEnv()`,
// which strips the paid-API credentials from the child environment so the CLI falls back to session auth.
// Non-interactive spawns can't answer Claude Code's "use this API key? No" prompt, so stripping the vars
// is the only reliable enforcement.
const PAID_API_ENV_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];

// Return a copy of `base` (default process.env) with every paid-API credential removed, so a spawned
// CLI authenticates via the regular session login and can never make a paid API call. Pure; never mutates
// the input. Use as: spawn('claude', args, { cwd, shell: true, env: workerEnv() }).
function workerEnv(base) {
  const env = Object.assign({}, base || process.env);
  for (const k of PAID_API_ENV_VARS) delete env[k];
  return env;
}

module.exports = { workerEnv, PAID_API_ENV_VARS };
