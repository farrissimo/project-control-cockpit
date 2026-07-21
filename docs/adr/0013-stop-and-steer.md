---
status: Proposed
date: 2026-07-20
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0013: Stop and steer a running turn (desktop-parity R2)

## Context and Problem

The 2026-07-20 incident's second half of the owner's complaint: "it doesn't respond once it says
'Claude is thinking' ... I couldn't stop it so I just closed the app." PCC's chat had **no way to
end an in-flight turn** short of force-quitting the whole application — the exact opposite of the
desktop app, which lets him stop or redirect mid-turn.

The owner's requirement (`docs/proposals/desktop-parity.md` R2) is explicit: **"it's not one or
the other. it's both."** Stop (kill the turn) AND steer (redirect it) are both required.

## Decision

**⚠ CORRECTION (2026-07-21): "steer already exists" is FALSE in practice.** The owner sees no steer
control in the app, and the send-queue behavior described below is NOT surfaced as a usable,
discoverable steer feature — R2's steer half is NOT done (authoritative status: `PROJECT.md`). The
original reasoning is kept below for the record. PCC's chat serializes all sends through one
`busy` flag and a `sendQueue` (`app/renderer/renderer.js`): a message composed while a turn is
running is queued, not blocked, and sent immediately when the current turn finishes (`runSend`'s
`finally` drains the queue). This is proven live by an existing, passing test
(`app/tests/e2e/robustness.spec.js`, "steering: composer stays usable mid-turn..."). It is
**next-turn steering**, not true mid-token injection into the model's current generation — the
underlying `claude -p` invocation reads its whole prompt once and runs to completion, and true
in-flight injection would require keeping stdin open in `--input-format stream-json` mode
throughout the turn, a larger structural change tied to ADR-0011's "run in streaming mode always"
slice. This is the honest fallback the requirement itself allows for ("if true mid-turn injection
is impossible, queue-next is the only safe option") — disclosed, not silently substituted.

**Stop is new** (`app/main.js`, `app/renderer/`):
1. The chat runs **one turn at a time globally** (the renderer's `busy` flag serializes every
   send across every chat), so a single in-flight reference is sufficient — no per-chat map
   needed. `askClaude`'s primary chat-turn spawn (not `oneShotWorker`'s background auto-name/
   summary/recall calls, which the owner never watches a "Claude is working…" bubble for) sets
   `currentTurn = { child, chatId, stoppedByOwner: false }`.
2. `ipcMain.handle('pcc:stopWorker', (_e, chatId) => ...)` — chat-scoped: a mismatched `chatId` is
   a safe no-op, so Stop can never kill a different chat's turn than the one actually shown as
   running. Marks `stoppedByOwner` **before** killing (reusing the existing `killWorker` tree-kill,
   already proven at app-quit — Soak fix F4), so the close handler resolves a plain "Stopped — you
   ended this turn before Claude finished" message instead of a raw exit-code error.
3. Renderer: a `#stop` button, visible **only** while a turn for that owner-visible send is
   running, disabled immediately on click (can't be "stopped" twice), and hidden again once the
   turn resolves.
4. The resulting bubble renders in the **neutral `assistant` style**, not the red `assistant
   error` style — an owner-initiated stop is not a failure.

**A bug caught before it shipped:** this codebase scopes `.hidden` per-element (`#authority-end.
hidden`, `#attachments.hidden`, …), not as a single global rule — the first e2e run of the new
Stop button caught it showing on page load (no matching `#stop.hidden { display:none; }` CSS
rule existed yet). Fixed and re-verified green.

## Consequences

- **Gain:** the owner can now end a stuck or unwanted turn with **Stop** (owner-proven 2026-07-21) —
  directly closes the incident's second failure mode. (**Steer, the other half, is NOT working**: no
  steer control is exposed for the owner — see the correction above and `PROJECT.md`.)
- **Cost:** one new module-level ref (`currentTurn`) in `main.js`, one new IPC channel
  (`stopWorker`, exact-channel-listed), one new button + its CSS rule.
- **Honest residue:** steer is next-turn (queued), not true in-flight token-level injection — that
  upgrade rides on the larger always-streaming worker-invocation change (ADR-0011), not built here.

## Confirmation

Tests pass before merge (functional proof on the owner's screen still PENDING — see PROJECT.md):
- **E2E** (`app/tests/e2e/stop-worker.spec.js`, real app + fake slow worker): Stop is hidden with
  no turn running, appears within the turn, and clicking it ends the turn well before the fake
  worker's own delay would have finished on its own (proves it was actually killed, not merely
  outlasted); the resulting bubble reads "Stopped" and carries no `error` class; Stop hides again
  once done; the chat accepts and completes a new message afterward (not permanently stuck);
  calling `stopWorker` with no active turn is a safe, honestly-reported no-op.
- **Regression** (`app/tests/e2e/robustness.spec.js`): the existing steering test still passes
  unchanged — the queue mechanism was not touched, only proven still correct.
- **Contract** (`app/tests/e2e/ipc.spec.js`, 29/29): `stopWorker` is in the exact-channels list.
- Full unit suite 162/162; lint clean.

## Engagement

- **Owner:** the audience — a visible Stop button appears exactly when he'd want one. (Steer is
  the send-queue behavior only — NOT a proven, owner-facing feature; see the correction above.)
- **Claude worker:** implemented `currentTurn` tracking, the IPC handler, the button + its
  handler, the CSS fix, and all four new/regression tests.
- **Codex verifier:** diff-reviews the change (static + lint + doctor; cannot launch Electron, so
  the E2E proof above is worker-attested test evidence, independently re-run at verification time).
- **Security-model note:** `stopWorker` only tree-kills a process the app itself spawned for the
  matching chat; it grants no new capability and does not touch the authority model.
- **Spawned projects:** the Stop button and `currentTurn` mechanism are **shared home-app UI/
  logic** (`app/main.js`, `app/renderer/`) — inherited automatically by every project opened in
  PCC, not scaffolded per-project (same correction applied in ADR-0011/0012).

## Supersedes / Related

New surface. Related: `docs/proposals/desktop-parity.md` (R2, the controlling requirement),
ADR-0011 (the always-streaming slice that would upgrade steer to true mid-turn injection),
Soak fix F4 / `killWorker` (the tree-kill mechanism this reuses, not reinvents).
