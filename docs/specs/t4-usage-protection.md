# Spec: Automatic usage protection from the real 5-hour % (ADR-0020 T4)

## Objective
Turn the owner's REAL 5-hour Claude usage % (already read by `app/usage-meter.js`, today display-only)
into automatic protection: warn as it climbs, and at a high threshold HOLD the next send and let the
owner choose — without PCC ever switching chats by itself. Bounded contract set by the owner/GPT ruling
(2026-07-24).

## Behavior
- The 5-hour severity thresholds are the ones already in code (`usageSeverity`): **70% warn, 90% hold**,
  single-sourced in `app/renderer/usage-protection.js` so the meter color and the protection can't drift.
- Protection acts ONLY on a fresh, available reading. A stale/unavailable reading is shown as "unknown"
  and never causes a hold (fail honest).
- The hold is enforced at the single pre-worker-invocation boundary (`runSend`), which both direct and
  queued sends drain through, so it cannot be bypassed. The reading is re-fetched fresh at send time.
- The hold offers the EXISTING owner-controlled rollover (`continueInFreshChat`) plus a one-message
  override and cancel. Rollover lowers FUTURE per-message usage; it never lowers the current 5-hour %
  (copy must not imply otherwise).
- Context-growth and 5-hour signals stay independent (OR semantics for showing "Continue in fresh
  chat"); only 5-hour ≥90% intercepts a send. Weekly % stays display-only.
- The "~252K startup baseline" was an invalid runtime constant already removed by ADR-0019 (dynamic
  per-chat growth baseline); this task only corrects the stale explanatory comment + test descriptions.

## Acceptance criteria (EARS — each has a test)
- **AC-1** WHEN a usage reading is fresh, available, and `sessionPercent >= 90` THE SYSTEM SHALL return
  the `hold` action. *(unit: usage-protection.test.js)*
- **AC-2** WHEN a fresh reading is `70 <= sessionPercent < 90` THE SYSTEM SHALL return `warn` and SHALL
  NOT intercept the send. *(unit)*
- **AC-3** WHEN a reading is stale or unavailable THE SYSTEM SHALL return `none` regardless of percent
  (fail honest — never hold on an untrusted number). *(unit)*
- **AC-4** WHEN the owner sends a message and the fresh 5-hour reading is `>= 90%` THE SYSTEM SHALL hold
  the send behind a three-action gate (Continue in fresh chat / Send this message anyway / Cancel) and
  SHALL NOT invoke the worker. *(e2e: usage-protection.spec.js)*
- **AC-5** WHEN the owner clicks "Send this message anyway" THE SYSTEM SHALL invoke the worker for
  exactly that message. *(e2e)*
- **AC-6** WHEN the owner clicks "Cancel" THE SYSTEM SHALL leave the message unsent with an honest note
  and SHALL NOT invoke the worker. *(e2e)*
- **AC-7** WHEN the fresh reading is `>= 90%` but stale THE SYSTEM SHALL let the send proceed normally.
  *(e2e)*
- **AC-8** THE SYSTEM SHALL NEVER switch chats or worker sessions automatically as part of this
  protection. *(covered by AC-4/AC-6: no auto-switch; rollover is owner-clicked only.)*
