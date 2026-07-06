# PCC Cockpit — Feature Roadmap (living tracker)

Ranked by the urgency/priority the owner placed on each. Updated at every
milestone; the grid shown in chat mirrors this file. No stone unturned.

Status: [x] Done · [~] In progress / Partial · [ ] Planned

## P1 — Critical (the owner hammered these)
1. [x] Desktop app with chat wired to Claude Code
2. [x] Standing rules persist (CLAUDE.md) + one-click corrections (no repeating yourself)
3. [~] Independent verification — Codex primary, Antigravity `agy` fallback (Gemini retired; wiring done). BLOCKED on a proven verdict: Codex out of usage; agy hung ~13 min headless on a real diff and returned nothing. Reliable headless verifier still unproven.
4. [x] Hard-checks layer — git facts + PCC health check (deterministic, no LLM)
5. [x] Project memory / brief — no Groundhog Day. Editable brief (PROJECT.md, auto-loaded each session) PLUS carry-forward of the canonical decisions: `scripts/recent-decisions.ps1` surfaces the latest agreements from docs/DECISIONS.md in the Project view, and the new-chat handoff embeds the 3 most recent — so settled decisions are never re-derived. (Auto-capturing NEW agreements from chat is the separate, deferred #12, which needs AI judgment.)
6. [x] Standardized lifecycle — declared stage model (.cockpit/state/lifecycle-model.json: define → plan → work → verify → phase-close → milestone → handoff → rollover, each with entry/what-to-do/exit/legal-next) + a "you are here" pin (.cockpit/state/lifecycle-state.json) + `scripts/lifecycle-status.ps1` + a Lifecycle view showing the map, current stage, and only the LEGAL next steps. Deliberately never auto-advances (moving stages is a recorded choice). Top lifecycle bar (current/next/decision) shipped earlier.

## P2 — High (the "huge" wounds; the governed loop)
7. [x] Clean new-chat handoff — `scripts/generate-handoff.ps1` assembles a ready-to-paste briefing from real repo truth (identity, live git state/sync, phase, honest verification status, standing orders, orient-from-these-files). One-click "Generate handoff" + Copy in the Project view. Sources "next" from PROJECT.md and verification from the app-build's own file, deliberately NOT the stale governance next_expected_action.
8. [x] Chat end-of-usefulness / rollover trigger — Signals card from this chat's own history: turn count, time span, and repeated-message detection (normalized). Tokens/true context-degradation are NOT app-observable, so they are surfaced honestly under "NOT proven" rather than faked.
9. [x] Untracked-files detection — deterministic `scripts/detect-untracked.ps1` (git-only, no LLM, respects .gitignore) + new Signals view rendering the honest 4-part format. CLI-first (works with app/ deleted); writes truth to .cockpit/result/detections/ with -WriteFile.
10. [x] Out-of-scope / drift detection — `scripts/detect-drift.ps1` compares files changed on the branch against a REAL declared boundary (.cockpit/state/app-build-scope.json allowed_globs), not a guess. Clear when work stays in scope; honest 'notice' when a changed file is outside it (revert, or update the boundary on purpose). Reports 'unknown' (never guesses) if the boundary file is missing.
11. [x] Stale-docs detection — `scripts/detect-stale-docs.ps1` checks a small, explicit, adjustable rule list (.cockpit/state/doc-freshness-map.json): if code matching a rule changed but the doc that should track it did not, it flags an honest 'notice'. Stays QUIET when no rule matches (never guesses); 'unknown' if the map is missing. Starter rules: app change → roadmap; new detector → roadmap; verify-work.ps1 → PROJECT.md + roadmap.
12. [ ] Agreements-only-in-chat -> flag + capture to truth
13. [x] Repo-sync discipline — `scripts/detect-repo-sync.ps1` Signals card: is the work actually backed up to the remote? Flags uncommitted changes, untracked files, and committed-but-unpushed commits (and a missing upstream). Pure git, deterministic, zero false positives. Clear only when the tree is clean and the branch is level with its upstream.
14. [x] Live trust signals — always-visible strip above the chat: On the rails (drift + stale-docs clear), Backed up (repo-sync clear), Verified (honest: green only for a fresh PASS newer than HEAD; amber "not verified yet" otherwise — never faked), Rules loaded (CLAUDE.md present). Each chip is green only when a real deterministic check says so; tooltips explain what is and isn't proven.

## P3 — Medium (honest detections + lifecycle extras)
15. [x] Reinventing-the-wheel signal — leverages the worker's real web access (Claude Code has WebSearch/WebFetch; confirmed). Two honest halves: a strengthened standing rule in CLAUDE.md ("assume the problem is already solved somewhere; web-search proven solutions FIRST; treat 'nothing exists' as a surprising result needing evidence"), and a one-click "Check prior art" correction button that makes the AI research existing solutions on demand. (Auto-detecting "reacting" / overlap with the whole world is web+AI judgment, not a deterministic script — handled by rule+button, not faked.)
16. [x] Project-bloat signal — `scripts/detect-bloat.ps1` flags objective, threshold-based bloat (large source files + dependency count) against a declared, adjustable `.cockpit/state/bloat-thresholds.json`. Grounded in real-world bloat research; deliberately skips duplication/dead-code (need language tooling, would false-alarm). Reports facts, not verdicts.
17. [x] "Never says no" / sycophancy signal — a one-click "Push back" correction (makes the AI argue the downside/other side) PLUS an honest, clearly-labeled nudge in Signals that flags when the latest substantive answer named no risk/downside/trade-off. The nudge is a keyword heuristic on one answer (stated as NOT proof), never a verdict; the button is the solid half.
18. [x] Standardized new-project bootstrap — `scripts/bootstrap-project.ps1 -Target <dir> -Name "<name>"` scaffolds a fresh project the PCC way: copies the cockpit app + self-contained scripts (detectors, lifecycle, handoff, recent-decisions, verify, bootstrap) + CLAUDE.md/AGENTS.md/.gitignore, writes fresh declared state (lifecycle pinned at 'define', generic scope/doc-map/thresholds), starter PROJECT.md + docs/DECISIONS.md, and git-inits with a first commit. Tested end-to-end: the new project's detectors, lifecycle, handoff, and app all run.
19. [x] Honest babysitting-reduction metrics — `scripts/babysitting-metrics.ps1` + a "Babysitting reduction" section in the Project view. Observable proxies ONLY, explicitly labeled NOT a score: automated watch-jobs now run for you (detector scripts + in-app), commits/snapshots, days active, plus this-chat proxies (your messages, correction-clicks needed, messages you repeated). States plainly it does not prove babysitting dropped.
26. [x] Rabbit-hole warning (owner-added mid-build) — a non-blocking flag that an idea may be disproportionately large/open-ended for its payoff. Honest form (effort estimation is AI judgment): a one-click "Rabbit-hole check" correction button that makes the AI assess it and name the strong signals + rough size, plus a proactive standing rule in CLAUDE.md to flag rabbit holes before diving in. Never refuses; the owner decides.

## P4 — Later / polish
20. [~] Multi-project switching (switcher stub in place)
21. [ ] Peek under the hood (optional technical depth, hidden by default)
22. [x] Desktop launcher / shortcut
23. [~] UI polish pass (ongoing)

## Cross-cutting standing orders (baked in)
24. [x] Research-first / don't reinvent — in CLAUDE.md (product-side detector later)
25. [x] Token-thrift / local-first execution — architectural

Every honest-detection feature (9-12, 15-17) ships ONLY in the
"Observed / what it might mean / what's NOT proven / what to do" format —
never a fake certainty (per the GPT + Gemini review and the owner's "nothing
fake" rule).
