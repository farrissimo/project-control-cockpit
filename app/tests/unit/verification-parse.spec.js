// The ONE shared verification parser (soak: independent review found the app read the
// verdict with a loose token scan, so a stray "PASS" in prose read as a real PASS on the
// trust strip / Overview while the phase-close gate rejected the same file). These tests
// pin the structured behavior that every JS trust surface now shares.
const { test, expect } = require('@playwright/test');
const { parseVerification, isExecutedType, isTrustedLocalProof, matchesCurrentCommit } = require('../../renderer/verification-parse.js');

test('a stray "PASS" in prose is NOT a verdict (the fake-green hole)', () => {
  const text = 'VERIFIER: someone\nTYPE: local_execution\n\nHonestly it will PASS eventually, looks fine.\n';
  expect(parseVerification(text).verdict).toBeNull(); // no VERDICT: line => no verdict
  expect(parseVerification(text).type).toBe('local_execution'); // TYPE still read structurally
});

test('a structured VERDICT: line is read', () => {
  const text = 'VERIFIER: test\nTYPE: local_execution\n\nVERDICT: PASS\n';
  const p = parseVerification(text);
  expect(p.verdict).toBe('PASS');
  expect(p.type).toBe('local_execution');
});

test('non-PASS verdicts and missing TYPE parse honestly', () => {
  expect(parseVerification('VERDICT: FAIL').verdict).toBe('FAIL');
  expect(parseVerification('VERDICT: INSUFFICIENT').verdict).toBe('INSUFFICIENT');
  expect(parseVerification('VERDICT: PASS').type).toBeNull(); // no TYPE line => null (caller defaults)
  expect(parseVerification('').verdict).toBeNull();
});

test('isExecutedType includes local_execution but not review_only', () => {
  expect(isExecutedType('ci_execution')).toBe(true);
  expect(isExecutedType('live_boundary')).toBe(true);
  expect(isExecutedType('local_execution')).toBe(true); // real execution (local)
  expect(isExecutedType('review_only')).toBe(false);    // read, not run
  expect(isExecutedType(null)).toBe(false);
});

// Origin seam: a hand-editable record can only be TRUSTED to claim local_execution. A forged
// ci_execution/live_boundary TYPE: line must NOT count as executed proof (clean-room/CI proof
// comes from the live CI check, never a text line).
test('isTrustedLocalProof trusts only local_execution (forged CI/clean-room claims are rejected)', () => {
  expect(isTrustedLocalProof('local_execution')).toBe(true);
  expect(isTrustedLocalProof('ci_execution')).toBe(false);   // not trustable from a file — forgery surface
  expect(isTrustedLocalProof('live_boundary')).toBe(false);  // not trustable from a file — forgery surface
  expect(isTrustedLocalProof('review_only')).toBe(false);
  expect(isTrustedLocalProof(null)).toBe(false);
});

test('VERIFIED_SHA is parsed from its own line (and only a real hex sha)', () => {
  const text = 'VERIFIED_SHA: e8a19b03d8c7c17de717af85d554ee3e6432a0c2\nTYPE: local_execution\n\nVERDICT: PASS\n';
  expect(parseVerification(text).sha).toBe('e8a19b03d8c7c17de717af85d554ee3e6432a0c2');
  expect(parseVerification('VERDICT: PASS').sha).toBeNull(); // absent => null
  expect(parseVerification('a VERIFIED_SHA: deadbeef mentioned mid-sentence').sha).toBeNull(); // not at line start
});

// CRIT-1: commit-bound freshness. Green ONLY when the recorded sha == HEAD and the tree is clean.
test('matchesCurrentCommit is true only for an exact sha match on a clean tree', () => {
  const sha = 'e8a19b03d8c7c17de717af85d554ee3e6432a0c2';
  expect(matchesCurrentCommit(sha, sha, false)).toBe(true);          // matches, clean
  expect(matchesCurrentCommit(sha, sha, true)).toBe(false);          // uncommitted edits => not current (the old proxy's blind spot)
  expect(matchesCurrentCommit(sha, 'a'.repeat(40), false)).toBe(false); // HEAD moved on
  expect(matchesCurrentCommit(null, sha, false)).toBe(false);        // record has no sha => cannot prove
  expect(matchesCurrentCommit(sha, null, false)).toBe(false);        // git unknown => fail closed
  expect(matchesCurrentCommit(sha.toUpperCase(), sha, false)).toBe(true); // case-insensitive
});

test('a mid-line VERDICT/TYPE mention in prose is not matched', () => {
  // Neither field is at the start of a line, so neither is treated as a real field.
  const text = 'I would call the TYPE: ci_execution and say the VERDICT: PASS informally.\n';
  const p = parseVerification(text);
  expect(p.verdict).toBeNull();
  expect(p.type).toBeNull();
});
