# Second Opinion Provider Routing   (status: draft)

Governed by ADR-0028: Route Second Opinion to the right independent reviewer.

## Objective

Keep PCC's existing **Claude -> Codex** second-opinion flow working, while adding a separate **Codex -> Antigravity** second-opinion flow so the main worker can still get an independent review without asking the owner to relay anything manually.

## Behavior

PCC already has a live "Second opinion" button, but it is hard-wired to Codex. That works when Claude is the worker, and breaks the trust split when Codex is the worker.

This slice keeps the old lane and adds a second one:

- When the last worker answer came from **Claude**, the second opinion goes to **Codex**.
- When the last worker answer came from **Codex**, the second opinion goes to **Antigravity**.
- The review run stays **read-only**. It is a review request, not a work request.
- If the chosen reviewer is unavailable, PCC must say so plainly instead of pretending a review happened.

## Verification boundary

This chat bridge is not the formal task-verification lane. It reviews the latest chat answer and
returns an `AGREE` / `PARTIALLY AGREE` / `DISAGREE` style second opinion. It may be useful review
context, but it does not by itself make work "done" and does not write a binding verification
verdict.

Formal done-verification remains the governed path: `pcc:verify` runs `scripts/verify-work.ps1`
(or the deployed `PCC-CodexVerifyWatcher` runs the same verification role), which produces a
`PASS` / `FAIL` / `INSUFFICIENT` / `BLOCKED` / `OUT_OF_SCOPE` verdict according to the verifier
protocol. In that lane, Codex is primary and Antigravity/`agy` is a fallback diff-only verifier.

Operational note for Codex-hosted checks: real Antigravity/`agy` smoke or verification from inside
Codex tools may need escalated host execution. Sandboxed attempts can report misleading auth or
availability failures. Treat a sandboxed AG failure as not proven until the host execution path has
been checked and recorded.

## AG bridge operating rule

The primary AG chat bridge is:

`PCC -> scripts/second-opinion.ps1 stdin -> agy.exe --sandbox --print <bounded prompt>`

Do not pipe the prompt into AG stdin. Current `agy --print` requires the prompt as an argument; stdin
probes either fail or treat `-` as a literal prompt. Do not route multiline AG prompts through a
Windows `.cmd` shim, because it can truncate the prompt before the review-only instructions reach
AG. In test mode, PCC calls the fake `agy.js` directly for that reason.

Backup-only option for long evidence: send AG a short review-only prompt that points to a bounded
evidence file/path. The backup still stays review-only and still cannot edit, implement, or directly
work on the codebase.

## Acceptance criteria

- AC-1: WHEN the last worker answer came from Claude THE SYSTEM SHALL send the second-opinion request to Codex.
- AC-2: WHEN the last worker answer came from Codex THE SYSTEM SHALL send the second-opinion request to Antigravity.
- AC-3: WHEN PCC renders the returned review THE SYSTEM SHALL label it with the reviewer that actually produced it.
- AC-4: WHEN the chosen reviewer cannot run THE SYSTEM SHALL show the real failure and SHALL NOT fabricate agreement or success.
- AC-5: WHEN the owner uses the existing Claude flow THE SYSTEM SHALL preserve that behavior unchanged.
- AC-6: WHEN the AG review prompt is multiline THE SYSTEM SHALL preserve the full review-only prompt through to AG.
