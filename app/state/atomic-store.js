// atomic-store.js — main-process-only durable write primitive (PCC data-truth
// recovery, Phase 2A slice 1). Pure Node (fs/path only): NO Electron, NO app
// state, NO project knowledge — so it is unit-testable against a throwaway temp
// dir and can never touch a real project.
//
// WHY THIS EXISTS: the chat-corruption crisis was caused by non-atomic writes —
// a process killed mid-write, or a partial payload, left the on-disk file
// truncated or overwritten with less than it had before. This primitive makes
// every write all-or-nothing and always keeps the immediately-prior GOOD
// generation, so a bad write can never destroy the last good one.
//
// SINGLE-WRITER CONTRACT (how concurrency is handled): this primitive guarantees
// per-CALL atomicity, not cross-writer serialization. It is safe because it is
// used by exactly one writer:
//   - WITHIN a process: writeJsonAtomic is fully synchronous (all fs.*Sync, no
//     await/callbacks), so two calls can never interleave.
//   - ACROSS processes: PCC runs a single instance — main.js takes Electron's
//     requestSingleInstanceLock, so only one app process ever writes the store.
//   - Optimistic-concurrency (revision CAS) that rejects a stale caller lives one
//     layer up, in the chat-store (Phase 2A slice 2), where it belongs.
// A cross-process advisory lock was deliberately NOT added here: a correct one
// needs ownership tokens + steal-safety and is its own concern, not the job of a
// durability primitive (a naive steal-based lock reintroduces races).
//
// DURABILITY SCOPE (honest): this protects against INTERRUPTED and PARTIAL writes
// and process kills — the target is only ever replaced by an atomic rename of a
// fully-written (short writes looped to completion), fsync'd temp file. Directory
// metadata is flushed where the platform supports it (best-effort; directory
// fsync is unavailable on Windows). This is NOT an absolute power-loss durability
// guarantee on every filesystem/OS.
//
// ORDERING (prev-first, so a success return is honest):
//   1. Reject the payload before touching disk if it can't serialize/parse.
//   2. Stage the NEW content in a temp file (same dir/volume), fsync'd.
//   3. If the current target exists, read its bytes ONCE. If those exact bytes are
//      valid JSON they are staged and installed to `<file>.prev` ATOMICALLY,
//      BEFORE the target is replaced. If a valid current cannot be preserved the
//      write is REJECTED (current + existing `.prev` untouched). If the current is
//      readable-but-corrupt, `.prev` is left alone (never clobbered with garbage).
//      If the current EXISTS but cannot be read at all, the write FAILS CLOSED
//      (we will not overwrite a possibly-valid, momentarily-unreadable file).
//   4. Install the new target by atomic rename — the LAST mutating step, so a
//      success return means BOTH the new target and the prior generation are in
//      place.
//   Every handled failure cleans up its temp files.
//
// KNOWN RESIDUAL (documented, not data loss): if the FINAL target rename fails
// after `.prev` was rotated, the current target is left intact and `.prev` holds
// a valid copy of that same current data. No committed generation is lost; `.prev`
// simply equals the current target until the next successful write. `ok:false` is
// returned — never a false success.
//
//   readJson(file) / readPrevJson(file):
//     { ok:true, data } | { ok:false, missing:true } | { ok:false, error } —
//     never throws.

const fs = require('fs');
const path = require('path');

let _tmpseq = 0;
function _uniqueTmp(dir, base, tag) {
  _tmpseq += 1;
  return path.join(dir, '.' + base + '.' + tag + '-' + process.pid + '-' + Date.now() + '-' + _tmpseq);
}

function _cleanup(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) { /* best-effort */ }
}

// Write the FULL buffer to `tmp` and fsync it. writeSync may perform a short write
// (it returns the byte count actually written), so loop until every byte is on
// disk — otherwise a truncated temp could be renamed over the target. Throws on
// failure so the caller can clean up and reject.
function _writeFsync(tmp, buf) {
  const fd = fs.openSync(tmp, 'w');
  try {
    let off = 0;
    while (off < buf.length) {
      const n = fs.writeSync(fd, buf, off, buf.length - off);
      if (n <= 0) throw new Error('writeSync made no progress at offset ' + off);
      off += n;
    }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

// Best-effort directory-metadata flush. Not supported for directories on Windows
// (EPERM/EISDIR) — swallow. See the DURABILITY SCOPE note above.
function _fsyncDir(dir) {
  let dfd;
  try { dfd = fs.openSync(dir, 'r'); fs.fsyncSync(dfd); }
  catch (_) { /* directory fsync unavailable on this platform */ }
  finally { if (dfd !== undefined) { try { fs.closeSync(dfd); } catch (_) {} } }
}

function readJson(file) {
  if (!fs.existsSync(file)) return { ok: false, missing: true };
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) { return { ok: false, error: 'read_failed: ' + e.message }; }
  try { return { ok: true, data: JSON.parse(raw) }; }
  catch (e) { return { ok: false, error: 'parse_failed: ' + e.message }; }
}

// Read the retained prior generation (`<file>.prev`), if any.
function readPrevJson(file) { return readJson(file + '.prev'); }

function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);
  const base = path.basename(file);

  // 1. Serialize + round-trip validate the NEW payload before touching disk.
  let json;
  try { json = JSON.stringify(data, null, 2); }
  catch (e) { return { ok: false, error: 'serialize_failed: ' + e.message }; }
  if (typeof json !== 'string') return { ok: false, error: 'serialize_failed: value is undefined' };
  try { JSON.parse(json); }
  catch (e) { return { ok: false, error: 'validate_failed: ' + e.message }; }
  const buf = Buffer.from(json, 'utf8');

  try { fs.mkdirSync(dir, { recursive: true }); }
  catch (e) { return { ok: false, error: 'mkdir_failed: ' + e.message }; }

  // 2. Stage the new target in its own temp. Touches nothing that already exists,
  //    so a failure here leaves the current target and `.prev` untouched.
  const targetTmp = _uniqueTmp(dir, base, 'new');
  try { _writeFsync(targetTmp, buf); }
  catch (e) { _cleanup(targetTmp); return { ok: false, error: 'temp_write_failed: ' + e.message }; }

  // 3. Preserve the prior generation BEFORE the target is replaced. Read the
  //    current bytes exactly ONCE and validate THOSE bytes (no read-then-reread
  //    race): the same snapshot we validate is the one we stage.
  if (fs.existsSync(file)) {
    let curRaw;
    try { curRaw = fs.readFileSync(file); }
    catch (e) {
      // The current target EXISTS but cannot be read — it may be valid but
      // transiently locked. We cannot prove it is safe to overwrite, so FAIL
      // CLOSED rather than risk losing an unpreservable good generation.
      _cleanup(targetTmp);
      return { ok: false, error: 'prev_preserve_failed: current unreadable: ' + e.message };
    }
    let curValid = false;
    try { JSON.parse(curRaw.toString('utf8')); curValid = true; } catch (_) { curValid = false; }
    if (curValid) {
      // A readable, VALID current MUST be preserved: stage + atomic install to
      // `.prev`, or REJECT the whole write (current target + existing `.prev`
      // left untouched — rename is all-or-nothing).
      const prevTmp = _uniqueTmp(dir, base, 'prev');
      try { _writeFsync(prevTmp, curRaw); }
      catch (e) { _cleanup(prevTmp); _cleanup(targetTmp); return { ok: false, error: 'prev_preserve_failed: ' + e.message }; }
      try { fs.renameSync(prevTmp, file + '.prev'); }
      catch (e) { _cleanup(prevTmp); _cleanup(targetTmp); return { ok: false, error: 'prev_install_failed: ' + e.message }; }
    }
    // else: readable but INVALID JSON (corrupt) — keep the existing good `.prev`
    // (never clobber it) and let the new valid target replace the corrupt current.
  }

  // 4. Install the new target atomically — the LAST mutating step. Success here
  //    means the prior generation is already safely in `.prev`. On failure the
  //    current target is left intact (see KNOWN RESIDUAL in the header); we never
  //    report success.
  try { fs.renameSync(targetTmp, file); }
  catch (e) { _cleanup(targetTmp); return { ok: false, error: 'rename_failed: ' + e.message }; }

  _fsyncDir(dir);
  return { ok: true };
}

module.exports = { readJson, readPrevJson, writeJsonAtomic };
