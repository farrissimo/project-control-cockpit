// Read-only DENY-LIST regression guard (execution authority audit, ADR-0009; DECISION-112).
// The read-only spawn profile is the enforcement of PCC's #1 trust concern — a "persuaded" read-only
// worker must not be able to run Bash/PowerShell/Write/Edit. That guarantee previously had NO automated
// test (only manual spikes); a regression that let read-only run a shell would have shipped green. These
// tests pin the profiles: (a) behavior-identity — the extracted module emits the exact flags main.js used
// to inline; (b) the semantic invariant — read-only never ALLOWS a mutation tool and always DENIES every
// one of them (deny-beats-allow backstop). Pure logic, node:test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toolFlagsFor, profileFor, READ_ONLY, BUILD, MUTATION_TOOLS } = require('../../authority-tool-profile');

// (a) Behavior identity: the exact argv fragments main.js spawned before the extraction. If these change,
// the extraction (or a deliberate profile edit) changed real spawn behavior — make it a conscious choice.
test('read-only flags are exactly the historical read-only argv', () => {
  assert.deepEqual(toolFlagsFor(false), [
    '--tools', 'WebSearch WebFetch Read Glob Grep',
    '--strict-mcp-config',
    '--allowedTools', 'WebSearch WebFetch Read Glob Grep',
    '--disallowedTools', 'AskUserQuestion Bash BashOutput KillBash PowerShell Edit Write NotebookEdit Agent Monitor Skill ToolSearch Task',
  ]);
});
test('build flags are exactly the historical build argv', () => {
  assert.deepEqual(toolFlagsFor(true), [
    '--tools', 'Bash PowerShell Read Write Edit Glob Grep WebSearch WebFetch',
    '--strict-mcp-config',
    '--allowedTools', 'Bash PowerShell Read Write Edit Glob Grep WebSearch WebFetch',
    '--disallowedTools', 'AskUserQuestion Agent Monitor Skill ToolSearch Task',
  ]);
});

// (b) The load-bearing invariant: read-only can NEVER run an execution/mutation tool.
test('read-only ALLOWS none of the mutation tools', () => {
  const allowed = READ_ONLY.allowed.split(/\s+/);
  for (const t of MUTATION_TOOLS) {
    assert.ok(!allowed.includes(t), `read-only must not allow '${t}', but --allowedTools includes it`);
  }
});
test('read-only DENIES every mutation tool (deny-beats-allow backstop)', () => {
  const denied = READ_ONLY.disallowed.split(/\s+/);
  for (const t of MUTATION_TOOLS) {
    assert.ok(denied.includes(t), `read-only must deny '${t}' as the backstop, but --disallowedTools omits it`);
  }
});
test('read-only never lists a tool as both allowed and (only) available without web/read scope', () => {
  // read-only's available tools must be a subset of the safe web+read set — no shell/mutation leaks in.
  const tools = READ_ONLY.tools.split(/\s+/);
  for (const t of MUTATION_TOOLS) {
    assert.ok(!tools.includes(t), `read-only --tools must not even make '${t}' available`);
  }
});

// Build is allowed to run them (that's the point of an owner-approved build) — assert the profile split
// is real, so a mistake that made BUILD read-only (or vice versa) is caught.
test('build ALLOWS the mutation tools (owner-approved build can act)', () => {
  const allowed = BUILD.allowed.split(/\s+/);
  for (const t of ['Bash', 'PowerShell', 'Write', 'Edit']) {
    assert.ok(allowed.includes(t), `build must allow '${t}'`);
  }
});

test('profileFor is a pure switch on the boolean', () => {
  assert.equal(profileFor(true), BUILD);
  assert.equal(profileFor(false), READ_ONLY);
});
