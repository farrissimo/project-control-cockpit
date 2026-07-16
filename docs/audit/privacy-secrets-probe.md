# Quick probe — Privacy, secrets & access control   (ADR-0009; status: PROBE ONLY, not the full category)

**Not a full category grid.** The owner asked for a *quick privacy-secrets probe* alongside the
backup-recovery / recovery-rollback / scaffolding-parity categories. The full
`privacy-secrets-access-control` slice remains **not done** in the phase manifest. This is the probe record
+ the one fix it produced.

## What was probed
1. **Does PCC handle secrets directly?** **No — by design.** PCC drives Claude Code through the owner's
   claude.ai login, not a paid API key (DECISION-003). `app/main.js:176` actively **scrubs**
   `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` from the child-process env so a stray key can't bill the
   metered API or disable org connectors. Net: PCC stores/transmits no API credentials of its own — a strong
   posture (nothing to leak).
2. **Is personal chat content kept out of git?** **Yes.** `.cockpit/chats/`, `.cockpit/chat-export/`, and
   `.cockpit/evidence/` are git-ignored (`.gitignore`) — first-class chat history is a local-first record,
   backed up by `backup-protected-files.ps1`, never committed repo truth.
3. **Any secrets ever committed?** **No.** `git log --all --diff-filter=A` shows no `.env`/`.pem`/`.key`/
   `secret*`/`credential*` file ever added; `git ls-files` tracks none today.
4. **Does the codebase back up its own security claim?** **This is where the gap was.** ⟶ below.

## Finding → FIXED (the one real break this session)
**`AGENTS.md` line 71 claims "Env is git-ignored" — but `.env` was NOT actually ignored.** `git check-ignore
.env` returned *not ignored*. No `.env` exists today, so nothing has leaked — but the claim was a
**fake-green safety net** (Rule 2, claims-match-implementation): the protection the doc promised did not
exist. Consequence is real *because of parity* — `.gitignore` travels to every spawned project
(`bootstrap-project.ps1` §3), and a spawned LLM project is exactly where a worker, trusting "env is
git-ignored," would create a `.env` with a real product API key and have it committed + pushed to GitHub.
Silent, costly, and shipped to every child — the failure mode this phase exists to catch.

**Minimum control built (clears the bar):** added a secrets block to `.gitignore` — `.env`, `.env.*`
(keeping `.env.example` trackable), `*.pem`, `*.key`, `secrets.json`. **Measurable proof it moved:**
`git check-ignore .env .env.local secrets.json config.pem app.key` now reports all ignored;
`.env.example` stays trackable. This **makes the AGENTS.md claim true** rather than weakening the claim, and
rides the scaffolder's `.gitignore` copy into every spawned project (parity, automatic). One line, zero
maintenance, closes a real consequential leak path.

## Not probed (deferred to the full category — disclosed, not painted green)
This quick probe did **not** cover: access control between projects, file-permission posture, OS-keychain /
credential-manager integration, redaction of secrets that a *worker* might paste into chat, or a
commit-time secret scanner (e.g. gitleaks/trufflehog — prior-art to evaluate IF the full category is done).
None are claimed green. The full `privacy-secrets-access-control` category, if the owner chooses it,
should probe these and decide (prior-art-first) whether a scanner clears the standardize-rarely bar.

## Verdict
Posture is **fundamentally sound** (PCC holds no secrets of its own; personal content is git-ignored; no
history leak) with **one real fake-green found and fixed** (`.env` now genuinely ignored, matching the doc,
traveling to all children). Recorded as a probe, not a completed category.
