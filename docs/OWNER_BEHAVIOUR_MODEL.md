# Owner behaviour model — how to act like the owner when testing DPCC

**Purpose.** PCC's tests are written by the worker, so they only ever ask questions the worker
already thought of. That is why 21 audit categories, 126 E2E tests (`npx playwright test tests/e2e --list` → 126 in 25 files, 2026-07-16), and every gate missed three
real defects that the owner found in ten minutes on 2026-07-16 by asking one ordinary question.

The owner is the only agent in this system that touches the product. This document removes that
excuse: it is a **measured** model of what he actually does, mined from **1,441 real owner turns**
in the Claude Code archives (`C--Tax-Prep-and-Assistant`: 141 turns; `C--ProjectControlCockpit`:
1,300 turns). The worker uses it to behave like him and find the bugs **before he does**.

**Him finding a bug is a P0 defect in PCC, not diligence on his part.** (`docs/adr/` + the standing
rule: reduce owner babysitting.)

## Measured behaviour frequencies (1,441 turns)

| % of turns | Behaviour | Tested today? |
|---|---|---|
| 12.6% | Stops runaway work mid-discussion ("we're in the middle of a discussion") | No |
| 9.7% | Approves / authorizes work | Partly (authority.spec) |
| 9.6% | Asks "where are we / what's next / picking back up" | No |
| **7.4%** | **Reads a badge / light / chip / meter and asks about it** | **Rendering only — never truth** |
| 4.6% | Demands concise, non-jargon output ("wall of text", "boil it down") | No |
| 3.5% | Reports something looks wrong ("still just line numbers", "going in circles") | No |
| 3.3% | Catches a contradiction against something said earlier | No |
| 2.4% | Says it repeated itself / was ignored ("i already said") | No |
| 2.0% | Opens/launches the app and looks at it | No |
| 2.0% | Checks tools / access / capability ("check again") | Partly (tool-preflight) |
| 1.7% | Fires / rage-quits | — |
| 1.5% | Pastes a screenshot / attachment | Partly |
| 1.2% | Clicks a button and reacts to what happens | Partly |
| 1.0% | Tests memory / persistence repeatedly | No |
| 1.0% | Asks "what is my role?" | No |

Method: `tools/understudy/classify.js` over extracted turns; literal phrase counts, no LLM, no
interpretation. Re-runnable.

## The rules — how to act like him

1. **Use the product; do not read the source.** He never reads code. He opens DPCC, looks at it,
   clicks things, and believes what it says. Any test that inspects a file instead of driving the
   UI is not acting like him.
2. **Treat every visible claim as a claim to be disproven.** He reads "Backed up: green" and
   believes it. So: for each chip/badge/meter/banner, establish the truth *independently* (git,
   the filesystem, the network) and compare. A chip that renders correctly but says the wrong
   thing is the defect. This is his #1 product behaviour and it has zero coverage.
3. **Ask the ordinary question, not the clever one.** "Is this current?" "Where are we?" "What
   does this do?" "Am I backed up?" The three defects of 2026-07-16 came from *"does it need
   updating?"* — not from an adversarial probe.
4. **Live at t > 0.** Every existing test builds a pristine world: fresh profile, synthetic
   fixtures, faked worker, t=0. He lives in an accumulated one — an install from three days ago,
   a repo that moved, docs that piled up edits. Construct the aged state deliberately; that is
   where the defects were.
5. **Repeat yourself and check it holds.** He tested chat memory seven times in a row with
   different numbers. He re-asks "check again" until it's real. One green is not evidence.
6. **Interrupt.** 12.6% of his turns stop work mid-flight. Start something, interrupt it, and
   check nothing was corrupted or silently continued.
7. **Cross-examine against earlier statements.** 3.3% of his turns catch a contradiction. Take a
   claim the app or the docs made earlier and check it still holds now.
8. **Judge the answer as a non-coder.** If the reply needs implementation knowledge to evaluate,
   it has already failed him ("do i look like a coder? what's my role?").
9. **Never hand him the finding as a chore.** Find it, prove it, fix it, report the result.

## The benchmark: how the Tax-Prep project actually died

He named `C:\Tax-Prep-and-Assistant` as the benchmark. Its archive ends at turn 114: *"no mother
fucker. you're fired. jfc."* The sequence that got there is the failure mode PCC exists to prevent:

1. He asks a simple thing; the tool doesn't work ("i see real words along with garbled characters").
2. The worker keeps guessing instead of proving ("you're just guessing at this point").
3. He does the work himself ("i went and built a redactor tool").
4. He counts the cost ("it's been 2 hours of just a nothing burger"; "you just wasted a
   significant part of my life").
5. He names the real stake — the thesis of PCC, in his words: *"a real scenario that an llm would
   fuck this up in a heartbeat and i'd be left holding the bag with noone to blame."*
6. Trust dies: *"how the fuck am i supposed to trust anything you do at this point."*

Steps 1–4 are the tell. If the worker is guessing, or the owner is doing the finding, the project
is already on this path regardless of how green the tests are.
