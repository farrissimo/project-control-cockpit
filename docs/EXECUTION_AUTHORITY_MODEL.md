# PCC Execution Authority Model

Status: Accepted direction (DECISION-112, 2026-07-08). Enforcement is Task 2 — this
document defines the model; it does not describe shipped code yet.

## Core law

**Reading context is never authorization to act.**

Pasting a new-chat handoff, asking a status question, asking "what next?", or pasting
a plan/report that contains commands is a READ-ONLY event. A handoff that says "run
the tests" is still read-only unless the owner grants explicit approval through PCC's
own approval path. Text can never arm the worker.

## Why this exists

The PCC chat agent is the only place in the app where free-form pasted text can turn
into real action (see `docs/EXECUTION_PATH_AUDIT.md`). It runs `claude -p`, which
inherits the machine's global Claude permissions. Those blanket-allow shell and file
writes, so a pasted handoff was executed instead of merely read. The fix is to make
the chat **read-only by default** and require explicit, bounded, expiring owner
approval before any execution.

## Authority states

| State | Plain-language label | Allows | Blocks |
|---|---|---|---|
| `read_only` | "Read-only — safe to paste context" | read, summarize, explain, plan, ask questions, web search/fetch, read files | shell, file writes, scaffold, app/test/Playwright launch, git commit/push/pull, lifecycle advance |
| `approval_needed` | "Approval needed — PCC wants to start work" | show the owner a plain-language description of the bounded job; Approve or Cancel | nothing runs yet |
| `authorized_running` | "Authorized work running — background work may execute" | execute/write ONLY inside the approved, bounded envelope | anything outside the approved envelope |
| `completed_needs_review` | "Work complete — review result" | show what ran, proof status, next step | execution (authority has dropped back to `read_only`) |
| `blocked` | "Blocked — work stopped" | show why it stopped (fail/timeout/forbidden action) | execution (dropped back to `read_only` unless recovery is explicitly approved) |

## State transitions

```
read_only ──(worker or button REQUESTS an action)──▶ approval_needed
approval_needed ──(owner Approve)──▶ authorized_running
approval_needed ──(owner Cancel)──▶ read_only
authorized_running ──(job done)──▶ completed_needs_review ──▶ read_only
authorized_running ──(fail / timeout / forbidden action)──▶ blocked ──▶ read_only
```

`read_only` is both the default and the resting state. Every path returns to it.

## Where authority expires

- Authorization is granted per **single bounded job/phase**, never permanently.
- It expires automatically on completion, failure, timeout, or a forbidden action.
- A new chat, or a newly pasted handoff, is always `read_only`.
- There is **no permanent write-approved chat**.
- There is **no per-command babysitting** — approval is at the job level, not per
  shell call.

## Enforcement points (Task 2)

- **Check** authority at the chat spawn (`askClaude` in `app/main.js`): `read_only`
  uses a restricted spawn profile; `authorized_running` uses a bounded build profile.
  This is the single text-to-action choke point, so it is the primary gate.
- **Display** a persistent mode badge in the chat UI. A handoff paste must never
  change the mode.
- **Expire** authority when the job ends; never sticky.

## Owner-visible logging expectations

For proof and trust, PCC must log (and surface):

- each approval — what was approved, its scope, and the time;
- each execution the worker performs while `authorized_running`;
- every drop-back to `read_only` / `blocked`, with the reason.

## Global Claude settings containment

`read_only` must hold even though the machine's global settings
(`~/.claude/settings.json`) blanket-allow `Bash(*)`, `PowerShell(*)`, `Edit`, and
`Write`. PCC enforces this from its own spawn, not by editing the owner's global
config:

- Use an explicit **deny list** (`--disallowedTools`) covering execution/mutation
  tools; deny overrides allow.
- Prefer, or add, an **allowlist-only profile** (e.g. a dedicated `--settings`
  file) so newly added or MCP/plugin tools cannot leak into `read_only`.

Deny-over-allow for shell tools was observed to work in practice; Task 2 pins it
with an automated test. MCP/plugin tool coverage is NOT yet proven (see the audit).

## Scope note

This document is the model. The state machine, the UI badge, and the mode-aware
spawn are implemented in **Task 2**, not here.
