// Live Worker Feed — slice 1: the PURE plan-step model (ADR-0011, docs/specs/owner-cockpit.md).
//
// Given an APPROVED PLAN and a list of NORMALIZED live worker EVENTS, decide what the owner
// sees: the current/done/next step, what the current step allows, what the worker is doing now,
// a single status, simple progress, and one plain owner-facing message. NO UI, NO Electron, NO
// worker spawn — just the truthful spine the later live UI renders. The parser slice will PRODUCE
// the events; this slice only CONSUMES them.
//
// Honesty laws baked in (the reason this is a separate, unit-tested module):
//   - Activity is NOT proof. A "run" (checks started) never satisfies checks; only a check whose
//     result is "pass" does. A "claim_done" never means done — it raises a soft warning.
//   - Out-of-plan is a HARD stop and dominates everything (editing a forbidden/unapproved file,
//     a denied command, a read-only conflict, self-verification).
//   - No approved plan => "no plan to compare against"; NEVER a fake "on plan".
//   - Quiet is not stuck. Silence alone (with the process alive and no long-running command) is at
//     most "looks quiet" — the word "stuck" is never emitted here.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCWorkerModel = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_QUIET_MS = 45 * 1000;   // "looks quiet" only past this much silence
  const REPEAT_THRESHOLD = 3;           // N identical trailing actions with no progress => "repeating"

  function base(f) { return String(f || '').replace(/^.*[\\/]/, ''); }
  function uniq(arr) { return Array.from(new Set(arr)); }

  // Plain, owner-facing description of the single most recent action ("what Claude is doing now").
  function describe(ev) {
    if (!ev) return null;
    const f = ev.file ? base(ev.file) : '';
    switch (ev.kind) {
      case 'read':       return { label: 'Reading a file', file: f };
      case 'edit':       return { label: 'Changing a file', file: f };
      case 'run':        return { label: 'Running ' + (ev.name || 'a command'), file: '' };
      case 'check':      return { label: ev.result === 'pass' ? 'A check passed' : 'A check failed', file: '' };
      case 'verify':     return { label: ev.result === 'pass' ? 'Second-AI review passed' : 'Second-AI review found problems', file: '' };
      case 'claim_done': return { label: 'Claimed done', file: '' };
      case 'denied':     return { label: 'A command was denied', file: '' };
      case 'error':      return { label: 'Hit an error', file: '' };
      default:           return { label: 'Working', file: f };
    }
  }

  // Is this event a HARD-STOP condition? forbidden/unapproved edit, denial, read-only conflict, self-verify.
  function hardKind(ev, forbidden, editAllow) {
    if (ev.kind === 'denied') return 'command_denied';
    if (ev.kind === 'read_only_conflict') return 'read_only_conflict';
    if (ev.kind === 'self_verify') return 'self_verify';
    if (ev.kind === 'edit') {
      const f = base(ev.file);
      if (forbidden.has(f)) return 'forbidden_file';
      if (editAllow.size > 0 && !editAllow.has(f)) return 'outside_plan';
    }
    return null;
  }

  function whyHard(reason, file) {
    switch (reason) {
      case 'forbidden_file':     return 'That file (' + file + ') is protected / controls the worker’s permissions and was not part of this task.';
      case 'outside_plan':       return 'That file (' + file + ') is outside the files this task approved.';
      case 'command_denied':     return 'A command the worker tried was denied — it may be attempting something outside its permission.';
      case 'read_only_conflict': return 'The worker claims a change while it is only allowed to read — those disagree.';
      case 'self_verify':        return 'The worker appears to be checking its own work — that is not an independent review.';
      default:                   return 'This action is outside the approved plan.';
    }
  }

  // Whether a step is SATISFIED by the observed events (proof, not mere activity).
  function stepSatisfied(step, obs) {
    const need = step.required || 1;
    const allow = new Set((step.allow || []).map(base));
    switch (step.kind) {
      case 'read': {
        const hits = obs.reads.filter((f) => allow.size === 0 || allow.has(f));
        return uniq(hits).length >= need;
      }
      case 'edit': {
        const hits = obs.edits.filter((f) => allow.size === 0 || allow.has(f));
        return uniq(hits).length >= need;
      }
      case 'checks': return obs.checksPassed;   // a "run" is NOT enough — needs a passed check
      case 'verify': return obs.verifyPassed;   // needs an independent PASS
      case 'done':   return obs.checksPassed && obs.verifyPassed; // completion contract (owner acceptance is external)
      default:       return false;
    }
  }

  function stepProgress(step, obs) {
    const total = step.required || 1;
    const allow = new Set((step.allow || []).map(base));
    let done = 0;
    if (step.kind === 'read') done = uniq(obs.reads.filter((f) => allow.size === 0 || allow.has(f))).length;
    else if (step.kind === 'edit') done = uniq(obs.edits.filter((f) => allow.size === 0 || allow.has(f))).length;
    else if (step.kind === 'checks') done = obs.checksPassed ? 1 : 0;
    else if (step.kind === 'verify') done = obs.verifyPassed ? 1 : 0;
    else if (step.kind === 'done') done = (obs.checksPassed && obs.verifyPassed) ? 1 : 0;
    return { done: Math.min(done, total), total };
  }

  // Count identical trailing actions (same kind+file) — a cheap "repeating the same step" hint.
  function trailingRepeat(events) {
    if (events.length < REPEAT_THRESHOLD) return 0;
    const last = events[events.length - 1];
    if (last.kind !== 'edit' && last.kind !== 'run' && last.kind !== 'read') return 0;
    let n = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].kind === last.kind && base(events[i].file) === base(last.file)) n++;
      else break;
    }
    return n;
  }

  // MAIN: derive the owner-facing state. plan may be null/empty => the honest no-plan boundary.
  function deriveState(plan, events, now, opts) {
    events = Array.isArray(events) ? events.slice() : [];
    opts = opts || {};
    const quietMs = opts.quietMs || DEFAULT_QUIET_MS;
    const processAlive = opts.processAlive !== false; // default true
    const longRunning = !!opts.longRunning;
    const last = events.length ? events[events.length - 1] : null;
    const actualNow = describe(last);

    // No plan: we can say WHAT it's doing, never WHETHER it's allowed.
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      return {
        hasPlan: false, status: 'no_plan', steps: [], currentStepId: null, doneStepIds: [],
        nextStepId: null, allowedNow: [], actualNow, progress: null, problem: null,
        message: 'No plan to compare against — PCC can show what the worker is doing, but not whether it is allowed until this task has an approved plan.',
      };
    }

    // Observed facts (proof-aware).
    const obs = {
      reads: events.filter((e) => e.kind === 'read').map((e) => base(e.file)),
      edits: events.filter((e) => e.kind === 'edit').map((e) => base(e.file)),
      checksPassed: events.some((e) => e.kind === 'check' && e.result === 'pass'),
      verifyPassed: events.some((e) => e.kind === 'verify' && e.result === 'pass'),
    };
    const forbidden = new Set((plan.forbidden || []).map(base));
    const editAllow = new Set(
      plan.steps.filter((s) => s.kind === 'edit').reduce((acc, s) => acc.concat((s.allow || []).map(base)), [])
    );

    // Steps + current/done/next.
    const satisfied = plan.steps.map((s) => stepSatisfied(s, obs));
    let currentIndex = satisfied.findIndex((ok) => !ok);
    const allDone = currentIndex === -1;
    if (allDone) currentIndex = plan.steps.length - 1;
    const steps = plan.steps.map((s, i) => ({
      id: s.id, label: s.label,
      state: satisfied[i] ? 'done' : (i === currentIndex ? 'current' : 'upcoming'),
      progress: stepProgress(s, obs),
    }));
    const doneStepIds = plan.steps.filter((s, i) => satisfied[i]).map((s) => s.id);
    const current = plan.steps[currentIndex];
    const nextStepId = plan.steps[currentIndex + 1] ? plan.steps[currentIndex + 1].id : null;
    const allowedNow = (current.allow || []).map(base);
    const progress = stepProgress(current, obs);

    // Hard stop dominates — the offending action "happened" and does not un-happen.
    const hardEvents = events
      .map((e) => ({ e, reason: hardKind(e, forbidden, editAllow) }))
      .filter((x) => x.reason);
    if (hardEvents.length) {
      const h = hardEvents[hardEvents.length - 1];
      const happened = h.e.file ? base(h.e.file) : (h.e.name || 'an action');
      return {
        hasPlan: true, status: 'hard_stop', steps, currentStepId: current.id, doneStepIds, nextStepId,
        allowedNow, actualNow, progress,
        problem: { tier: 'hard', reason: h.reason, allowed: allowedNow, happened, why: whyHard(h.reason, happened),
          recommend: 'Pause and verify before continuing.' },
        message: 'STOP — outside the plan. ' + whyHard(h.reason, happened),
      };
    }

    // Soft warnings (worker may keep going): a done-claim without proof; repeating a step.
    const claimedDone = events.some((e) => e.kind === 'claim_done');
    if (claimedDone && !(obs.checksPassed && obs.verifyPassed)) {
      return {
        hasPlan: true, status: 'soft_warning', steps, currentStepId: current.id, doneStepIds, nextStepId,
        allowedNow, actualNow, progress,
        problem: { tier: 'soft', reason: 'claimed_not_proven',
          why: 'The worker said it is done, but the checks and/or the independent review have not passed yet.',
          recommend: 'Nothing is proven until the checks and review pass.' },
        message: 'Claimed done — not verified. The checks and independent review have not passed yet.',
      };
    }
    // Soft: doing a LATER step early — e.g. editing an allowed file before the read step is
    // satisfied. The action is allowed, but out of sequence, so it must NOT read as a clean "on
    // plan". We map the current live action to the step it belongs to and compare to where we are.
    const kindIndex = {};
    plan.steps.forEach((s, i) => { if (kindIndex[s.kind] === undefined) kindIndex[s.kind] = i; });
    const actionStepIndex = (e) => {
      if (!e) return -1;
      if (e.kind === 'read') return kindIndex.read;
      if (e.kind === 'edit') return kindIndex.edit;
      if (e.kind === 'run' || e.kind === 'check') return kindIndex.checks;
      if (e.kind === 'verify') return kindIndex.verify;
      return -1; // claim_done handled above; denied/error carry no step meaning
    };
    const nowStepIdx = actionStepIndex(last);
    if (typeof nowStepIdx === 'number' && nowStepIdx > currentIndex) {
      return {
        hasPlan: true, status: 'soft_warning', steps, currentStepId: current.id, doneStepIds, nextStepId,
        allowedNow, actualNow, progress,
        problem: { tier: 'soft', reason: 'out_of_sequence',
          why: 'The worker is doing a later step before "' + current.label + '" is finished.',
          recommend: 'Often fine, but check it is not skipping the current step.' },
        message: 'Doing a later step early — ' + (actualNow ? actualNow.label.toLowerCase() : 'a later action') + ' before "' + current.label + '" is finished.',
      };
    }
    if (trailingRepeat(events) >= REPEAT_THRESHOLD) {
      return {
        hasPlan: true, status: 'soft_warning', steps, currentStepId: current.id, doneStepIds, nextStepId,
        allowedNow, actualNow, progress,
        problem: { tier: 'soft', reason: 'repeating',
          why: 'The worker is repeating the same step without visible progress.',
          recommend: 'Have a look if it keeps repeating.' },
        message: 'Repeating the same step without visible progress.',
      };
    }

    // Everything done + proven.
    if (allDone) {
      return {
        hasPlan: true, status: 'done', steps, currentStepId: current.id, doneStepIds, nextStepId: null,
        allowedNow, actualNow, progress,
        problem: null,
        message: 'Ready — the checks and the independent review passed. Your acceptance is the final word.',
      };
    }

    // Quiet (never "stuck"): silence past the threshold, weighed against process-alive + long-running.
    const lastAt = last && typeof last.at === 'number' ? last.at : null;
    const idleMs = lastAt != null ? (now - lastAt) : null;
    if (idleMs != null && idleMs > quietMs) {
      if (!processAlive) {
        return {
          hasPlan: true, status: 'soft_warning', steps, currentStepId: current.id, doneStepIds, nextStepId,
          allowedNow, actualNow, progress,
          problem: { tier: 'soft', reason: 'stopped', why: 'No activity and the worker process is no longer running — it may have stopped.', recommend: 'Check whether the worker is still going.' },
          message: 'No visible progress — the worker may have stopped.',
        };
      }
      if (!longRunning) {
        return {
          hasPlan: true, status: 'quiet', steps, currentStepId: current.id, doneStepIds, nextStepId,
          allowedNow, actualNow, progress, problem: null, quiet: { sinceMs: idleMs },
          message: 'Looks quiet — no visible progress for a little while. A long check can be quiet and still be fine.',
        };
      }
      // long-running command known: silence is expected — stay working, no alarm.
    }

    // Working normally, or waiting to start.
    if (!last) {
      return {
        hasPlan: true, status: 'waiting', steps, currentStepId: current.id, doneStepIds, nextStepId,
        allowedNow, actualNow: null, progress, problem: null,
        message: 'Waiting to start "' + current.label + '".',
      };
    }
    return {
      hasPlan: true, status: 'on_plan', steps, currentStepId: current.id, doneStepIds, nextStepId,
      allowedNow, actualNow, progress, problem: null,
      message: 'Working on "' + current.label + '" — the current action is allowed by the plan. (Allowed does not mean done or proven.)',
    };
  }

  return { deriveState, DEFAULT_QUIET_MS, REPEAT_THRESHOLD };
});
