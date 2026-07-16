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
