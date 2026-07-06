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
- AGENTS.md: verifier verdict format (PASS/FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE + NOT PROVEN).

## Pending / immediate next tasks
1. VERIFICATION not yet confirmed working. Codex was out of usage until ~10am MT
   on 2026-07-07. A Windows scheduled task "PCC Verify Codex 10am MT" runs
   `scripts/verify-work.ps1 -WriteFile` at 10:05 MT and writes the verdict to
   app/last-verification.txt. After 10am: read that file (or use the Verify tab)
   and confirm a real verdict appears. Do NOT claim verification works until a
   clean run is observed.
2. FIX scripts/verify-work.ps1 fallback: it still calls the RETIRED Gemini CLI
   (`gemini --skip-trust -p`). Gemini CLI was replaced by Antigravity `agy`
   (v1.0.10, at %LOCALAPPDATA%\agy\bin\agy.exe). TESTED finding: a plain
   `agy -p "..."` HANGS (waits for an approval prompt that never renders in a
   non-interactive shell) and gets killed (exit 255). Per Antigravity docs,
   non-interactive runs need `agy --headless` plus an `--approve` policy (or
   `--dangerously-skip-permissions`), and it may need `agy auth login` first
   (interactive; owner must do it). So: ensure auth, then wire the fallback as
   e.g. `agy --headless --approve <policy> -p "<review prompt>"`, and TEST it
   actually returns before trusting it. Codex stays the primary verifier.
3. Continue down docs/COCKPIT_ROADMAP.md by priority.

## Roadmap status (full list: docs/COCKPIT_ROADMAP.md)
6 done, 7 in motion, 12 planned. Next priorities: finish P1 verification (#3),
P1 lifecycle state-machine (#6), P1 deeper memory (#5), then P2 handoff /
rollover / detections. Every detection ships ONLY in the
"Observed / what it might mean / what's NOT proven / what to do" format —
never a fake certainty.

## Key decisions
- DECISION-102: PCC is a chat-centered local-first desktop app driving Claude
  Code; supersedes DECISION-087 (read-only web dashboard). Keeps 087's
  file-bridge-consumer architecture.
