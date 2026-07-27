# Expectation Audit — retroactive Expected-Behavior Map for PCC (ADR-0027, backfill)

> **What this is.** A one-time archaeology that builds the Expected-Behavior Map for everything
> **already built** in PCC, so the gap between *what a feature was meant to do* and *what actually
> got built + tested* becomes visible **before the owner is forced to find it by pressing a button**.
> This is the retroactive companion to the forward-process rule in
> [ADR-0027](adr/0027-expected-behavior-map-traceability.md); new features carry their map in their
> own ADR. PCC only (not spawned projects, not ITM).
>
> **Why it exists.** On 2026-07-27 the owner pressed real cockpit buttons for the first time and
> instantly hit two defects (switch-chat-while-busy blocked; search didn't jump to the match). Both
> were **built, tested, and CI-green** — and still wrong, because they were built to a *narrower
> behavior than expected* and no test encoded the fuller expectation. **CI-green proves "the code does
> what its tests say," not "the app does what the owner expects."** This register is how we check the
> second thing.

## The short version — what's most likely to surprise you

Across the whole audit, these are the highest shock-risk gaps (likelihood you hit it × severity).
Everything else on the control surface is built and pinned by a test.

1. **You can't watch the worker work.** There's no live activity feed — only a "Claude is working…"
   timer. The real-time stepper/action-timeline the design calls for isn't wired (§0b.1). *This is the
   "it works silently" problem — the top trust item for the proving window.*
2. **"Steering" doesn't steer.** Typing while a turn runs **queues** a message for after it finishes; it
   does not redirect the running worker. The docs admit this (§0.1 / hit-list #1).
3. **Usage accuracy on a cold turn is unproven.** The cold per-message usage measurement was halted on a
   real defect and never re-proven (§0b.2).
4. **Delete-chat uses a different confirm dialog** than the rest of the app — worth one on-screen check
   that Cancel/OK behave (hit-list #2).

The rest of this document is the evidence and the full click-through order behind those four.

## How to read this

Each row maps: **behavior → control (which button/action) → expected result → source → status → test/evidence.**

**Source type** — where the expectation comes from:
- **STATED** — explicitly written in a chat or doc (cited).
- **INFERRED** — deduced by the auditor (said so; used sparingly).
- **REFERENCE** — imported from a reference anchor (e.g. *"mimic the Claude/Codex desktop chat"*), which
  compactly imports a whole behavior set (auto-resize, stop button, …) without enumerating each.

**Status taxonomy** (the class the row falls in):

| class | meaning | is it a gap? |
|---|---|---|
| **A** | built + tested + matches the expectation | no |
| **B** | built + tested **but narrower/different** than expected (the #2/#3 shock class) | **yes — the dangerous one** |
| **C** | built but **not** tested (no test encodes the behavior) | yes |
| **D** | expected, **not built**, and not rejected/deferred/superseded | yes |
| **E** | not built **because** explicitly rejected/deferred/superseded | no (but flag overdue deferrals) |
| **F** | previously worked, now **regressed** | yes |

> **Class B is the killer** — it looks green, passes everything, and is still not what the owner meant.
> A naive "is it tested?" check (or code coverage) misses class B entirely. **Coverage ≠ intent.**

**Two axes of "done."** PCC deliberately tracks two different proofs, and this register keeps them
separate because conflating them is the whole bug:
1. **Automated-test status** — does a real test exercise the behavior? (CI green.)
2. **Owner-proven status** — has the owner seen it work on his real screen? (ADR-0009 sign-off gate (b).)
   PROJECT.md tracks this as ✅ proven / ⬜ not-yet-proven / ❌ not working.

A behavior can be automated-tested (A) yet still ⬜ owner-unproven — and that ⬜ is exactly where a
class-B surprise hides. The **Owner-proven** column carries the ✅/⬜/❌ so the final click-through test
knows what to look at first.

**Ranking.** Rows are ordered by **shock-risk = likelihood the owner hits it × severity if wrong**, so
this reads as a hit-list, not a flat inventory.

**Provenance rule.** Every row cites a source and evidence. An unknown stays **"unknown"** — no invented
gaps, no manufactured green. Same no-fake ethos as the rest of PCC.

**Living document.** This can never be "complete" (emergent requirements are real — the owner didn't
know he wanted to resize the chat box until he used it). It captures every *known* expectation now and
grows as new ones surface in use or audit.

---

## Section 0 — Recorded gaps (already admitted in the docs — highest confidence)

These are pre-existing, doc-stated gaps: PCC already wrote them down. They need no archaeology — they are
the register's highest-confidence rows and the first things the sign-off test should probe.

| # | behavior | control / area | expected result | source | class | owner-proven | evidence / test |
|---|---|---|---|---|---|---|---|
| 0.1 | **Steer a running turn** — inject a mid-turn correction to the worker | typing while a turn runs (`#steer-hint`) | a steer input that redirects the **running** worker mid-turn | typing **queues** a message sent as a new turn after the current finishes — not live redirect (renderer.js:32,440) | **B** | STATED — PROJECT.md:51 ❌; ADR-0013:65 *"next-turn (queued), not true in-flight token-level injection"* | see hit-list #1 |
| 0.2 | **Per-turn cost cap** shows/enforces on screen | usage protection | ADR-0014 cap visible + enforced on the owner's screen | STATED — PROJECT.md:54 *"⬜ not yet proven on screen"*; [ADR-0014] | A? | ⬜ | `e2e/usage-protection.spec.js`, `e2e/nearest-limit.spec.js` (code path tested; on-screen unproven) |
| 0.3 | **Cross-turn cost rollover** | usage protection | ADR-0015 rollover carries across turns, visible | STATED — PROJECT.md:55 *"⬜ not yet proven on screen"*; [ADR-0015] | A? | ⬜ | `e2e/cost-rollover.spec.js` (path tested; on-screen unproven) |
| 0.4 | **Durable per-chat cost across restart** | chat cost | ADR-0017 per-chat cost survives an app restart | STATED — PROJECT.md:56 *"⬜ not yet proven on screen"*; [ADR-0017] | A? | ⬜ | `unit/*`/`e2e/*` cost-store (path tested; on-screen unproven) |
| 0.5 | **Plain-language usage-limit message** | usage limit notice | ADR-0018 shows a human message when a cap is hit | STATED — PROJECT.md:57 *"⬜ not yet proven on screen"*; [ADR-0018] | A? | ⬜ | `e2e/payload-cap-notice.spec.js` (path tested; on-screen unproven) |
| 0.6 | **Packaged installer / fresh-machine install** works | (build/dist) | app installs + runs from the packaged installer on a clean machine | STATED — PROJECT.md:337 *"explicitly deferred and needing owner go"* | **E** | ⬜ | deferred (overlaps sign-off gate (b)) |
| 0.7 | **Dual-control evidence** for high-stakes actions | (governance) | second-control requirement when dual-control evidence is required | STATED — PROJECT.md:455 *"explicit left-disabled"* | **E** | n/a | intentionally disabled (flag if it becomes needed) |

> `A?` = an automated test exercises the code path, but because it has never been proven on the owner's
> screen we cannot yet rule out a class-**B** narrowness (the #2/#3 pattern). The sign-off click-through
> resolves each `A?` to a firm A or B. This honest uncertainty is the point — not a fake A.

### Section 0b — Feature-scale gaps admitted in the docs (owner-facing)

Larger than a single button — whole expected capabilities the docs themselves record as not-built,
disabled, or deferred. Sourced from the ADRs/specs/mockups; each verified against the code where noted.

| # | expected capability | expected result | actual | class | source (verified) |
|---|---|---|---|---|---|
| 0b.1 | **Live worker feed / progress streaming** — the owner watches what the worker is *doing* in real time | a LIVE bar + done/current/next stepper + an incremental **action timeline** (each `tool_use` shown as it happens), per ADR-0011 / DECISION-107 | **not wired.** The only live signal is a generic *"Claude is working… (elapsed)"* bubble + Stop; renderer.js:245 defers live tool events to *"the separate action-timeline spec"*; main.js renders the **final** result, not incremental events | **D** | STATED — spec `owner-cockpit.md` AC-12..24, `action-timeline.md`; mockups `feed-6-guided.html` (labelled *"honestly… not wired yet"*). **Verified**: renderer.js:245, main.js result-path. **= handoff open-thread #1 (trust-critical).** |
| 0b.2 | **Cold per-message usage accounting** — the real usage cost of each message is trustworthy | usage numbers materially correct on a cold (non-warm-worker) turn; the ADR-0016 usage-trust blocker closed | **UNPROVEN — Gate 0 HALTED** (2026-07-24): cold-restart measurements "materially false"; root cause "returns to UNTESTED" | **D** (open, unproven) | STATED — spec `gate-0-usage-proof.md`; ADR-0020:33 |
| 0b.3 | **Automatic context-rollover before a chat runs away** | catch a chat whose context has grown huge (the "426K-token chat that stayed green") before it degrades | **deliberately REMOVED as dishonest** (ADR-0025 removed the meter; ADR-0019 superseded; T1 auto-rollover flag off). The runaway is now covered **only** by the *manual* "Continue in fresh chat" button | **E** (rejected — not a gap) | STATED — PROJECT.md:60–66; ADR-0025; spec `t1-deterministic-compaction.md` AC-6. *Residual risk noted: manual-only coverage.* |
| 0b.4 | **Sign-off gates (a) + (b)** — the final owner acceptance | gate (a) report **signed**; gate (b) a **live spawned-project build** proven end-to-end | gate (a) built + published but **under owner review, unsigned**; gate (b) **not done**; packaging/installer deferred | **E** (deferred, owner-gated) | STATED — PROJECT.md:337; ADR-0009. *This register IS the gate-(b) click-through script.* |

> **Not gaps (historical defects already fixed — recorded so they're not re-counted):** the
> *Send-button-stuck-disabled* defect (now `send-button-busy-state.md`, tested), the *build-session
> silent-expiry* defect (now `build-session-countdown.md`, tested), and *scaffold-dirty-at-birth* (now
> `scaffold-project-identity.md`, tested) were all real once and are **class A** now. The docs describe
> the defect each spec *closed* — they are proof the map works, not open items.

---

## Section 1 — Ranked shock-risk hit-list (the payoff)

Built from the Stage-1 extraction: every user-facing control in `app/renderer/renderer.js`
(7 tabs — Chat, Project, Rules, Memory, Lifecycle, Signals, Verify — plus global chrome and the
create-flow / summary / no-project overlays) cross-referenced against the 65 IPC channels in
`app/main.js`, the docs-stated expectations, and the E2E suite (`app/tests/e2e/`).

**The overwhelming majority of the control surface is class A** — built and pinned by a matching E2E
spec (chat switching `chat-nav`, search-jump `chat-search`, composer resize `composer-size`, stop
`stop-worker`, usage protection `usage-protection`/`nearest-limit`, backup/sync `sync`, lifecycle
`lifecycle-advance`, detectors `detectors`, create-flow `create-flow`, handoff `handoff-packet`, …).
Those are not re-listed here. **This hit-list is only the rows that are NOT a clean A** — the places a
button-press could surprise the owner — ordered by shock-risk (likelihood he hits it × severity).

| rank | behavior | control | expected result | actual (from code) | class | source | on-screen probe for sign-off |
|---|---|---|---|---|---|---|---|
| 1 | **Steer a running turn** | typing in `#input` while a turn runs (`#steer-hint`) | redirect/correct the **currently running** worker mid-turn (like Claude/Codex desktop; ADR-0013 "steer half") | message is **committed + queued** and sent as a **new turn after the current one finishes** (renderer.js:32, 440–479); worker is not steered mid-flight | **B** | STATED PROJECT.md:51 ❌; ADR-0013; REFERENCE "mimic Claude/Codex desktop" | type a redirect mid-turn — does the running answer change, or only get a follow-up after it ends? |
| 2 | **Delete a chat** confirm dialog | 🗑 on a chat row → `deleteChatFiles` + `chatsDelete` | a reliable, on-brand confirm before deleting (as used for every other destructive action) | uses **native `confirm()`** (renderer.js:1457), *not* the Electron-safe `pccConfirm` the app deliberately built and uses everywhere else (rename, discard-project, end-build) | **B?** | INFERRED (code inconsistency); native dialogs are why `pccConfirm` exists | click 🗑 — does a proper confirm appear and does Cancel truly abort / OK truly delete? |
| 3 | **Attach / paste / drop files** | `#attach-btn` +, paste image, drag-drop onto `#composer` | attachment reaches the worker and influences its answer | files are read client-side into `attachments[]` and passed to `send`; **no dedicated E2E spec** exercises the round-trip | **C?** | STATED (shipped per project memory "image paste + file '+' SHIPPED") | attach an image + a file, send, confirm the worker actually receives/uses them |
| 4 | **Model selector** | `#model-select` (change) | the chosen model actually answers the next turn | writes `localStorage['pcc.model']`, read by `getSelectedModel()` into `send`; **no spec asserts the selected model is the one used** | **C?** | INFERRED | pick a different model, send, confirm the reply came from it |
| 5 | **Correction chips (×9)** — "Check prior art", "Rabbit-hole check", "Push back", etc. | corrections bar buttons | each sends its exact canned instruction (alone or appended to the draft) | each calls `sendMessage(cannedText)`; **no spec pins the chip→text mapping**, so a wrong/renamed chip text ships silently | **C** | STATED (owner-named "Check prior art" button in CLAUDE.md) | click each chip, confirm the sent text matches its label's intent |
| 6 | **Rename a chat** | ✎ on a chat row → `pccPrompt` → `chatsRename` | rename persists and locks the name (no auto-rename overwrite) | wired via Electron-safe `pccPrompt`; `chatsRename` referenced in only ~1 test — thin coverage | **C?** | INFERRED | rename a chat, reload, confirm it stuck |
| 7 | **Save the brief (Memory tab)** | `#memory-save` → `saveMemory` | edited PROJECT.md text is written atomically | wired to `saveMemory` (atomic write); **no dedicated E2E spec** for the Memory tab save | **C?** | INFERRED | edit Memory, Save, reopen, confirm persisted |
| 8 | **"Save chats backup"** | (internal) `pcc:saveChatsBackup` | — | **disabled no-op**, returns `ok:false` (main.js) | **E** | INFERRED (dead channel) | none — confirm nothing in the UI still calls it expecting success |

> **How to use this list:** rows 1–2 are the real shock candidates (a built-but-narrower behavior and a
> reliability inconsistency); rows 3–7 are "built, but no test encodes the owner-facing expectation"
> (class C — the intent isn't pinned, so it can drift silently); row 8 is dead code to confirm-and-forget.
> `B?`/`C?` = the code strongly suggests this class but it needs the on-screen probe to confirm. None of
> these are asserted as confirmed bugs — they are ranked *risks*, each with the exact check that resolves it.

## Section 2 — Per-area control-surface index (the spine, for completeness)

The full built surface, by tab, with status. Class-A rows (built + E2E-pinned) are summarized per area
rather than enumerated; the exceptions are the hit-list above. This is the click-through order for the
final sign-off test.

| tab / area | controls | dominant status | E2E anchor | exceptions (see hit-list) |
|---|---|---|---|---|
| **Chat** | switch/new/rename/delete chat, search+jump, summary drawer, composer (resize/attach/paste/drop/Enter), stop, steer-queue, corrections bar (×9 + capture-decisions + second-opinion), handoff-packet, continue-fresh-chat, usage-hold gate, model select, welcome chips | mostly **A** | `chat-nav`, `chat-search`, `chat-summary`, `chat-recovery`, `composer-size`, `stop-worker`, `continue-fresh-chat`, `usage-protection`, `handoff-packet` | steer (#1), delete-confirm (#2), attach (#3), model (#4), chips (#5), rename (#6) |
| **Project** | back-up now / get-latest / refresh sync, new-project, generate+copy handoff, owner overview, metrics, decisions | **A** | `sync`, `create-flow`, `handoff-packet`, `owner-overview`, `overview-ci-claim` | — |
| **Rules** | display-only (`getRules`) | **A** (display) | — | — |
| **Memory** | edit + save PROJECT.md | **C?** | none dedicated | memory-save (#7) |
| **Lifecycle** | advance-stage (gated), verify-then-advance, mark-review-phase, jump-to-verify | **A** | `lifecycle-advance`, `lifecycle` | — |
| **Signals** | refresh (runs 6 detectors + stakes), signal cards | **A** | `detectors`, `classify-stakes` | — |
| **Verify** | run product, verify product, run Codex review, hard-checks (git+doctor) | **A** | `ipc`, `verify-evidence`, `crosscheck` | — |
| **Global chrome** | project switcher, tab nav ×7, enable/end build session, trust chips (display), tool-warning, proving-window bar, pccPrompt/pccConfirm modals | **A** | `authority`, `multiproject`, `proving-window`, `buttons` | — |
| **Create-flow overlay** | interview composer, save project, cancel, pick location | **A** | `create-flow` | — |

*Method note:* status is assigned from (a) whether an E2E spec exercises the behavior and (b) direct
source reading. "A" means an E2E spec pins it; "C?" means built but no spec encodes the owner-facing
expectation; "B/B?" means built to a **narrower** behavior than expected. Coverage was cross-checked
against `app/tests/e2e/` (41 specs). This is the **automated** axis; the **owner-proven** axis (✅/⬜/❌)
is tracked in Section 0 and resolved by the sign-off click-through.

---

## Stage 2 (not yet run — explicit owner opt-in required)

Sections 0–2 are **Stage 1**: bounded, sourced from the finite control surface + the docs + the test
suite. **Stage 2** mines the ~254 dev-session transcripts + in-app chats for *undocumented / emergent*
expectations — the class that never made it into any doc (the #2/#3 pattern was exactly this). It is
token-heavy and is a parallel-agent job; per ADR-0027 it runs only on the owner's explicit go. Until
then, this register is complete **for everything the docs and code already record**, and honestly
silent about what only the chat history knows.
