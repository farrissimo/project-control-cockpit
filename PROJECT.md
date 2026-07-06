# PROJECT.md — current project brief

Read this first. Always-current summary so a new session starts fully oriented,
with no re-briefing from the owner.

## What this is
PCC (Project Control Cockpit): a local-first desktop app (Electron) for building
projects WITH LLMs while preventing the usual failure modes — fake completion,
drift, lost context between chats, repeating yourself, and constant babysitting.
#1 rule: reduce owner babysitting. The chat is the interface; verified truth in
files is the source of truth. Direction of record: docs/DECISIONS.md ->
DECISION-102 (supersedes DECISION-087's read-only web dashboard). Full ranked
feature plan and status: docs/COCKPIT_ROADMAP.md.

## Owner
Visionary / product lead, NOT a coder. Plain-language, concise, no cheerleading,
no fake "done", never make him repeat himself. Standing rules are in CLAUDE.md.
Standing orders: keep going by default (stop only when genuinely unsure or at a
real milestone); research the web for existing solutions before building (don't
reinvent the wheel); snapshot (commit) as you go; on every update show the full
roadmap grid with progress, ranked by his priority.

## Architecture
- The app (app/) is a pure consumer of the repo / .cockpit file bridge; it never
  reaches into script internals. Extractability test: delete app/, keep .cockpit
  and scripts, and everything still runs from the CLI.
- Worker = Claude Code, driven via its supported non-interactive mode `claude -p`
  (prompt over stdin, `--continue` keeps context) — NOT by wrapping the
  interactive terminal, so a Claude Code update can't brick it.
- Verifier = Codex CLI `codex exec` (primary); Antigravity CLI `agy` (fallback).
  Mechanical work -> local tools; LLM only for irreducible judgment (token-thrift).

## What's built (branch: feat/cockpit-desktop-app; main untouched)
Launch from the Desktop "PCC Cockpit" shortcut or `npm start --prefix app`:
- Chat wired to Claude (`claude -p`), conversation persists across restarts.
- Left sidebar: Chat / Project / Rules / Memory / Signals / Verify.
- Lifecycle bar (top): "You are here -> Next action -> Decision required", from real state.
- Live trust strip (top, always visible): On the rails / Backed up / Verified / Rules loaded. Each chip is green only when a real deterministic check says so; "Verified" stays amber unless a fresh independent PASS newer than HEAD exists (never faked).
- Lifecycle view: the standardized stage map (define → plan → work → verify → phase-close → milestone → handoff → rollover) from .cockpit/state/lifecycle-model.json, with a "you are here" pin (lifecycle-state.json) and only the LEGAL next steps shown (scripts/lifecycle-status.ps1). Never auto-advances.
- One-click corrections under the chat (Be concise, No cheerleading, Stay in scope, Show evidence, Stop reacting, Copy block).
- Standing rules auto-load from CLAUDE.md; the Rules view shows them.
- Project memory: this PROJECT.md, editable in the Memory view, auto-read each session.
- New-chat handoff: one-click "Generate handoff" in the Project view (scripts/generate-handoff.ps1) builds a ready-to-paste briefing from real repo truth (git state, phase, honest verification status, standing orders) so a fresh chat never needs re-briefing.
- Verify view: Hard checks (git + scripts/doctor.ps1, deterministic, work today) plus independent review (Codex/agy) via scripts/verify-work.ps1.
- Signals view: the DECISION-102 honest-detection system. Shipped detectors: untracked-files (scripts/detect-untracked.ps1, git-only, respects .gitignore), chat-rollover (turns/time/repeats from the app's own chat history), out-of-scope/drift (scripts/detect-drift.ps1, branch changes vs the declared boundary), stale-docs (scripts/detect-stale-docs.ps1, changed code vs a declared doc-freshness rule list), and repo-sync (scripts/detect-repo-sync.ps1, is the work backed up to the remote — uncommitted/untracked/unpushed). Every detector uses the "Observed / what it might mean / what's NOT proven / what to do" format; built to grow (one script + one line in main.js per detector).
- Declared boundaries (so detectors never guess): .cockpit/state/app-build-scope.json (what the app-build lane is allowed to change — drift checks this) and .cockpit/state/doc-freshness-map.json (a small, adjustable "if this code changes, this doc should too" list — stale-docs checks this). Both have plain-language sections; update them deliberately as the work grows. If a boundary is missing, its detector reports "unknown" rather than guessing.
- AGENTS.md: verifier verdict format (PASS/FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE + NOT PROVEN).

## Pending / immediate next tasks
1. VERIFICATION not yet confirmed working. A Windows scheduled task
   "PCC Verify Codex 10am MT" runs `scripts/verify-work.ps1 -WriteFile` at
   10:05 MT on 2026-07-07 and writes the verdict to app/last-verification.txt.
   After it runs, read that file (or use the Verify tab) and confirm a real
   verdict appears. Do NOT claim verification works until a clean run is
   observed.
   - DONE this session (commit d89a174): the fallback no longer calls the
     retired Gemini CLI; it now calls Antigravity `agy -p` with the git diff
     embedded inline (agy ignores stdin). NOT PROVEN: agy as a reliable
     verifier — a real-diff run hung ~13 min and returned nothing. The reliable
     non-interactive agy invocation is still open: a prior handoff note
     suggested `agy --headless --approve`, but those flags are NOT in the
     installed v1.0.10 `agy --help` (which lists `-p/--print`, `--sandbox`,
     `--dangerously-skip-permissions`), so that note is unconfirmed. Codex
     stays the primary verifier; this is parked, not being worked.
2. Continue down docs/COCKPIT_ROADMAP.md by priority. Shipped this session:
   the Signals view + detectors #9 (untracked-files), #8 (chat-rollover), and
   #10 (out-of-scope/drift), #11 (stale-docs), #13 (repo-sync "work backed
   up?"), #14 (live trust strip), and #7 (in-app new-chat handoff generation).
   #12 (agreements-only-in-chat) is deferred: it needs AI judgment, not a
   deterministic script, so it is parked rather than faked with keyword guesses.
   Next candidates: P1 #6 lifecycle state-machine, P1 #5 deeper memory
   carry-forward, then #12 as a small on-demand LLM check when the owner wants it.

## Roadmap status (full list: docs/COCKPIT_ROADMAP.md)
14 done, 4 in motion, 7 planned. All of P1 and P2 is now done or honestly
handled except: P1 verification (#3) awaits the scheduled Codex run, and P1
deeper memory carry-forward (#5) remains. #12 (agreements-only-in-chat) is
deferred (needs AI judgment). Remaining is mostly P3/P4 (extra honest detections,
bootstrap, metrics, multi-project, polish). Every detection ships ONLY in the
"Observed / what it might mean / what's NOT proven / what to do" format —
never a fake certainty.

## Key decisions
- DECISION-102: PCC is a chat-centered local-first desktop app driving Claude
  Code; supersedes DECISION-087 (read-only web dashboard). Keeps 087's
  file-bridge-consumer architecture.
