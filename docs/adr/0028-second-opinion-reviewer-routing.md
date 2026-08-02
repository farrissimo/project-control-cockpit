---
status: Accepted
date: 2026-07-28
deciders: owner (product lead), Codex (worker), Antigravity/AG (verification-first reviewer)
feature: true
---

# ADR-0028: Route Second Opinion to the right independent reviewer

## Context and Problem

PCC already has a live **Second opinion** button, but it was built for the older split where
Claude was the worker and Codex was the reviewer. The owner's current rule is different: Codex is
the main worker, and the independent reviewer for that lane must not be Codex grading its own work.
The owner also set a hard boundary for Antigravity's role on 2026-07-28: **no editing, no direct
work, review only.**

That leaves a real behavior gap: the current second-opinion flow is still hard-wired to Codex, so
it preserves the old Claude->Codex cross-check but cannot honestly serve the new Codex-worker lane.

## Decision

Keep the existing **Claude -> Codex** second-opinion path, and add a separate **Codex ->
Antigravity** second-opinion path.

- The second-opinion target is chosen from the worker that produced the answer being reviewed, not
  from whatever worker happens to be selected later.
- Antigravity is used here as a **review-only** cross-checker. The prompt must explicitly forbid
  editing, implementation, file changes, and direct codebase work.
- If the chosen reviewer is unavailable, PCC must say so plainly instead of pretending a review
  happened.
- The chat bridge is review context only. It is distinct from formal done-verification, which still
  runs through `scripts/verify-work.ps1` / the `PCC-CodexVerifyWatcher` path and produces a binding
  verifier verdict.
- The AG chat bridge calls `agy.exe --sandbox --print <bounded prompt>` directly. PCC may pass the
  prompt into `scripts/second-opinion.ps1` over stdin, but AG itself must receive the prompt as the
  `--print` argument. Do not use AG stdin as the primary path, and do not route multiline AG prompts
  through a Windows `.cmd` shim.

## Consequences

- Gain: PCC keeps the old working Claude cross-check and restores an independent review path when
  Codex is the worker.
- Gain: the owner no longer has to relay the review request by hand for the Codex lane.
- Cost: PCC now owns two reviewer lanes, so the app must remember which worker produced the answer
  being reviewed.
- Honest trade-off: this is still a second-opinion feature, not the full task-verification lane.
  It improves trust in chat review, but it does not replace the governed build -> checks ->
  independent verification path for "done."
- Operational residue: when Codex itself is driving a real Antigravity/`agy` smoke or fallback
  verification, sandboxed shell attempts may misreport AG availability. The host/escalated path is
  the meaningful proof path for AG availability, and failures outside that path should be recorded
  as not proven rather than treated as authoritative.
- Operational rule: if an AG prompt becomes too large for the direct `--print` bridge, the backup is
  a short review-only prompt that points to bounded evidence, not a stdin pipe and not an editing
  session.

## Expected-Behavior Map

| behavior | control (which button/action) | expected result | source | status | test |
|---|---|---|---|---|---|
| Claude answer uses Codex reviewer | `Second opinion` after a Claude reply | PCC sends the review request to Codex and shows a Codex review bubble | STATED owner 2026-07-28 chat + existing shipped behavior | A | `app/tests/e2e/crosscheck.spec.js` |
| Codex answer uses Antigravity reviewer | `Second opinion` after a Codex reply | PCC sends the review request to Antigravity and shows an AG review bubble | STATED owner 2026-07-28 chat: Codex main worker, AG verifier | A | `app/tests/e2e/crosscheck.spec.js` |
| Reviewer role stays review-only | `Second opinion` request payload | The reviewer is told to do no editing, no implementation, no file changes, and no direct work | STATED owner 2026-07-28 chat: "it will do NO editing or other work at all" | A | `app/tests/e2e/crosscheck.spec.js` |
| Multiline AG prompt preserves review-only instructions | `Second opinion` request payload routed to AG | The full prompt reaches AG through `--print`, including the no-editing and verdict-shape instructions | STATED owner 2026-07-28 chat + bridge research/probe | A | `app/tests/scripts/second-opinion.spec.js`, `app/tests/e2e/crosscheck.spec.js` |
| Reviewer failure is surfaced honestly | `Second opinion` while chosen reviewer is unavailable | PCC shows the real failure and does not fabricate agreement or success | STATED owner 2026-07-28 chat + PCC honesty rules | A | `app/tests/e2e/boundary.spec.js` |
| Busy-turn refusal stays visible | `Second opinion` while another turn is running | PCC refuses with a visible one-line reason, never a silent no-op | REFERENCE `docs/specs/switch-while-busy.md` | A | `app/tests/e2e/switch-while-busy.spec.js` |

## Confirmation

- `npx playwright test tests/scripts/second-opinion.spec.js --reporter=line` passes for the AG bridge operating rule.
- Focused second-opinion e2e files passed individually: `tests/e2e/crosscheck.spec.js`,
  `tests/e2e/boundary.spec.js --grep "second opinion"`, `tests/e2e/ipc.spec.js --grep
  "secondOpinion"`, and `tests/e2e/switch-while-busy.spec.js`.
- `pwsh -NoProfile -File scripts/check-adr.ps1` passes with this ADR marked Accepted.
- AG verifies the Expected-Behavior Map row-by-row against the proof for this slice.

## Engagement

- Owner: the same `Second opinion` button keeps working, but Codex replies are reviewed by AG instead
  of being sent back to Codex.
- Worker: second-opinion work must stay inside this routing rule and must keep AG review-only.
- Verifier: checks the route, the honest failure behavior, and that the old Claude lane did not
  break.
- Future worker/verifier sessions: do not confuse the chat bridge with formal task verification;
  use `verify-work.ps1` / watcher for binding verdicts and use the host/escalated path when proving
  real AG availability from Codex tooling.
- Future chats / spawned projects: the behavior is recorded in this ADR and the feature spec.

## Supersedes / Related

Related: `docs/specs/second-opinion-provider-routing.md`, `docs/specs/switch-while-busy.md`,
`docs/specs/worker-provider-selection.md`, `docs/DECISION_AND_CHANGE_STANDARD.md`, and
`docs/adr/0027-expected-behavior-map-traceability.md`.
