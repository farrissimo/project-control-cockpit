---
status: Proposed
date: 2026-07-25
---

# ADR-0021: Build-authority continuity across "Continue in fresh chat"

## Context and Problem

Execution authority in PCC is stored PER stable `chat.id` ([app/authority-store.js](../../app/authority-store.js)).
Its core law: build is granted ONLY by an explicit owner approve, bound to one `chat.id`, and always
expiring; message content can never grant it, and reading context is never authorization to act.

"Continue in fresh chat" ([`continueInFreshChat()`](../../app/renderer/renderer.js)) mints a NEW
`chat.id` via `startNewChat({ name: 'Continued chat', prefill })`. Because authority is keyed to
`chat.id`, the continued chat has no grant and lands read-only. The owner must then remember to
re-click "Enable build session" — and forgets, so tools look randomly disabled and momentum breaks at
exactly the point PCC should smooth. This was the #1-severity build-continuity friction observed in the
Land Evaluator trust trial (2026-07-25). See [PARENT_TRUST_CONTINUITY_PLAN.md](../PARENT_TRUST_CONTINUITY_PLAN.md)
Task 1.1.

## Decision

Adopt **Option B: a one-click, in-flow re-approval** — NOT silent inheritance.

When "Continue in fresh chat" is invoked FROM a chat that is actively build-authorized
(`authorized_running`), the continue flow stages the SAME job for the continued chat's new `chat.id`
and immediately presents the existing owner confirm modal ("Continue the build session … ?"). One
explicit owner click re-enables build, bound to the new `chat.id` with fresh deadlines. Cancel leaves
the continued chat read-only.

Silent inheritance is rejected: auto-copying the grant to a new `chat.id` with no explicit approve
would violate the core law and is the "authority escalation from over-broad inheritance" the Codex
advisory (2026-07-25) warned against.

Scope (bounded):
- The pure guard is [app/renderer/continued-build.js](../../app/renderer/continued-build.js)
  (`planContinuedBuild`): carry ONLY for an `authorized_running` source; never for `read_only`,
  `approval_needed`, or an expired/absent source.
- Wiring reuses the existing owner-gated path (`requestJob` → `pccConfirm` → `approveJob`), bound to
  the new `chat.id`. `authority-store.js` semantics are UNCHANGED; nothing is bound to worker-session
  ids or message content.
- The automatic-rollover path (`autoRolloverToNewChat`) is OUT OF SCOPE here — it is currently
  disabled (`AUTO_ROLLOVER_ENABLED = false`); if ever enabled it must PRE-STAGE and surface approval
  in the new chat, never auto-approve.

## Consequences

- The owner keeps building across a continue with one visible click instead of a forgotten one — the
  friction becomes part of the flow, not a hidden memory task.
- The authority model is unchanged and uncompromised: still explicit, per-chat, expiring; a read-only
  source still carries nothing.
- Small blast radius: one new pure module + a renderer helper in the continue flow. No safety stop is
  weakened.
- The single transient `pending` slot in the store means a continue re-stages the pending request for
  the continued chat; this is a deliberate owner action (they clicked Continue), not a silent stomp.

## Confirmation

- Unit ([app/tests/unit/continued-build.test.js](../../app/tests/unit/continued-build.test.js)):
  `authorized_running` → offer with job name; `read_only`/`approval_needed`/null/`{}` → no offer;
  blank job name → safe fallback label. Run: `npm run test:unit`.
- E2E ([app/tests/e2e/continue-fresh-chat.spec.js](../../app/tests/e2e/continue-fresh-chat.spec.js)):
  (1) a build-enabled source → continue → in-flow confirm modal appears → one click → the NEW chat.id
  is `authorized_running`; (2) a read-only source → continue → NO modal, new chat stays `read_only`.
- Gate: `npm test` (guarded Electron E2E) + `npm run lint` + `pwsh -NoProfile -File scripts/doctor.ps1`
  + `check-adr.ps1`, CI green on the exact commit. Codex is the independent primary verifier at close;
  verdict recorded verbatim. NOT self-certified.

## Engagement

- **Owner:** sees a one-click "Continue build" confirm in the continued chat; no hidden re-enable step.
- **Renderer:** `continueInFreshChat()` captures the source authority snapshot and calls
  `offerCarriedBuildSession(newId, name)`; guard in `continued-build.js`; module loaded in
  `index.html`; global declared in `eslint.config.js`.
- **Main/authority:** unchanged — reuses `pcc:requestJob` / `pcc:approveJob` / `pcc:cancelJob`.
- **Child projects:** inherit this once ported (scaffolded copies) — tracked in
  [PCC_FIX_BACKLOG.md](../PCC_FIX_BACKLOG.md); this ADR is the source-of-truth fix.
- **Verifier (Codex):** reviews the diff + runs static/lint/doctor; behavior proven by CI E2E.
