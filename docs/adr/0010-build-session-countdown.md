---
status: Proposed
date: 2026-07-20
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0010: Build-session countdown + activity-based idle renewal (DECISION-112 refinement)

## Context and Problem

Command-execution ("build") authority is granted per chat and bounded by two deadlines
(`authority-store.js`): a **30-minute idle window** (renewed on an owner send) and an absolute
**2-hour hard cap** that never extends. The bound is correct and deliberate — it is what makes
autonomous command execution safe. But it was **invisible and silent**:

1. The authority state exposed only `{mode, label, job}` — **no deadlines** — so the UI literally
   could not show time remaining.
2. When either deadline passed, command access simply **disappeared mid-work with no warning**.
   During a long CI wait or a long working turn the owner repeatedly lost tools with no signal and
   no idea why ("what is going on / work randomly stopped"). This was the single largest source of
   babysitting in the 2026-07-20 session.
3. The idle window renewed only on an **owner send**, not on the worker's own activity — so a
   single long working turn could idle out even while actively working.

The failure mode is a trust/usability defect, not a safety hole: expiry is a safety feature, but
**silent** expiry maximizes babysitting (the #1 thing PCC exists to reduce).

## Decision

Refine — do **not** weaken — the DECISION-112 bound:

1. **Expose the deadlines.** `authority.stateFor` and `main.authoritySnapshot` carry
   `idleExpiresAt` / `hardExpiresAt` when authorized (read-only display data; absent when
   read_only). Exposing the times cannot grant or extend authority.
2. **Make the timer visible.** The chat-header authority badge shows a live
   `Build session — <time> left` countdown, turns urgent under 5 minutes, and on expiry shows
   `Build session expired — re-enable to continue` instead of tools vanishing silently.
3. **Renew idle on worker ACTIVITY.** A new `touchActivity(chatId, now)` slides the idle window
   for an **already-authorized** chat, heartbeated by the renderer while a turn is in flight. It
   is safety-preserving by construction: it can **never grant** authority (a read_only or pending
   chat is a no-op) and **never extends past the hard cap** (checked first). An actively-working
   long turn therefore tracks the fixed 2-hour ceiling and never idles out mid-task.
4. **The 2-hour absolute hard cap is unchanged.** It still ends every session on schedule
   regardless of activity. No deadline value was altered.

## Consequences

- **Gain:** the bound is legible — the owner sees exactly how much time is left and gets a warning
  before it ends, so a session never expires as a silent surprise; a long working turn no longer
  idles out. Directly reduces babysitting.
- **Cost:** a per-second renderer interval while authorized (cheap; cleared when not) and a small
  activity IPC. One new bridge channel (`touchActivity`), exact-channel-listed.
- **Honest residue:** the timer is UI over a main-owned source of truth; if the renderer is wrong
  the *display* could mislead, but authority itself is still enforced only by the store + spawn
  profile (the badge never sets authority). The hard cap remains the real safety guarantee.

## Confirmation

Proven before merge, suite stays green:
- Unit (`authority-store.spec.js`, injectable clock): deadlines exposed when authorized / absent
  otherwise; `touchActivity` renews an authorized idle window, is a no-op that never grants for
  read_only/pending, is chat-scoped, and never beats the 2-hour hard cap under relentless activity.
- E2E (`authority.spec.js`, real app): an approved session's state carries finite deadlines (hard
  cap beyond idle); the header badge renders the live `Build session — … left` countdown, not the
  read-only label.
- Contract (`ipc.spec.js`): the exact-channels list includes `touchActivity`; lint clean.
- Full-suite CI green on the exact commit before merge.

## Engagement

- **Owner:** sees the countdown + warning and re-enables when he chooses; sets the intent.
- **Claude worker:** implements the store/main/preload/renderer changes and the tests.
- **Codex verifier:** diff-reviews the change (static + lint + doctor; it cannot launch Electron).
- **Security-model note:** this touches the execution-authority model, so it is flagged for owner
  awareness. It is designed to preserve every DECISION-112 invariant (read_only default, no
  self-authorization, sliding idle + absolute hard cap, per-chat isolation) — the store's existing
  invariant tests still pass unchanged. If the owner wants the GPT secondary check (ADR-0009
  trigger #2, "touches the security model"), it applies; the worker's read is that the invariants
  are preserved, not altered.
- **Spawned projects:** inherit this via the scaffolder like the rest of the authority machinery
  (DECISION-113 parity).

## Supersedes / Related

Refines DECISION-112 (execution authority) and `app/authority-store.js`. Related:
`docs/specs/build-session-countdown.md`, ADR-0006/0007/0008 (governance gate), ADR-0009 (secondary
verification trigger).
