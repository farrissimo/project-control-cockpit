# PCC Cockpit — Feature Roadmap (living tracker)

Ranked by the urgency/priority the owner placed on each. Updated at every
milestone; the grid shown in chat mirrors this file. No stone unturned.

Status: [x] Done · [~] In progress / Partial · [ ] Planned

## P1 — Critical (the owner hammered these)
1. [x] Desktop app with chat wired to Claude Code
2. [x] Standing rules persist (CLAUDE.md) + one-click corrections (no repeating yourself)
3. [~] Independent verification — Codex primary, Gemini/Antigravity fallback (plumbing done; first real run scheduled 10:05 MT / via Antigravity today)
4. [x] Hard-checks layer — git facts + PCC health check (deterministic, no LLM)
5. [~] Project memory / brief — no Groundhog Day (editable brief + auto-load done; deeper carry-forward pending)
6. [ ] Standardized lifecycle — always shows current state, the legal next move, and a first-class "Decision required" state

## P2 — High (the "huge" wounds; the governed loop)
7. [ ] Clean new-chat handoff generation (compact, from verified state only)
8. [ ] Chat end-of-usefulness / rollover trigger (turns, tokens, time, repeat-count)
9. [ ] Untracked-files detection
10. [ ] Out-of-scope / drift detection (changed files vs task scope)
11. [ ] Stale-docs detection (narrow, honest: changed code but required doc untouched)
12. [ ] Agreements-only-in-chat -> flag + capture to truth
13. [~] Repo-sync discipline (surface when to commit/sync)
14. [~] Live trust signals (on the rails / independently verified / following your rules)

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
