# CCB ↔ PCC Relationship — Audit Determination

**Date:** 2026-07-04
**Author:** Claude (Opus 4.8), at owner request
**Status:** Accepted by owner. Canonical. See `DECISION-074`.

---

## 1. What was audited

- **PCC** (Project Control Cockpit): full working state — 15 V1 cycles, 5 BRR phases, `.cockpit/` file bridge, PowerShell tooling, DECISIONS log.
- **CCB** (Command Center CCB, at `C:\CommandCenterCCB`): `README.md`, `CCB_PRODUCT_SPEC.md`, `OPERATING_MODEL.md`, `FAILURE_CLASS_MATRIX.md`, `GOVERNANCE_FRICTION_PATTERNS.md`, `PROJECT_ROOM_V1_POSTMORTEM.md`, `project_blueprint.json` example, and the module layout: 16,207-line `ccb.mjs` engine plus `vision-gate.mjs`, `isolation.mjs`, `packet-generator.mjs`, `worker-bee.mjs`, `execution-guard.mjs`, `wizard.mjs`, `pm-review.mjs`.

---

## 2. The finding that overturned the initial hypothesis

Working only from a verbal description of CCB, the initial hypothesis was:
*"CCB births governed projects; PCC is the proven execution engine each one runs on."*

**The actual CCB repository falsifies this.** CCB already has its own execution engine, more mature than PCC's:

| PCC mechanism | CCB's already-built equivalent |
|---|---|
| Worker directive + file bridge | `packet-generator.mjs` + `worker-bee.mjs` + agent-bridge |
| BRR autonomous gate | `vision-gate.mjs` (isolated alignment gate) |
| Task safety class / containment | `isolation.mjs` + `execution-guard.mjs` |
| Verification / verdict | quality gate + `converge` + provider-authority policy |
| doctor / backup / safe-stop | `doctor`, `.ccb-backups`, `RECOVERY_LOCK.json`, `recover` |
| State spine + restart safety | `ccb.plan.json` + `TRANSITION_MODEL` + `SESSION_STATE.md` |

PCC as "CCB's engine" would install a **second, younger, competing governance runtime** — the exact "parallel governance maze" both projects explicitly forbid. That path is rejected.

---

## 3. What PCC has that CCB lacks — in CCB's own words

- **`GOVERNANCE_FRICTION_PATTERNS.md`** is CCB cataloguing its own over-governance: duplicate startup authorities, bootstrap micromanagement, brittle task packets forcing abort/delete/recreate loops, completion paths needing `recover` to finish work completion should have finished.
- **`FAILURE_CLASS_MATRIX.md` Class 7:** "CCB reached 202/209 tasks done while the platform continued to surface new defect classes … 180 → 195 → 209 → 215 without a corresponding increase in coverage." — task-count theater.
- **Class 5 (Owner-Experience):** the most under-tested class; heavy binary approval ceremony, no graduated trust.

CCB's gates are **binary and blanket** (approve everything, every time), which generates the ceremony its own friction doc complains about. What it lacks is PCC's **BRR**: earned, graduated, per-task-class autonomy plus honest-accounting ("state what was NOT proven"). BRR is the antidote to CCB's two worst self-documented ailments.

---

## 4. Determination: separate products, conceptual link — not architectural

**Keep CCB and PCC as two separate codebases and two separate products. Do not merge; do not make one import the other. The link is philosophy, not code.**

- **CCB = mature delivery factory.** Export: engine machinery (wizard intake, blueprint contract, spawned standalone projects, isolation/containment, vision-gate). Target user: non-coder running many projects.
- **PCC = governance-discipline lab.** Export: BRR (earned graduated autonomy; anti-over-governance, honest-accounting ethos). Target user: technical owner governing one codebase.

The owner's instinct to build PCC *independent* from CCB was correct, and CCB's own postmortem proves why: *"You cannot prove delivery and repair the engine at the same time. These must be separate sessions."* PCC is the clean room where governance was re-derived without CCB's baggage — and BRR is real, exercised across 5 phases.

Cross-pollination goes **both directions, as patterns not code**:
- **PCC → CCB:** adopt BRR concepts (graduated task-safety autonomy to kill Class-5 approval ceremony; the "what was NOT proven" rule to kill Class-7 task-count theater).
- **CCB → PCC:** if PCC ever outgrows single-repo scope, CCB has already built the multi-project/spawn/isolation machinery — borrow the *patterns*, never fork the engine.

---

## 5. Strong caution

**Do not integrate now, in either direction.** CCB's own spec says *"CCB is not done."* PCC is days old. Wiring two unfinished governance systems together would manufacture the exact truth-drift, scope-drift, and parallel-authority failures both repos have already documented.

Any borrowing of CCB's hard-earned lessons into PCC must go through PCC's own governed intake (`backlog/IDEAS.md` → advisor/owner promotion → bounded task → independent verification), one lesson at a time, treated as an external pattern to re-derive and re-prove locally — **never** as a live dependency or a bulk copy. Extreme caution is warranted precisely because CCB's lessons are entangled with CCB's own over-governance; the value is in the corrected principle, not the CCB implementation of it.

---

## 6. One-line answer

Not naturally linked as software; genuinely linked as ideas. Keep them separate — PCC's real value to the pair is that **BRR is the cure for the over-governance CCB has already diagnosed in itself.**

---

## 7. Owner decision: Path A now, Path B deferred behind a maturity gate

Following this audit, the owner considered two possible futures for PCC:

- **Path A** — PCC stays a lean, separate, single-repo governance tool in its own right. A complete answer on its own, not a stepping stone.
- **Path B** — PCC's earned-trust kernel (BRR) eventually becomes the foundation a rebuilt CCB is built around, with CCB's mature engine machinery (isolation, spawn, wizard) pulled in on top of it as patterns, once PCC is proven enough to bear that weight.

**Decision: pursue Path A now. Path B remains a live possibility, not a commitment, revisited only once Path A is judged sufficiently built and mature — a judgment to be made and recorded explicitly in repo truth at that time, not assumed.**

### The modularity/extractability design rule

The owner's long-standing instinct toward modularity (carried over from CCB, where it proved hard to honor in practice) is not a separate goal from Path B — it is the same requirement, and it is free to satisfy now.

CCB's own claimed modularity (`vision-gate.mjs`, `isolation.mjs`, etc. as "adjacent isolated modules" per `CCB_PRODUCT_SPEC.md`'s Architectural Rules) is modularity in name only: each module is a satellite bolted onto the 16,000+ line `ccb.mjs` monolith, integrating by reaching into shared engine state. That is why CCB's pieces could not be cleanly pulled out when asked — modularity was claimed at the documentation level but defeated at the state level.

PCC starts from a structurally better position: it is already a set of discrete PowerShell scripts operating over the `.cockpit/` file-bridge contract, each with defined inputs and outputs on disk rather than shared in-process state. This is the thing CCB tried to retrofit and could not. The task going forward is not to *build* modularity into PCC — it is to *not lose* the modularity PCC already has as it grows.

**Standing design rule for all future PCC work:** every new PCC capability must be a script (or clearly bounded unit) with a documented input/output contract over the `.cockpit/` bridge, with no shared hidden state with other scripts — such that it could, in principle, be run against a different repo given only its documented inputs. Any proposed capability that instead reaches into another script's internal state, or that only works because of undocumented shared assumptions, should be rejected or redesigned on sight.

This single rule serves two purposes at once: it is the leanness discipline Path A needs to avoid CCB's over-governance trap, and it is the exact condition that keeps Path B possible later, at zero cost paid today.

---

## 8. The Maturity Checkpoint (current milestone)

The owner named the next major milestone as a deliberate **stop-and-assess checkpoint** — not a finish line. It is the point at which PCC is modular and mature enough to pause and evaluate, with real evidence in hand, **both** live options together:

1. Whether PCC is a fit to seed a **CCB v2** foundation, and/or
2. Whether it should continue maturing into the **standalone single-repo / single-project control center** envisioned in the original scope.

Both options remain on the table at the checkpoint. Reaching the checkpoint does **not** decide between them — it earns the right to decide with evidence instead of guessing now.

### Pass criteria (both must be demonstrated, not merely specified)

Consistent with the V1/BRR standard that capability is proven by real cycles rather than claimed:

1. **Categories A–C proven across real cycles** — Routing & Model Governance; Behavior & Tooling Controls; Metrics & Evidence Depth are substantially complete and exercised on real task cycles, not just spec'd.
2. **The extractability rule actually holds** — verified by a bounded audit task confirming that every script built since `DECISION-074` communicates only through the `.cockpit/` file-bridge contract, with no hidden shared state or undocumented cross-script assumptions.

### Category D (UI) is explicitly after the checkpoint

The UI is a **consumer** that plugs into the proven file-bridge contract — it reads and writes the same `.cockpit/` files every script already uses, and never reaches into a script's internals. Because the checkpoint's job is partly to prove that contract is clean and stable, the UI is downstream of it by nature: you don't build the consumer until the thing it consumes is proven solid. Categories E (Multi-Model/Multi-Agent) and F (Knowledge & Memory) remain deferred; E in particular is treated as Path-B / CCB-domain scope, not Path-A work.

### Roadmap re-cut under Path A (post-audit)

| Category | Placement | Note |
|---|---|---|
| A — Routing & Model Governance | Pre-checkpoint (Phase 1) | Core Path A |
| B — Behavior & Tooling Controls | Pre-checkpoint (Phase 2) | Core Path A |
| C — Metrics & Evidence Depth | Pre-checkpoint (Phase 3) | Core Path A |
| **Maturity Checkpoint** | **Milestone** | **Evaluate CCB v2 seed and/or standalone continuation** |
| D — Product Surface (UI) | Post-checkpoint | Consumer of the proven file contract |
| E — Multi-Model/Multi-Agent | Deferred | Path-B / CCB-domain scope |
| F — Knowledge & Memory | Deferred | Gated on proven need |

See `DECISION-074`'s "Maturity Checkpoint" amendment for the canonical record.
