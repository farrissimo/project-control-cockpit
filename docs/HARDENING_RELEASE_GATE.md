# Release gate — exact-SHA release evidence (Hardening, Slice 1)

## What this is
One **fresh-run** command that evaluates the **current commit** and produces an honest,
machine-readable receipt. It answers one question:

> Is *this precise commit* — not "roughly the current code" — positively proven releasable right now?

It is a **thin orchestrator**. It does not re-derive sync, CI, detection, or evidence-validation
logic — it **invokes the authorities that already own them** and combines their answers under one
small policy. All the fact logic lives in tools that are tested and used elsewhere.

- Command: [`scripts/run-release-gate.ps1`](../scripts/run-release-gate.ps1)
- CI fact authority: [`scripts/ci-status.ps1`](../scripts/ci-status.ps1)
- Schema: [`schemas/release-gate.schema.json`](../schemas/release-gate.schema.json)
- Approved exception: [`.cockpit/state/release-gate-exceptions.json`](../.cockpit/state/release-gate-exceptions.json)
- Receipt (git-ignored, generated): `.cockpit/evidence/release-gate.json`
- Tests: [`app/tests/scripts/release-gate.spec.js`](../app/tests/scripts/release-gate.spec.js)

Run it: `pwsh -File scripts/run-release-gate.ps1` (add `-Json` for the machine receipt).
Exit codes: **0 = PASS, 1 = FAIL, 2 = UNKNOWN**.

## Fresh-run only — the receipt is a historical record, never live proof
There is **no `-EvaluateFile` mode**. The generated `release-gate.json` is a **receipt of one run**.
It is never read back later and treated as current proof. To know whether the code is releasable
now, **run the gate again**. This removes an entire class of "stale evidence reused as if live"
bugs: the only way to get a verdict is to collect the facts fresh.

## Fact sources (each an existing authority, invoked — not reimplemented)
| Fact | Authority | How |
|------|-----------|-----|
| commit / branch / clean tree | git | `rev-parse` / `status --porcelain`, captured at **start and again at end** |
| backup / sync | `scripts/detect-repo-sync.ps1` (existing PCC authority) | invoked; its `signal` is consumed |
| actual remote branch head | git | `git ls-remote origin refs/heads/<branch>`, compared to the local SHA (not a cached tracking ref) |
| exact-SHA CI | `scripts/ci-status.ps1` → GitHub check-runs | the named `test` check for the exact commit |
| branch protection (linchpin) | `scripts/check-branch-protection.ps1` → GitHub rulesets API | the active `protect-main` ruleset with an empty bypass list, required `test` check + PR + no force-push/delete |
| local execution | npm | `npm run test:unit` · `npm test` · `npm audit --audit-level=high` (exit codes) |
| detectors | `detect-bloat.ps1` / `detect-drift.ps1` / `detect-stale-docs.ps1` | invoked; `signal` consumed |
| evidence structure | `Test-Json -SchemaFile` | the generated record is validated against the schema |

`git ls-remote` reads the **real remote head** each run (no fetch of tracking refs, no mutation of
local refs). Network unavailable, remote missing, or an indefinite result ⇒ **UNKNOWN**, never PASS.

`ci-status.ps1` is the single CI authority (named-`test`-check-only, mirroring the app's Verified
light). It carries the SHA it queried, so the gate binds the CI result to the exact commit.

## The only policy the gate owns
Each required fact resolves to **ok / FAIL / UNKNOWN**, then:

> any required **FAIL** ⇒ overall **FAIL**; else any required **UNKNOWN** ⇒ overall **UNKNOWN**; else **PASS**.

| Fact | ok | FAIL | UNKNOWN |
|------|----|----|---------|
| HEAD stable (start == end) | equal | changed during the run | — |
| clean tree (start & end) | both clean | either dirty | — |
| backup / sync signal | `clear` | `notice` (unbacked/unpushed) | `unknown` / unreadable |
| remote head | `match` | `mismatch` | unavailable / indefinite |
| CI (exact SHA) | `passed` and bound to this SHA | `failed` / `cancelled` / `skipped` | `pending` / `missing` / `unreachable` / `ambiguous` |
| branch protection | `PASS` (active ruleset, empty bypass) | `FAIL` (absent / weakened / bypassable) | gh/API/auth unavailable — cannot tell |
| unit / full / audit | exit 0 | non-zero exit | did not run |
| detector | `clear`, or the exact bloat exception | uncovered `notice` | `unknown` / malformed output |
| evidence structure | validates against schema | fails schema validation | — |

Two deliberate points: **UNKNOWN never becomes PASS** (missing network truth blocks release
without pretending failure); **invalid generated evidence forces FAIL** (the gate never claims a
valid release record it couldn't produce). Every result is tied to the exact **starting SHA**, and
HEAD + tree are re-checked after all work.

## Accepted bloat — an exact, fail-closed, disclosed exception
The two known oversized files (`app/main.js`, `app/renderer/renderer.js`) are owner-accepted, split
deferred. The gate tolerates the bloat notice **only** when the detector reports `signal: notice`
with **exactly** the two approved full item strings in
[`.cockpit/state/release-gate-exceptions.json`](../.cockpit/state/release-gate-exceptions.json)
— set equality on complete strings, **no substring or regex**. Any change to wording, path, line
count, threshold, or an added/removed item breaks the match and **fails the gate**. This is
deliberately brittle so a real change forces a fresh, explicit re-acceptance instead of silently
staying green. Every applied exception is written into the receipt as `exceptions_applied`.

## Deliberate exclusions
- **"Never says no?" (sycophancy)** is a chat-answer nudge (renderer-only, "a keyword heuristic, not
  proof"). It is not release health and plays no part in the gate.
- **`untracked`** detector: covered by the clean-tree check.
- No security scanners, mutation testing, failure injection, or packaging in this slice.
- No product behavior changes; no new governance; no LLM calls at runtime.

## Honesty guarantees under test
`release-gate.spec.js` drives the real gate in throwaway repos with each authority faked (fake
sibling scripts, a local bare remote for `ls-remote`, a fake `npm`), proving: a valid fresh run
passes; dirty tree fails; HEAD-changed-during-run fails; real remote-head mismatch fails; unavailable
remote ⇒ UNKNOWN; red / skipped CI fail; missing / pending CI ⇒ UNKNOWN; wrong-SHA CI fails; a failing
unit/full/audit command fails; malformed detector output ⇒ UNKNOWN; the exact two-item bloat notice is
accepted and disclosed; a changed or additional bloat item fails; an unapproved notice fails; and the
generated receipt validates against the schema and names the exact SHA.
