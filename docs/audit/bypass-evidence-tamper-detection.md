# Audit grid — Bypass evidence & tamper-detection   (ADR-0009 category; status: done)

**Scope:** ADR-0009 locked rule #5 — *every escape hatch must leave a **deterministic, owner-visible**
trail; PCC itself raises the flag in plain language; an LLM autopsy (Claude/Codex noticing) is a bonus,
**never** the guarantee.* This category maps every way a control can be bypassed, skipped, or overridden,
and asks of each: does the bypass leave a deterministic trail, and can the **owner see it**?

**Method (probe freely, standardize rarely):** enumerated every escape hatch across `scripts/`, `app/`,
`.githooks/`, `.github/`, and `.cockpit/` (bypass ledgers, `--no-verify`, env opt-outs, hook fail-open
points, the CI trailer audit, branch protection). The **deterministic** half of rule #5 is strong and
tested-holds. The attack found the gap on the **owner-visible** half — and, underneath it, that the
linchpin verifier the whole model rests on was **silently non-functional** in the normal environment.

## Probe results

| Mechanism | Deterministic trail? | Owner-visible? | Verdict |
|---|---|---|---|
| **Governance-gate bypass ledger** (`governance-gate-exceptions.json`) — turns a T0/T1 BLOCK into PASS | **yes** — exact-`diff_id`, read from the **staged index**, so every bypass lands in committed git history; disclosed in the gate run-receipt | file + git history + CI audit | **tested, holds** (`governance-gate.spec.js`, `receipt-check.ps1`) |
| **Durable `Verified-Receipt` trailer / BYPASS verdict** | **yes** — CI audit re-derives each T0/T1 commit's `diff_id` and FAILs missing/malformed/mismatched/forged-BYPASS | CI FAIL → blocked PR | **tested, holds** (`verification-trailer.spec.js`: missing/amended-mismatch/forged-BYPASS all FAIL) |
| **`git commit --no-verify`** (local hook skip) | **yes** — a `--no-verify` T0/T1 commit has no trailer → CI audit FAIL, server-side | CI FAIL → blocked PR | **tested, holds** |
| **Release-gate bloat exception** (`release-gate-exceptions.json`) | **yes** — exact full-string set equality, fail-closed; a real change re-fails the gate | file + gate console; **and** the app's raw bloat Signal still shows the underlying files | **tested, holds** (`release-gate.spec.js`) |
| **Stakes-manifest escalation / `governor_self_edit`** | **yes** — can only *raise* tier; governor/CI/hook edits force T0 | **app** — the change-stakes card renders the Escalations list | **tested, holds** (`classify-stakes.spec.js`) |
| **CI trailer audit judged from trusted `main`** (ADR-0008) | **yes** — auditor/libs/classifier run from a detached `origin/main` worktree, not the PR tree | CI | **tested, holds** |
| **Branch protection** — the linchpin the entire "server-side un-bypassable" guarantee rests on | verifier exists (`check-branch-protection.ps1`, fail-closed) **but was non-functional + unsurfaced** | **NO owner-facing verdict consumed it** | **gap found → control built** |

## The gap that cleared the build bar → FIXED
The whole bypass-evidence model is only "un-bypassable" **if GitHub branch protection is actually on**
(active ruleset, empty bypass list, required `test` check + PR, no force-push/delete). The prior category
built `check-branch-protection.ps1` to prove this live — but two things left it a paper guarantee:

1. **The verifier was silently non-functional in the real environment.** It located `gh` via
   `Get-Command gh`, but `gh` is **not on PATH** on this machine (installed at `C:\Program Files\GitHub
   CLI\gh.exe`). So in every normal `-NoProfile`/gate/hook context the check returned **UNKNOWN** — it
   could *never* confirm protection. Fail-closed (not a fake green), but effectively dead. **Fixed:** a
   `Resolve-Gh` fallback that finds `gh` in the standard Windows install locations when it is off PATH.
   Independently checkable: the fallback path is now *exercised* (gh off PATH → the API path is reached,
   not the "gh not found" UNKNOWN). The final verdict depends on `gh` being authenticated: on this machine
   (gh authed) the check returns **PASS** for ruleset `protect-main` with an empty bypass list, consistent
   with O1 (owner-confirmed 2026-07-15); in an **unauthenticated** context it still fails closed to
   **UNKNOWN**, never a fake PASS.
2. **No owner-facing verdict consumed it.** `app/main.js` never runs it; nothing surfaced the linchpin's
   state. If protection were silently disabled, every other bypass-evidence guarantee would degrade and
   the owner would never know — the exact "an LLM/owner would have to notice" failure rule #5 forbids.
   **Fixed:** wired branch protection into the **release gate** as a required, fail-closed check
   (`run-release-gate.ps1`): `PASS → ok`, `FAIL (absent/weakened/bypassable) → gate FAIL` in plain
   language, `UNKNOWN → gate UNKNOWN` — never a green PASS over an unconfirmed backstop. Added to the
   receipt (`branch_protection` fact) + schema (`release-gate.schema.json`), and pinned by
   `release-gate.spec.js` (linchpin FAIL → gate FAIL; UNKNOWN → gate UNKNOWN).

Now the owner's "is this releasable?" verdict **FAILs** (in plain language) when the backstop that makes
every bypass catchable is **off/weakened**, and reads **UNKNOWN** (never a green PASS) when it **cannot be
confirmed** — the gate is never a green over an unconfirmed backstop.

## Disclosed surfaces (not built — probed and judged)
- **No always-on app surface for *active* bypasses.** Governance-gate BYPASS entries and applied
  release-gate exceptions live in ledger files / commit trailers / git-ignored run-receipts, not a Signals
  card. **Low consequence today** — there are **zero** active governance bypasses, and the one accepted
  exception (two oversized files) still shows its raw bloat Signal in the app. A "Known Residual Risks /
  active-exceptions billboard" remains an open idea (PROJECT.md), not built now: it would move no number
  while the ledgers are empty. Recommend building it *if/when* a bypass is ever actually taken.
- **The "Back up" button commits WIP with `--no-verify`** (`main.js`) — intentional WIP snapshots,
  unlabelled as a gate-skip. Caught server-side by the CI trailer audit if they carry T0/T1 changes.
  Lower risk; noted.
- **Accepted residues (do NOT machine-fix), carried from ADR-0007/0008:** a correctly-bound *fabricated*
  PASS trailer (irreducible worker-attestation — "attested" ≠ "verified"); path-granularity gaming;
  kept-test assertion-weakening; `ci.yml` self-edit + admin bypass + a pre-compromised `main` (owner-side,
  closed by O1 branch protection, not code). All disclosed in-code, none newly introduced here.

## Verdict
The deterministic half of the bypass-evidence contract is strong and well-tested: every escape hatch leaves
a committed-in-history trail or a deterministic CI-audit FAIL — none rely on an LLM noticing. The gap was
the owner-visible half **for the linchpin**: branch protection was both silently non-functional (gh off
PATH) and unsurfaced. Both are fixed — the check now works, and the release gate FAILs when the backstop
is off/weakened and reads UNKNOWN (never a green PASS) when it cannot be confirmed. The remaining
un-surfaced trails are low-consequence today (no active
bypasses) and disclosed, not painted green.
