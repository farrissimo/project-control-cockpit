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

  // If a canonical store already exists (or a recoverable prior generation),
  // never re-migrate or overwrite it.
  const existing = cs.readStore(chatsFile);
  if (!existing.ok) return { ok: false, error: existing.error };
  if (existing.store) return { ok: true, already: true, revision: existing.store.revision };

  // Stable project identity (fails closed on project-id conflict).
  const pid = cs.resolveProjectId(projectDir, { now });
  if (!pid.ok) return { ok: false, error: pid.error };

  // backup.json is optional, but a PRESENT-yet-corrupt/malformed one fails closed
  // rather than being ignored (that would silently drop the disk safety net).
  let backupChats = [];
  if (typeof backupFile === 'string' && backupFile) {
    const b = atomic.readJson(backupFile);
    if (b.ok) {
      if (b.data && Array.isArray(b.data.chats)) backupChats = b.data.chats;
      else if (b.data && b.data.chats !== undefined) return { ok: false, error: 'backup_malformed' };
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
