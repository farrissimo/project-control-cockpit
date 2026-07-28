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

Across the whole audit — including a mine of all 256 historical dev-session transcripts + in-app chats
(Stage 2, below) — these are the highest shock-risk gaps (likelihood you hit it × severity). Everything
else on the control surface is built and pinned by a test.

1. **CONFIRMED, live: the Send button silently stops working in a chat that isn't even busy.**
   Found investigating the owner's real chat-switching complaint from a few days of actual use, then
   reproduced end-to-end twice (Playwright, fake worker, zero real Claude usage). Switch to an idle
   chat while a *different* chat is mid-turn and try to send — nothing happens. No error, no queued
   delivery, the typed text just sits there. The global `busy` flag is the leading suspect but the
   exact mechanism isn't fully pinned down yet (a follow-up check found the disabled-state timing more
   complex than one line — see hit-list #0 for the honest detail). Waited 10s past the
   other chat finishing — the stuck message never recovered on its own (hit-list #0).
2. **"Steering" doesn't steer — and this is the single most-repeated complaint in PCC's history.**
   Typing while a turn runs **queues** a message for after it finishes; it does not redirect the running
   worker. Raised independently in 9+ separate sessions over weeks. Once fake-verified (a commit claimed
   "steer" worked when it didn't) — that false stamp is long since closed, but the underlying control
   still isn't built (§0.1 / hit-list #1).
3. **You can't watch the worker work — and now there's a root cause.** No live activity feed, only a
   "Claude is working…" timer. One transcript names why: *"the worker runs one-shot and discards tool
   events"* — it's an architecture gap, not a missing UI widget (§0b.1). *The top trust item for the
   proving window.*
4. **The removed chat-length meter left a real need unmet.** Its removal (ADR-0025) was the right call —
   a meter that lies is worse than none — but "how do I know this chat is safe to keep going" is still a
   live, repeatedly-raised owner pain with no honest replacement (§0b.3).
5. **Usage accuracy on a cold turn is unproven**, and **two internal tools you're about to rely on**
   (`verify-evidence.ps1`, the Verify tab on no-remote projects) have transcript-flagged reliability
   questions that were never re-confirmed fixed (§0b.2, Stage 2 tooling section).
6. **Two smaller, concrete things to click-check:** delete-chat's confirm dialog differs from the rest of
   the app (hit-list #2), and closing PCC via the X should be confirmed to actually kill every underlying
   process (Stage 2, S2.3).

The rest of this document is the evidence and the full click-through order behind those six.

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
| 0 | **Sending in one chat while another chat's turn is still running** | type + Send in an idle chat you switched to (per PR #83's fix, switching itself works) | the idle chat sends immediately — its own turn is independent of any other chat's | **CONFIRMED, reproduced live twice** (Playwright + the deterministic fake worker, zero real usage): switch to an idle chat while a different chat is mid-turn, type a message, click Send — **nothing happens.** The composer keeps the typed text; the log never leaves the welcome screen; no error, no bubble, no queued-later delivery. Waited a further 10s past the other chat's turn finishing — the stuck message never sent on its own; a real user would have to notice and manually re-send after the *unrelated* chat happens to finish. **Root cause: hypothesized, not fully pinned down.** The global `busy` flag (renderer.js:29) and `sendBtn.disabled = inRecovery \|\| busy` (line 104) are strong candidates — a follow-up check showed `#send.disabled` reading `false` at points where `true` was expected, meaning the disable/re-enable timing involves more than one code path (`setRecoveryState`, lines 1240/1250, and whatever re-syncs the button on a chat-store refresh). The BEHAVIOR is certain; the EXACT internal mechanism needs closer instrumentation before anyone tries to fix it. "New chat" is separately confirmed silently blocked the same way (renderer.js:830) — before/after row counts identical. "Enable build session" / correction chips were checked on the SAME busy chat (not after switching away) and did not clearly reproduce — inconclusive, needs a same-chat-switched-away retest. | **B — CONFIRMED (behavior); root cause UNCERTAIN** | Live reproduction, this session, 2026-07-27 (fake worker, no real Claude usage), 2 separate runs | reproduced; still worth an owner click to feel the actual UX (button just sits grey, no explanation) |
| 1 | **Steer a running turn** | typing in `#input` while a turn runs (`#steer-hint`) | redirect/correct the **currently running** worker mid-turn (like Claude/Codex desktop; ADR-0013 "steer half") | message is **committed + queued** and sent as a **new turn after the current one finishes** (renderer.js:32, 440–479); worker is not steered mid-flight | **B** | STATED PROJECT.md:51 ❌; ADR-0013; REFERENCE "mimic Claude/Codex desktop" | type a redirect mid-turn — does the running answer change, or only get a follow-up after it ends? |
| 2 | **Delete a chat** confirm dialog | 🗑 on a chat row → `deleteChatFiles` + `chatsDelete` | a reliable, on-brand confirm before deleting (as used for every other destructive action) | uses **native `confirm()`** (renderer.js:1457), *not* the Electron-safe `pccConfirm` the app deliberately built and uses everywhere else. **Logic partially confirmed live**: both Accept (deletes, message correct) and Cancel (aborts, chat stays) work correctly under automated testing. **Not fully verifiable by me** — Playwright intercepts native dialogs entirely, so this proves the JS-level logic is right but can't prove the actual native OS dialog renders/behaves well in the real packaged app, which is exactly what `pccConfirm` was built to avoid. | **B?** (logic confirmed A; native-dialog-in-real-app still open) | Live reproduction (logic) + INFERRED (code inconsistency; native dialogs are why `pccConfirm` exists) | one real click on 🗑 in the actual running app — does the native popup look/feel right, and does it ever get stuck behind the window? |
| 3 | **Attach / paste / drop files** | `#attach-btn` +, paste image, drag-drop onto `#composer` | attachment reaches the worker and influences its answer | files are read client-side into `attachments[]` and passed to `send`; **no dedicated E2E spec** exercises the round-trip | **C?** | STATED (shipped per project memory "image paste + file '+' SHIPPED") | attach an image + a file, send, confirm the worker actually receives/uses them |
| 4 | **Model selector** | `#model-select` (change) | the chosen model actually answers the next turn | writes `localStorage['pcc.model']`, read by `getSelectedModel()` into `send`; **no spec asserts the selected model is the one used** | **C?** | INFERRED | pick a different model, send, confirm the reply came from it |
| 5 | **Correction chips (×9)** — "Check prior art", "Rabbit-hole check", "Push back", etc. | corrections bar buttons | each sends its exact canned instruction (alone or appended to the draft) | each calls `sendMessage(cannedText)`; **no spec pins the chip→text mapping**, so a wrong/renamed chip text ships silently | **C** | STATED (owner-named "Check prior art" button in CLAUDE.md) | click each chip, confirm the sent text matches its label's intent |
| 6 | **Rename a chat** | ✎ on a chat row → `pccPrompt` → `chatsRename` | rename persists and locks the name (no auto-rename overwrite) | **CONFIRMED, reproduced live**: renamed a chat, name updated immediately in the row, then did a **full app restart** (close + relaunch on the same profile) — new name still there. Works correctly. | **A** | Live reproduction, this session, 2026-07-27 | resolved — no owner action needed |
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

## Stage 2 — transcript + in-app chat mine (owner-authorized, run 2026-07-27)

Mined the full corpus: 256 dev-session transcripts (266MB, `~/.claude/projects/C--ProjectControlCockpit/`,
sharded 8-way) + 11 in-app PCC chats (3 live + 8 exported), via 9 parallel read-only agents, grep-first
so multi-MB session logs didn't blow context. Below is the synthesis — not a raw dump of everything
found (that would violate "keep it lean"); only what changes or strengthens the register.

**Integrity note on this run's own data:** one transcript shard (`37709fd2....jsonl`) is *this current
session's own live log* — it was still being written while the mining agents ran, so a few of its "hits"
were the mining agent reading back things **I had already written earlier in this same session** (the
pccConfirm-vs-native-confirm() note, the "save-chats-backup no-op" note). Those are **not independent
corroboration** and are excluded from the counts below; they remain exactly as already sourced (direct
code reading), not inflated with a circular transcript citation.

### What this confirms (independently, across many separate historical sessions)

- **Steer doesn't steer** (hit-list #1) — the single most-repeated owner complaint in the entire corpus,
  independently raised in at least 9 separate historical sessions across weeks/months ("stop button
  seems to work but steer isn't an option," "steering genuinely doesn't work in the running app for some
  reason I can't see statically," "steer was claimed done... doesn't even show for you"). One session
  notes it was **fake-verified**: 6 "desktop-parity" commits were stamped `Verified-Receipt` while steer
  was actually broken underneath — a historical false-green, since closed by governance hardening. This
  is not a one-off; it is the most persistent unmet expectation in PCC's history.
- **No live worker-activity feed** (§0b.1) — independently raised at least 5 times ("the worker feed
  isn't showing any changes, I was expecting more activity," "nothing happens when I click on those
  journey buttons... I would expect a slideout," "an in-chat progress bar... it would auto-refresh," "it
  just powers through the work completely silently"). One session gives a **root cause**: *"the worker
  runs one-shot and discards tool events"* — the backend never keeps the incremental `tool_use` stream
  around long enough to show it, confirming this is an architecture gap, not a rendering oversight.
- **The removed chat-length meter left a real, still-felt owner need** (§0b.3) — independently raised
  repeatedly ("chat health meter sucks, how am I supposed to know it's going off the rails," "I can't
  objectively tell when a chat is no longer safe to continue," "all the safety and invisible stuff needs
  to be automatic, hidden from me, but needs a token count"). ADR-0025's removal was correct (a meter
  that can't be shown truthfully is worse than none) — but the owner's underlying need was never
  re-solved, only the dishonest solution was removed. Upgrading this row's residual-risk note.

### New findings (not previously in this register)

| # | behavior | expected | found in transcripts | class | source | on-screen probe |
|---|---|---|---|---|---|---|
| S2.1 | **Desktop shortcut launch** | launching PCC via its desktop shortcut opens the current build with full, current data | Two separate historical incidents: shortcut bypassed a launcher fix and ran a stale build ("of course it 'didn't work' — it never ran"); a second session: "the desktop shortcut doesn't work. that's what we fought all morning." Both were resolved *in-session* at the time, but the failure mode (shortcut ≠ the code path Playwright launches) is structural, not a specific bug — no E2E test launches via an actual `.lnk` shortcut | **C** (untested path) | STATED — 2 independent sessions | launch PCC from its real desktop shortcut (not a terminal command) and confirm it's the current build with full chat history |
| S2.2 | **Remote/mobile control** | a `/remote-control`-style capability so the owner can interact with a project away from the desktop, matching the Claude-desktop-app anchor | "no /remote-control flag in the pcc app at all and I use that all the time in the desktop-app" | **D** (real gap, never built, not rejected) | STATED — 8345031d…jsonl; REFERENCE "mimic desktop app" | none — not built; flag for a scoping decision, not a click-check |
| S2.3 | **Close (X) fully terminates the app** | clicking the window close button kills the app and all underlying worker/child processes, permanently | "fix it so that when I click the X to close the app it actually closes the app and any underlying processes... it better be a permanent solution not some half-assed patch" | **C?** (likely fixed — `singleton.spec.js` covers single-instance handling, but not confirmed to cover full process-tree termination on close specifically) | STATED — 85961ade…jsonl | close via the X, confirm no orphaned Electron/node process remains (Task Manager / `tasklist`) |
| S2.4 | **App never hangs unrecoverably on "Claude is thinking"** | a hung turn is always stoppable; the owner should never have to force-close the whole app | "it doesn't respond once it says 'Claude is thinking'... I couldn't stop it so I just closed the app" | **A?** (the Stop button — ADR-0013 — was built afterward and PROJECT.md marks it ✅ owner-tested; this looks historically resolved, but worth one re-confirm given the severity of the original incident) | STATED — f3b44eac…jsonl (historical, pre-Stop-button) | trigger a long turn, click Stop, confirm it actually interrupts rather than just hiding the "thinking" bubble |

### Internal tooling reliability (not a UI control, but real and owner-raised)

- **`verify-evidence.ps1` may still hand the verifier a stale diff range** instead of the change actually
  in flight — flagged as "known broken" in one session (2edb894a…jsonl) and matches an existing standing
  note (project memory: *"PCC's own verification tooling has proven defects — verify-work.ps1 stale
  range"*). Not re-confirmed fixed; worth a direct check before trusting any Codex verdict this register
  depends on.
- **PCC's Verify tab may time out on local-first / no-remote projects** rather than degrading gracefully,
  unlike Backup (which already has an honest local-only tier) — STATED, 3334ee25…jsonl. Not re-confirmed
  fixed or broken.

### Test-suite finding (a side effect of this audit, not a transcript item)

Running the full suite during this work surfaced a **live-data dependency in `continue-fresh-chat.spec.js`**:
its first test hardcodes an expectation that the "Continue in fresh chat" button carries CSS class
`clear`, but that class is driven by the **real, unmocked Claude 5-hour usage percentage**
(`app/renderer/renderer.js:2311-2315`, thresholds in `app/renderer/usage-protection.js`) — at ≥70% real
usage the button legitimately switches to `notice`. The code itself was verified correct (it does build
the handoff before opening the new chat, contrary to an old transcript complaint that the live button
skipped this — that appears already fixed). The test failure is an **environmental flake tied to how
much of the real Claude plan has been used**, not a regression from any change in this session. Follow-up
worth flagging separately: this test should stub usage like its sibling tests do, so it isn't flaky
during exactly the high-usage periods (like this one) when you'd most want the suite trustworthy.

### Not re-litigated (already correctly closed, confirmed by the mine)

PR #50's failing-tests-at-merge incident, the 6 fake-verified desktop-parity commits, Owner Overview not
checking CI result, `doctor.ps1`/scaffolder false alarms, and the scaffolder's own defect-cloning risk are
all **historical** — each has a matching spec now in the suite (`work-packet-messages.spec.js`,
`governance-gate.spec.js`, `overview-ci-claim.spec.js`, the scaffold-kit "passes doctor with no ISSUEs"
test) or was addressed by later governance hardening. Listed here only so a future audit doesn't
re-surface them as if new.
