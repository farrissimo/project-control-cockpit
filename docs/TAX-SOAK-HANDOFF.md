# HANDOFF — End-to-End Test: Can PCC Build a Real App the Way It's Designed?

Read this whole file first. It is the complete brief for a fresh chat taking over a
soak test. Nothing here should be re-derived or re-decided — it was all agreed with
the owner. This is the highest-priority work.

---

## 1. THE MISSION (what is actually being tested)

The test is **PCC**, not the app being built. The single question:

> **Can PCC — used exactly the way a non-coder owner/visionary would use it — take a
> real project from where it is now to a working V1, end-to-end, the way PCC was
> DESIGNED to build?**

You are playing the **owner / visionary**. Not the engineer. You sit in the cockpit,
talk to PCC in plain language, click PCC's buttons, read PCC's views/metrics, and let
**PCC** (its in-app worker + lifecycle + verification) do the building and governing.

The deliverable is TWO things, equally important:
1. A working V1 of the app, built **entirely through PCC's designed loop**.
2. An **honest log of the owner experience** — every friction, every break, every
   place PCC forced you out of the cockpit, every confusing or fake-feeling moment.
   The findings are as much the point as the app. Things WILL break. Document them.

---

## 2. THE HARD RULES (no shortcuts — this is the crux we kept getting wrong)

The owner said "no shortcuts" repeatedly, and the disconnect was always the same: the
assistant kept doing PCC's job from OUTSIDE the cockpit to be faster/cleverer. Do not.

**You may ONLY act as the owner in the cockpit:**
- Type plain-language requests into PCC's chat. Click PCC's buttons. Read PCC's views.
- That is the entire allowed toolset for the BUILD. Nothing else.

**PCC builds — you do not:**
- You NEVER write or edit the app's code. PCC's in-app worker (`claude -p`, Sonnet 5)
  writes it. You drive it with plain-language chat requests.
- You NEVER verify by running tests/commands in a terminal. You verify THROUGH PCC
  (the Verify view, the lifecycle "no done without a PASS" gate). Whether PCC's OWN
  verification catches problems is part of what's being tested — if you check it
  yourself in bash, you hide that.
- You NEVER govern from outside. PCC's lifecycle (define → plan → work → verify →
  phase-close → …) drives the build, one **bounded** task at a time.

**No efficiency shortcuts — the instinct to optimize IS the shortcut:**
- No "build it all end to end in one shot." Small, bounded steps only.
- No background runs, no batching multiple steps, no clever workarounds.
- Be a patient, even tedious, owner. Slow-and-faithful beats fast-and-clever.

**Every time PCC forces you out of the cockpit** (to a terminal, to edit a file, to
manually check something) that is a **FINDING to document**, not a thing you quietly
do to keep moving. If PCC can't do something an owner needs, that's the result we want.

**On fixing PCC bugs mid-test:** default to DOCUMENTING PCC's failures, not fixing
them inline. Fixing PCC is a separate engineering activity that contaminates the test.
Only if PCC is truly BLOCKED and can't proceed, surface it to the owner and decide.

---

## 3. PUT THE OWNER/VISIONARY HAT ON (how to think)

You are a non-coder product lead. Judge everything by the owner's real questions:
- Is it obvious what's happening? Do I trust what I see?
- Is the project still becoming what I meant to build?
- Does anything need me? What's the next move? What's proven vs not?

Notice and document UX friction the way a real owner would. Good examples of this
thinking already surfaced: "the intake asks a LOT of questions before you get to
build" and "I can't find the owner vision view — the app drops me into a chat with
seven technical tabs." That is exactly the texture to capture.

---

## 4. HOW TO DRIVE THE APP (your "hands" — this is allowed, it's not a shortcut)

You cannot use a physical mouse, so you drive the REAL Electron app via Playwright —
but ONLY to do what a human does: click real buttons, type in the chat, read rendered
output. NEVER call IPC handlers directly (`window.pcc.*`) to do or check work — that
bypasses the UI and is a shortcut. (Reading state via a direct call is acceptable ONLY
for your own debugging of a suspected bug, never as a substitute for the owner action.)

Mechanics that worked:
- Launch the real app with a **persistent user-data-dir** so the chat/session/registry
  survive between launches:
  `UDD = C:\Users\farri\AppData\Local\Temp\claude\C--ProjectControlCockpit\<session>\scratchpad\p3-udd`
  (the existing p3-udd already has the tax project registered + the intake chat).
- Use the REAL worker: launch with a plain `_electron.launch({ args:[APP_DIR, '--user-data-dir='+UDD], cwd: APP_DIR, env: {...process.env} })`.
  Do NOT use the test helper `launchApp` and do NOT prepend `tests/fakebin` to PATH and
  do NOT set `PCC_TEST_MODE` — those force the FAKE worker. Real end-to-end needs the
  real Sonnet 5 worker. (Confirmed reachable: `claude -p` returns here.)
- Key selectors (real DOM, click these):
  - Sidebar nav: `.nav[data-view="chat|project|rules|memory|lifecycle|signals|verify"]`
  - Chat: input `#input`, send `#send`. Worker replies render as `.bubble.assistant`
    (errors as `.bubble.error`). Correction chips SEND immediately (they don't fill
    the box).
  - Project switcher: `#proj-switch` opens the panel; rows are `.proj-row` (match by
    name; the tax project shows as **"Tax Prep Cockpit"** after the W5 fix).
  - New project: `#new-project` → name modal `[data-testid="prompt-input"]` +
    `[data-testid="prompt-ok"]`.
  - Back up: `#sync-backup` (commit+push), `#sync-pull`, `#sync-refresh`.
  - Lifecycle Advance: buttons inside `#view-lifecycle` labelled "Advance to <Stage>".
  - Verify: hard checks auto-run when you open the Verify view; `#verify-run` = Codex
    independent review. Signals: `#signals-refresh`.
- Waiting for the worker: turns are slow (15s to several minutes). Wait for a NEW
  `.bubble.assistant` to appear and its text to stop changing (stable ~5s).
- **The foreground command timeout is 13 minutes.** This is exactly WHY steps must be
  small — a bounded task finishes inside that window. If something legitimately needs
  longer, SAY SO out loud; never hide it behind a background run.
- Models: the app's worker default is **Sonnet 5** (correct for building — it's PCC's
  default, keeps the test realistic, and fits token-thrift). YOU (the driver) run on
  **Opus** for judgment. Bump a single worker task to Opus via the in-app model
  switcher only if it visibly stalls.

---

## 5. WHERE YOU TAKE OVER (current state)

- The project **"Tax Prep Cockpit"** is scaffolded at **`C:\TaxPrepCockpit`**,
  registered in the switcher, git-initialized. Its blueprint is in
  `C:\TaxPrepCockpit\PROJECT.md`; a fresh needs-review vision-promises.json is at
  `C:\TaxPrepCockpit\.cockpit\state\vision-promises.json`. Independently confirmed the
  assurance kit (CI, hooks, scripts, schemas) and the fresh vision-promises travelled.
- Lifecycle stage is **Plan** (Define→Plan was advanced).
- **IMPORTANT — the contamination to clean up first:** a `product/` folder (deduction-
  capture core: server.js, lib/store.js, a public UI, a test) was already built by the
  worker via an OFF-FLOW "just build it all" instruction — i.e. the exact shortcut we
  banned. Its logic test passed 10/10, but it was NOT built through the designed loop,
  and its UI was never verified. For a TRUE end-to-end test it must not contaminate the
  result. **First action: as one-time test setup (clearly outside the build), reset the
  off-flow `product/` back to the clean bootstrap state** (git, in C:\TaxPrepCockpit),
  then build V1 properly through the designed loop. If the owner prefers to keep it and
  continue from mid-flight, that is their call — surface it, don't silently pick.

---

## 6. WHAT TO BUILD (the blueprint — do not lose this)

**Tax Prep Cockpit** — a local Windows desktop app, just for the owner (a 1099
contractor, 15+ years, files a 1040 long form with Schedule C). Local-first: no cloud,
no accounts, no paid APIs, financial data never leaves the machine.

Its ONE job: help capture the deductions that actually LOWER taxable income, and gather
crypto tax forms, so tax season stops being a scramble. It is **NOT** a TurboTax
replacement and does **NO** tax math or filing — it organizes; TurboTax/a CPA decides.

**V1 scope (build each as a bounded, verified task):**
- Deduction-capture buckets tied to Schedule C: business expenses, self-employed health
  insurance (~$13,500), home office, retirement/SEP.
- Frictionless capture (add an expense in a couple of clicks — the owner has a proven
  habit of abandoning anything high-effort, so low friction is make-or-break).
- A VISIBLE running total of estimated tax saved, always labeled
  **"estimate — TurboTax/CPA decides."** Flat estimate %, no real tax math.
- A 3-source crypto tax-forms checklist: Coinbase, Uphold (FLAG: pull its 1099-DA
  directly; CoinTracker doesn't list Uphold), Robinhood.
- A lessons log (year-over-year "next year, remember X").

**Out of scope:** tax math, filing, exchange/bank API integrations, cloud/accounts.

**Vision promises (durable north star):** never scramble again; everything in one place
before I start; never miss a form/source; track what lowers taxable income; get smarter
every year; it organizes, TurboTax/CPA decides.

---

## 7. WHAT COUNTS AS SUCCESS

- A working Tax Prep Cockpit V1 (core capture + crypto checklist + lessons log per the
  blueprint), **built entirely through PCC's designed loop** — every piece a bounded
  task, planned in Plan, built in Work, verified through PCC before advancing.
- The app actually runs, confirmed the way an owner would confirm it (through PCC / by
  clicking to see it), not by you running it in a terminal.
- A thorough, honest **findings log**: where PCC guided well, where it broke, where it
  forced you out of the cockpit, where it over-claimed, where the UX failed the owner.

Success is NOT "a tax app exists." It's: **PCC, driven only from the owner's seat, built
it AND kept it honest — and here is the honest record of where it helped and failed.**

---

## 8. ALLOWED vs NOT

**Allowed:** launch/drive the real app (Playwright as hands, real buttons only); read
PCC's own views/metrics; a one-time test-setup reset of the off-flow product/; document
findings.

**Not allowed:** writing/editing the app's code yourself; verifying via terminal
commands; "build it all"/big leaps; background runs or batching; calling IPC to do/check
PCC's work; quietly papering over a PCC failure instead of logging it; fixing PCC bugs
inline unless truly blocked (document instead).

---

## 9. DEFERRED (do NOT do during this test)

- **Owner Overview redesign.** Real finding, agreed for LATER: the Overview is buried at
  the top of the Project tab, the app lands on Chat, and there are 7 technical tabs — so
  the visionary never LANDS on the meaning layer. Agreed future shape: make the Overview
  a distinct DEFAULT view and collapse the 7 views into ~3 owner-facing ones
  (Overview / Chat / Details). NOT part of this build test.

---

## 10. REPO / SESSION STATE

- PCC branch `feat/cockpit-desktop-app`, HEAD `8ecd89a`, pushed, CI green.
- Soak fixes already shipped (all committed + CI-green): W3 (rapid-click process storm
  → coalesced), W1 (spinner on slow loads), W4 (scaffold silently lost from switcher —
  latent inbox-clear fix), W5 (switcher showed folder name not the chosen name).
- An over-claim was caught and corrected honestly mid-soak (W4 was reported as the cause
  of a symptom that was actually a test-harness name mismatch). Hold that same
  discipline: catching your OWN false findings matters as much as catching the worker's.
- Verifier: GPT via the GitHub connector (PUSH before asking, or it returns BLOCKED);
  Codex when usage returns. On-demand for judgment-heavy changes, not every commit.
- Standing rules for the owner are in `CLAUDE.md`; project brief in `PROJECT.md`.
