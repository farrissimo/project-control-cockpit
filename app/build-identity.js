// Build identity — "which build of PCC is this?"
//
// The app could not answer that question. The version string was hardcoded in
// package.json, never surfaced, and never bound to a commit — so telling a 3-day-old
// install from a fresh one meant grepping the packaged binary by hand. For an app whose
// whole premise is that its self-report can be trusted, that is a hole.
//
// Two sources, in priority order:
//   1. A build stamp (app/build-info.json) written at package time by tools/write-build-info.js.
//      This is the ONLY source a packaged app has — there is no .git inside the package.
//   2. Live git, when running from a dev checkout.
//
// Fail-closed rule (spec AC-4): if neither source yields a real identity, this reports
// `unknown` and carries NO version and NO sha. It must never fall back to package.json's
// version alone — a bare "0.1.0" LOOKS like an answer while proving nothing about which
// code is running, which is exactly the fake-green this repo exists to kill.
//
// Pure + dependency-injected so it is unit-testable without Electron or a real repo.
// Spec: docs/specs/build-identity.md

const SHA_RE = /^[0-9a-f]{40}$/i;

// An identity is only real if it names a specific commit. Anything short of that is unknown.
function unknown(reason) {
  return { status: 'unknown', version: null, sha: null, shortSha: null, builtAt: null, dirty: null, source: null, reason: reason };
}

function isIso8601(s) {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
}

// Validate a parsed stamp. A malformed stamp is treated as NO stamp (not as a partial
// answer) — half an identity is not an identity.
function validateStamp(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.version !== 'string' || !raw.version) return null;
  if (typeof raw.sha !== 'string' || !SHA_RE.test(raw.sha)) return null;
  if (!isIso8601(raw.builtAt)) return null;
  if (typeof raw.dirty !== 'boolean') return null;
  return {
    version: raw.version,
    sha: raw.sha.toLowerCase(),
    shortSha: raw.sha.toLowerCase().slice(0, 7),
    builtAt: raw.builtAt,
    dirty: raw.dirty,
  };
}

/**
 * Resolve this build's identity.
 *
 * @param {object} deps
 * @param {boolean} deps.packaged   true when running from a packaged app (no .git available)
 * @param {string}  deps.stampPath  path to build-info.json
 * @param {function(string): (string|null)} deps.readFile  returns file text, or null if unreadable
 * @param {function(string[]): ({ok: boolean, out: string})} deps.runGit  runs git in the repo, never throws
 * @param {string=} deps.version    package version, used ONLY to enrich a git-derived identity
 * @returns {object} identity
 */
function readBuildIdentity(deps) {
  const d = deps || {};

  // 1. The stamp. Authoritative when present and valid — it is what a packaged app ships.
  let stampText = null;
  try { stampText = typeof d.readFile === 'function' ? d.readFile(d.stampPath) : null; }
  catch (e) { stampText = null; } // an unreadable stamp is a missing stamp, never a throw

  if (typeof stampText === 'string' && stampText.trim()) {
    let parsed = null;
    try { parsed = JSON.parse(stampText); } catch (e) { parsed = null; }
    const stamp = validateStamp(parsed);
    if (stamp) return Object.assign({ status: 'stamped', source: 'stamp', reason: null }, stamp);
    // Malformed stamp: fall through to git. In a PACKAGED app there is no git, so this
    // correctly lands on unknown rather than inventing a value.
  }

  // 2. Live git — the dev-checkout path (spec AC-3). A packaged app has no repo, so this
  // is skipped there and the absence of a valid stamp becomes an honest unknown.
  if (!d.packaged && typeof d.runGit === 'function') {
    let head = null;
    try { head = d.runGit(['rev-parse', 'HEAD']); } catch (e) { head = null; }
    if (head && head.ok && SHA_RE.test((head.out || '').trim())) {
      const sha = head.out.trim().toLowerCase();
      // Dirty state is a separate question, and a failure to answer it is NOT a reason to
      // discard a known SHA — but it must not be reported as clean either.
      let dirty = null;
      try {
        const st = d.runGit(['status', '--porcelain']);
        if (st && st.ok) dirty = st.out.trim().length > 0;
      } catch (e) { dirty = null; }
      return {
        status: 'dev',
        version: typeof d.version === 'string' && d.version ? d.version : null,
        sha: sha,
        shortSha: sha.slice(0, 7),
        builtAt: null, // a dev run isn't "built" at a point in time; claiming one would be a lie
        dirty: dirty,
        source: 'git',
        reason: null,
      };
    }
  }

  if (d.packaged) return unknown('This packaged build carries no valid build stamp, so the exact code it was built from cannot be identified.');
  return unknown('Not a packaged build, and git could not identify the current commit.');
}

/**
 * One-line, owner-readable identity. Never blank, never a bare version (spec AC-7):
 * if we do not know, it says so in words.
 */
function formatIdentity(id) {
  if (!id || id.status === 'unknown') return 'Unknown build';
  const bits = [];
  if (id.version) bits.push('PCC ' + id.version);
  if (id.shortSha) bits.push('build ' + id.shortSha);
  if (id.builtAt) {
    const t = new Date(id.builtAt);
    if (!Number.isNaN(t.getTime())) bits.push('built ' + t.toISOString().slice(0, 10));
  }
  if (id.status === 'dev') bits.push('running from source');
  if (id.dirty === true) bits.push('UNCOMMITTED CHANGES — not identifiable by commit');
  else if (id.dirty === null && id.status !== 'unknown') bits.push('uncommitted-changes state unknown');
  return bits.join(' · ');
}

module.exports = { readBuildIdentity, formatIdentity };
