// Pure, unit-tested selection of the spawn TOOL PROFILE from the authority decision (DECISION-112).
//
// Extracted from main.js so the read-only DENY-LIST — the enforcement of read-only mode and the linchpin
// of PCC's persuadable-bypass defense — is regression-guarded by a test, not asserted only by a comment
// and manual "spikes". A change that let a read-only spawn run Bash (allowing it, or dropping it from the
// deny backstop) must FAIL a test, not ship green.
//
// Scope of the guarantee this module provides: it proves PCC PASSES the correct flags. Whether the Claude
// CLI HONORS `--disallowedTools` over `--allowedTools` (deny-beats-allow) is a CLI property — documented
// precedence plus the manual A/B/C headless repros — not something JS can prove. That boundary is stated
// in docs/audit/execution-authority-worker-safety.md.

// Tools a READ-ONLY spawn must never be able to run (execution + mutation + shell). If any of these ever
// becomes runnable in read-only, the persuadable-bypass defense is breached.
const MUTATION_TOOLS = ['Bash', 'BashOutput', 'KillBash', 'PowerShell', 'Edit', 'Write', 'NotebookEdit'];

// The two profiles, kept as the exact strings main.js passes to the worker spawn.
const READ_ONLY = Object.freeze({
  tools: 'WebSearch WebFetch Read Glob Grep',
  allowed: 'WebSearch WebFetch Read Glob Grep',
  disallowed: 'AskUserQuestion Bash BashOutput KillBash PowerShell Edit Write NotebookEdit Agent Monitor Skill ToolSearch Task',
});
const BUILD = Object.freeze({
  tools: 'Bash PowerShell Read Write Edit Glob Grep WebSearch WebFetch',
  allowed: 'Bash PowerShell Read Write Edit Glob Grep WebSearch WebFetch',
  disallowed: 'AskUserQuestion Agent Monitor Skill ToolSearch Task',
});

function profileFor(isBuild) { return isBuild ? BUILD : READ_ONLY; }

// The exact `--tools/--strict-mcp-config/--allowedTools/--disallowedTools` argv fragment main.js spawns.
function toolFlagsFor(isBuild) {
  const p = profileFor(isBuild);
  return ['--tools', p.tools, '--strict-mcp-config', '--allowedTools', p.allowed, '--disallowedTools', p.disallowed];
}

module.exports = { toolFlagsFor, profileFor, READ_ONLY, BUILD, MUTATION_TOOLS };
