// Build identity — proof of the fail-closed rules in app/build-identity.js.
// Runner: node:test. Pure: no Electron, no real repo, no filesystem — every source
// (stamp file, git) is injected, so each AC is exercised exactly, not incidentally.
// Spec: docs/specs/build-identity.md
const { test } = require('node:test');
const assert = require('node:assert');
const { readBuildIdentity, formatIdentity } = require('../../build-identity');
const { buildStamp } = require('../../tools/write-build-info');
const fs = require('node:fs');
const path = require('node:path');

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const GOOD_STAMP = {
  version: '0.1.0',
  sha: SHA,
  builtAt: '2026-07-16T09:30:00.000Z',
  dirty: false,
};

// Injected sources. Default: no stamp, no git — the honest-unknown baseline.
function deps(over) {
  return Object.assign({
    packaged: true,
    stampPath: 'C:\\fake\\build-info.json',
    version: '0.1.0',
    readFile: () => null,
    runGit: () => ({ ok: false, out: '' }),
  }, over || {});
}
const stampOf = (obj) => () => JSON.stringify(obj);

// --- AC-2: packaged + valid stamp => report that stamp ---------------------------------
test('AC-2: a packaged build with a valid stamp reports that stamp identity', () => {
  const id = readBuildIdentity(deps({ readFile: stampOf(GOOD_STAMP) }));
  assert.equal(id.status, 'stamped');
  assert.equal(id.source, 'stamp');
  assert.equal(id.version, '0.1.0');
  assert.equal(id.sha, SHA);
  assert.equal(id.shortSha, 'a1b2c3d');
  assert.equal(id.builtAt, '2026-07-16T09:30:00.000Z');
  assert.equal(id.dirty, false);
});

test('AC-2: the stamp wins over git — a packaged app must report what it SHIPPED, not a stray repo', () => {
  // A packaged install can sit next to an unrelated checkout. If git ever outranked the stamp,
  // the app would report a commit it was not built from — a confident lie.
  const other = '9999999999999999999999999999999999999999';
  const id = readBuildIdentity(deps({
    packaged: false, // even in dev, an explicit stamp is authoritative
    readFile: stampOf(GOOD_STAMP),
    runGit: () => ({ ok: true, out: other + '\n' }),
  }));
  assert.equal(id.sha, SHA, 'reported the stamped commit, not the ambient git HEAD');
  assert.equal(id.source, 'stamp');
});

// --- AC-3: dev + no stamp => derive live from git --------------------------------------
test('AC-3: running from source with no stamp derives identity live from git', () => {
  const id = readBuildIdentity(deps({
    packaged: false,
    runGit: (args) => (args[0] === 'rev-parse'
      ? { ok: true, out: SHA + '\n' }
      : { ok: true, out: '' }), // status --porcelain: clean
  }));
  assert.equal(id.status, 'dev');
  assert.equal(id.source, 'git');
  assert.equal(id.sha, SHA);
  assert.equal(id.shortSha, 'a1b2c3d');
  assert.equal(id.dirty, false);
  assert.equal(id.builtAt, null, 'a dev run has no build time; inventing one would be a lie');
});

// --- AC-4: no stamp + no git => unknown, and NO version/sha ------------------------------
test('AC-4: a packaged build with no stamp reports unknown and carries no version or sha', () => {
  const id = readBuildIdentity(deps());
  assert.equal(id.status, 'unknown');
  assert.equal(id.sha, null);
  assert.equal(id.shortSha, null);
  assert.equal(id.version, null, 'must NOT fall back to the package version — it proves nothing about the code');
  assert.ok(id.reason && id.reason.length > 0, 'unknown must say why');
});

test('AC-4: a malformed stamp is treated as NO stamp, not as a partial identity', () => {
  const bad = [
    ['not json at all', () => '{{{'],
    ['empty object', stampOf({})],
    ['sha is not a sha', stampOf(Object.assign({}, GOOD_STAMP, { sha: 'deadbeef' }))],
    ['sha missing', stampOf({ version: '0.1.0', builtAt: GOOD_STAMP.builtAt, dirty: false })],
    ['builtAt not a date', stampOf(Object.assign({}, GOOD_STAMP, { builtAt: 'whenever' }))],
    ['dirty not a boolean', stampOf(Object.assign({}, GOOD_STAMP, { dirty: 'no' }))],
    ['version empty', stampOf(Object.assign({}, GOOD_STAMP, { version: '' }))],
    ['whitespace only', () => '   '],
  ];
  for (const [label, readFile] of bad) {
    const id = readBuildIdentity(deps({ readFile }));
    assert.equal(id.status, 'unknown', label + ' => unknown');
    assert.equal(id.sha, null, label + ' => no sha');
    assert.equal(id.version, null, label + ' => no version');
  }
});

test('AC-4: an unreadable stamp (throwing reader) degrades to unknown rather than crashing', () => {
  const id = readBuildIdentity(deps({ readFile: () => { throw new Error('EACCES'); } }));
  assert.equal(id.status, 'unknown');
  assert.equal(id.sha, null);
});

test('AC-4: a throwing/failing git in dev with no stamp reports unknown, never a guess', () => {
  const id = readBuildIdentity(deps({ packaged: false, runGit: () => { throw new Error('ENOENT'); } }));
  assert.equal(id.status, 'unknown');
  assert.equal(id.sha, null);
  assert.equal(id.version, null);
});

test('AC-4: git returning junk instead of a sha is rejected', () => {
  const id = readBuildIdentity(deps({ packaged: false, runGit: () => ({ ok: true, out: 'fatal: not a git repository\n' }) }));
  assert.equal(id.status, 'unknown');
  assert.equal(id.sha, null);
});

// --- AC-5: dirty is recorded and surfaced ------------------------------------------------
test('AC-5: a stamp built from a dirty tree reports dirty and says it is not commit-identifiable', () => {
  const id = readBuildIdentity(deps({ readFile: stampOf(Object.assign({}, GOOD_STAMP, { dirty: true })) }));
  assert.equal(id.dirty, true);
  assert.match(formatIdentity(id), /UNCOMMITTED CHANGES/, 'the owner-facing line must say the sha does not pin this build');
});

test('AC-5: a dev tree with uncommitted changes reports dirty', () => {
  const id = readBuildIdentity(deps({
    packaged: false,
    runGit: (args) => (args[0] === 'rev-parse'
      ? { ok: true, out: SHA }
      : { ok: true, out: ' M app/main.js\n?? app/new.js\n' }),
  }));
  assert.equal(id.dirty, true);
});

test('AC-5: when the dirty check itself fails, dirty is unknown — never silently "clean"', () => {
  const id = readBuildIdentity(deps({
    packaged: false,
    runGit: (args) => (args[0] === 'rev-parse' ? { ok: true, out: SHA } : { ok: false, out: '' }),
  }));
  assert.equal(id.sha, SHA, 'a known commit is still reported');
  assert.equal(id.dirty, null, 'but cleanliness is unknown, not assumed');
  assert.match(formatIdentity(id), /uncommitted-changes state unknown/);
});

// --- AC-7: the rendered line is never blank and never a bare version ---------------------
test('AC-7: unknown renders as an explicit "Unknown build", never blank', () => {
  assert.equal(formatIdentity(readBuildIdentity(deps())), 'Unknown build');
  assert.equal(formatIdentity(null), 'Unknown build');
  assert.equal(formatIdentity(undefined), 'Unknown build');
});

test('AC-7: a real identity renders version, short sha and build date', () => {
  const line = formatIdentity(readBuildIdentity(deps({ readFile: stampOf(GOOD_STAMP) })));
  assert.match(line, /PCC 0\.1\.0/);
  assert.match(line, /build a1b2c3d/);
  assert.match(line, /built 2026-07-16/);
});

test('AC-7: a dev identity says it is running from source', () => {
  const line = formatIdentity(readBuildIdentity(deps({
    packaged: false,
    runGit: (args) => (args[0] === 'rev-parse' ? { ok: true, out: SHA } : { ok: true, out: '' }),
  })));
  assert.match(line, /running from source/);
  assert.match(line, /build a1b2c3d/);
});

test('AC-7: no rendered identity is ever an empty or whitespace-only string', () => {
  const cases = [
    readBuildIdentity(deps()),
    readBuildIdentity(deps({ readFile: stampOf(GOOD_STAMP) })),
    readBuildIdentity(deps({ packaged: false, runGit: (a) => (a[0] === 'rev-parse' ? { ok: true, out: SHA } : { ok: true, out: '' }) })),
  ];
  for (const id of cases) assert.ok(formatIdentity(id).trim().length > 0);
});

// --- AC-1: the writer records the required fields ----------------------------------------
test('AC-1: buildStamp records version, full sha, UTC ISO-8601 build time and a dirty boolean', () => {
  const s = buildStamp({ version: '0.1.0', sha: SHA.toUpperCase(), dirty: true, now: new Date('2026-07-16T09:30:00Z') });
  assert.equal(s.version, '0.1.0');
  assert.equal(s.sha, SHA, 'sha normalized to lowercase so it compares cleanly against git');
  assert.equal(s.builtAt, '2026-07-16T09:30:00.000Z');
  assert.equal(s.dirty, true);
});

test('AC-1: buildStamp refuses inputs that would produce an unidentifiable build', () => {
  const now = new Date('2026-07-16T09:30:00Z');
  const bad = [
    ['no version', { version: '', sha: SHA, dirty: false, now }],
    ['short sha', { version: '0.1.0', sha: 'deadbeef', dirty: false, now }],
    ['no sha', { version: '0.1.0', sha: undefined, dirty: false, now }],
    ['dirty not boolean', { version: '0.1.0', sha: SHA, dirty: 'no', now }],
    ['bad clock', { version: '0.1.0', sha: SHA, dirty: false, now: new Date('nope') }],
  ];
  for (const [label, f] of bad) assert.throws(() => buildStamp(f), label + ' must throw, not produce a junk stamp');
});

// The writer/reader contract. These two live in different files and could silently drift;
// if they ever did, a packaged app would report "Unknown build" and nobody would learn that
// until an owner was looking at it. This pins them together.
test('AC-1/AC-2: a stamp the writer produces is one the reader ACCEPTS (round trip, no drift)', () => {
  for (const dirty of [false, true]) {
    const stamp = buildStamp({ version: '0.1.0', sha: SHA, dirty: dirty, now: new Date('2026-07-16T09:30:00Z') });
    const id = readBuildIdentity(deps({ readFile: () => JSON.stringify(stamp) }));
    assert.equal(id.status, 'stamped', 'writer output must satisfy the reader (dirty=' + dirty + ')');
    assert.equal(id.sha, SHA);
    assert.equal(id.version, '0.1.0');
    assert.equal(id.dirty, dirty);
    assert.equal(id.builtAt, '2026-07-16T09:30:00.000Z');
  }
});

// --- AC-6: dist cannot package without stamping first ------------------------------------
test('AC-6: npm run dist writes the build stamp BEFORE electron-builder runs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const dist = pkg.scripts && pkg.scripts.dist;
  assert.ok(dist, 'a dist script must exist');
  const stampIdx = dist.indexOf('write-build-info');
  const builderIdx = dist.indexOf('electron-builder');
  assert.ok(stampIdx !== -1, 'dist must invoke the stamp writer, or a packaged app ships with no identity');
  assert.ok(builderIdx !== -1, 'dist must invoke electron-builder');
  assert.ok(stampIdx < builderIdx, 'the stamp must be written BEFORE packaging, or the package captures a stale/absent stamp');
});

test('AC-6: the packaged file set does not exclude the build stamp', () => {
  // build-info.json sits in app/ and is picked up by the "**/*" glob. If an exclusion ever
  // swallowed it, every packaged build would silently report "Unknown build".
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const files = (pkg.build && pkg.build.files) || [];
  const excludesStamp = files.some((f) => typeof f === 'string' && f.startsWith('!') && /build-info/.test(f));
  assert.ok(!excludesStamp, 'build-info.json must not be excluded from the package');
  assert.ok(files.includes('**/*'), 'the stamp relies on the **/* include');
});
