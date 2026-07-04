# Worker Result

### Summary

Completed task `pcc-brr2-009` ("BRR Execution: Automatic Stop Triggers") by adding `scripts/check-stop-conditions.ps1` — an advisory, non-gating detector of the deterministically-checkable stop conditions — plus an "Automatic Stop Triggers" section in `docs/BRR_POLICY.md`. This is the "stop" half of the proceed-vs-stop model: where the Safe Next-Task Drafting Rules (item 3) say when PCC may proceed, this surfaces when it must stop instead of guessing. Also folded the owner's two governing maxims verbatim into a shared "Governing Principles" note in `docs/BRR_POLICY.md`, positioned to govern both the promotion rules and the stop triggers.

The whole task is scoped conservatively on the "controlled forward motion, not friction" side the plan demands: the detector **always exits 0 and hard-blocks nothing** — a reported STOP is a surfaced recommendation, not an automatic halt — and it honestly does **not** pretend to auto-detect the judgment-based stop conditions (fork, north-star alignment, whether a new owner decision is needed), naming them as out of reach for automation per `DECISION-008`.

### Files Changed

* Created: `scripts/check-stop-conditions.ps1` — advisory detector; composes `doctor.ps1`, reads live state, reports CLEAR/STOP, always exits 0.
* Updated: `docs/BRR_POLICY.md` — new "Governing Principles" note (the two maxims verbatim) and new "Automatic Stop Triggers" section.
* Updated: `docs/DECISIONS.md` — added `DECISION-040`.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — added the detector to the script catalog.
* Updated: `README.md` — Phase 2 status now includes `pcc-brr2-009` / `DECISION-040`.

### Commands / Tests Run

1. **Live CLEAR case:** `pwsh -NoProfile -File scripts/check-stop-conditions.ps1` against the live state (ready_for_worker, no owner decision, no promotion_basis, repo healthy).
2. **STOP detection (disposable scratch copy):** Case A — populated `owner_decision_request`; Case B — `blocked` status plus a `promotion_basis` whose lane referenced no approved-lane source.
3. `git status` / grep after scratch work — confirmed live state untouched.
4. `check-schemas.ps1` + `validate-cockpit-state.ps1` on the live repo after all edits.
5. (Handback health checks run by `finalize-worker-handback.ps1`, below.)

### Results

1. `CLEAR TO PROCEED on the deterministically-checkable stop conditions.` exit 0, with the explicit "not auto-checked (remain judgment)" footer.
2. Case A: `STOP recommended` — "An owner decision is pending... Do not proceed autonomously until the owner decides." exit 0. Case B: `STOP recommended` with **two** reasons — the `blocked` status ("needs attention rather than autonomous continuation") and the non-approved-lane promotion ("recorded lane does not reference a recognized approved-lane source... Cannot confirm this promotion is in-lane"). exit 0.
3. Live `task-state.json` unchanged (`ready_for_worker`, nulls); no scratch leakage.
4. `[PASS]` x3; `PCC state validation OK`.

### Evidence

Mapping to completion criteria:

* **Deterministic detector, CLEAR vs STOP, minimum condition set** — `check-stop-conditions.ps1` detects all four required conditions (pending owner decision; `doctor.ps1` `[ISSUE]`; attention-needed status; self-promoted task with a non-approved-lane `promotion_basis`), demonstrated in Results 1-2.
* **Advisory / non-gating, always exits 0, doesn't hard-block** — every run above exited 0, including the STOP cases; the script only reads state and prints. Stated in the script header and the BRR_POLICY section; `enforce-handoff-restart-safety.ps1` explicitly left as the only handoff gate.
* **Honestly does NOT auto-detect judgment conditions** — the script's closing output and the BRR_POLICY "What it honestly does not detect" subsection both name fork / north-star / new-owner-decision as remaining judgment, per `DECISION-008`.
* **BRR_POLICY "Automatic Stop Triggers" section, tied to existing policy** — references the Stop-Instead-of-Guess Policy, Owner Review Matrix, and the auto-promotion gate rather than duplicating them.
* **Maxims recorded verbatim in a shared Governing Principles note** — both lines are quoted exactly, positioned above the promotion rules and stop triggers as their shared preamble.
* **Demonstrated live (CLEAR) and scratch (STOP)** — Results 1-2.
* **Truth-surface propagation honest** — `docs/BRR_POLICY.md`, `docs/DECISIONS.md`, `docs/HANDOFF_PACKET_SPEC.md`, `README.md` updated; `docs/REPO_GOVERNANCE.md` reviewed (its Task Process already routes stops through `owner_decision_request` and the drafting-rules gate; the advisory detector is a tool those rules can use, not a new workflow step, so no change was forced there) and `docs/BRR_PLAN.md` left unchanged (no per-item completion annotations, per precedent). Flagging the `REPO_GOVERNANCE` "no change" call for the verifier.
* **Local validation healthy** — Result 4 and the handback checks.

### Known Risks

* **Design call worth explicit owner/GPT review:** I scoped this as *advisory/surfacing*, not a hard gate — because the plan's Phase 2 caution and PCC's anti-hidden-gating stance point that way. The tradeoff is real: an advisory detector only helps if something actually *runs* it and acts on a STOP. Nothing yet auto-invokes `check-stop-conditions.ps1` in the cycle; it is a tool the drafting-rules gate and a future item-5/pilot can call. If the owner wants stops to *actually gate* self-promotion (not just be surfaceable), that is a deliberate escalation from this conservative first version and should be its own decision — I did not make PCC's autonomy self-gating unilaterally.
* Condition 4 (approved-lane check) is a *formal* string check that `promotion_basis.lane` references a known approved-lane source; it does not verify the cited lane/priority is semantically correct. That remains the verifier's job, and is stated as such in the script and policy — but it means a self-promotion could pass this check with a plausible-looking but wrong lane reference.
* Same `[ISSUE]`-text-match coupling to `doctor.ps1` output as the other composed checks; all would need updating together if `doctor.ps1`'s label format changed.

### Unresolved Assumptions

* Assumed advisory/non-gating is the correct scope for the first version (see Known Risks) — grounded in the plan's explicit "controlled forward motion, not friction" caution rather than my own preference, but flagged as the key design decision.
* Assumed the attention-needed status set (`blocked`/`verified_fail`/`insufficient_evidence`/`out_of_scope`) is the right "don't autonomously continue" set; these are the non-terminal-success, non-in-flight statuses from `docs/STATE_MODEL.md`.
* This cycle is self-verified under the `DECISION-033`/`DECISION-036` fallback; verification follows immediately with the standard disclosure. Given this is safety machinery, GPT secondary review of the surface-vs-gate design is specifically recommended.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work. The detector is advisory and non-gating — it hard-blocks nothing and always exits 0; `enforce-handoff-restart-safety.ps1` remains the only handoff gate. No fake detection of judgment-based conditions was added (they are named as out of reach, `DECISION-008`). No acceptance-boundary enforcement (item 5) was built and no unattended execution was switched on. No verification verdicts, task safety classes, or BRR Phase 1 policy meaning were changed; no existing stop condition was weakened. No archived history was rewritten. The owner was not asked to restate canonical policy.
