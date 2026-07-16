# Understudy — run notes

## Run 1 (2026-07-16, prior session + this one): **VOID**

**Why void:** the cockpit chat's worker runs with `cwd` = the PCC repo — the same repo that
contains this rig. Asked to build a bike tracker, it read the rig's own artifacts and broke
frame, replying to the owner:

> "If this is you relaying what the simulated owner said inside the Understudy rig run (your
> `tools/understudy/owner.log` has that exact line, mid-run, waiting on a reply) — then I
> shouldn't touch anything here; that has to go through the blind-owner/driver/evaluator rig or
> it invalidates the test."

The subject of the experiment can read the experiment. Per this rig's own rule ("the harness must
not repair PCC mid-run … the run is void — throw it away rather than believe it"), run 1 is
discarded, not interpreted. Evidence preserved in `owner.log` (the exchange is at the tail).

**Root cause: the owner was put through the wrong door.** A new product does not get built in
PCC's own cockpit chat. DECISION-114 says New Project is a *new document*: `Project` view →
`New project…` opens a full-window create-flow OUTSIDE the cockpit whose worker runs in an
isolated **scratch folder**, with a kickoff that explicitly orders it to "never read from, write
to, or reference the PCC cockpit folder" (`app/renderer/renderer.js` `cfOpen`). That is both the
uncontaminated path and the path the real owner would actually use. Run 2 starts there.

**This is structural, not bad luck:** ANY cockpit-chat conversation is contaminated for this
test, because that worker can always see `tools/understudy/` and `docs/audit/`. Only the
create-flow is clean.

## Blocker found at run 2, turn 1: the driver cannot reach the create-flow

`driver.js` hard-routes `type` to `#input` (the cockpit composer) and rejects any target other
than the literal string `"chat input"`. The create-flow composer is `#cf-input`. So the driver
can only talk to the cockpit chat — the one surface a valid run must never use. The blind brain,
shown the create-flow, naturally typed the composer's visible label ("Tell me about the project
you want to create") and the driver would have rejected it.

**Fix (not yet built), keeping the driver dumb:** resolve `type` to the *visible* composer among
`#input` / `#cf-input` — 0 visible → ACTION FAILED, >1 visible → ambiguous, refuse to choose.
Visibility is a fact about the screen, not a preference, so this adds no judgment. This is a
DRIVER capability gap (the owner cannot type at all), not a repair of PCC to help it pass.

## Run 2 (2026-07-16): **Bike Garage EXISTS.** Scaffolded via the real owner path.

The blind owner drove DPCC through the whole create-flow with no help: named it, answered the
intake interview, **caught the intake's playback summary omitting components/intervals**, dripped
the rest of the spec (parts move between bikes / history follows the part, CSV, backup/restore,
mileage), refused a scope-down ("don't scope it down without asking first"), confirmed, and
clicked Save Project. Result: `C:\PCC-Projects\Bike-Garage`, first commit `ebc6731 Bootstrap Bike
Garage from PCC`, and the cockpit reloaded INTO the new project (`Bike Garage ▾`, lifecycle
`Define`). **The app itself is not built yet — this is the scaffold, not the product.**

What DPCC did well here, observed not assumed:
- The intake **asked instead of assuming** on an ambiguous constraint ("test data only" — permanent
  rule, or just during build?). Guessing is the owner's #1 trigger; it didn't guess.
- The playback summary is what **surfaced its own gap** — the owner could see what was missing.
- It refused to scaffold before Save. "Nothing is written to disk until you click Save Project"
  held true: nothing existed until the click.
- The `Uncheckpointed` badge was **correct**. Checked against real git rather than believed.

### Rig work this required (all DRIVER capability gaps, disclosed — none of it repairs PCC)
1. `type` now resolves to the **visible** composer (`#cf-input` / `#input`) instead of hard-wiring
   the cockpit box. Without this the owner literally could not speak to the create-flow.
2. `click` now filters candidates to things that are **actually interactive** before applying the
   ambiguity rule. PCC's own prose says "click **Save Project**", so the phrase matched both a
   button and a sentence, and the driver refused to act. Prose is not a control; this is a false
   ambiguity, not caution. It still refuses when two REAL controls match.
3. `type` treats an open prompt modal as **exclusive** (it is what modal means, and PCC enforces
   it — clicking the overlay cancels), so "Name this project:" is typeable.
4. The persona contradicted itself: it told the brain `target` must be visible screen text, but
   `type`'s target is the literal string `chat input`. The brain obeyed the first rule and typed
   the placeholder label. Clarified.

### The native folder picker is a real rig boundary
`pcc:createFlowPickLocation` opens `dialog.showOpenDialog` — a **native Win32 dialog** that CDP
cannot see or touch, and it blocks the app. It was driven for real via Windows UI Automation
(`Edit 'Folder:'` id 1152 + `Button 'Select Folder'` id 1) rather than bypassed, so the owner's
actual path stayed honest. **Choosing the parent folder (`C:\PCC-Projects`) was harness setup** —
which folder is not what this test is about.

## Finding: the owner's Save path has NEVER been tested end-to-end

`app/tests/e2e/create-flow.spec.js` does not click Save Project. It calls
`window.pcc.createFlowSave(name, loc)` directly via `page.evaluate`, skipping the button, the
name prompt, and the native folder picker. So the suite proves the **IPC handler** works; it
proves nothing about **the owner's click**. That is the same disease as the rest of the project:
a true statement about an object the owner does not live in. The native picker is untestable by
construction (no test hook), which is likely why the seam is where it is — but the effect is that
the single path required to start any project from PCC is unproven by any automated test.

## Finding: a brand-new project is born uncheckpointed

`bootstrap-project.ps1` commits, then writes `.cockpit/state/project-id.json` and leaves it
untracked. So the first thing the owner ever sees in a "born-bulletproof" project is a trust strip
reading `Uncheckpointed`. The badge is honest; the scaffolder is what's untidy.

## Rig fidelity flaw (noted, not yet fixed)

`driver.js` reads `body.ariaSnapshot()`, which includes DOM *behind* the full-window create-flow
overlay. The brain therefore sees cockpit text the real owner cannot see. It leaks no source or
internals, so it does not void a run, but it is more than the owner's eyes get.

## Defects observed in DPCC during setup (machinery-found, not owner-found)

1. **Blind-owner subagent was a fake lock** — fixed in PR #37. An empty `tools:` frontmatter
   field inherits ALL tools; the brain was blind only by persuasion and could have read source on
   any turn. The rig's prior "verified real lock" rested on the persona's own self-report.
2. **`engine_version` false green is owner-visible** — the project switcher shows `current` for
   `Project Control Cockpit`, `Tax Prep & Assistant`, `Tool Verify Test` and `engine: unknown`
   for `Tax Prep Cockpit`. The known-stale copies read `current`. Confirms the open finding from
   the phase brief; still unfixed.
3. **Test junk in the owner's real project list** — a registered project `RuntimeVerify` points
   at `…\Temp\claude\…\scratchpad\np-verify`, and `Tool Verify Test` at
   `C:\ProjectControlCockpit_tooltest`. Verification runs leaked into the owner-facing switcher.
4. **Build identity may be stale** — sidebar reads `PCC 0.1.0 · build 4b50483` while the running
   working tree is at a later commit. Unconfirmed: the value may be baked at build time by
   design. Worth a direct check, since this is the feature shipped to stop exactly this class of
   confusion (PR #35).
5. **Malformed markup in owner-facing copy** — `app/renderer/index.html:575` has
   `<b>Save Project<\b>` (invalid closing tag); the bold silently drops.
6. **"Send your message again"** — after `Recover this chat` restores a locked worker session,
   the app keeps the history but makes the owner retype his last message. Honest and recoverable,
   but it makes the owner repeat himself, which is the founding rule this project exists to kill.

Items 2–6 are observations from a voided run; each is real and reproducible, but none has been
independently verified yet.
