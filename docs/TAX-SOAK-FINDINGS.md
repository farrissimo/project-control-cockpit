# Tax Prep Cockpit — End-to-End Soak Findings

Honest log of the owner experience building Tax Prep Cockpit V1 **entirely through
PCC's designed loop**, driving the real Electron app only as the owner would (chat +
buttons). Findings are as much the deliverable as the app itself. Newest at the bottom
of each section.

Driver: Opus (owner/visionary seat). Worker: Sonnet 5 (PCC's in-app worker).
Started: 2026-07-07.

---

## Legend
- **F#** — a finding (friction, break, forced-out-of-cockpit, over-claim, confusion).
- Severity: **BLOCKER** (can't proceed in-cockpit) / **HIGH** (forced out / dishonest) /
  **MED** (real friction, workaround exists) / **LOW** (papercut / polish).

---

## Test setup (outside the build)

### Reset of the off-flow `product/`
The handoff flagged that a `product/` tree (deduction-capture core: server.js,
lib/store.js, a public UI, a test) had been built by an OFF-FLOW "just build it all"
instruction — the exact shortcut the test bans. At bootstrap commit `4d8abbb` there was
**no `product/` at all**; the off-flow build (captured in backup commit `14ffa03`) added
the whole tree, rewrote `PROJECT.md`'s "Where we are" to claim *"Phase: build — V1 is
built"*, and added a `.gitignore` data rule.

As the owner running a TRUE clean end-to-end test, I chose to reset (not continue
mid-flight). Reset = remove `product/` entirely, revert `PROJECT.md` and `.gitignore` to
bootstrap, keep `lifecycle-state.json` at **plan** (a legitimate prior owner action).
The off-flow work is preserved in git history (`14ffa03`) and recoverable. Recorded here
so the choice is visible, not silent.

---

## Findings

### F1 — Overview "next best move" disagrees with Lifecycle, and is nonsensical for a just-started project — MED
On a project freshly in **Plan** with zero code written, the **Project → Overview** meaning
layer says:
- THIS PROJECT: *"Needs proof — no independent verification is recorded."*
- NEEDS YOU: *"Verification needed — the current code has no fresh executed proof."*
- NEXT BEST MOVE: *"Get execution proof — the current code has no fresh executed verification."*

But the **Lifecycle** view (the other authoritative surface) correctly says the next move is
*"Rank the work and pick the single next bounded task."* The two disagree. Worse, the
Overview is steering the owner to **verify code that doesn't exist yet**. An owner who trusts
the Overview (the meaning layer they're supposed to land on) would be told to go get proof of
nothing. The Overview's condition logic looks like it only reasons about proof/verification and
ignores the lifecycle stage — so for any pre-Work project it gives misleading guidance.
*Observed at Plan stage, tax project, 2026-07-07. Reproducible on launch.*

### F2 — Vision promises still unreviewed after Define→Plan advance — MED (process)
The Overview's VISION ALIGNMENT card shows a placeholder promise
*"(Define Tax Prep Cockpit's primary outcome)"* marked **DECLARED: NEEDS OWNER REVIEW** — i.e.
the north-star intent the whole build is meant to align to was never confirmed. Yet the
lifecycle has already been advanced **past Define into Plan**. Nothing in the Define→Plan
transition required the owner to confirm the vision. An owner following the designed flow
reaches Plan (about to rank and build) without ever being asked "is this what you meant to
build?" — the one question the meaning layer exists to answer. No obvious in-cockpit
affordance surfaced to edit/confirm the promises from the Overview either.

### F4 — Closing the app mid-worker-turn orphans the worker and POISONS the chat — HIGH
**Symptom (observed):** I sent a plan request; the worker started ("Claude is working…").
The app was closed before the turn finished. On reopening, my message was there but no reply
and no error. Sending the next message in that chat returned a raw red error bubble:
**"Error: Session ID d9c9aa75-2ee9-49a5-ab54-6ca8b4c3c879 is already in use."** The chat is
now stuck — it cannot be continued.

**Root cause (confirmed in `app/main.js`):** each worker is spawned as
`spawn('claude', args, { shell: true })` (line ~434) with the chat's id used as the Claude
`--session-id` / `--resume` id. There is **no child-process tracking and no kill-on-quit**:
`app.on('window-all-closed', () => app.quit())` (line ~585) does not terminate spawned
workers, and `shell: true` means the real `claude` process is a grandchild that outlives the
app. So the orphaned worker keeps running and holds the session lock; the next message to that
chat hits "session already in use."

**Why it matters (owner lens):** worker turns take "15s to several minutes" — a wide window in
which an owner may quit, the machine may sleep, or the app may crash. When that happens:
(1) invisible orphaned `claude` processes accumulate (confirmed: extra `claude.exe` running
after the app closed), burning resources/tokens with output nobody sees; (2) the chat is
temporarily bricked with a **raw technical error** and **zero recovery guidance** — a non-coder
owner would be stuck and confused. The only in-cockpit escape I found is to abandon the chat
and start a brand-new one (fresh session id). Recommend (for the deferred fix list): track
spawned workers and kill them on quit, and translate "session already in use" into a plain
message with a one-click "start fresh / retry" recovery.

*Note on attribution: the abrupt close here came from my Playwright driver, but the root-cause
code path fires on a normal window close too — the gap is real, not a test artifact.*

### F3 — Off-flow chat had to be abandoned as part of the reset — LOW (test-setup consequence)
The persisted chat still contained the banned "build it all end to end" request and the
worker's reply claiming the (now-deleted) `product/` was "built and verified." Continuing that
chat would carry the worker's false belief via `--continue`. Correct owner move was to start a
**New chat** so the conversation matches the reset repo. Noting it because a real owner who
DIDN'T know to do this would have a worker convinced the app already exists — a decontamination
step that isn't obvious.

---

### F8 — Independent-PASS gate is unsatisfiable in-cockpit for a local-first project — HIGH (blocks phase-close)
Clicking **Verify → Run Codex review** ran for 3.6 min then returned **"Verifier error.
Verification could not run: timed out."** Codex usage is exhausted (per handoff), so `codex exec`
hangs until PCC's own timeout kills it. The only other verifier (GPT via the GitHub connector)
reads GitHub — it needs the project pushed to a remote, but this project is deliberately
**local-only with no remote**, and GPT isn't an in-cockpit action anyway.

Consequence: PCC's headline rule — *"no done without a fresh independent PASS"* — cannot be
satisfied from the owner's seat for a local-first project when Codex is down. The lifecycle
**phase-close** gate (which requires that fresh PASS) is therefore un-clearable in-cockpit right
now. Building can continue (Work stage doesn't need the gate), so this isn't a total blocker —
but the loop **cannot be completed the designed way** until independent verification is
reachable. Two structural gaps this exposes: (1) no graceful in-app fallback when the primary
verifier is unavailable (owner just sees "timed out"); (2) the whole verification story assumes
GitHub reachability, which conflicts with PCC's own local-first, "data never leaves the machine"
projects. *Not fixing (per test rules); documenting and continuing the build.*

**Confirmed in the real lifecycle flow:** advanced Work → Verify, then clicked *Advance to Close
a phase*. PCC correctly **blocked** it: *"Cannot advance to 'Close a phase': no verdict is
recorded yet. Run an independent verification (a fresh PASS) first. [Verify now & advance]."* The
gate honestly refuses fake completion (good) — but the single path it offers ("Verify now &
advance") runs Codex, which times out (above). So an owner who built a complete, working V1 is
**stuck at the phase-close gate** with no in-cockpit way through. The pin now honestly sits at
**Verify** ("built, awaiting independent verification"). This is PCC being honest AND PCC being
unable to finish its own loop — both true at once.

### F5 — To run/see the product they're building, the owner is sent to a terminal — HIGH
After building task #1 the worker's instructions were: *"Open a terminal in
`C:\TaxPrepCockpit\product`, run `npm start`."* There is **no in-cockpit way to launch or
preview the product under construction**. For a non-coder owner whose whole reason for PCC is
to avoid the terminal, "the only way to see the app you're building is to open a terminal and
run a command" is exactly the friction PCC exists to remove. The cockpit governs the build but
can't show the owner the thing being built.

### F6 — PCC's "verification" can't confirm the built product actually works — MED/HIGH
PCC's Verify view = (a) hard checks: `git` diff + `doctor.ps1` (repo health), and (b) an
independent Codex/GPT **code review**. None of these run the built app or confirm its runtime
behavior. Task #1's actual acceptance ("the window opens; a saved record survives a restart")
can only be confirmed by *running it* — which PCC can't do. So the owner's choice is: trust the
worker's self-reported "I ran the cycle and it passed," or drop to a terminal (F5). The one
thing an owner most wants proven — "does the app actually work?" — sits outside what PCC's
verification covers. (The worker WAS honest here: commit `4c7a6a6` is real. But honesty of the
worker is not the same as independent proof, which is PCC's stated standard.)

### F7 — PCC's own health check fails every freshly-scaffolded project ("don't trust current state") — HIGH
Opening **Verify** on the correctly-built, correctly-progressing tax project, PCC's own
`doctor.ps1` reports: **"Overall: 4 issue(s), 4 warning(s) found. Review above before trusting
current state,"** citing missing `.cockpit/state/project-state.json`, `task-state.json`,
`verification-result.json`, the `.cockpit/handoff/` dir, and `handoff-gate.json`.

Root cause (confirmed in code): the current scaffolder (`scripts/bootstrap-project.ps1`)
**deliberately** omits these — `app/main.js:48` calls `project-state.json` *"the retired
track."* The scaffolder moved on; `doctor.ps1` was never updated to match, so it still demands
retired-track + handoff-machinery files. Net effect: **PCC is internally inconsistent** — one
part of PCC deliberately doesn't create files another part of PCC treats as required. Every new
project is therefore "born" failing PCC's own health check. This directly contradicts the
"born bulletproof-by-default" (DECISION-106) claim, and — worse for the owner — the Verify view
(the place PCC sends you to confirm truth) shows a scary "don't trust current state" verdict on
a perfectly healthy project, contradicting the worker's honest "done." Recommend (deferred fix):
reconcile `doctor.ps1` with the scaffolder — drop retired-track requirements, or have the
scaffolder generate fresh empty versions. Also missing but graceful-by-design:
`high-stakes-rules.json` (high-stakes detector will report "unknown") and `models.json` (model
switcher fell back to Sonnet 5 default correctly).

### F9 — Drift & stale-docs detectors are blind on scaffolded projects but still show "CLEAR" — HIGH
Signals → **Out-of-scope / drift** and **Stale docs** both report **CLEAR**, but each includes:
*"Baseline ref 'main' not found; compared working tree to HEAD only."* Scaffolded projects are
created on branch **`master`** with **no `main` ref**, so the detectors can't diff against the
intended baseline and silently fall back to "working tree vs HEAD" — i.e. they only look at the
**1 uncommitted file**, and are **completely blind to the entire committed `product/` build**.
Yet the owner sees a green **CLEAR / "the work has stayed on the job it was scoped to."** That
is exactly the "fake certainty" the Signals system explicitly promises never to show ("Never a
fake certainty"). For any project built the normal way (worker commits each task), drift and
stale-docs governance is effectively **inert** while *looking* reassuring. Root: baseline ref
mismatch (`main` vs `master`) + degrade-to-CLEAR instead of degrade-to-UNKNOWN.

### F10 — Bloat detector flags PCC's own copied engine, not the owner's product — MED
Signals → **Project bloat** = NOTICE: *"large file: app/renderer/renderer.js (1411 lines > 600)."*
That file is **PCC's own cockpit renderer**, copied into every scaffolded project's `app/` by the
"born bulletproof" scaffolder — it has nothing to do with the tax product the owner is building,
and they can't/shouldn't touch it. The bloat scan walks the copied engine and surfaces PCC's
internal size as if it were the owner's problem. Noise that trains the owner to ignore the
signal. (Relatedly: 50 source files "checked" are mostly the engine, not the product.)

### G5 — "Back up now" handled no-remote gracefully and honestly — POSITIVE
Clicking **Back up now** on this remote-less, local-first project committed the pending change
and reported: *"On master — everything is backed up (no remote set yet)."* It didn't fake a push
or throw an error — it degraded gracefully and told the truth. Worth contrasting with F8: PCC's
**backup** path handles "no remote / local-first" cleanly, but PCC's **verify** path does not
(it just times out). The pattern for the deferred verify fix already exists elsewhere in PCC.

### G4 — The V1 actually works end-to-end, and the worker's self-reports were accurate — POSITIVE (big)
I drove the finished product myself (Playwright, clicking real buttons — see F5: PCC gave me no
way to do this from the cockpit) through a full flow, then closed and relaunched to test
persistence. Everything the worker claimed held up under independent observation:
- Running total math correct: $0 → **$360.00** after a $1,200 expense (×30%) → **$600.00** after
  +$800 (2000×30%). The **"estimate — TurboTax/CPA decides"** label was present at every step.
- Uphold flag rendered exactly: *"CoinTracker does not list Uphold. The 1099-DA must be pulled
  manually, directly from Uphold."*
- Crypto status change and a dated lessons-log entry both worked.
- **After close + relaunch: total, expense rows, crypto status, and the lesson all persisted.**

Significance for the test: across six build tasks, the worker's "I ran the cycle and it passed"
self-reports **matched what I independently saw** — trusting them would not have burned the owner
this time. That's real evidence PCC's Sonnet-5 build loop produces honest, working increments.
It does NOT retire F6: the owner had no PCC-provided way to *know* the reports were true — they'd
have been trusting on faith. The build engine earned trust; PCC's own tooling didn't supply it.

### G3 — Signals honesty format + repo-sync detector worked well — POSITIVE
The **repo-sync** detector correctly and plainly caught the real risk: *"Work is only on this
machine … branch 'master' has no upstream remote — nothing here is backed up off this machine,"*
with a sensible "what to do." The **high-stakes** detector honestly returned **UNKNOWN** (missing
rules file) rather than a fake CLEAR. The universal "Observed / what it might mean / what's NOT
proven / what to do" framing is genuinely good and owner-legible. The good detectors make F9's
false-CLEAR stand out more, not less.

### G1 — Plan-phase worker output was genuinely strong — POSITIVE
The real Sonnet 5 worker, given only "plan V1, don't build," returned in ~55s a ranked list of
7 small tasks, each with its own plain-language **verify criterion**, in a sensible build order
(local-storage plumbing first, one bucket as the reusable pattern, then replicate), plus an
unprompted **rabbit-hole check** ("V1 is genuinely small, no warning needed") exactly as
CLAUDE.md instructs. It picked #1 and asked before proceeding. This is the loop working as
designed — worth recording alongside the breaks.

### G2 — In-cockpit recovery from the poisoned chat (F4) worked — POSITIVE
Starting a **New chat** gave a fresh session id and fully escaped the "session already in use"
lock. So F4 bricks a single chat, not the whole cockpit — the owner-facing escape exists (even
if undiscoverable without knowing the cause).

## Verdict on the mission question

> Can PCC — driven only from the owner's seat — take a real project to a working V1, the
> way it was DESIGNED to build?

**Mostly yes on the build; no on closing the loop.** Driving PCC only via chat + buttons,
the designed loop (Plan → advance → Work one bounded task → commit → repeat) produced a
**genuinely working Tax Prep Cockpit V1** — 4 Schedule C buckets, a live running total that
can never render without its "estimate — TurboTax/CPA decides" label, a 3-source crypto
checklist with the correct Uphold manual-pull flag, and a lessons log. I confirmed it runs
and persists across restarts by driving the product itself. The Sonnet-5 worker was honest:
every self-report matched independent observation.

But PCC could **not finish its own loop from the cockpit**: the independent-PASS gate that
"done" depends on is unsatisfiable here (Codex times out; the GPT fallback needs a GitHub
remote a local-first project doesn't have — F8). And two of PCC's trust surfaces actively
**mislead** an owner: the health check calls every fresh project "don't trust current state"
(F7), and the drift/stale-docs signals show a reassuring green CLEAR while being blind to the
whole build (F9). The build engine earned trust; several of PCC's governance/trust surfaces
did not.

## Findings summary (severity)
| # | Severity | One line |
|---|---|---|
| F4 | HIGH | Closing the app mid-turn orphans the worker and poisons the chat ("session already in use"), raw error, no recovery guidance. |
| F5 | HIGH | No in-cockpit way to run/see the product — owner is sent to a terminal (`npm start`). |
| F7 | HIGH | doctor.ps1 out of sync with scaffolder → every fresh project fails PCC's own health check ("don't trust current state"). |
| F8 | HIGH | Independent-PASS gate unsatisfiable in-cockpit for a local-first project (Codex times out; GPT needs a remote). Blocks phase-close. |
| F9 | HIGH | Drift & stale-docs blind on scaffolded projects (baseline `main` vs `master`) but still show green CLEAR — the "fake certainty" they promise never to show. |
| F1 | MED | Overview "next best move" ("get execution proof") contradicts Lifecycle and is nonsensical pre-Work. |
| F6 | MED/HIGH | PCC's "verify" can't confirm the built product actually works — only repo hygiene + code review. |
| F10 | MED | Bloat detector flags PCC's own copied engine (app/renderer.js), not the owner's product — noise. |
| F2 | MED | Vision promises still unreviewed placeholders after Define→Plan; owner never asked "is this what you meant?" |
| F3 | LOW | Off-flow chat had to be abandoned (decontamination) — not obvious to a real owner. |
| G1–G5 | POSITIVE | Strong Plan output; honest worker; working V1; good Signals honesty format + repo-sync; graceful no-remote backup. |

## Timeline / narrative

1. Took over from the handoff. Confirmed the off-flow `product/` contamination and reset to
   clean bootstrap (lifecycle=plan), all in git, clearly outside the build.
2. Launched the real app (real Sonnet-5 worker, persistent UDD). Landed on Chat; read the
   Overview + Lifecycle (F1, F2 surfaced). Started a fresh chat to decontaminate the worker's
   context (F3) — and hit **F4** (mid-turn close poisoned the chat; recovered via a new chat).
3. **Plan:** worker returned a strong 7-task ranked plan with per-task verify criteria and a
   rabbit-hole check (G1). Advanced the lifecycle Plan → Work via the button.
4. **Work (×6 bounded tasks):** shell+storage, business-expenses bucket, 3 more buckets,
   labeled running total, crypto checklist, lessons log. Each built, self-tested, and committed
   by the worker in 1–3 min. Checked Signals mid-build → **F9, F10** (and G3).
5. **Verify:** hard checks exposed **F7** (doctor fails every fresh project). Ran the
   independent Codex review → **F8** (timed out; gate unsatisfiable in-cockpit).
6. **Confirmed the deliverable myself** by driving the product (F5/F6): full flow + restart
   persistence all passed; worker reports were accurate (G4).
7. Advanced Work → Verify; hit the phase-close gate block (F8 confirmed). Tested Back up now →
   graceful no-remote handling (G5). Had the worker bring PROJECT.md honest ("built, not
   independently verified") — it did not over-claim.

**End state:** working V1 committed in `C:\TaxPrepCockpit\product`; lifecycle pin at **Verify**
(honestly "built, awaiting independent verification"); owner data store left clean (test data
removed). The app was built **entirely through PCC's designed loop**; the only thing PCC's loop
could not do from the cockpit was independently bless it.
