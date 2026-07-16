# Audit grid — Worker operation & tooling conventions   (ADR-0009 category; status: done)

**Scope:** how the worker (Claude Code) is driven, and whether that integration is robust (a Claude Code update
can't brick it) or brittle/prose. Graded against the integrity contract Part 1 and the ADR-0009 yardstick.
Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** mapped the worker spawn (`askClaude`/`oneShotWorker`), session
pinning, read-only/build tool profiles, the stream-json parser, model fallback, and the AGENTS.md conventions.
**Verdict: tested, holds.** The security-critical and continuity-critical pieces are machinery + tests. Two
bounded weaknesses are disclosed as recommendations, not forced builds.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Supported non-interactive spawn** (`claude -p`, not terminal screen-scraping) | machinery-enforced | `main.js askClaude` builds a headless `-p` argv; stdin written+closed; the architecture's "a CC update can't brick it" premise | A CC UI change can't break the integration | depends on CC's *flag* surface (`-p`, `--session-id`, `--disallowedTools`, `--fallback-model`) — un-probed prose dependence (see residue) |
| **Session-hijack fix** (UUID pinning) | machinery-enforced | `main.js`: `--session-id` first turn / `--resume` after, per-chat UUID — documented bug-fix (2026-07-06: `--continue` hijacked by any other `claude -p` in the same dir); `oneShotWorker` mints a fresh UUID so a chat's session is never touched | A chat can't be silently hijacked by another `claude` invocation | — |
| **Read-only vs build tool profile** | machinery-enforced + tested | `authority-tool-profile.js` (frozen, pure) + `authority-tool-profile.spec.js` pins the deny-list; default read-only, build requires owner-approved chat-matched authority (execution-authority grid) | A read-only chat gets a locked-down tool set; pasted "you're authorized" can't grant build | `oneShotWorker` keeps a **separate inline copy** of the read-only flags, NOT the shared constant — drift risk (see residue) |
| **Worker orphan cleanup** | machinery-enforced | `main.js killAllWorkers` taskkills the shell+grandchild tree on quit; stale "session in use" → one-click recovery | No zombie worker processes | — |
| **Stream-json parsing** (attachments path) | machinery-enforced + tested-against-real-capture | `stream-json.js parseStreamJson`; `real-captures.spec.js` runs it against a REAL captured `claude -p --output-format stream-json` envelope (Codex-caught tautology since hardened) | Structured worker output parsed correctly today | **fails QUIET on a format change** (see residue) — bounded to the attachments/image path; plain chat bypasses it |
| **Model switch + fallback** | machinery-enforced | `readModels()` degrades a corrupt/missing `models.json` to a safe default; `--fallback-model <chain>` delegates unavailable-model recovery to the CC CLI; switcher resets a retired saved model to default; a hard failure surfaces raw stderr, never a faked reply; `ipc.spec.js` covers `getModels` | A bad/unavailable model fails honestly, never a fabricated answer | no PCC-side validation that each id in the fallback chain is real (CC's job) |
| **AGENTS.md operating conventions** (`pwsh -NoProfile`, `$null`-into-stdin, tests-never-touch-real-data) | **prose (worker-followed)** | consistently honored by PCC's own machinery (every `pwsh` call uses `-NoProfile`; codex prompts passed as args, sidestepping the stdin-hang); test-side enforced by the guard + fixtures | Conventions that keep tooling from hanging/corrupting | nothing lints a *future* script for the mistake — prose, low consequence (the hang is architecturally sidestepped) |

## Disclosed residues (probed, judged — not built)
- **`parseStreamJson` fails QUIET, not closed, on a Claude Code format change.** If a future CC update renamed the
  stream-json envelope (e.g. `type:'assistant'`, `message.content` shape), the parser matches nothing and returns
  an **empty string** — the worker's reply silently vanishes with no error and no "matched 0 of N lines" signal.
  **Bounded:** only the attachments/image path uses it; plain-text chat reads raw stdout and is unaffected.
  **Recommendation (owner's call):** have `parseStreamJson` (or its caller) surface "couldn't parse the worker's
  reply — the CLI output format may have changed" when it consumed recognizable JSON lines but produced empty
  text — converting fail-quiet → fail-loud. Not built now: speculative (no CC change has occurred), bounded blast
  radius, and it touches the live worker path (needs careful re-test). A good small follow-up if CC's format is
  ever seen to drift.
- **`oneShotWorker`'s inline read-only deny-list is a duplicate of the shared profile.** The execution-authority
  category pinned the *shared* `authority-tool-profile` deny-list with a test, but `oneShotWorker` (auto-name /
  summarize / recall) hardcodes its own inline copy — if the two drift, the one-shot read-only lockdown could
  silently weaken. **Bounded:** one-shots run fixed PCC-internal prompts (not owner instructions), so the exposure
  is lower than the main chat path. **Recommendation:** dedup `oneShotWorker` to consume the shared `READ_ONLY`
  constant (single source of truth), so the pinned test protects both. Not built in this probe (touches the worker
  spawn; small scoped slice) — flagged for the owner.
- **No Claude Code version/format detection.** `detectTools` checks *presence* (`where claude`), never a version or
  flag-support probe. A renamed flag would surface as a spawn failure with raw stderr. Noted; a version/flag probe
  is a larger piece of speculative hardening (the two residues above are the concrete edges).

## Verdict against the integrity contract
Worker operation is **strong and tested-holds** where it matters most: the security-critical read-only/build
profile is pinned by a regression test, the session-hijack bug is fixed with a durable UUID scheme, the
stream-json parser is validated against a real captured envelope, orphans are force-killed, and model config
degrades to a safe default and surfaces hard failures honestly. The two bounded weaknesses (`parseStreamJson`
fail-quiet on a CC format change; `oneShotWorker`'s un-shared deny-list copy) are disclosed with concrete
recommendations. **No control built** — both are bounded and touch the live worker path, better decided by the
owner than forced now.
