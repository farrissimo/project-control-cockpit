# Chat Review / Verification Expected-Behavior Checklist

Purpose: give the owner a click-through testing checklist for PCC chat review and verification.
This is an Expected-Behavior artifact inside the existing governed workflow; it does not replace
idea scope, ADR/spec checks, owner approval, implementation, tests, or AG verification.

## Scope

In scope:
- Chat worker selection where it affects review/verification trust.
- The `Second opinion` chat button.
- Review-only AG behavior for Codex answers.
- Honest visible failure behavior.
- Formal done-verification boundary: chat review is not the same as task verification.

Out of scope:
- New worker/provider features.
- Reworking formal verification machinery.
- Re-enabling Claude as primary worker.
- Any AG editing or direct implementation path.

Repo truth:
- `docs/adr/0027-expected-behavior-map-traceability.md`
- `docs/adr/0028-second-opinion-reviewer-routing.md`
- `docs/adr/0029-worker-provider-selection.md`
- `docs/specs/second-opinion-provider-routing.md`
- `docs/specs/worker-provider-selection.md`

## Owner Checklist

| Owner action | PCC should visibly / observably do this | Proof / test |
|---|---|---|
| Open chat with no prior answer and click `Second opinion` | Show a friendly error saying there is no answer to review | `app/tests/e2e/crosscheck.spec.js` |
| Get a Claude answer, then click `Second opinion` | Show a Codex review bubble with the Codex response | `app/tests/e2e/crosscheck.spec.js` |
| Get a Codex answer, then click `Second opinion` | Show an AG review bubble with the AG response | `app/tests/e2e/crosscheck.spec.js` |
| Trigger Codex -> AG second opinion | Send AG a review-only prompt: no editing, no implementation, no file changes, no direct codebase work | `app/tests/e2e/crosscheck.spec.js`, `app/tests/scripts/second-opinion.spec.js` |
| Send a multiline Codex -> AG review prompt | Preserve the full prompt through `agy --print`, including the review-only instructions | `app/tests/scripts/second-opinion.spec.js` |
| Make the chosen reviewer unavailable | Show the real failure plainly; do not fabricate agreement or success | `app/tests/e2e/boundary.spec.js` |
| Click `Second opinion` while another turn is busy | Refuse visibly with a one-line reason; do not silently no-op | `app/tests/e2e/switch-while-busy.spec.js` |
| Select or reload chat worker state after stale Claude selection | Fall back to Codex as the active worker; Claude remains backup/disabled | `app/tests/e2e/chat-worker-provider.spec.js` |
| Use chat second opinion as review context | Treat it as review context only, not a formal done-verification verdict | `docs/specs/second-opinion-provider-routing.md`, `docs/adr/0028-second-opinion-reviewer-routing.md` |

## Verification Use

At task completion, AG checks this kind of checklist row by row:
- every owner action named in scope has visible expected behavior;
- every built behavior names a passing test or honest evidence;
- no mapped behavior is marked done without proof;
- chat review is not mistaken for formal work verification.
