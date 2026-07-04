# Worker Result

### Summary

Completed task `pcc-brr2-006` ("BRR Governance: Secondary Workflow Canon") by formalizing, in repo truth, the exact degraded-workflow arrangement now in effect: Codex is unavailable, Claude Code performs both worker and verifier roles under the existing `DECISION-033` fallback, and ChatGPT joins as a secondary review input with remote-only repo access. Added `DECISION-036`, which defines: (1) GPT's role as additive secondary review, explicitly not independent verification (it cannot locally re-run the guardrails `DECISION-031`/`DECISION-032` require); (2) the standard disclosure wording every self-verified `verification-result.json` must now use; and (3) a time-boxed pre-authorization to commit *and* push every verified `PASS` for the remainder of this BRR phase, so ChatGPT's remote access can actually see completed work, without permanently overriding `DECISION-020`'s normal per-time push approval rule.

This task itself is being executed and will be verified entirely by Claude Code under exactly this fallback — the first cycle to operate this way for real.

### Files Changed

* Updated: `docs/DECISIONS.md` — added `DECISION-036`.
* Updated: `docs/VERIFICATION_RESULT_SPEC.md` — extended the existing `DECISION-033` self-verification disclosure requirement with the standard wording and an explanation of GPT review's narrower scope.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — extended the "Advisor / Verifier Handoff" section with GPT's role and the time-boxed push authorization; updated the "Recommended Close-Out Order" section's push paragraph to reflect that `close-out-verified-task.ps1` itself still never pushes (push remains a deliberate separate step, just no longer requiring a fresh ask each time during this window).
* Updated: `docs/REPO_GOVERNANCE.md` — extended the Task Process's fallback paragraph with the same GPT-role and push-authorization clarifications.

### Commands / Tests Run

* `pwsh -NoProfile -File scripts/validate-cockpit-state.ps1` and `pwsh -NoProfile -File scripts/check-schemas.ps1` — run before handback to confirm the docs-only changes left no live state/schema drift (expected, since no state or schema files were touched).
* `pwsh -NoProfile -File scripts/finalize-worker-handback.ps1` — the established worker handback path, run as the final step before this evidence.

### Results

* Both pre-handback checks: clean (`PCC state validation OK`; all three `[PASS]`).
* `finalize-worker-handback.ps1`: exit `0`, all four steps completed, `doctor.ps1` fully clean at the final `returned_for_verification` state.

### Evidence

Mapping to the directive's completion criteria:

* **Repo truth states clearly when the degraded fallback may be used, distinguishing it from the normal two-role path** — unchanged from `DECISION-033` (this task didn't need to redefine the trigger condition itself, only formalize what was missing: the second reviewer's role and push authorization); `DECISION-036` cross-references `DECISION-033` explicitly rather than duplicating it.
* **Repo truth states clearly whether GPT review counts as secondary input, independent verifier-of-record, or something narrower, propagated consistently** — `DECISION-036`'s Implication 1 states this directly and explicitly (secondary review input, not independent verifier-of-record, not equivalent to Codex), and the same characterization was propagated verbatim in substance across `docs/VERIFICATION_RESULT_SPEC.md`, `docs/HANDOFF_PACKET_SPEC.md`, and `docs/REPO_GOVERNANCE.md` — checked side by side after writing to confirm no drift in wording between the four surfaces.
* **Required self-verification disclosure wording is made explicit** — `docs/VERIFICATION_RESULT_SPEC.md` now states the standard sentence verbatim, so future fallback cycles (including this one's own verification, next) don't have to improvise it.
* **Change stays bounded to governance/verification-language/workflow-truth clarification** — no scripts were touched; only `docs/DECISIONS.md` and three closely related docs.
* **Resulting task draft and touched surfaces leave the repo healthy** — confirmed via the pre-handback checks and the clean `finalize-worker-handback.ps1` run.
* **No new autonomy, owner-decision capture flow, acceptance-boundary policy, or unrelated workflow redesign** — confirmed; this only names an already-owner-directed arrangement in repo truth.

### Known Risks

* The commit-and-push pre-authorization is explicitly time-boxed ("remainder of this BRR phase") per the owner's own stated scope, not indefinite. Whoever verifies future phases needs to actively check whether this authorization is still in effect or has lapsed — repo truth states the boundary condition (phase close or Codex's return, owner's call) but does not and cannot enforce it automatically; this is a judgment call each future cycle must make honestly, not something a script gates.
* This is the first task where the disclosure wording and GPT-role language will actually be exercised (in this task's own verification, immediately following). Any awkwardness in the wording will surface there.

### Unresolved Assumptions

* Assumed no changes were needed to `docs/STATE_MODEL.md`, `docs/BRR_POLICY.md`, `README.md`, or any script — checked each and found no field, phase, or behavior stale as a result of this task specifically (BRR Phase 1 policy content is explicitly unaffected per the directive's own forbidden scope).
* Assumed "the remainder of this BRR phase" (rather than a fixed task count or date) is the right scope boundary for the push pre-authorization, matching how the owner phrased the authorization directly in this conversation.
* Given the fallback is now active, this task's own verification will be self-performed by Claude Code per `DECISION-033`/`DECISION-036` — there is no Codex or independent party to flag review recommendations to this cycle; the self-verification pass immediately following this evidence is the check.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. `doctor.ps1`, `check-schemas.ps1`, and `validate-cockpit-state.ps1` were not redesigned. No verification verdicts or task safety classes were changed. No BRR Phase 1 policy content (`docs/BRR_POLICY.md`) was touched. No owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation was introduced. No archived history was rewritten or retrofitted. GPT repo review was not silently declared equivalent to full local independent verification — the opposite was stated explicitly and repeatedly across all four touched surfaces.
