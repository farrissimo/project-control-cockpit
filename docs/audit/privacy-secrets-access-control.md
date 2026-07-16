# Audit grid — Privacy, secrets & access control   (ADR-0009 category; status: done — FULL)

**Scope:** how PCC handles secrets, personal content, and isolation between projects. This is the FULL category;
the earlier **quick probe** (`docs/audit/privacy-secrets-probe.md`) already found + fixed the one fake-green
(AGENTS.md claimed "Env is git-ignored" but `.env` wasn't → secrets block added to `.gitignore`). Graded against
the integrity contract Part 1 and the ADR-0009 yardstick. Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** mapped credential handling, personal-content-in-git, secret
redaction on the write path, commit-time scanning, cross-project isolation, and file permissions. **Verdict: the
core is sound (PCC holds no secrets, isolation is enforced, the one fake-green is fixed). Two protections are
absent — but neither is a fake-green, and building one would violate PCC's own no-guessing principle.** No
control built; both absences disclosed as owner-decision residues.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **PCC holds no secrets of its own** | machinery-enforced | `app/main.js:186` scrubs `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` from spawned workers (login-based, DECISION-003); grep of `app/`+`scripts/` finds no other credential handling | Nothing to leak — the strongest posture | — |
| **Personal/chat content out of git** | machinery-enforced | `.cockpit/chats`, `chat-export`, `evidence` git-ignored + confirmed untracked; no history leak (`git log --diff-filter=A`) | Chat/personal content never committed or pushed | — |
| **`.env`/key/cert files git-ignored** | machinery-enforced (**probe fix**) | `.gitignore` secrets block (`.env`/`.env.*`/`*.pem`/`*.key`/`secrets.json`); travels to spawned projects | The common commit-leak vectors are blocked; matches the AGENTS.md claim | see `privacy-secrets-probe.md` |
| **Cross-project isolation** | machinery-enforced (fail-closed) | `chat-service.js`/`chat-store.js`: a store whose `projectId !== active` is rejected on READ and MUTATE (`project_mismatch`/`project_id_conflict`); identity resolved durably, fails closed | Project A can't read/mutate Project B's chat/state | isolation is **logical, not OS-enforced** (see below) |
| **Execution authority as access control** | machinery-enforced | cross-ref `docs/audit/execution-authority-worker-safety.md` (read-only default, owner-granted expiring build authority) | A worker can't act without owner-granted authority | — |
| **Secret redaction before disk write** | **absent — honest accepted-boundary** | grep: no `redact`/`sanitize` on the write path; chat text written verbatim to `chats.json` + `transcript.jsonl` + summaries | — | a secret pasted into chat is stored cleartext locally — see residue |
| **Commit-time secret scanning** | **absent — owner-decision recommendation** | grep: no gitleaks/trufflehog/detect-secrets, no scan hook, no CI scan step | — | an inline secret in a legit committed file is caught only by human review + the `.gitignore` block — see residue |
| **File-permission hardening** | absent (OS defaults) | grep: no `chmod`/`icacls`/`0600`; `.cockpit/chats/**` inherit default Windows ACLs | — | low consequence (single-user, local-first) |

## Disclosed residues — for the owner's active acceptance (ADR-0009 gate a)
1. **Secrets pasted into chat are stored in cleartext on the local disk.** Chat text is persisted verbatim across
   three tiers (`chat-store.js` `chats.json`; `main.js` `transcript.jsonl`; summary files) and swept into
   `backup-protected-files.ps1` backups. **This is an honest architectural property, not a fixable defect:**
   PCC is local-first (truth in files, on your own machine), the content is git-ignored (never exfiltrated), and
   **no app claims to redact** (so it is not a fake-green). Auto-redaction would require *guessing* which text is
   a secret — the exact fake-certainty / "declare boundary, never guess" pattern PCC's own rules and DECISION-008
   forbid; a redactor that silently mangles content or gives false "we protect secrets" confidence would be worse
   than honest non-redaction. **Recommendation:** accept as a residual risk + keep real secrets out of chat.
2. **No commit-time secret scanner.** An inline secret embedded in an otherwise-legit committed file (e.g. a
   hardcoded key in a `.js`) is caught only by human review + the `.gitignore` block. **This is prior-art-shaped
   hardening (gitleaks / trufflehog / detect-secrets), but it is a new dependency + an owner-gated decision, and
   PCC itself holds no secrets and has a clean history — so it is speculative-for-spawned-projects, not a current
   defect.** **Recommendation (owner decides, prior-art-first):** evaluate a SHA-pinned gitleaks CI step when
   spawned projects begin handling real product secrets — the point at which it clearly earns its place.
3. **Isolation is logical, not OS-enforced.** The store layer rejects cross-project access, but any local process
   (or a worker with Bash) reachable to another project's folder can read its cleartext `.cockpit/chats/*`. Low
   consequence on a single-user machine; noted, not closed (OS sandboxing is out of scope for a local-first app).

## Verdict against the integrity contract
Privacy/secrets/access-control is **fundamentally sound**: PCC stores and transmits no secrets of its own (keys
actively scrubbed — nothing to leak), personal content is git-ignored with no history leak, cross-project access
is actively rejected fail-closed, and the one fake-green (`.env`) is fixed and travels to every child. The two
absent protections (write-path redaction, commit-time scanner) are **honest, non-fake-green boundaries** — one an
irreducible local-first property (redaction = guessing, forbidden by principle), the other an owner-gated
prior-art decision best made when spawned projects handle real secrets. **No control built; both named for the
owner's active acceptance.**
