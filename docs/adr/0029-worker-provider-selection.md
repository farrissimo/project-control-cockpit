---
status: Accepted
date: 2026-07-28
deciders: owner (product lead), Codex (worker), Antigravity/AG (verification-first reviewer)
feature: true
---

# ADR-0029: Make Codex the live worker and keep Claude as a disabled backup

## Context and Problem

PCC's chat was originally built around Claude, so the app still defaults to that mental model in
the surface copy and worker path. The owner has now explicitly changed the intended role split:
**Codex is the main worker**, not just in this chat, and PCC must not silently assume Claude when
the owner opens the app.

That creates a real product mismatch:

- the app needs to default to Codex from repo truth
- the app must not pretend Claude is currently usable if it is only a backup
- the chat surface needs to stop telling the owner he is always talking to Claude

## Decision

Keep the visible **Worker** selector beside **Model**, but make it reflect the real role split:
Codex is the live worker, and Claude remains visible only as a disabled backup.

- Codex is the repo-configured default worker and the normal live chat path.
- Codex's default model option is `auto`, meaning PCC omits `--model` and lets the
  signed-in Codex account choose its supported default. Concrete Codex model IDs
  may still be added to the editable config when they are known to work for this account.
- Claude keeps its existing chat path and safeguards underneath, but the UI presents it as disabled
  while it is backup-only and unavailable.
- A stale saved worker preference must not silently revive disabled Claude.
- Codex is not presented as supporting Claude-style attachments or resume semantics unless PCC can
  honestly prove those behaviors.

## Consequences

- Gain: PCC stops silently forcing the old Claude-first assumption when the intended main worker is
  Codex.
- Gain: the app stays honest about Claude's current role instead of offering a choice that should
  not actually be used.
- Cost: PCC still carries two worker paths underneath, so the disabled backup state has to stay
  explicit in config and tests.
- Honest trade-off: this is a real product-behavior slice, not a config-only tweak, because it
  changes default routing and owner-facing expectations.

## Expected-Behavior Map

| behavior | control (which button/action) | expected result | source | status | test |
|---|---|---|---|---|---|
| Repo-configured worker becomes the app default | open PCC with no saved worker choice | PCC selects Codex as the repo-configured default worker | STATED owner 2026-07-28 chat: app should not default to Claude | A | `app/tests/e2e/chat-worker-provider.spec.js` |
| Claude stays visible as disabled backup | `Worker` selector | PCC shows Claude but marks it disabled/unavailable | STATED owner 2026-07-28 chat: "greyed out" backup | A | `app/tests/e2e/chat-worker-provider.spec.js` |
| Stale Claude preference cannot re-enable Claude | open PCC with a saved Claude worker choice while Claude is disabled | PCC falls back to Codex instead of silently selecting disabled Claude | STATED owner 2026-07-28 chat: Claude backup should not be used | A | `app/tests/e2e/chat-worker-provider.spec.js` |
| Codex path works for normal text chat | send a chat turn with Codex selected | PCC runs the turn through Codex CLI and renders Codex's reply in chat | STATED owner 2026-07-28 chat: Codex is the main worker | A | `app/tests/e2e/chat-worker-provider.spec.js` |
| Codex account-default model avoids unsupported pinned IDs | send a Codex turn with model `auto` | PCC omits `--model` instead of passing a hard-coded Codex model that may be unavailable to the signed-in account | OWNER-REPORTED 2026-07-30 failure: `gpt-5-codex` rejected by ChatGPT account | A | `app/tests/e2e/chat-worker-provider.spec.js` |
| Unsupported Codex attachments fail plainly | send attachments while Codex is selected | PCC says attachments are not supported for Codex and does not pretend they were sent | INFERRED from PCC honesty rules + bounded Codex slice | A | `app/tests/e2e/chat-worker-provider.spec.js` |
| Worker-facing labels stay accurate | open and use chat with Codex active | PCC stops claiming the owner is always talking to Claude | STATED owner 2026-07-28 chat: app must reflect Codex as main worker | A | `app/tests/e2e/chat-worker-provider.spec.js` |
| Claude wiring is preserved underneath | future re-enable change | PCC can re-enable Claude without inventing a new worker path | STATED owner 2026-07-28 chat: keep Claude as backup, do not replace it | B | `app/tests/e2e/chat-worker-provider.spec.js` |

## Confirmation

- `npx playwright test tests/e2e/chat-worker-provider.spec.js --reporter=line` passes on the default-worker, disabled-backup, stale-preference, Codex chat, Codex `auto` argv, and Codex-attachment rows.
- The Claude path is preserved underneath rather than fully owner-selectable in this slice; it is recorded as status `B` because the row is about future re-enable capacity, not a currently visible enabled control.
- `pwsh -NoProfile -File scripts/check-adr.ps1` passes with this ADR marked Accepted.
- AG verifies the Expected-Behavior Map row-by-row against the proof for this slice.

## Engagement

- Owner: picks the worker in the app instead of inheriting a hidden default.
- Worker: must keep Claude and Codex paths honest and must not claim unsupported Codex behaviors.
- Verifier: checks the default, routing, and copy honesty, and confirms the Claude path did not
  regress.
- Future chats / spawned projects: the behavior is recorded in this ADR and the feature spec.

## Supersedes / Related

Related: `docs/specs/worker-provider-selection.md`, `docs/specs/second-opinion-provider-routing.md`,
`docs/DECISION_AND_CHANGE_STANDARD.md`, and `docs/adr/0027-expected-behavior-map-traceability.md`.
