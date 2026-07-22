// Owner/Visionary Overview — the DETERMINISTIC decision logic (DECISION-107),
// split out from rendering so it is unit-testable with crafted inputs and can
// never drift into runtime AI. Pure function: takes the facts PCC already has
// (lifecycle, detections, verification taxonomy, sync, state, vision promises)
// and returns an owner-facing view-model. No DOM, no I/O, no LLM.
//
// Hard guardrails encoded here:
//  - "owner decision needed" is NOT a driver: there is no live source outside the
//    retired task-state.json (DECISION-104), so it never sets condition/next-move.
//  - Next Best Move and the Journey defer to the real lifecycle; only urgent items
//    (backup / proof / drift / high-stakes) override the lifecycle's next step.
//  - Declared promise status is returned separately from proof and never labeled
//    "proven".
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCOverview = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Share the ONE executed-type definition with the trust strip (soak: an independent
  // review flagged that this list was hardcoded here and could drift from the shared
  // helper). Node: require the sibling module; browser: use the global that
  // verification-parse.js (loaded first) installed. If it's unavailable the call throws
  // — which fails safe (the Overview errors) rather than silently guessing executed.
  const VP = (typeof module !== 'undefined' && module.exports)
    ? require('./verification-parse')
    : (typeof self !== 'undefined' ? self.PCCVerification : undefined);

  function computeOverview(d) {
    d = d || {};
    const lc = d.lc, det = d.det, x = d.x, sync = d.sync, state = d.state, vp = d.vp, ci = d.ci;
    const projName = (state && state.project && state.project.project_name) || 'This project';

    // Proof status, straight from the verification taxonomy.
    const v = x && x.verification;
    const proof = { kind: 'missing', fresh: false, verdict: null, type: null };
    if (v && v.present) {
      proof.verdict = v.verdict || null;
      proof.type = v.type || 'review_only';
      // Commit-bound freshness comes pre-computed by main (matchesCurrent): the record
      // proves the current code only when its VERIFIED_SHA == HEAD and the tree is
      // clean. Replaces the old mtime-vs-commit-time proxy that stayed fresh over
      // uncommitted edits. Unknown/absent => false (fail closed).
      proof.fresh = v.matchesCurrent === true;
      // Origin seam: this record is hand-editable, so only a locally-run proof (local_execution,
      // the product's own checks) is TRUSTED as executed here. A forged ci_execution/live_boundary
      // TYPE: line no longer counts as executed — clean-room/CI proof comes from the live CI check,
      // never a text line. Uses the ONE shared rule so the Overview and the trust strip never diverge.
      const executed = VP.isTrustedLocalProof(v.type);
      if (v.verdict === 'PASS') proof.kind = executed ? 'executed' : 'review_only';
      else if (v.verdict) proof.kind = 'failing';
    }
    // Live CI is the STRONGEST, un-forgeable execution proof of the CURRENT commit: a real
    // clean-room run queried by HEAD sha (so a pass is inherently fresh), and it cannot be
    // faked by editing the hand-editable local record. Exactly like the trust strip's
    // Verified light (renderer.js), when CI is definitive it TAKES PRECEDENCE over the
    // local record — without this the Overview under-reported "Needs proof" while the trust
    // light showed "Verified (ran in CI)" for the same commit (two owner-facing surfaces
    // disagreeing). Requires a clean tree + known git state, same gate as the trust light,
    // so uncommitted changes CI never saw are not covered.
    const ciPassedFresh = !!(ci && ci.available && ci.state === 'passed' && x && x.gitKnown && !x.dirty);
    if (ciPassedFresh) { proof.kind = 'executed'; proof.fresh = true; proof.verdict = proof.verdict || 'PASS'; proof.ci = true; }
    const notice = (key) => !!(det && det[key] && det[key].signal === 'notice');
    const syncDirty = !!(sync && !sync._error && sync.clean === false);
    // Backup state UNKNOWN (git could not be read, or the fact is missing): we must
    // NOT let the ladder fall through to "Healthy — backed up" over a state we could
    // not confirm (CRIT-2). Treated like an urgent item, below dirty.
    const syncUnknown = !sync || !!sync._error;
    // A detector that CRASHED reports signal:'unknown' (main.js runDetector). An
    // errored check is NOT an all-clear — the ladder must not fall through to Healthy
    // as if it were "no signal". (The trust strip's railsFrom already treats unknown
    // as unknown; the Overview must too.)
    const detectorUnknown = ['drift', 'highStakes', 'staleDocs', 'bloat'].some((k) => det && det[k] && det[k].signal === 'unknown');
    const factsReadable = !!(lc && lc.signal === 'ok' && det && x);

    // Current lifecycle stage. Proof only becomes relevant once there is built work
    // to verify; before that (define/plan) demanding "get execution proof" is
    // nonsensical and contradicts the lifecycle's own next step (soak fix F1).
    let curStage = null, curLabel = null;
    if (lc && lc.signal === 'ok' && Array.isArray(lc.all_stages)) {
      const cur = lc.all_stages.find((s) => s.is_current);
      if (cur) { curStage = (cur.id || String(cur.label || '')).toLowerCase(); curLabel = cur.label || cur.id || null; }
    }
    const preWork = curStage === 'define' || curStage === 'plan';
    const needProof = !preWork && (proof.kind === 'missing' || proof.kind === 'review_only' || !proof.fresh);

    // Vision promises declared but not yet owner-reviewed — an owner action the
    // Overview should surface (soak fix F2), so the visionary is asked "is this what
    // you meant to build?" instead of that question never appearing.
    const visionNeedsReview = !!(vp && !vp._error && Array.isArray(vp.promises) && vp.promises.length &&
      (vp.review_status !== 'reviewed' || !vp.last_reviewed));

    // ---- OVERALL CONDITION (priority; no percentage) ----
    let cond;
    if (!factsReadable) {
      cond = { label: 'Unknown', cls: '', why: 'Could not read enough project facts to judge condition.', safe: 'Unknown' };
    } else if (proof.kind === 'failing') {
      cond = { label: 'Blocked', cls: 'bad', why: 'The last recorded verification verdict was ' + proof.verdict + '.', safe: 'No — resolve the failing verification first.' };
    } else if (needProof) {
      const why = proof.kind === 'missing' ? 'No independent verification is recorded for the current work.'
        : proof.kind === 'review_only' ? 'The latest verification is review-only — the code was read, not executed — and CI is not currently reporting a pass for the current commit.'
        : 'The recorded verification does not match the current code — a newer commit or uncommitted changes since the check (stale) — re-verify.';
      cond = { label: 'Needs proof', cls: 'warn', why: why, safe: 'Yes, with caution.' };
    } else if (syncDirty) {
      cond = { label: 'Needs attention', cls: 'warn', why: 'Work is not fully backed up (uncommitted, untracked, or unpushed changes).', safe: 'Yes, but back up soon.' };
    } else if (syncUnknown) {
      cond = { label: 'Needs attention', cls: 'warn', why: 'Could not read git/backup status, so “backed up” cannot be confirmed — check that git is available.', safe: 'Yes, but confirm your work is backed up.' };
    } else if (notice('drift') || notice('highStakes') || notice('staleDocs') || notice('bloat')) {
      const which = notice('drift') ? 'possible scope drift' : notice('highStakes') ? 'a high-stakes change' : notice('staleDocs') ? 'stale docs' : 'a bloat signal';
      cond = { label: 'Needs attention', cls: 'warn', why: 'A signal is raised: ' + which + '. See the evidence below / Signals tab.', safe: 'Yes, with caution.' };
    } else if (detectorUnknown) {
      cond = { label: 'Needs attention', cls: 'warn', why: 'A background check could not run, so its signal is UNKNOWN — treat with caution until it runs (an errored check is not an all-clear).', safe: 'Yes, with caution.' };
    } else if (x && !x.rulesLoaded) {
      cond = { label: 'Needs attention', cls: 'warn', why: 'Standing rules (CLAUDE.md) are not loading.', safe: 'Yes, with caution.' };
    } else if (preWork) {
      cond = { label: 'Getting set up', cls: '', why: 'Still in the "' + (curLabel || 'setup') + '" stage — there is nothing built to verify yet. Follow the next step below.', safe: 'Yes — you are setting the project up.' };
    } else {
      cond = { label: 'Healthy', cls: 'good', why: 'Fresh executed proof, backed up, no raised signals, rules loaded.', safe: 'Yes.' };
    }

    // ---- NEEDS OWNER ----
    let needs;
    if (proof.kind === 'failing') needs = { main: 'Verification needs a look', sub: 'Last verdict: ' + proof.verdict + '.', attn: true };
    else if (syncDirty) needs = { main: 'Backup needed', sub: 'Some work isn’t saved to the remote yet.', attn: true };
    else if (syncUnknown) needs = { main: 'Check backup status', sub: 'Git status could not be read, so backup can’t be confirmed.', attn: true };
    else if (needProof) needs = { main: 'Verification needed', sub: 'The current code has no fresh executed proof.', attn: true };
    else if (notice('drift') || notice('highStakes')) needs = { main: 'Review needed', sub: notice('drift') ? 'A scope-drift signal is raised.' : 'A high-stakes change is flagged.', attn: true };
    else if (visionNeedsReview) needs = { main: 'Confirm the project’s vision', sub: 'The vision promises haven’t been reviewed as your real intent yet — confirm them so the build has a north star.', attn: true };
    else needs = { main: 'Nothing needed right now', sub: 'PCC has no live owner-decision signal yet (the old source was retired), so “decision needed” is not shown here.', attn: false };

    // ---- NEXT BEST MOVE (urgent overrides, else the lifecycle's own next step) ----
    let move;
    if (syncDirty) move = { main: 'Back up the project', sub: 'Some work isn’t saved to the remote yet.', fromLifecycle: false };
    else if (syncUnknown) move = { main: 'Check git / backup', sub: 'Git status could not be read, so backup can’t be confirmed.', fromLifecycle: false };
    else if (needProof) move = { main: 'Get execution proof', sub: 'The current code has no fresh executed verification.', fromLifecycle: false };
    else if (notice('drift')) move = { main: 'Review scope drift', sub: 'Changes may be outside the declared boundary.', fromLifecycle: false };
    else if (notice('highStakes')) move = { main: 'Get a second opinion', sub: 'This touches something costly to get wrong.', fromLifecycle: false };
    else if (notice('staleDocs') || notice('bloat')) move = { main: 'Tidy up', sub: notice('staleDocs') ? 'Docs may be out of date.' : 'A bloat signal is raised.', fromLifecycle: false };
    else if (lc && lc.signal === 'ok' && Array.isArray(lc.next) && lc.next.length) move = { main: lc.next[0].label, sub: lc.next[0].what_to_do || '', fromLifecycle: true };
    else move = { main: 'Continue the current task', sub: '', fromLifecycle: false };

    // ---- JOURNEY (the real lifecycle stages; never a second model) ----
    let journey = [];
    if (lc && lc.signal === 'ok' && Array.isArray(lc.all_stages)) {
      const curIdx = lc.all_stages.findIndex((s) => s.is_current);
      journey = lc.all_stages.map((s, i) => ({
        label: s.label,
        cls: s.is_current ? 'now' : (curIdx >= 0 && i < curIdx ? 'done' : ''),
      }));
    }

    // ---- VISION PROMISES (declared self-assessment; graceful if missing/malformed) ----
    let vision;
    if (!vp || vp._error || !Array.isArray(vp.promises) || !vp.promises.length) {
      vision = { status: 'missing', needsReview: false, cards: [], lastReviewed: null };
    } else {
      vision = {
        status: 'ok',
        needsReview: vp.review_status !== 'reviewed' || !vp.last_reviewed,
        lastReviewed: vp.last_reviewed || null,
        cards: vp.promises.map((p) => {
          const st = p.declared_status || 'needs_owner_review';
          return {
            label: p.label || p.id || 'Promise',
            status: st,
            statusCls: ['built', 'in_progress', 'at_risk', 'needs_owner_review'].indexOf(st) >= 0 ? st : '',
            evidence: p.evidence || '',
            notProven: p.not_proven || '',
          };
        }),
      };
    }

    // ---- PROOF CARD ---- (live CI IS surfaced: the exec line below reports a CI pass for the
    // current commit, and the trust-strip "Verified" chip is bound to the same live CI truth.)
    const proofView = {
      review: proof.kind === 'review_only' ? (proof.fresh ? 'available (matches current code)' : 'stale')
        : proof.kind === 'failing' ? ('last verdict was ' + proof.verdict)
        : proof.kind === 'executed' ? 'present' : 'missing',
      // Executed proof is either a live CI pass for the current commit (clean-room, the
      // strongest) or the product's own local checks. Labeled honestly for each; a forged
      // ci_execution/live_boundary TYPE: line in the local record is still never trusted
      // (that path yields local_execution wording only).
      exec: (proof.kind === 'executed' && proof.fresh)
        ? (proof.ci
          ? 'yes — the CI test check passed for the current commit (clean-room execution proof, not just a code read)'
          : 'yes — the product’s checks ran on this machine (local execution, not a clean-room CI run)')
        : 'not surfaced in the app yet',
    };

    return { projName: projName, cond: cond, needs: needs, move: move, journey: journey, vision: vision, proof: proofView };
  }

  return { computeOverview: computeOverview };
});
