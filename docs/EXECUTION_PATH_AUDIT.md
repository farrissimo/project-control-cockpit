# PCC Execution / Mutation Path Audit

Source: Task 1 audit, 2026-07-08. Companion to `docs/EXECUTION_AUTHORITY_MODEL.md`
and DECISION-112. Inspection-only findings (git + file reads); no code was run to
produce this.

## Headline finding

`pcc:send` → `askClaude` (`app/main.js`) is the **sole text-to-action path** in PCC:
the only place where free-form pasted text is handed to an action-capable agent. It
spawns `claude -p` with `shell:true`, and that process inherits the machine's global
Claude permissions, so it can run shell, write files, and launch processes. Every
other execution/mutation path is a **discrete owner-clicked IPC** that acts on a
specific control, not on pasted chat text. Authority enforcement therefore belongs
at the chat spawn.

## Path classification

Legend: `[TEXT→ACTION]` pasted text can drive it · `[OWNER-CLICK]` discrete UI action
· `[SHELL]` runs shell · `[PROC]` launches a process/app · `[WRITE]` writes files ·
`[GIT]` commit/push/pull · `[RO]` read-only

| Path (main.js) | Class | What it does |
|---|---|---|
| `pcc:send` → `askClaude` (509, 569) | `[TEXT→ACTION][SHELL][PROC][WRITE]` | Spawns `claude -p` (shell:true). Sole text→action bridge. Inherits global allow. **The control gap.** |
| `pcc:runProduct` (198) | `[OWNER-CLICK][PROC]` | `spawn(cfg.run, shell:true, detached)` — launches the BUILT product's window. |
| `pcc:backup` (628) | `[OWNER-CLICK][GIT]` | `git add -A` + `commit --no-verify` + `push`. |
| `pcc:pull` (660) | `[OWNER-CLICK][GIT]` | `git pull --ff-only`. |
| `pcc:verify` (171) | `[OWNER-CLICK / SCHEDULED][SHELL]` | `pwsh verify-work.ps1` (Codex/agy verifier). |
| `pcc:verifyProduct` (187) | `[OWNER-CLICK][SHELL]` | `pwsh verify-product.ps1`. |
| `pcc:secondOpinion` (574) | `[OWNER-CLICK][SHELL][PROC]` | `pwsh second-opinion.ps1` (Codex). |
| `pcc:lifecycleAdvance` (332) | `[OWNER-CLICK][WRITE]` | `execFile pwsh lifecycle-advance.ps1` (validated arg, no shell; gated by legal transitions + PASS gate). |
| `pcc:setPhaseKind` (216) | `[OWNER-CLICK][WRITE]` | Writes `lifecycle-state.json`. |
| `pcc:saveMemory` (156) | `[OWNER-CLICK][WRITE]` | Writes `PROJECT.md`. |
| `pcc:handoff` (269) | `[OWNER-CLICK][SHELL][RO-output]` | `pwsh generate-handoff.ps1` (produces text). |
| `pcc:hardChecks` (280) | `[OWNER-CLICK][SHELL][RO]` | `git status` + `doctor.ps1`. |
| `pcc:detections` / `lifecycle` / `metrics` / `recentDecisions` (351/326/308/317) | `[SHELL][RO]` | `runDetector` → `pwsh detect-*.ps1 -Json` (read-only). |
| `pcc:syncStatus` (607) | `[RO][GIT-read]` | `git status` / `rev-list`. |
| `pcc:engineStatus` (243) | `[RO]` | File reads only. |

Only the first row is `[TEXT→ACTION]`. Rows 2–15 are owner-clicks; the click itself
is today's only "approval," and none of them read pasted chat text.

## Non-chat automation (needs later verification)

- **Pre-commit hook** (`.githooks/pre-commit`): runs `npm test` (Electron + Playwright)
  on **command-line** commits touching `app/` or `scripts/`. NOT hit by the in-app
  "Back up now" button, which commits with `--no-verify`. (Restored to auto-run in
  b897b43 after the 661ae80 revert.)
- **Scheduled task** "PCC Verify Codex 10am MT" (Ready): runs `verify-work.ps1` daily
  — autonomous execution (does not launch the app). Confirm it is intended and lives
  inside the authority model.
- **Dashboard**: a static dashboard server (python http.server on :8787) and scripts
  `watch-dashboard.ps1` / `generate-dashboard.ps1` / `codex-verify-watcher.ps1` exist.
  Whether any is auto-invoked by PCC vs. started manually is **not traced** (would
  require running commands). Flagged for verification.

## PROVEN

- The chat agent is the only text→action path; all other action paths are discrete
  owner-clicked IPCs (main.js handler review).
- The New Project flow REQUIRES the chat agent to run shell scripts
  (`app/renderer/renderer.js:274-277` tells the chat to run `new-project-intake.ps1`
  and `bootstrap-project.ps1`). So a blanket read-only chat breaks intake/scaffold.
- The pre-661ae80 chat spawn used `--allowedTools "WebSearch WebFetch"
  --disallowedTools "AskUserQuestion"`; `--allowedTools` only ADDS, so the chat could
  invoke everything the global settings allow.
- `~/.claude/settings.json` `permissions.allow` blanket-allows `Bash(*)`,
  `PowerShell(*)`, `Read(*)`, `Edit(*)`, `Write(*)`, `Glob(*)`, `Grep(*)`.
- The in-app "Back up now" commits with `--no-verify`, so the pre-commit hook does
  not fire on normal owner backups.

## NOT PROVEN (open items for Task 2 tests)

- Claude CLI permission precedence as a documented guarantee. Deny-over-allow for
  shell tools was observed at runtime earlier (with `Bash`/`PowerShell` denied, the
  agent could not run either despite the global allow, and asked for approval), but
  it has not been pinned by an automated test or checked against official docs.
- Whether name-based `--disallowedTools` covers all MCP/plugin tools (e.g. the
  enabled `github` plugin). `read_only` likely needs an allowlist-only profile.
- Whether denying shell breaks any CURRENT chat feature OTHER than New Project.
- Whether the dashboard server / watchers are auto-invoked by PCC.

## Open items for Task 2

- Enforce `read_only` at `askClaude` with a restricted profile that overrides global
  settings; automated test proving it cannot run a shell command on this machine.
- Test: pasting a handoff fixture in `read_only` yields a text reply only — no
  process spawned, no file modified.
- Test: content cannot flip mode (a handoff saying "run tests" stays `read_only`).
- Test: `authorized_running` (New Project) can still scaffold — product flow survives.
- Test: authority auto-expires back to `read_only` after a job.
- Verify MCP/plugin tool coverage under the chosen containment mechanism.
