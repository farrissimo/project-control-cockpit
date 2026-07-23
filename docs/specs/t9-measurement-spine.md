# Spec: Minimum-T9 measurement spine (ADR-0020, Step 1)

Status: Proposed · 2026-07-23 · Owner-approved to build (reconciled plan, Step 1)

## Objective
Make PCC's LLM usage **fully attributable and measurable from local data**, so the pre-T1 diagnostic
and the later Gate 0 proof rest on trustworthy ground truth — **without** a full gateway redesign, and
without any required paid access. Three gaps close this:
1. **`num_turns` is invisible on normal turns** — the usage log records the agentic-turn count only on
   the max-turns branch, so ordinary turns can't show how far one message fanned out.
2. **"No unattributed `claude` calls" is asserted but never proven** — nothing fails if a new hidden
   spawn is added, and nothing checks that every logged call maps to a known operation.
3. **The PCC measurement arm records no `num_turns`** — `tools/measure-usage.js` already runs a faithful
   **PCC arm** (cold `claude -p --resume` per turn, `--gap` for cache-TTL testing) but omits the
   agentic-turn count, so the diagnostic can't see fan-out.

Non-goals: the full T9 gateway; T1 compaction; running any real measurement; changing worker behavior.
**Scope note (rabbit-hole guard):** the paired harness's *direct warm-session arm* is deliberately
**deferred to Step 2**, where the diagnostic actually runs — its only consumer. Its addition needs a real
`claude` and belongs with the run, not the spine. Step 1 is instrumentation + tests only, and makes the
existing PCC arm measurement-complete (adds `num_turns`) so Step 2 only adds the direct arm + one run.

## Behavior
- **Reuse, don't reinvent:** extend `usage-log.js`, `measure-usage.js`, and reuse `reconstruct-incident.js`
  parsing. No new dependencies. Everything LLM-agnostic (records raw TOKENS, never dollars).
- **num_turns surfaced:** every attributable usage-log record (`chat-turn`, `chat-turn-attach` where the
  stream exposes it, one-shot/`recall-*`/`summary`) carries `num_turns` (the real count, or `null` —
  never a fabricated number), matching how the max-turns branch already does it.
- **Spawn-site guard:** a test proves PCC's **runtime** `claude` spawns are exactly the two known,
  attributed sites (`askClaude`, `oneShotWorker` in `app/main.js`); adding a third unguarded spawn fails
  the test. (Dev-time `tools/measure-*.js` spawns are out of scope — they are not product runtime.)
- **Reconciliation reader:** a pure helper (+ test) reads the usage-log JSONL and classifies every record
  as a **known trigger** or **unattributed**, so "nothing spent invisibly" is a checkable fact, not a claim.
- **PCC arm made measurement-complete:** `measure-usage.js` records `num_turns` per turn, so its per-turn
  table + evidence records carry the agentic-turn count. (The direct warm-session arm + one paired run are
  Step 2.)

## Acceptance criteria (EARS — each needs a passing test)
1. WHEN a normal chat turn completes with usage THE SYSTEM SHALL record `num_turns` (the parsed count, or
   `null` if absent) on that turn's usage-log record.
2. WHEN a background one-shot call completes with usage THE SYSTEM SHALL record `num_turns` on its record.
3. WHEN the usage record carries no parseable turn count THE SYSTEM SHALL record `num_turns: null` and
   never a fabricated number.
4. WHEN the reconciliation reader is given usage-log records THE SYSTEM SHALL classify each as a known
   trigger or `unattributed`, and SHALL flag any unknown trigger.
5. WHEN a `claude` spawn is added to `app/main.js` outside `askClaude`/`oneShotWorker` THE SYSTEM SHALL
   fail the spawn-site guard test.
6. WHEN `measure-usage.js` records a turn THE SYSTEM SHALL include `num_turns` (parsed count or `null`).
7. WHEN `num_turns` recording fails for any reason THE SYSTEM SHALL NOT affect or slow the worker turn
   (usage logging is best-effort by contract).

## Verification
Affected unit tests (usage-log num_turns + reconciliation; harness against fake-claude) + the spawn-site
guard test; lint; independent Codex diff review; diff-bound receipt; PR; exact-SHA CI as the full-suite
authority. No real `claude` call runs in any test or in CI.
