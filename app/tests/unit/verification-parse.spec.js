// The ONE shared verification parser (soak: independent review found the app read the
// verdict with a loose token scan, so a stray "PASS" in prose read as a real PASS on the
// trust strip / Overview while the phase-close gate rejected the same file). These tests
// pin the structured behavior that every JS trust surface now shares.
const { test, expect } = require('@playwright/test');
const { parseVerification, isExecutedType } = require('../../renderer/verification-parse.js');

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

test('a mid-line VERDICT/TYPE mention in prose is not matched', () => {
  // Neither field is at the start of a line, so neither is treated as a real field.
  const text = 'I would call the TYPE: ci_execution and say the VERDICT: PASS informally.\n';
  const p = parseVerification(text);
  expect(p.verdict).toBeNull();
  expect(p.type).toBeNull();
});
