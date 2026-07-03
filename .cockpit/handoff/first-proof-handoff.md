# First Proof Handoff

This is a live, self-contained worker handoff for the PCC control-loop proof. A worker can execute it end to end without the owner restating anything. It is concrete on purpose: exact paths, exact evidence format, exact blocked behavior.

For the general operating procedure behind this handoff, see `.cockpit/handoff/claude-worker-runbook.md`. This file is the ready-to-run instance of that procedure.

---

## 1. What The Worker Reads First (in order)

1. `.cockpit/handoff/worker-directive.md` — the active bounded task, allowed/forbidden scope, completion criteria, required evidence. This is authoritative for the current cycle.
2. `.cockpit/state/task-state.json` — the canonical task record the directive was generated from.
3. `.cockpit/state/project-state.json` — durable project truth, active decisions, and constraints (context only).

The directive is self-contained. If it is present and well-formed, execute it without asking the owner to restate the task.

---

## 2. Where The Worker Writes (exact paths)

* Write the full result to: `.cockpit/result/worker-result.md` (overwrite; one result per cycle).
* Do NOT write to `.cockpit/state/*.json` or `.cockpit/result/verification-result.json`. Those advance only after a verifier PASS or explicit owner override.

---

## 3. Required Evidence Format (must match exactly)

The result in `.cockpit/result/worker-result.md` must use these headings, in this order:

```
### Summary
### Files Changed
### Commands / Tests Run
### Results
### Evidence
### Known Risks
### Unresolved Assumptions
### Out-of-Scope Confirmation
```

Minimum content per section:

* **Summary** — what was done, in plain language.
* **Files Changed** — every file created or modified, by path.
* **Commands / Tests Run** — exact commands, or "None" with a reason.
* **Results** — command/test output, or "N/A".
* **Evidence** — concrete, checkable proof each completion criterion was met (paths, section names, output).
* **Known Risks** — caveats and anything left unverified.
* **Unresolved Assumptions** — assumptions made when the directive was silent.
* **Out-of-Scope Confirmation** — explicit statement that no forbidden-scope work was performed.

Worker claims are evidence, not truth. The verifier decides PASS/FAIL, not the worker's own summary.

---

## 4. Scope Discipline

Operate only within the "Allowed Scope" of the active `worker-directive.md`. Do not build application code, add dependencies, introduce broad orchestration, redesign V1 scope, change verification verdicts, or modify unrelated docs. If the task appears to require any of these, treat it as a blocker (Section 5) — do not widen scope to get unblocked.

---

## 5. Blocked Behavior (do this instead of improvising)

If the task cannot be completed within allowed scope, do not make broad changes. Write to `.cockpit/result/worker-result.md`:

* **Blocker** — what is preventing completion.
* **What you tried** — steps already attempted.
* **Evidence you have** — what was gathered before stopping.
* **Recommended next action** — the smallest change to the directive or inputs that would unblock.

Then stop and wait for a revised directive.

---

## 6. Definition Of Done For This Cycle

The worker's part of the cycle is done when:

* `.cockpit/result/worker-result.md` exists and uses the Section 3 format.
* Every completion criterion in the active directive is addressed with evidence.
* No forbidden-scope work was performed (and this is stated explicitly).

After that, control passes to the verifier, which writes `.cockpit/result/verification-result.json`. Only a PASS verdict advances `.cockpit/state/*.json`.
