# Metric-honesty audit (2026-07-14)

**What this is:** every visible chip, card, gauge, and number in the app, traced to its
actual data source in code and classified **BACKED** (a real check on real data, fails
closed), **DECLARED** (a self-report/heuristic — honestly labeled as not-proof), or
**SOFT-SPOT** (can show a green/clear at-a-glance state over something not actually
proven). Traced by two agents, **key claims re-verified against source by hand** before
being written here. Read-only; nothing changed.

## Headline verdict (the honest one)

**The app is far more honest than a "fake metrics everywhere" fear implies.** The large
majority of what you see is a real deterministic check that **fails closed** — when it
can't prove something it shows grey/amber/red, not green. The anti-forgery is genuinely
strong: a hand-edited verification record can't fake an "executed" green
(`isTrustedLocalProof` trusts only `local_execution`), and CI green is bound to the exact
commit SHA with a dirty-tree downgrade.

**But you were right to demand the check.** There are **three real soft-spots** where a
green/clear can sit over something not actually proven — one of them the lying banner you
already spotted. They are few, specific, and fixable. And there is a category of
**declared self-reports** that are *honestly labeled* as "not proof" but which you should
know are declared, not proven.

---

## The verdict, per metric

### BACKED — real check, real data, fails closed (trust these)
| Metric | Backed by | Fails closed? |
|---|---|---|
| Authority **chip** | live per-chat authority store, clock-expiry | yes → read-only |
| On the rails | `detect-drift.ps1` + `detect-stale-docs.ps1` (live git) | yes → unknown |
| Backup / checkpoint | `detect-repo-sync.ps1` (live git + declared tier) | yes → unknown |
| CI / **Verified** | `ci-status.ps1` → GitHub check-runs, **exact-SHA bound**, dirty-tree downgrade, `isTrustedLocalProof` gate | yes → amber/grey |
| Rules loaded | real `fs.existsSync(CLAUDE.md)`; labeled "proves load, not obey" | yes → red/grey |
| Untracked | `detect-untracked.ps1` (`git status`) | yes → unknown |
| Bloat | `detect-bloat.ps1` (declared thresholds + git) | yes → unknown |
| Owner Overview / Overall condition | deterministic ladder w/ explicit `factsReadable`/`syncUnknown`/`detectorUnknown` guards | yes → Unknown/Needs-attention, never fake-Healthy |
| Next best move / Journey | real lifecycle (`lifecycle-status.ps1`) | yes |
| Verify (Codex) | real `codex exec` run; records `TYPE: review_only` (honest amber) | yes |
| Verify product | real declared command, verdict = **real exit code** | yes → no_config, no fake PASS |
| Hard checks (git + doctor) | raw real command output | n/a (raw facts) |
| Project glance: commits / days-active | real `git rev-list` / commit timestamps | yes → "—" |
| Proof card | deterministic from the proof object | yes |

### DECLARED — self-report or heuristic, honestly labeled as NOT proof (know what they are)
| Metric | What it really is | Labeled honestly? |
|---|---|---|
| **Vision-promise cards** | owner-hand-authored `declared_status` in `vision-promises.json` | **Yes** — schema says "NOT machine proof"; UI labels every card "declared:…" and foots it "not machine proof (see the Proof card)"; kept structurally separate from the Proof card. *This is the correct way to show a self-report.* |
| "Never says no?" (sycophancy) | keyword scan of the last answer | Yes — "a keyword heuristic on one answer, not proof of sycophancy" |
| Chat-length gauge / % | proxy: `max(turns/40, hours/6)` toward the rollover thresholds | Yes — "Token usage and whether context has actually degraded are NOT measurable from here… just observable counts" |
| Project glance: "watchers" | count of `detect-*.ps1` **+ a hardcoded `2`** for the app-side signals | Partially — the hardcoded `2` is disclosed in the script's `note`, but the displayed number blends real+hardcoded |

These are not lies — they're proxies/declarations with the caveat attached. The risk is
only that an owner reading the *color/number at a glance* takes them as proof. The fix (if
any) is presentational, not a correctness bug.

### SOFT-SPOT — a green/clear can sit over something not actually proven (the fix list)
Ranked by severity.

> **STATUS (2026-07-14): all three FIXED and shipped to `main`, each with a regression
> test, independently Codex-reviewed, CI-green on the exact commit.** #2 and #3 (detectors →
> UNKNOWN when nothing was actually checked) in `90cd2e0`; #1 (the authority banner is now a
> transient, non-persisted notice, and historical persisted banners are filtered on render)
> in `d75eef3`.

1. **The authority BANNER (already demonstrated).** "Build session enabled — it can run
   commands and write files" is a *saved chat message* that never retracts when authority
   expires. On a fresh open it can greet you with a build-enabled claim while the live
   state is read-only. The *chip* is honest; the *banner* is the lie. **The one outright
   false surface.** → Fix: retract/expire the banner with the session, or render live
   authority state instead of a frozen message.

2. **Stale-docs shows CLEAR (green) when zero rules are defined.**
   (`detect-stale-docs.ps1:69-74`.) The card text is honest — *"defines no rules yet…
   nothing is being checked"* — but the **badge color is `clear`/green**. A glancing owner
   sees green "Stale docs ✓" when in truth *nothing was checked.* This is inconsistent
   with the project's own F9 soak fix, which correctly made the *missing-baseline* case
   return `unknown` (grey) for exactly this reason. → Fix: zero-rules should be `unknown`,
   not `clear` — match the badge to the honest text.

3. **High-stakes can show CLEAR on a degraded (HEAD-only) comparison when the baseline
   ref is missing.** (`detect-high-stakes.ps1:76-82, 104-110.`) It discloses
   *"compared working tree to HEAD only"* in the observed line, so it's milder than #2 —
   but it still returns `clear`/`notice` from a partial comparison where drift and
   stale-docs (post-F9) fail to `unknown`. → Fix: for consistency, degrade to `unknown`
   on a missing baseline, or make the degradation visible in the badge, not just the text.

---

## Design strengths worth stating (honesty cuts both ways)

- **Anti-forgery origin seam:** a hand-edited `TYPE: ci_execution`/`live_boundary` in the
  verification record is never trusted as executed — only `local_execution` counts.
- **Exact-SHA CI binding** + a dirty-tree downgrade so uncommitted edits CI never saw
  can't wear a "ran in CI" green.
- **The Overview never fails open to "Healthy"** — `factsReadable`, `syncUnknown`,
  `detectorUnknown`, and `!rulesLoaded` all block the green terminal.
- **The F9 fix exists** — the project already hunted and killed a false-green on missing
  baselines for drift/stale-docs. Soft-spots #2/#3 are the *same bug class, not yet fully
  applied* — a consistency gap, not a new disease.

---

## What this means for you

The answer to *"is that metric prose or backed by real data?"* is now a per-metric fact,
not a guess:
- **Most are backed and fail closed** — trust them, and now you know *why*.
- **A few are declared self-reports** — honestly labeled; know they're declarations.
- **Three are soft-spots** — the banner (a real lie) and two green-over-unchecked badges
  (a consistency gap the project already knows how to fix).

This is the gap list. It's small and specific — which is itself the honest reassurance:
the app is not riddled with fake greens; it has three findable, fixable soft edges. Fixing
them (each through the standard: restore point → change → CI → independent verify) is the
first concrete governance-hardening work, and every fix also becomes a regression test so
the green-over-unchecked class can't quietly return.
