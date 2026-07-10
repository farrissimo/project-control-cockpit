// chat-bootstrap.js — the ONE main-owned path that may create the canonical
// chats.json (PCC data-truth recovery, Phase 2A slice 4). Pure Node (fs via
// atomic-store); takes explicit paths so it is unit-testable against throwaway
// dirs and never touches production data.
//
// HARD RULES:
//   - chats.json is NEVER created without an EXPLICIT, untouched legacy
//     localStorage snapshot (an array) handed in by the caller. No snapshot ->
//     { ok:false, error:'snapshot_required' } and NOTHING is written.
//   - If a canonical store already exists, bootstrap is a no-op (already:true) —
//     it never re-migrates or overwrites an existing store.
//   - Migration is FAIL CLOSED: any conflict/malformation in the snapshot or
//     backup.json returns the failure and writes NO store (both sources preserved).
//   - This is the ONLY whole-store write; ongoing changes go through the
//     command-shaped chat-store mutations, never a whole-store replace.

const cs = require('./chat-store');
const mig = require('./chat-migrate');
const atomic = require('./atomic-store');

function bootstrapCanonical(opts) {
  opts = opts || {};
  const chatsFile = opts.chatsFile;
  const backupFile = opts.backupFile;
  const projectDir = opts.projectDir;
  const legacySnapshot = opts.legacySnapshot;
  const now = (typeof opts.now === 'number') ? opts.now : Date.now();

  if (typeof chatsFile !== 'string' || !chatsFile) return { ok: false, error: 'chats_file_required' };
  // Do NOT create chats.json without the untouched legacy snapshot.
  if (!Array.isArray(legacySnapshot)) return { ok: false, error: 'snapshot_required' };

  // Stable project identity FIRST (fails closed on project-id conflict), so an
  // existing store can be verified against the active project before we trust it.
  const pid = cs.resolveProjectId(projectDir, { now });
  if (!pid.ok) return { ok: false, error: pid.error };

  // If a canonical store already exists (or a recoverable prior generation), never
  // re-migrate or overwrite it — but it MUST belong to the active project. A
  // foreign-project chats.json is rejected, never accepted as already:true.
  const existing = cs.readStore(chatsFile);
  if (!existing.ok) return { ok: false, error: existing.error };
  if (existing.store) {
    if (existing.store.projectId !== pid.projectId) {
      return { ok: false, error: 'project_mismatch', storeProjectId: existing.store.projectId, activeProjectId: pid.projectId };
    }
    return { ok: true, already: true, revision: existing.store.revision, projectId: pid.projectId };
  }

  // backup.json is optional (a MISSING one is a legitimate empty source), but a
  // PRESENT one must be a valid legacy envelope: a non-array object with an array
  // `chats`. Anything else ({}, null, [], "x", {savedAt:123}, {chats:null}) is
  // malformed and fails closed — it is NOT silently treated as an empty backup.
  let backupChats = [];
  if (typeof backupFile === 'string' && backupFile) {
    const b = atomic.readJson(backupFile);
    if (b.ok) {
      const d = b.data;
      if (d === null || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.chats)) {
        return { ok: false, error: 'backup_malformed' };
      }
      backupChats = d.chats;
    } else if (!b.missing) {
      return { ok: false, error: 'backup_unreadable: ' + b.error };
    }
  }

  // Fail-closed structural reconcile -> canonical store (or no store at all).
  const plan = mig.planMigration({ localChats: legacySnapshot, backupChats, projectId: pid.projectId, now });
  if (!plan.ok) return plan; // conflict/malformation -> NO chats.json written

  const w = atomic.writeJsonAtomic(chatsFile, plan.store);
  if (!w.ok) return { ok: false, error: 'write_failed: ' + w.error };
  return { ok: true, created: true, revision: plan.store.revision, projectId: pid.projectId, provenance: plan.provenance };
}

module.exports = { bootstrapCanonical };
