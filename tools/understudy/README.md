# Operation Understudy — the owner-simulation test rig

**What it's for.** PCC's own tests are written by the worker, so they only ask questions the
worker already thought of. On 2026-07-16 the owner found three real defects in ten minutes by
asking one ordinary question, while 21 audit categories and 126 E2E tests (`npx playwright test tests/e2e --list` → 126 in 25 files, 2026-07-16) found none. This rig
puts a **blind simulated owner** in the driver's seat to find them first.

Plan: `docs/audit/UNDERSTUDY_PLAN.html` · Profile: `docs/audit/OWNER_PROFILE.html` +
`docs/OWNER_BEHAVIOUR_MODEL.md`

## The three roles (never collapse them)

1. **Blind owner brain** — decides what the owner does. Has **NO tools**. Sees only screen text.
2. **Dumb driver** (`driver.js`) — executes ONE action, reports exactly what's on screen. No
   judgment, no retries, no diagnosing, no substituting a "close enough" control.
3. **Independent evaluator** — Codex/GPT, afterwards, over the logs. Not the worker, not the brain.

## Verified facts (tested 2026-07-16, do not re-derive)

- **`--disallowed-tools` IS A FAKE LOCK.** `claude -p --disallowed-tools "Read,Bash,Grep,..."`
  silently ignores it — the spawned process reads files anyway and still lists those tools.
  **Do not use it.**
- **`--settings` with a `permissions.deny` list IS a real lock.** Verified by ordering the brain
  to read `app/main.js`: it could not ("I HAVE NO TOOLS capable of reading that file").
  Use `blind-settings.json`.
- **Microsoft's official `@playwright/mcp` approach works on DPCC over CDP** — no fork needed.
  The Electron forks (`playwright-mcp-electron` v0.1.5, `@hotnsoursoup/...` v0.0.30) are 6–12
  months stale; the official package ships ~daily. Attach over CDP instead.
- `page.accessibility.snapshot()` is **removed** from modern Playwright. Use
  `page.locator('body').ariaSnapshot()`.
- `.claude/agents/*.md` agent definitions **load at session start** — a newly-written agent type
  is not available in the session that created it. `owner-brain.md` exists and will register in
  a fresh session; until then spawn the brain via `claude -p --settings blind-settings.json`.

## Running it

```
node tools/understudy/start-app.js          # launches DPCC, holds it on CDP 9333
node tools/understudy/driver.js '{"action":"read","why":"look"}'
node tools/understudy/driver.js '{"action":"click","target":"New chat","why":"..."}'
node tools/understudy/driver.js '{"action":"type","target":"chat input","text":"...","why":"..."}'
```

Brain turn (blind, no tools):
```
{ cat .claude/agents/owner-brain.md; echo; echo "=========="; cat turn.txt; } \
  | claude -p --settings tools/understudy/blind-settings.json --permission-mode acceptEdits
```
`turn.txt` = the owner's private intent + **the screen text only**. Never give it source, git,
logs, paths, or internals — that voids the run.

Two logs are written beside `driver.js`: `owner.log` (what the owner could see/do — the usability
evidence) and `trace.log` (sealed; evaluator only).

## Mining the owner corpus

```
node tools/understudy/mine-user-turns.js <archive-dir> out.json
node tools/understudy/classify.js tax-turns.json pcc-turns.json     # behaviour frequencies
node tools/understudy/profile-mine.js ...                            # voice, triggers, questions
node tools/understudy/samples.js ...                                 # verbatim by mode
```
Archives: `~/.claude/projects/C--ProjectControlCockpit` (1,300 owner turns) and
`C--Tax-Prep-and-Assistant` (141). Counting is literal phrase-match — no LLM, re-runnable.

## The rule that makes the run worth anything

The brain must never receive source, git state, logs, or hidden internals; no intelligent agent
may modify or substitute an owner action; the harness must not repair PCC mid-run. If any of
that happens, **the run is void** — throw it away rather than believe it.
