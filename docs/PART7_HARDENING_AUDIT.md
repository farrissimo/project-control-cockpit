# PCC Part 7 — Existing-Code Hardening Sweep (Findings)

**Audited commit:** `f3607cc` (branch `fix/data-truth-recovery`), working tree clean.
**Scope:** the *existing* application — `app/main.js` (1193 lines), `app/renderer/renderer.js` (2211 lines), the other `app/*.js` modules, and the `scripts/*.ps1` state/status writers. The freshly-hardened `app/state/*` chat modules (S1–S6.1) are used as the **correct reference pattern**, not re-audited.
**Method:** read-only. Four parallel auditor passes (authority/mutation, fail-closed, truth/provenance, test-integrity), then **every material finding re-verified against the actual code** by the implementer before inclusion. No code was changed. Per assurance-plan Part 7, this classifies findings only; it does **not** fix.
**Definitions (assurance plan Part 7):** `CRITICAL BLOCKER` = can lose/corrupt real user data **or** silently show false state the owner would trust · `IMPORTANT BOUNDED REPAIR` = real, contained defect · `ORDINARY TECH DEBT` = does not stop progress · `NO DEFECT`.

---

## Headline

The chat-data recovery (S1–S6.1) is solid and fails closed. The audit found the **same disease elsewhere**: the hardened atomic-write primitive (`app/state/atomic-store.js`) and the honest "unknown, not green" pattern (`app/ci-status.js`) both exist in the codebase but are **used only by the chat store**. Other canonical writers still do non-atomic whole-object overwrites, and two owner-facing **trust indicators can paint green over false state** — the exact "can't trust what PCC shows" class the recovery mission targets, now on the *verification* and *backup* surfaces rather than chat data.

**2 critical, 8 important, 3 tech-debt.** Only the critical + important enter the hardening queue below (your decision to schedule).

> **STATUS (2026-07-11): the critical + important queue is COMPLETE.** All 2 critical (CRIT-1 09b236a, CRIT-2 5ce4cf8) and all 8 important — I6 0a08f9c, I2 c0cc689, I7 eca3bf6, I5 49b6750, I4 280c6c7, I8 f107692, I3 ccd902e, I1 d40af30 — shipped (each Codex-PASS + pushed). Tech-debt T1/T2/T3 left as non-blocking (T3 = the untested push-failure branch, still open). The atomic-write primitive is now shared by both JS (app/state/atomic-store.js) and PowerShell (scripts/lib/atomic-write.ps1) writers. Separately, CI (.github/workflows/ci.yml) now also runs the node:test unit suite (96f0783), closing the gap where the data-integrity primitives had no CI proof.

---

## Failure-class coverage (all 16 checked)

| # | Failure class | Result |
|---|---|---|
| 1 | Multiple authorities for one domain | Found (C3, lifecycle pin) |
| 2 | Whole-state replacement writes | Found (I1, I2, I3, I5) |
| 3 | Swallowed exceptions | Found (I2; else clean) |
| 4 | Best-effort inside a claimed guarantee | Found (I2, T2) |
| 5 | Malformed input normalized to valid-looking | Found (**C? I6** authority fail-open) |
| 6 | Stale state displayed as current | Found (I4 boot-snapshot strip) |
| 7 | Verification detached from current commit | Found (**CRIT-1**) |
| 8 | Project identity from mutable paths | Found (I2, bounded) |
| 9 | Missing revision/concurrency protection | Found (C3 lifecycle) |
| 10 | Corrupt recovery overwriting good recovery | Not found (atomic-store handles it correctly) |
| 11 | Tests: success but not relevant failure | Found (I6, T3) |
| 12 | Tests not exercising production path | Not found (specs hit real modules) |
| 13 | Misleading comments / test names | Found (minor; I7 "durable", T-isolation name) |
| 14 | False-green defaults | Found (**CRIT-2**, I7-overview, I8-lifecycle-gate) |
| 15 | Production-data exposure during tests | Found (I5 — tests write real PROJECT.md) |
| 16 | Ack before persistence confirmed | Found (I1/I2/I3 — non-atomic acks) |

---

## CRITICAL BLOCKERS

### CRIT-1 — The "Verified" trust indicator can show "matches current code" over unverified working-tree edits
**Class 7 (verification detached from commit) + Class 2 (claim mismatch).**
**Files:** `app/main.js:406,409-411` · `app/renderer/renderer.js:1567,1849` · `app/renderer/overview-logic.js:41` (freshness), `:148` (label) · `scripts/verify-work.ps1:109-114`

Freshness of the verification record is decided by **timestamp**, not commit identity:
`main.js` builds `mtimeEpoch` (mtime of `last-verification.txt`) and `headCommitEpoch` (`git log -1 --format=%ct`); the chip greens when `v.mtimeEpoch >= headCommitEpoch` (`renderer.js:1567`), labelled **"PASS (ran locally — matches current code)"** (`renderer.js:1849`; Overview freshness computed at `overview-logic.js:41`, label rendered at `:148`). A stable `VERIFIED_SHA` is written into the record (`verify-work.ps1:110`) but its own comment says it "plays no part in any pass/fail or trust decision" — so it is discarded.

The committed-after case is handled (goes "stale"). But **uncommitted edits never advance `headCommitEpoch`**, so a PASS recorded before an in-app build turn's `Write`/`Edit` still satisfies `mtime >= headCommitEpoch` and stays green "matches current code" over unverified changes. (A rebase/amend that lowers HEAD's committer time produces the same false green.) Direct violation of Part 1 rule 7 on the app's central trust light.
**Why critical:** it silently paints "verified / matches current code" — the exact signal the owner trusts to decide whether to rely on the state — when the working tree has moved past the verification. **Confidence: high.** (Does not corrupt data; it is a false *display*.)

### CRIT-2 — `syncStatus` reports `clean: true` when git itself fails → both the Owner Overview AND the always-visible sync banner falsely say "backed up"
**Class 14 (false-green default) + Class 3 (unchecked failure).**
**Source:** `app/main.js:1056-1071` · **consumed at** `app/renderer/overview-logic.js:51,92` (Overview "Healthy") **and** `app/renderer/renderer.js:1881-1900` (visible sync banner).

`git()` never throws — it returns `{ failed, out, err }` (`main.js:1017`). `syncStatus` **never inspects `.failed`** on the `status --porcelain` call: on failure, `out===''` → `untracked=0, dirty=0`, and (if the upstream lookup also fails) `ahead=0`, so `clean = true` with **no error field**.

Two owner-facing surfaces then paint green:
- **Owner Overview** — `syncDirty = !!(sync && !sync._error && sync.clean === false)` (`overview-logic.js:51`); `_error` is never set, so a git failure → `syncDirty=false`, the "not fully backed up" branch is skipped, and Overview can render **"Healthy — backed up"** (`:92`).
- **Sync banner** (always visible on the chat screen) — `if (s.clean && s.behind === 0)` then, with an upstream, **"everything is backed up."** (`renderer.js:1884-1885`, `cls='good'`). The worst trigger is a **partial** failure: `git status --porcelain` fails (transient `index.lock`, or a concurrent git) while `@{u}` still resolves → `clean=true` + `hasUpstream=true` → the banner claims "everything is backed up" over a tree git never read.

**Why critical:** the backup-safety signal greens on failure, on the surface the owner glances at to decide whether work is safe. The sibling `ciStatus` (`main.js:1029-1054`) and `doctor.ps1` both handle git failure correctly (`available:false` / WARN) — `syncStatus` is the lone surface that paints the failure green. **Confidence: high** (defect certain; trigger requires a git-command failure — the partial-porcelain-failure case reaches the strongest "everything is backed up" wording).

---

## IMPORTANT BOUNDED REPAIRS

- **I1 — Torn task/project-state writes.** `scripts/finalize-worker-handback.ps1:95-96,118-119` (also `advance-cockpit-state.ps1:96-97`): two sequential whole-object `Set-Content` writes of `task-state.json` then `project-state.json`, no atomic temp+rename, no transaction. A kill between the two lines leaves canonical state inconsistent (task advanced, project stale) with no retained generation. Bounded by pre-task `backup-protected-files.ps1` snapshots.
- **I2 — Project registry: non-atomic write + swallowed error + path-keyed identity.** `app/main.js:90-92` writes `projects.json` with a bare `fs.writeFileSync` inside `catch{ /* best effort */ }`; `readRegistry` (`:78-88`) swallows a parse error and resets to `{active:null,projects:[]}` then re-adds only HOME — a corrupt/partial write silently drops **every registered project** from the switcher and the next write persists that loss. Identity is keyed on the filesystem path (`:83`), so a moved/renamed project is silently dropped. Not in the backup set (lives in `userData`). Bounded: project folders survive and are re-addable.
- **I3 — `lifecycle-state.json`: two writers, no CAS.** `app/main.js:241-244` (`setPhaseKind`, main process) and `scripts/lifecycle-advance.ps1` (spawned `pwsh`) both read-modify-whole-write the same file with no revision/lock; interleaving loses an update on the phase-close pin. Non-atomic, no `.prev`, not in the backup set.
- **I4 — Live trust strip is a boot/action snapshot, never invalidated after a worker turn.** `app/renderer/renderer.js` `loadTrust()` runs at boot and on discrete actions, but `runSend()` (`:307-366`) does **not** refresh it. An in-app build turn that commits/pushes/edits leaves the Verified / backup / CI chips showing the previous snapshot with no "updating/stale" indicator. (The *failed-refresh* path is correctly handled → `unknown`.) This is the recurrence of the known "boot-snapshot, no runtime invalidation" systemic class, on the live trust strip.
- **I5 — Tests write the real repo's `PROJECT.md`.** `app/tests/e2e/ipc.spec.js:85-99` calls `saveMemory`, which (`main.js:31,175-179`) is **not** test-isolated the way `chatsDir()` is — in `PCC_TEST_MODE`, `projectDir` stays `HOME_DIR`, so it does a real `fs.writeFileSync` to the owner's actual `PROJECT.md` on every test/pre-commit run. Content is echoed back identically (bounds harm), and the test name "without changing the file" is inaccurate. Also the underlying write is non-atomic with no `.prev` (durability facet).
- **I6 — Authority store fails OPEN on a malformed (but parseable) entry.** `app/authority-store.js:66-72,47-56,102-109`: `load()` accepts `data.chats` as-is if it is an object; an entry missing `idleExpiresAt`/`hardExpiresAt` makes `now > undefined` false, so `expireOne` never drops it and `authorizeSend` returns `true` → **perpetual build (command-execution) authority**. Unreadable/unparseable stores *do* fail closed correctly; the gap is missing shape-validation of entries (violates "malformed fails closed" in the one security-sensitive domain). No failure-path test exists (`authority-store.spec.js` covers only well-formed persistence). Trigger is narrow (the store is normally written only by `approve()` with full deadlines), hence important rather than critical.
- **I7 — Owner Overview treats a detector that *could not run* as "no signal."** `app/renderer/overview-logic.js:50,84-110`: `notice()` fires only on `signal==='notice'`; a detector normalized to `'unknown'` (crashed) is non-raising, so if drift/staleDocs/bloat/highStakes all error, the ladder can fall through to **Healthy**. The trust strip's `railsFrom()` correctly treats `unknown` as unknown — Overview does not. (Medium confidence; individual Signals cards still show "could not run.")
- **I8 — Phase-close freshness gate goes false-green when `git log` fails.** `scripts/lifecycle-advance.ps1:73-76`: if `git log -1 --format=%ct` returns nothing, `$headEpoch=0`, so `$fresh = ($fileEpoch -ge 0)` is trivially true — the staleness half of the DECISION-012 "fresh PASS" gate is defeated on any git-timestamp failure. (The verdict/type/execution checks still apply, bounding it.)

---

## ORDINARY TECH DEBT

- **T1 — "Durable" chat mirror swallows write failure.** `app/main.js:742-762`: `transcript.jsonl`/summary whole-file writes inside `catch{ /* best-effort */ }`; comment says "durable." Derived mirror, **not** an authority (canonical `chats.json` is correctly sole authority, old `saveChatsBackup` disabled at `:775`) — only the wording overstates (Part 1 rule 2).
- **T2 — `pcc:verify` returns `{ok:true}` on any stdout even if the run errored.** `app/main.js:195-200`. Display-only; the real gate reads structured `VERDICT:`/`TYPE:` via `parseVerification`, so no false PASS reaches a trust verdict.
- **T3 — Backup push-failure branch unexercised.** `app/tests/e2e/sync.spec.js` drives only push-success; `main.js:1117-1119`'s `push.failed → ok:false` path has no test. Code is currently correct; a regression could show "backed up" without pushing.

---

## Examined and sound (NO DEFECT)

- **`app/state/atomic-store.js`, `chat-store.js`, `chat-service.js`, `chat-migrate.js`, `chat-bootstrap.js`** — the hardened reference: atomic temp+fsync+rename, `.prev` preserved before replace and never clobbered by a corrupt current, mandatory revision CAS, reread-verify, validate-before-serve/validate-before-write, project-identity binding. This is the pattern the findings above should adopt.
- **`app/ci-status.js`** — every unknown → `none`/`available:false`; refuses to read an unrelated green check as a pass. Reference-quality, commit-bound by HEAD sha.
- **`app/renderer/verification-parse.js`** — structured verdict/type parse; forgery seam (`isTrustedLocalProof` vs `isExecutedType`) correct.
- **`app/authority-logic.js`** and the **unreadable-store** path of `authority-store.js` — fail closed to `read_only`; a failed `persist()` loses an authorization (safe direction). (The *malformed-entry* path is I6.)
- **`app/backup-policy.js`, `app/chat-summary.js`, `app/chat-recall.js`, `app/stream-json.js`** — pure/honest; `safeJson` returns null and callers surface `ok:false`.
- **`scripts/backup-protected-files.ps1`** — new timestamped dir per run (corrupt run can't overwrite a good restore point); restore validates the manifest before copying.
- **`scripts/doctor.ps1`, `verify-product.ps1`, `verify-evidence.ps1`** — downgrade git/JSON failures to WARN/null; verdict derives from a real exit code; never a fabricated PASS.
- **Test isolation** (`app/tests/helpers/launch.js`) — throwaway `--user-data-dir` + fakebin + `PCC_TEST_MODE`; `sync.spec.js` uses a throwaway git project. The S6/S6.1 tests inject real `fs` faults against the real modules. (The one leak is I5.)
- **Single-instance lock** (`app/main.js:1155-1163`) — enforces the single-writer premise atomic-store relies on.

---

## Recommended hardening queue (your call to schedule — Part 7 does not fix)

Ordered by trust impact. Each would be its own bounded slice under the canonical workflow (implement → Codex falsify → commit after PASS).

1. **CRIT-1** — bind the Verified indicator to commit identity: record the verified SHA and compare `git rev-parse HEAD` (and working-tree dirtiness) instead of mtime-vs-commit-time; show "stale/uncommitted-changes" honestly.
2. **CRIT-2** — make `syncStatus` check `git().failed` and return a structured `_error`/`available:false`; **both** the Overview ladder (`overview-logic.js`) **and** the visible sync banner (`renderer.js:1881-1900`) must treat sync-unknown as *not* "backed up."
3. **I6** — validate authority entries on `load()` (drop any entry missing/!finite deadlines → fail closed to `read_only`); add the malformed-store failure test.
4. **I1/I2/I3/I5(write)** — route the registry, lifecycle pin, task/project-state, and `PROJECT.md` writers through the existing `atomic-store` primitive (atomic + `.prev`); stop swallowing their write errors.
5. **I4** — refresh the trust strip after a worker turn (or show an "updating" state); I7 — treat `unknown` detectors as unknown in the Overview ladder; I8 — fail the freshness gate closed when git can't report HEAD's time.
6. **I5(test)/T3** — isolate `memoryPath` in test mode; add the backup push-failure test.

Tech debt (T1/T2) does not need to block product progress.

---

*Part 7 is read-only classification. No fixes were applied. The critical/important items above are proposed for the hardening queue and await the owner's scheduling decision.*
