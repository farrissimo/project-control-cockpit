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
Visionary / product lead, NOT a coder or an engineer. Plain-language, concise, no cheerleading,
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
- Chat wired to Claude (`claude -p`), conversation persists across restarts. Chat history: many named chats ("Chats" panel — switch/rename/delete), each pinned to its own Claude session id so switching resumes the right thread and no background claude call can hijack it. Model switcher (default Sonnet 5, editable list in .cockpit/state/models.json, auto-fallback so a retired model never crashes the chat) + "New chat" (clean start). Quick buttons add to your message (send once). Copy blocks render with a Copy button. Uses the claude.ai login, not a paid API key (DECISION-003).
- Left sidebar: Chat / Project / Rules / Memory / Lifecycle / Signals / Verify.
- Chat renders copy blocks (fenced ``` code) with a working Copy button; the worker is told it's a text-only channel (no interactive AskUserQuestion picker) and not to narrate tool failures.
- Lifecycle bar (top): "You are here -> Next action -> Decision required", from real state.
- Live trust strip (top, always visible): On the rails / Backed up / Verified / Rules loaded. Each chip is green only when a real deterministic check says so; "Verified" stays amber unless a fresh independent PASS newer than HEAD exists (never faked).
- Lifecycle view: the standardized stage map (define → plan → work → verify → phase-close → milestone → handoff → rollover) from .cockpit/state/lifecycle-model.json, with a "you are here" pin (lifecycle-state.json) and only the LEGAL next steps shown (scripts/lifecycle-status.ps1). Never auto-advances.
- One-click corrections under the chat (Be concise, No cheerleading, Stay in scope, Show evidence, Stop reacting, Push back, Check prior art, Rabbit-hole check, Capture decisions, Copy block).
- Standing rules auto-load from CLAUDE.md; the Rules view shows them.
- Project memory: this PROJECT.md, editable in the Memory view, auto-read each session. Plus recent-decisions carry-forward — the Project view surfaces the latest agreements from docs/DECISIONS.md (scripts/recent-decisions.ps1), and the handoff embeds the 3 most recent, so settled decisions are never re-derived.
- New-chat handoff: one-click "Generate handoff" in the Project view (scripts/generate-handoff.ps1) builds a ready-to-paste briefing from real repo truth (git state, phase, honest verification status, standing orders) so a fresh chat never needs re-briefing.
- Verify view: Hard checks (git + scripts/doctor.ps1, deterministic, work today) plus independent review (Codex/agy) via scripts/verify-work.ps1.
- Signals view: the DECISION-102 honest-detection system. Shipped detectors: untracked-files (scripts/detect-untracked.ps1, git-only, respects .gitignore), chat-rollover (turns/time/repeats from the app's own chat history), out-of-scope/drift (scripts/detect-drift.ps1, branch changes vs the declared boundary), stale-docs (scripts/detect-stale-docs.ps1, changed code vs a declared doc-freshness rule list), and repo-sync (scripts/detect-repo-sync.ps1, is the work backed up to the remote — uncommitted/untracked/unpushed). Every detector uses the "Observed / what it might mean / what's NOT proven / what to do" format; built to grow (one script + one line in main.js per detector).
- Declared boundaries (so detectors never guess): .cockpit/state/app-build-scope.json (what the app-build lane is allowed to change — drift checks this) and .cockpit/state/doc-freshness-map.json (a small, adjustable "if this code changes, this doc should too" list — stale-docs checks this). Both have plain-language sections; update them deliberately as the work grows. If a boundary is missing, its detector reports "unknown" rather than guessing.
- AGENTS.md: verifier verdict format (PASS/FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE + NOT PROVEN).

## Pending / immediate next tasks
1. VERIFICATION (#3): self-resolving. A Windows scheduled task "PCC Verify
   Codex 10am MT" runs `scripts/verify-work.ps1 -WriteFile` at 10:05 MT on
   2026-07-07 and writes the verdict to app/last-verification.txt. After it
   runs, read that file (or use the Verify tab) and confirm a real verdict
   appears — do NOT claim verification works until then. Fallback (agy) is
   wired but NOT PROVEN reliable (a real-diff run hung ~13 min); Codex stays
   primary and this is parked, not being worked.
2. No other task is required right now. #20 (multi-project switching) is
   PAUSED by owner choice (creating projects works; switching the app between
   them does not — a real architectural change, deliberately deferred). #12
   (agreements-only-in-chat) is deferred (needs AI judgment, not a script).
   #21 (peek under the hood) and #23 (UI polish) are optional and unstarted.
   Everything else in P1/P2/P3 is done. Next real work is the owner's call.

## Roadmap status (full list: docs/COCKPIT_ROADMAP.md)
All of P1/P2/P3 done or honestly handled. Also shipped (owner feedback while
dogfooding): chat history + rename (#27), apply-and-send quick buttons (#28),
copy blocks + no tool-failure narration (#29), model switcher + fallback,
conversation-hijack fix (per-chat session ids), mandatory backup policy.
NEW PROJECT creation is done (#20 pt1): chat-first guided intake (reuses CCB
wizard logic) + blueprint scaffold + "New project…" button.
#12 (agreements-only-in-chat) is now DONE: "Capture decisions" button grounds
itself in this chat's own literal, persisted transcript (never Claude's own
memory) and proposes quoted candidates for owner confirmation before writing to
docs/DECISIONS.md. Honest limit: only sees this one chat's history.

Open / deferred:
- #3 verification — awaits the scheduled Codex run (2026-07-07 10:05 MT).
- #20 multi-project SWITCHING — PAUSED by owner (real architectural change; one
  project today). Creating new projects works; switching the app between them does not.
- #21 peek-under-the-hood, #23 UI polish — optional, not started.
Every detection ships ONLY in the "Observed / what it might mean / what's NOT
proven / what to do" format — never a fake certainty.

## Key decisions
- DECISION-102: PCC is a chat-centered local-first desktop app driving Claude
  Code; supersedes DECISION-087 (read-only web dashboard). Keeps 087's
  file-bridge-consumer architecture.
