# PCC Path A Plan / Scope

> **Canonical status.** This is the plan of record for **Path A** — PCC continuing
> as a lean, separate, single-repo project control center on its own terms
> (`DECISION-074`; confirmed as the post-checkpoint direction in `DECISION-087`).
> It is the Path-A analogue of `docs/BRR_PLAN.md` and `docs/V1_Scope.md`: it
> defines what Path A is, records what is already built, and breaks the remaining
> work into categories → phases → tasks → subtasks. It is a roadmap, not itself
> a live task list; concrete work is delivered as bounded `pcc-pathD-0XX` tasks
> promoted from this plan's breakdown, each through the normal worker/verifier
> cycle.
>
> **Progressive elaboration by design.** The *next* buildable phase (D1) is
> specified to task/subtask depth. Later phases (D2, D3) are outlined, and
> deferred categories (E, F) are placeholders only. Fully speccing speculative
> far-future work would be exactly the governance bloat PCC's charter exists to
> filter out (`docs/PROJECT_CHARTER.md` Core Design Rule). Each phase is
> elaborated to full depth only when it becomes the next real work.

---

## Purpose

Path A is the answer to "what is PCC, finished, on its own?" — a local-first
control board that reduces owner babysitting for a single project/repo, honest
about what it knows, resistant to governance bloat, with every capability a
bounded unit over the `.cockpit/` file bridge.

This plan exists so that Path A work can start from repo truth without
re-planning from chat: a fresh session can open this file, pick the next
`pcc-pathD` task, and build.

---

## 1. Path A Definition (from `DECISION-074`)

- PCC and CCB stay **separate products**. Neither imports or becomes the other's
  engine.
- **Path A now:** PCC is a lean, separate, single-repo governance tool, complete
  on its own terms — not a stepping stone.
- **Path B deferred:** PCC's earned-trust kernel *may* later seed a rebuilt CCB.
  Live possibility, not a commitment; revisited only when Path A is judged
  mature, and recorded explicitly at that time.
- **Standing design rule (extractability, `DECISION-074`/`077`):** every new PCC
  capability is a script or clearly bounded unit with a documented input/output
  contract over the `.cockpit/` bridge and **no hidden shared state** with other
  scripts — it could in principle run against a different repo given only its
  documented inputs. Every Path A task is checked against this rule.

---

## 2. Where We Are Now (repo truth)

- The **Maturity Checkpoint is reached** (`DECISION-084`) and the kernel is
  frozen/backed up (`DECISION-085`).
- Pre-checkpoint categories **A, B, C are complete** and were the basis for the
  checkpoint.
- The remaining Path A build work is **Category D (the owner-facing product
  surface / UI)**. Categories E and F stay deferred.

---

## 3. The UI Decision (finished-state form)

**Finished form: a local-first web dashboard that is a pure *consumer* of the
`.cockpit/` file bridge.** It reads the same `.cockpit/` state/result/log files
the scripts already read and write, renders them as owner-facing panels, and —
only in its final phase — writes *request files* that existing scripts act on.
It never reaches into a script's internals, never runs shell work itself, and
never mutates authoritative state directly.

**Why this form, from PCC's own principles:**

- **Extractability (`DECISION-074`/`077`) prefers it.** A page that only reads
  `.cockpit/` files (and later drops request files) has zero hidden shared state
  with the engine — the cleanest possible embodiment of "the UI is a consumer of
  the file contract" (`docs/CCB_PCC_RELATIONSHIP.md` §8). A bundled desktop app
  tempts pulling engine logic into the app process, which is the shared-state
  monolith failure CCB's postmortem blames.
- **Local-first / no paid API (`DECISION-002`/`003`):** served locally, no
  external calls.
- **Reduce babysitting (`DECISION-001`):** a glanceable board (current task,
  state, verdict, blocker, next action) is the payoff.
- **Leanness / "don't become harder to manage than the projects it controls"
  (original scope §9):** a native app shell + build pipeline + packaging is heavy
  machinery for a local status board; a local web page is lighter and more
  reversible.

**Disclosed departure from original scope §10.** The original scope preferred a
Tauri/Electron **desktop app first**, and rejected a web UI *only* because "this
product needs local project and shell access." Under PCC's evolved architecture
the **scripts own shell access, not the UI** — the UI just reads files and (last)
drops request files. That premise no longer holds, so the desktop-first
preference is superseded for Path A by the pure-consumer web dashboard. Recorded,
not buried (`DECISION-087`).

**Built progressively:** read-only status board first (biggest babysitting win,
lowest risk, proves the consumer pattern), then the full panel set, then a thin
request-file write-path for the first controls. Finished form and first form are
the same technology — the read-only board is grown, not thrown away.

---

## 4. Guardrails Carried Into Every Path A Task

- **Advisory-not-gating by default.** New surfaces inform; they do not block or
  redirect work unless a block is explicitly justified and owner-approved.
- **Read-only until D3.** Phases D1–D2 read `.cockpit/` files only. The first
  write-path (D3) is gated on its own owner decision because it adds new UI
  authority (see §6, Phase D3).
- **Honest-only display (`DECISION-008`).** No fabricated numbers (e.g. no
  invented "session usage %"). A panel shows only what PCC can truthfully derive
  from real files.
- **Three-filter test (`docs/PROJECT_CHARTER.md`).** Every task must reduce
  babysitting, avoid bloat, and preserve modularity, or it is not promoted.
- **Exercised, not spec'd.** A capability counts as done only when built and
  functionally tested on real `.cockpit/` artifacts, then verified.

---

## 5. Full Roadmap

| Category | Phase | Status |
|---|---|---|
| A — Routing & Model Governance | 1 (pre-checkpoint) | ✅ Done — `DECISION-075` (`pcc-pathA-001`) |
| B — Behavior & Tooling Controls | 2 (pre-checkpoint) | ✅ Done — `DECISION-076` (`pcc-pathB-001`) |
| C — Metrics & Evidence Depth | 3 (pre-checkpoint) | ✅ Done — `DECISION-081` (`pcc-pathC-001..004`) |
| **Maturity Checkpoint** | Milestone | ✅ Reached — `DECISION-084`; frozen `DECISION-085` |
| **D — Product Surface (UI)** | Post-checkpoint | ⬜ **Next** — broken down in §6 |
| E — Multi-Model/Multi-Agent | Deferred | Path-B / CCB-domain scope |
| F — Knowledge & Memory | Deferred | Gated on proven need |

---

## 6. Category Breakdown

### Category A — Routing & Model Governance — ✅ DONE

Delivered as `scripts/classify-routing.ps1`, a read-only advisory routing
classifier (`DECISION-075`, `pcc-pathA-001`). Original scope §7.17 (session
pressure) deferred to Category D; §7.18 (premium escalation) already covered by
the Owner Review Matrix. Record only; no remaining pre-checkpoint work.

### Category B — Behavior & Tooling Controls — ✅ DONE

Communication preferences fielded in state (`communication_prefs`) and surfaced
in the worker directive (`DECISION-076`, `pcc-pathB-001`). These become editable
in Phase D3. Record only.

### Category C — Metrics & Evidence Depth — ✅ DONE

`doctor.ps1` repo-health checks extended (`DECISION-078`, `pcc-pathC-001`);
state-drift repair (`pcc-pathC-002`); category recorded substantially complete
(`DECISION-081`, `pcc-pathC-003`); bounded extractability audit verified
(`pcc-pathC-004`). `IDEA-013` (richer evidence review) stays deferred until a
concrete evidence-review gap surfaces. Record only.

### Maturity Checkpoint — ✅ REACHED

`DECISION-084` (reached on verified `pcc-pathC-004`); kernel frozen and backed up
`DECISION-085`. This plan is downstream of the checkpoint.

---

### Category D — Product Surface (owner-facing local dashboard) — ⬜ NEXT

**Task ID convention:** `pcc-pathD-0XX`, promoted from this breakdown.
**Panels** are drawn from original scope §11 (Owner Control Board, Directive,
Verification, Local Tools, Session/Usage, Handoff/Rollover, Tone/Behavior).

#### Phase D1 — Read-only status board (the babysitting win)

Prove the consumer-of-file-bridge pattern. Read-only throughout: no writes, no
controls, calls no engine script.

- **`pcc-pathD-001` — Dashboard skeleton + Owner Control Board panel** *(first buildable task)*
  - D1-T1.1 — Choose and record the local-serving mechanism: a single,
    self-contained PowerShell script that reads `.cockpit/` state and renders a
    local HTML view, with no external runtime dependency and no engine-script
    calls (extractability rule). Record the choice in the task's decision.
  - D1-T1.2 — Owner Control Board panel: render current project, task, state,
    next expected action, role, worker, verdict, and blocker from
    `.cockpit/state/project-state.json` + `.cockpit/state/task-state.json`.
  - D1-T1.3 — Manual "regenerate" path; functionally test against the real
    `.cockpit/` state and against a synthetic malformed-state case (fails clean,
    no mutation).
  - D1-T1.4 — Record decision + evidence; hand back for verification.
- **`pcc-pathD-002` — Directive + Verification panels**
  - D1-T2.1 — Directive Panel: current directive, boundaries, required evidence,
    success criteria, handoff target (from `.cockpit/handoff/worker-directive.md`).
  - D1-T2.2 — Verification Panel: returned evidence, changed files, verdict,
    missing evidence, next action (from `worker-result.md` +
    `verification-result.json`).
  - D1-T2.3 — Functionally test against a real completed cycle's archived
    artifacts.
- **`pcc-pathD-003` — Routing / Local Tools read-only panel**
  - D1-T3.1 — Local Tools Panel: suggested local route + command preview, shown
    as **display-only** (the panel never executes anything), sourced from
    `classify-routing.ps1` output captured as data.
  - D1-T3.2 — Routing history: read-only summary of `.cockpit/logs/routing-log.jsonl`.

#### Phase D2 — Live refresh + full panel set (still read-only)

- **`pcc-pathD-004` — Auto-refresh / watch mode:** poll `.cockpit/` files and
  re-render; remains read-only.
- **`pcc-pathD-005` — Session/Usage panel (honest-only):** the honest home for
  original scope §7.17. Shows only truthfully-derivable facts — current route
  (from `classify-routing.ps1`), routing history — and explicitly **not** any
  fabricated usage/pressure number (`DECISION-008`).
- **`pcc-pathD-006` — Handoff/Rollover panel (read-only):** latest clean handoff
  and current rollover-trigger warnings (from `check-stop-conditions` output).

#### Phase D3 — Thin write-path for controls (first interactivity) — OWNER-GATED

D3 is where the UI stops being pure read-only. **New authority: the UI can
trigger actions.** To preserve the file-bridge contract, every control only
**drops a request file** that an existing script/watcher already understands —
the UI still never executes work or mutates authoritative state directly.

**Gate:** `pcc-pathD-007` requires its own owner decision before promotion; it is
not auto-promoted from this plan, because it adds authority (a UI that can
initiate actions), not just a view.

- **`pcc-pathD-007` — Request-file inbox contract + schema:** define a
  `.cockpit/request/` inbox convention and schema — the one genuinely new bridge
  surface. Owner-decision gated.
- **`pcc-pathD-008` — Rollover/handoff controls:** drop a rollover-request file;
  the existing safe-stop/handoff path picks it up.
- **`pcc-pathD-009` — Tone/Behavior controls:** update `communication_prefs`
  (Category B) via a request-file → existing state-update path, never a direct
  edit from the UI.

---

### Category E — Multi-Model/Multi-Agent — DEFERRED (placeholder)

Path-B / CCB-domain scope (`DECISION-074`, `docs/CCB_PCC_RELATIONSHIP.md` §8).
Not broken down: doing so now would be speculative bloat. Elaborate only if Path
B is ever chosen.

### Category F — Knowledge & Memory — DEFERRED (placeholder)

Original scope §12.1/§12.2: lightweight persistent project memory first, full
RAG only when proven necessary. Gated on proven need. Not broken down.

---

## 7. How To Start Path A Work (next session)

1. Open this plan; the next task is **`pcc-pathD-001`** (Phase D1 — dashboard
   skeleton + Owner Control Board panel), scoped in §6.
2. Promote it to a worker directive through the normal path and build it as a
   bounded, read-only, extractability-compliant task.
3. Verify through the two-role cycle (or the disclosed fallback of `DECISION-086`
   while Codex is unavailable), record the decision, then continue to
   `pcc-pathD-002`.

No further planning is required to begin Category D.
