// atomic-store.js — main-process-only durable write primitive (PCC data-truth
// recovery, Phase 2A slice 1). Pure Node (fs/path only): NO Electron, NO app
// state, NO project knowledge — so it is unit-testable against a throwaway temp
// dir and can never touch a real project.
//
// WHY THIS EXISTS: the chat-corruption crisis was caused by non-atomic writes —
// a process killed mid-write, or a partial payload, left the on-disk file
// truncated or overwritten with less than it had before. This primitive makes
// every write all-or-nothing and always keeps the immediately-prior generation,
// so a bad write can never destroy the last good one.
//
// Contract:
//   writeJsonAtomic(file, data):
//     1. serialize + round-trip validate (a value that can't serialize/parse is
//        REJECTED before anything on disk is touched);
//     2. write to a unique temp file in the SAME directory (same volume, so the
//        final rename is atomic);
//     3. fsync the temp file (durability);
//     4. if the target already exists, copy it to `<file>.prev` (retained prior
//        generation) BEFORE replacing;
//     5. atomically rename temp -> target.
//   A failure in steps 1-3 leaves the existing target completely untouched.
//
//   readJson(file): { ok:true, data } | { ok:false, missing:true } |
//                   { ok:false, error } — never throws.

const fs = require('fs');
const path = require('path');

function readJson(file) {
  if (!fs.existsSync(file)) return { ok: false, missing: true };
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { return { ok: false, error: 'read_failed: ' + e.message }; }
  try { return { ok: true, data: JSON.parse(raw) }; }
  catch (e) { return { ok: false, error: 'parse_failed: ' + e.message }; }
}

// Read the retained prior generation (`<file>.prev`), if any. Used by recovery
// paths that need to fall back when the current file is unreadable.
function readPrevJson(file) { return readJson(file + '.prev'); }

function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);

  // Step 1 — serialize + validate round-trip BEFORE touching disk. A circular
  // or otherwise unserializable value must never get the chance to clobber a
  // good file.
  let json;
  try { json = JSON.stringify(data, null, 2); }
  catch (e) { return { ok: false, error: 'serialize_failed: ' + e.message }; }
  if (typeof json !== 'string') return { ok: false, error: 'serialize_failed: undefined' };
  try { JSON.parse(json); }
  catch (e) { return { ok: false, error: 'validate_failed: ' + e.message }; }

  try { fs.mkdirSync(dir, { recursive: true }); }
  catch (e) { return { ok: false, error: 'mkdir_failed: ' + e.message }; }

  // Step 2/3 — write temp in the same dir, fsync for durability.
  const tmp = path.join(dir, '.' + path.basename(file) + '.tmp-' + process.pid + '-' + Date.now());
  try {
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, json, null, 'utf8');
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) { /* best-effort cleanup */ }
    return { ok: false, error: 'temp_write_failed: ' + e.message };
  }

  // Step 4 — retain the prior generation before replacing.
  if (fs.existsSync(file)) {
    try { fs.copyFileSync(file, file + '.prev'); }
    catch (e) { /* prior-gen retention is best-effort; do not block the write */ }
  }

  // Step 5 — atomic replace.
  try { fs.renameSync(tmp, file); }
  catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) { /* cleanup */ }
    return { ok: false, error: 'rename_failed: ' + e.message };
  }
  return { ok: true };
}

module.exports = { readJson, readPrevJson, writeJsonAtomic };
