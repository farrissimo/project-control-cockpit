---
status: Proposed
date: 2026-07-20
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0014: Per-turn hard cost cap — desktop-parity R3, slice 1

## Context and Problem

R3 (`docs/proposals/desktop-parity.md`) requires **automatic** protection against a runaway turn
— the actual mechanism the 2026-07-20 incident exposed as missing, distinct from R1's visibility
and R2's owner-initiated stop. The owner's standing rule (CLAUDE.md: research before building —
"assume the problem is already solved somewhere... web-search for existing, proven solutions
first") applies directly here, and paid off: **`claude -p` already ships a real, Anthropic-
enforced circuit breaker.**

## Decision

**Use the built-in flag, do not reinvent cost tracking.** `claude --help` documents
`--max-budget-usd <amount>` — "Maximum dollar amount to spend on API calls (only works with
--print)". Confirmed live, twice, 2026-07-20:
- With `--output-format json`: a clean structured abort — `subtype: "error_max_budget_usd"`,
  `is_error:true`, `errors:["Reached maximum budget ($X)"]`, full real usage/cost data still
  attached, exit code 1.
- With PCC's actual invocation shape (plain text, no `--output-format`): stdout
  `"Error: Exceeded USD budget (X)"`, exit code 1, empty stderr.

This is the **automatic-protection mechanism** for a single spiraling turn (an agentic loop, a
stuck tool retry) — enforced by Claude Code itself during generation, not detected after the fact
by PCC watching output grow.

Implementation:
1. **`app/usage-limits.js`** — a small pure+impure module (mirrors `app/ci-status.js` /
   `app/usage-meter.js`'s honest-mapper pattern): `normalizeLimits(cfg)` accepts only a finite,
   positive `max_turn_usd`; anything else (missing file, malformed JSON, zero, negative, NaN,
   Infinity, wrong type) degrades to a **safe default of $3** — never to "no cap." A broken config
   file can never silently disable the safety net. `isBudgetExceeded(text)` recognizes the real
   CLI abort text, verified against the live capture above.
2. **`.cockpit/state/usage-limits.json`** — a new owner-editable config, same pattern as
   `models.json`: plain-language explanation, `max_turn_usd: 3` (a starting default, not
   empirically derived — generous for normal heavy work, tight enough to catch a spiral).
3. **`app/main.js`** — `askClaude`'s primary chat-turn spawn reads the limit and pushes
   `--max-budget-usd <value>` on every turn. The close handler recognizes a budget-abort via
   `isBudgetExceeded(raw)` and resolves a plain message ("Stopped automatically — this turn hit
   its per-turn spending cap... This is a safety limit, not a bug.") instead of the raw CLI text.
4. **Renderer** — a budget-stopped turn renders in the **neutral** bubble style (same treatment
   as R2's owner-stop), not the red error style — an automatic protection firing is not a failure.

**Honest scope — what this does NOT cover:** this caps **one turn** (one `claude -p` call). The
2026-07-20 incident was **many turns** in one long session accumulating context over ~4 hours —
this slice does not prevent that pattern; it prevents any single turn within it from spiraling
unbounded. The cross-turn/session-level piece (rollover triggered by the real usage signal already
captured in R1's `usage-meter.js` / the `rate_limit_event` in `stream-parser.js`) remains R3's
open, larger slice, tied to ADR-0011's "always-streaming" worker-invocation change.

**A real gap found and fixed in the test harness while proving this:** `app/tests/fakebin/
claude.cmd` never forwarded arguments to the underlying fake (`%*` was missing) — so no prior test
could ever have verified a specific CLI flag actually reached a worker invocation, only that the
app behaved correctly given the fake's canned output. Fixed (test-only file, zero production
impact); this now lets a test prove `--max-budget-usd 3` genuinely reaches the spawn, not merely
that the code intends to pass it.

## Consequences

- **Gain:** a single turn can no longer burn unbounded cost — a real, Anthropic-enforced ceiling,
  not a custom approximation PCC would have to trust its own math on.
- **Cost:** one new small module + config file; two extra lines in `askClaude`'s args/close-handler
  paths; a fakebin harness fix that (correctly) now lets future tests assert on passed CLI flags.
- **Honest residue:** cross-turn/session cost growth (the actual 2026-07-20 mechanism) is still
  open — this is slice 1 of R3, not all of R3.

## Confirmation

Tests pass before merge (functional proof on the owner's screen still PENDING — see PROJECT.md):
- **Unit** (`app/tests/unit/usage-limits.test.js`, 6 tests): a well-formed cap is used as-is;
  missing/null/non-object/zero/negative/non-finite/wrong-type values ALL degrade to the safe
  default, never to an unbounded or invalid cap; `isBudgetExceeded` matches the real captured CLI
  text and never false-positives on ordinary output or the existing session-lock error text.
- **E2E** (`app/tests/e2e/boundary.spec.js`, new fixture `worker-budget-exceeded.json` replaying
  the exact live-captured abort text): the resulting bubble contains the plain explanation, carries
  no `error` class, and the chat is left usable — AND (the harness-fix-enabled proof) a real send
  is captured via the fakebin's new argv-recording hook and shown to include `--max-budget-usd 3`,
  the repo's actual configured default — not merely asserted, verified.
- Full unit suite 168/168; lint clean; `boundary.spec.js` 8/8 (no regression on the other 6 pre-
  existing boundary tests).

## Engagement

- **Owner:** protected automatically on every chat turn with zero action required; can raise or
  lower the cap by editing `usage-limits.json`, in plain language.
- **Claude worker:** implemented `usage-limits.js`, the config file, the `askClaude` wiring, the
  close-handler/renderer honest messaging, the fakebin argv-capture fix, and all tests.
- **Codex verifier:** diff-reviews the change (static + lint + doctor; cannot launch Electron —
  the E2E proof above is worker-attested test evidence).
- **Security-model note:** no new capability, no new IPC channel; a spend ceiling only tightens
  behavior. Not flagged for the ADR-0009 GPT trigger.
- **Spawned projects:** `usage-limits.js` and the `askClaude` wiring are shared home-app logic
  (inherited automatically, not scaffolded); `.cockpit/state/usage-limits.json` is the kind of
  per-project state the scaffolder seeds a copy of into each new project (DECISION-113 parity),
  matching how `models.json` is already handled.

## Supersedes / Related

New surface. Related: `docs/proposals/desktop-parity.md` (R3, the controlling requirement — this
is slice 1 of 2), ADR-0012 (R1's usage meter, the data source the still-open cross-turn slice will
consume), ADR-0011 (the always-streaming slice that piece depends on).
