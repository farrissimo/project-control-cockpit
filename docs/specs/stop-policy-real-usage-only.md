# Spec: Only real Claude usage stops approved work (ADR-0022)

## Objective
Approved work must never be stopped or silently rerouted by a fake or misset PCC limit. Only the
owner's real 5-hour Claude usage may hard-stop it. Phantom-dollar caps become advisory telemetry.

## The stop matrix (authoritative)
| Control | Disposition | May stop/reroute approved work? |
|---|---|---|
| Real 5-hour usage hold (≥90%) | Hard stop / intercept, owner chooses | **YES — the only one** |
| Payload caps (per-send input size) | Explicit visible input safety rail (trims one over-large send) | No (alters input, never stops a turn) |
| `max_turns` (per-message step count) | Runaway backstop; auto-continue is ADR-0023 (Task 1.2) | Not yet fixed — named residual, out of scope here |
| Per-turn dollars (`max_turn_usd`) | Advisory telemetry only | **No** |
| Per-chat dollars (`max_chat_usd`) | Advisory telemetry only | **No** |

## Behavior
- On a chat turn, PCC does NOT pass `--max-budget-usd`; the per-turn dollar cap cannot abort a turn.
- Per-chat cumulative cost is accumulated for display but never triggers a rollover or resets.
- The real `total_cost_usd` and token usage are still parsed and logged (telemetry unchanged).
- The "nearest stop" answer never names a demoted spend guard; only real usage or the turn cap.
- The 5-hour usage hold is unchanged: acts only on a fresh available reading, fails honest on stale/unknown.

## Acceptance criteria (EARS)
- WHEN a chat turn is sent THE SYSTEM SHALL NOT pass `--max-budget-usd` to the worker.
- WHEN a chat's cumulative real cost crosses the former `max_chat_usd` value THE SYSTEM SHALL NOT
  reroute the worker, start a fresh session, or reset the accumulated total; it SHALL keep accumulating.
- WHEN cost is recorded for a turn THE SYSTEM SHALL still log the real token usage and cost as telemetry.
- WHEN a demoted spend guard is at or above its cap THE SYSTEM SHALL NOT report it as the nearest stop.
- WHEN the real 5-hour reading is fresh and ≥90% THE SYSTEM SHALL still intercept and offer the owner a choice.
- WHEN the real 5-hour reading is stale or unavailable THE SYSTEM SHALL NOT hold on it.

## Out of scope (separate slices)
- `max_turns` auto-continue under a hard ceiling (ADR-0023 / Task 1.2).
- Chat-length meter monotonicity/semantics (advisory; does not gate the trial).
- Payload-cap ceiling redesign (validate-only here).
