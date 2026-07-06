# PCC Cockpit — Feature Roadmap (living tracker)

Ranked by the urgency/priority the owner placed on each. Updated at every
milestone; the grid shown in chat mirrors this file. No stone unturned.

Status: [x] Done · [~] In progress / Partial · [ ] Planned

## P1 — Critical (the owner hammered these)
1. [x] Desktop app with chat wired to Claude Code
2. [x] Standing rules persist (CLAUDE.md) + one-click corrections (no repeating yourself)
3. [~] Independent verification — Codex primary, Antigravity `agy` fallback (Gemini retired; wiring done). BLOCKED on a proven verdict: Codex out of usage; agy hung ~13 min headless on a real diff and returned nothing. Reliable headless verifier still unproven.
4. [x] Hard-checks layer — git facts + PCC health check (deterministic, no LLM)
5. [~] Project memory / brief — no Groundhog Day (editable brief + auto-load done; deeper carry-forward pending)
6. [~] Standardized lifecycle — lifecycle bar shows current state, next action, and "Decision required" (done); full state-machine of legal transitions pending

## P2 — High (the "huge" wounds; the governed loop)
7. [~] Clean new-chat handoff — PROJECT.md brief + handoff paste block proven (first slice done; in-app auto-generation pending)
8. [x] Chat end-of-usefulness / rollover trigger — Signals card from this chat's own history: turn count, time span, and repeated-message detection (normalized). Tokens/true context-degradation are NOT app-observable, so they are surfaced honestly under "NOT proven" rather than faked.
9. [x] Untracked-files detection — deterministic `scripts/detect-untracked.ps1` (git-only, no LLM, respects .gitignore) + new Signals view rendering the honest 4-part format. CLI-first (works with app/ deleted); writes truth to .cockpit/result/detections/ with -WriteFile.
10. [x] Out-of-scope / drift detection — `scripts/detect-drift.ps1` compares files changed on the branch against a REAL declared boundary (.cockpit/state/app-build-scope.json allowed_globs), not a guess. Clear when work stays in scope; honest 'notice' when a changed file is outside it (revert, or update the boundary on purpose). Reports 'unknown' (never guesses) if the boundary file is missing.
11. [x] Stale-docs detection — `scripts/detect-stale-docs.ps1` checks a small, explicit, adjustable rule list (.cockpit/state/doc-freshness-map.json): if code matching a rule changed but the doc that should track it did not, it flags an honest 'notice'. Stays QUIET when no rule matches (never guesses); 'unknown' if the map is missing. Starter rules: app change → roadmap; new detector → roadmap; verify-work.ps1 → PROJECT.md + roadmap.
12. [ ] Agreements-only-in-chat -> flag + capture to truth
13. [x] Repo-sync discipline — `scripts/detect-repo-sync.ps1` Signals card: is the work actually backed up to the remote? Flags uncommitted changes, untracked files, and committed-but-unpushed commits (and a missing upstream). Pure git, deterministic, zero false positives. Clear only when the tree is clean and the branch is level with its upstream.
14. [x] Live trust signals — always-visible strip above the chat: On the rails (drift + stale-docs clear), Backed up (repo-sync clear), Verified (honest: green only for a fresh PASS newer than HEAD; amber "not verified yet" otherwise — never faked), Rules loaded (CLAUDE.md present). Each chip is green only when a real deterministic check says so; tooltips explain what is and isn't proven.

## P3 — Medium (honest detections + lifecycle extras)
15. [ ] Reinventing-the-wheel signal (overlap vs existing, honest)
16. [ ] Project-bloat signal (threshold-based, not mind-reading)
17. [ ] "Never says no" / sycophancy signal (missing risk/opposition section)
18. [ ] Standardized new-project bootstrap (every project starts the same way)
19. [ ] Honest babysitting-reduction metrics

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
