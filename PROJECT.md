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
- Left sidebar: Chat / Project / Rules / Memory / Verify.
- Lifecycle bar (top): "You are here -> Next action -> Decision required", from real state.
- One-click corrections under the chat (Be concise, No cheerleading, Stay in scope, Show evidence, Stop reacting, Copy block).
- Standing rules auto-load from CLAUDE.md; the Rules view shows them.
- Project memory: this PROJECT.md, editable in the Memory view, auto-read each session.
- Verify view: Hard checks (git + scripts/doctor.ps1, deterministic, work today) plus independent review (Codex/agy) via scripts/verify-work.ps1.
- Signals view: the DECISION-102 honest-detection system. Shipped detectors: untracked-files (scripts/detect-untracked.ps1, deterministic, git-only, respects .gitignore) and chat-rollover (turns/time/repeats from the app's own chat history). Every detector uses the "Observed / what it might mean / what's NOT proven / what to do" format; built to grow (one script + one line in main.js per detector).
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
   the Signals view + detectors #9 (untracked-files) and #8 (chat-rollover).
   Next: #10 out-of-scope/drift, #11 stale-docs, #12 agreements-to-truth.

## Roadmap status (full list: docs/COCKPIT_ROADMAP.md)
8 done, 7 in motion, 10 planned. Next priorities: finish P1 verification (#3,
awaiting the scheduled run), P1 lifecycle state-machine (#6), P1 deeper memory
(#5), then more P2 detectors (#10 drift, #11 stale-docs, #12 agreements). Every
detection ships ONLY in the
"Observed / what it might mean / what's NOT proven / what to do" format —
never a fake certainty.

## Key decisions
- DECISION-102: PCC is a chat-centered local-first desktop app driving Claude
  Code; supersedes DECISION-087 (read-only web dashboard). Keeps 087's
  file-bridge-consumer architecture.
