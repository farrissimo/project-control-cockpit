// Restart-continuity: decide whether a chat turn CREATES a worker session (--session-id) or
// RESUMES an existing one (--resume). ADR-0020 T3 restart-continuity fix (Blocker 1).
//
// THE BUG THIS FIXES: the renderer tracked "has this chat had a worker turn yet?" in a
// process-local Set (turnsStarted) that is LOST when the app closes. So after a NORMAL close of a
// COMPLETED chat, reopening PCC and sending the next message made the renderer believe it was a
// brand-new first turn — PCC re-issued `--session-id <id>` for a session Claude had ALREADY created
// on the first turn. Claude Code rejects that at startup with "Session ID ... is already in use"
// (proven: it fires purely because the on-disk session file exists, with NO live process holding
// it), which PCC then mis-surfaced as a scary "worker session is locked — Recover this chat" prompt.
//
// THE FIX: `--session-id` must be used ONLY when the session does not yet exist. The ground truth
// for that is Claude Code's own persisted session file. So when the renderer THINKS a send is a
// first turn, we confirm against disk: if Claude already has this session, RESUME it instead of
// trying to re-create it. Genuine new chats and freshly re-minted recovery sessions (no file yet)
// still create normally, so real interrupted-turn / crash protection is untouched.
//
// SAFETY / NO-COUPLING-RISK: this is a READ-ONLY existence check that returns `false` on ANY error
// (config dir missing/unreadable). A false result falls back to exactly today's behavior (trust the
// renderer's isFirstTurn), so the worst case if Claude ever changes its on-disk layout is "the old
// bug", never a broken send. Session ids are globally-unique UUIDs, so a filename match anywhere
// under projects/ is unambiguous — we never depend on Claude's cwd→folder hashing.

const fs = require('fs');
const path = require('path');
const os = require('os');

// Claude Code's session store root: <config>/projects, honoring CLAUDE_CONFIG_DIR (else ~/.claude).
function claudeProjectsDir(opts) {
  if (opts && opts.projectsDir) return opts.projectsDir;
  const env = process.env.CLAUDE_CONFIG_DIR;
  const base = env && env.trim() ? env.trim() : path.join(os.homedir(), '.claude');
  return path.join(base, 'projects');
}

// True iff Claude Code already has a persisted session file `<sessionId>.jsonl` on disk (so passing
// --session-id would collide with "already in use"). Scans the per-project subfolders; a UUID
// filename match anywhere is definitive. Returns false on any error so the caller degrades to
// today's isFirstTurn behavior — this check can only ADD safety, never break a send.
function workerSessionExists(sessionId, opts) {
  if (!sessionId || typeof sessionId !== 'string') return false;
  const root = claudeProjectsDir(opts);
  const target = sessionId + '.jsonl';
  try {
    const subs = fs.readdirSync(root, { withFileTypes: true });
    for (const d of subs) {
      if (!d.isDirectory()) continue;
      try { if (fs.existsSync(path.join(root, d.name, target))) return true; } catch (e) { /* skip */ }
    }
  } catch (e) { return false; }
  return false;
}

// Pure decision: a turn CREATES a new worker session only when the renderer believes it is the
// chat's first worker turn AND Claude has no existing session by that id. Everything else RESUMES.
// Keeping the renderer's isFirstTurn as the gate means the normal resume path (isFirstTurn=false)
// never pays for a disk scan and is behaviorally unchanged.
function isNewWorkerSession(isFirstTurn, sessionExists) {
  return !!isFirstTurn && !sessionExists;
}

module.exports = { claudeProjectsDir, workerSessionExists, isNewWorkerSession };
