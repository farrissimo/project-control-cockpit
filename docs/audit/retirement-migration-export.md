# Audit grid — Retirement, migration & data export / decommissioning   (ADR-0009 category; status: done)

**Scope:** how a project ends, moves, or gets its data out — is the owner locked in, or can they cleanly
export / archive / leave? Graded against the integrity contract Part 1 and the ADR-0009 yardstick. Columns:
`docs/audit/README.md`.

**Method (probe freely, standardize rarely):** checked extractability, data export, project removal, folder
migration, archive/decommission, and format longevity. **Verdict: tested, holds — low consequence.** The data is
just files (JSON / JSONL / Markdown / git) in the project folder; the owner is not locked in. No control built.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Extractability** (delete `app/`, keep `.cockpit` + `scripts`, everything still runs from the CLI) | machinery-enforced + tested | scripts self-locate via `$PSScriptRoot`; the two `app/` reads are optional/guarded (`verify-evidence.ps1`, `run-release-gate.ps1` — "still RUNS with app/ deleted"); `scaffold-kit.spec.js` proves the CLI engine travels + computes in a bare project (no Electron); a formal kernel-audit passed (`idea-014`, routing-log `pcc-pathC-004`) | The owner is never trapped in the GUI — the engine is CLI-portable | — |
| **Open data formats** | machinery-enforced (by construction) | state = JSON; chats = `transcript.jsonl` + `summary.md` + `chats.json`; docs/decisions = Markdown; history = git; no proprietary/binary data tier | The owner can read/copy/walk away with everything using a text editor + git | — |
| **Continuous on-disk mirroring** (export is structurally unnecessary) | machinery-enforced | `main.js` `persistChat`/`summarizeChat` write open-format chat files on every turn/leave | The data is always already exported to the folder | no explicit "export" button — see residue |
| **Project removal via self-pruning registry** | machinery-enforced | registry at `userData/projects.json`; `readRegistry` prunes any path failing `fs.existsSync` on every read | Deleting a project folder cleanly drops it from the switcher — nothing orphaned | no explicit "remove project" button (delete the folder instead) |
| **Per-chat file cleanup on delete** | machinery-enforced | `main.js` `pcc:deleteChatFiles` | Deleting a chat removes its mirror files | — |

## Disclosed residues (probed, judged — low consequence, not built)
- **No explicit export / remove / archive *function*.** The owner manages retirement by hand-managing folders
  (delete a folder → the registry auto-prunes it). **Judged not worth building:** the data is already in open
  formats sitting in the folder, so an "export" button would just copy files the owner already has; a "remove"
  button would duplicate "delete the folder." This is **"fine because the data is just files,"** not lock-in.
  The stale `.cockpit/chat-export/` folder is an unwired artifact of a prior manual export (git-ignored) — not a
  live code path.
- **One absolute-path migration friction, confined to the retired track.** `project-state.json` bakes an absolute
  `active_repo_path`, and `validate-cockpit-state.ps1` hard-fails on it if the folder moves (until hand-edited).
  **But `project-state.json` is the retired advisor track** — freshly scaffolded projects deliberately omit it
  (`scaffold-kit.spec.js` RUNTIME_OK), so this affects only PCC's own legacy repo, not spawned projects. Low
  consequence; noted, not fixed.
- **No terminal "archived/retired" lifecycle state.** A finished project stays in the switcher until its folder is
  deleted. Low consequence (the switcher is a convenience list, not a source of truth). Noted.

## Verdict against the integrity contract
Retirement / migration / export is **tested-holds and low-consequence.** Data is 100% open formats in the project
folder + `userData`; extractability is a real, tested architectural property; deleting a folder cleanly removes a
project via the self-pruning registry. The absent export/remove/archive *buttons* are structurally unnecessary
(the data is just files) and the one migration friction is confined to the retired advisor track. **No control
built** — the expected outcome. The owner cannot be locked in.
