// Direct contract tests for scripts/lib/atomic-write.ps1 (Write-JsonAtomic) — the
// PowerShell mirror of app/state/atomic-store.js used by the state writers. Proves
// the durability + fail-closed guarantees on their own, independent of any consumer.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HELPER = path.join(__dirname, '..', '..', '..', 'scripts', 'lib', 'atomic-write.ps1');

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-aw-')); }

// Run Write-JsonAtomic once. Path + JSON are passed via env vars to avoid any shell
// quoting/escaping ambiguity. Returns the process result (status, stderr).
function writeAtomic(target, json) {
  return spawnSync('pwsh',
    ['-NoProfile', '-Command', `. '${HELPER.replace(/'/g, "''")}'; Write-JsonAtomic -Path $env:PCC_AW_PATH -Json $env:PCC_AW_JSON`],
    { encoding: 'utf8', timeout: 20000, env: { ...process.env, PCC_AW_PATH: target, PCC_AW_JSON: json } });
}

test('writes a new file with exactly the given JSON', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'state.json');
    const r = writeAtomic(f, '{"a":1}');
    expect(r.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(f, 'utf8'))).toEqual({ a: 1 });
    expect(fs.existsSync(f + '.prev')).toBe(false); // nothing prior to retain
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('retains the prior good generation in .prev on overwrite', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'state.json');
    expect(writeAtomic(f, '{"gen":1}').status).toBe(0);
    expect(writeAtomic(f, '{"gen":2}').status).toBe(0);
    expect(JSON.parse(fs.readFileSync(f, 'utf8'))).toEqual({ gen: 2 });
    expect(JSON.parse(fs.readFileSync(f + '.prev', 'utf8'))).toEqual({ gen: 1 }); // prior recoverable
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rejects an invalid-JSON payload and leaves the existing file untouched', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'state.json');
    expect(writeAtomic(f, '{"good":true}').status).toBe(0);
    const r = writeAtomic(f, 'this is not json {');
    expect(r.status).not.toBe(0); // fails closed (throws -> nonzero)
    expect(JSON.parse(fs.readFileSync(f, 'utf8'))).toEqual({ good: true }); // unchanged
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rejects an empty payload', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'state.json');
    const r = writeAtomic(f, '');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(f)).toBe(false); // never created a truncated/empty file
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a corrupt current does NOT clobber an existing good .prev', () => {
  const dir = tmpdir();
  try {
    const f = path.join(dir, 'state.json');
    fs.writeFileSync(f, 'GARBAGE not json');          // corrupt current
    fs.writeFileSync(f + '.prev', '{"lastgood":true}'); // a valid prior generation
    const r = writeAtomic(f, '{"fresh":true}');
    expect(r.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(f, 'utf8'))).toEqual({ fresh: true }); // corrupt replaced
    // the good .prev must survive — a corrupt current is never staged over it
    expect(JSON.parse(fs.readFileSync(f + '.prev', 'utf8'))).toEqual({ lastgood: true });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
