# Worker Result — pcc-pathA-001

**Task:** Local-First Routing: Advisory Task Routing Classifier
**Worker:** Claude Code
**Task Safety Class:** A

## Files created or changed

- **Created** `scripts/classify-routing.ps1` — the deliverable: a read-only, advisory, non-gating routing-suitability classifier.
- **Edited** `docs/DECISIONS.md` — recorded `DECISION-075`.
- **Edited** `README.md` — one-line note under "Local-First Principle" pointing at the new advisory (first Path-A task).
- No `backlog/IDEAS.md` edit: checked; no existing IDEA entry corresponds to §7.12, so none needed a delivered-status note.

## Summary of changes

Delivers original project scope §7.12 (Local-First Routing) as the leanest honest form: a single self-contained script that reads the active task from `.cockpit/state/task-state.json` and mechanically classifies its routing-suitability into a fixed closed set (`local_deterministic` / `model_judgment` / `mixed` / `unknown`), then prints an advisory recommendation tied to `DECISION-002` (prefer local deterministic tools for local-suitable work).

Classification uses only mechanical signals already in task state: the task's `task_safety_class` plus literal, case-insensitive keyword membership tests against the task title/objective (a fixed local-suitable keyword list and a fixed judgment keyword list). It is explicitly labeled a mechanical keyword heuristic and a hint — never a claim to know the task's true nature (`DECISION-008`).

The script is strictly read-only: it mutates no file or state, calls no other script, gates/redirects/executes nothing, and adds no log event type. It exits 0 on well-formed input and fails cleanly (non-zero, no mutation) on missing or malformed task-state. This satisfies `DECISION-074`'s extractability rule — one `.cockpit/` file-bridge input, stdout output, no shared state — so it could run against a different repo given only its documented input.

## Commands run

Functional tests (not read-through only):

1. `pwsh -NoProfile -File scripts/classify-routing.ps1` — against the real live `task-state.json`.
2. Same script against three synthetic task shapes and two failure inputs in the scratch copy (`-TaskStatePath` override).

## Command/test results

| Test | Input | Expected | Actual | Exit |
|---|---|---|---|---|
| 1 | real `task-state.json` (pcc-pathA-001, Class A) | sane class | `mixed` (correct — has json/path + decision/review) | 0 |
| 2 | synthetic deterministic (rename/move/list/diff/validate/schema, Class A) | `local_deterministic` | `local_deterministic` | 0 |
| 3 | synthetic judgment (policy/decide/design/prose, Class B) | `model_judgment` | `model_judgment` | 0 |
| 4 | synthetic no-keyword, Class C | `unknown` | `unknown` | 0 |
| 5 | malformed JSON | clean non-zero, no mutation | clean `Fail`, no write | 1 |
| 6 | missing file | clean non-zero, no mutation | clean `Fail`, no write | 1 |

All classifications correct; both failure modes exit non-zero without mutating any state.

## Known risks

- The classifier is a keyword heuristic and can be wrong (e.g. a task whose objective mentions "json" but is really judgment-heavy). This is disclosed in the script's own output and in `DECISION-075`; it is an advisory hint, and the worker's in-context judgment governs. It does not gate anything, so a wrong hint has no enforcement consequence.
- Keyword lists are intentionally small/legible; they will not catch every phrasing. Expanding them is future work, not required here.

## Unresolved assumptions

- Assumes `task_title`/`task_objective` are the right text to scan; if a future task carries its real intent only in the directive rather than task-state, the classifier would see less signal. Acceptable for an advisory hint.

## Confirmation that forbidden scope was not touched

- No existing script modified (verified: only `scripts/classify-routing.ps1` is new; `log-event.ps1`, `summarize-routing-log.ps1`, `check-stop-conditions.ps1`, `doctor.ps1`, etc. untouched).
- No new log event type; no write to `routing-log.jsonl`.
- No gating/redirecting/executing of work — advisory only.
- No schema, verdict, task status, Task Safety Class, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule changed.
- No manual `codex exec` invoked — verification is left to the live PCC-CodexVerifyWatcher.
