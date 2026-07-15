# Owner milestone-update generator — structure→machinery for channel 1   (status: active)

> Implements **channel 1 (owner significant milestone update)** of `docs/specs/communication-contracts.md`
> (ADR-0009 category 1, AC-1). This is the "make the template real" slice: the fixed block set stops
> depending on the worker remembering it, and the phase **% complete is computed, never invented**.

## Objective
The owner has asked "hundreds of times" for the same milestone-update shape: fixed blocks, plain
language, visually organized, never a wall of text, with a real (not made-up) progress number. A prose
rule in CLAUDE.md drifts. The fix (ADR-0009 principle: machinery over prose) is a **deterministic
generator** that assembles the fixed format and computes what can be computed — the phase **% complete**
(done slices ÷ total, from a declared manifest) and the **git context** (what changed since a ref) — and
leaves **only the plain-English judgment slots** for the LLM to fill. "Same format every time" then comes
from code, not memory.

## The phase manifest = the honest denominator
`.cockpit/state/phase-manifest.json` (`schema: phase-manifest/v1`) declares the current phase and its
**slices** as DATA — the same "declare the boundary, then check against it" pattern as the stakes
manifest. Each slice has `id`, `title`, `workstream`, `done` (bool), and `evidence` (a PR number /
commit SHA / doc pointer). The generator computes `pct = round(done ÷ total × 100)`.

**Anti-fake-green rule (the core of this slice):** a slice may be counted `done` **only** if it carries
non-empty `evidence`. A `done: true` slice with empty `evidence` is a manifest defect — the generator
does **not** silently count it; it reports the percentage as **UNKNOWN** and names the offending slice.
The number can therefore never be inflated by flipping a flag; it must point at a checkable artifact.

## Behavior
`scripts/new-milestone-update.ps1` (deterministic, read-only, no LLM, exits 0):
1. Read the manifest (default `.cockpit/state/phase-manifest.json`; `-ManifestPath` overrides for tests).
2. **Fail closed on bad input.** Missing file, invalid JSON, wrong `schema`, no slices, a **malformed
   slice** (not an object, missing `id`, or a **non-boolean `done`** — e.g. the JSON *string* `"false"`,
   which PowerShell would otherwise truthy-cast), or any `done`-without-`evidence` slice ⇒ the computed
   `pct` is **UNKNOWN** (never 0-faked, never invented), with a plain reason and — for the evidence and
   malformed cases — the offending slice id(s) / issue.
3. Otherwise compute `pct`, `done`, `total` from the manifest.
4. Compute git context since `-Since <ref>` (default: `origin/main`): the commit subjects and the
   changed-file count on `HEAD` since that ref. This is raw material for the judgment slots, never a
   substitute for them. If git is unavailable, the context is marked unavailable — it never blocks.
5. Emit the **fixed block set** as paste-ready markdown, in this exact order, each block 1–2 lines:
   - **Header:** `🏁 <milestone> · <phase name> · <pct>% complete (<done>/<total> slices)`
   - **What just happened** — judgment slot
   - **Where it fits** — judgment slot
   - **Why it's better** — judgment slot
   - **Principles check** — judgment slot (the 10-point yardstick is printed for reference)
   - **Needs you** — judgment slot (or "nothing")
   Judgment slots are emitted as explicit `«fill: …»` placeholders so an unfilled update is obvious.
6. `-Json` emits the machine-readable computed fields (`schema`, `pct`, `done`, `total`, `phase`,
   `git`, `blocks`, `not_proven`) for tests and callers.

## Acceptance criteria
- **AC-1 (computed %):** WHEN the manifest is valid THE SYSTEM SHALL report `pct = round(done÷total×100)`
  with `done`/`total` matching the manifest's slice states.
- **AC-2 (never invented):** WHEN the manifest is missing, malformed (incl. `slices` not an array of
  objects, or a slice with a non-boolean `done`), wrong-schema, or empty THE SYSTEM SHALL report
  `pct = "UNKNOWN"` with a plain reason — never a fabricated number and never a silent 0.
- **AC-3 (evidence-bound done):** WHEN any slice has `done: true` and empty `evidence` THE SYSTEM SHALL
  report `pct = "UNKNOWN"` and name the offending slice id(s), refusing to count it.
- **AC-4 (fixed block set):** WHEN generating an update THE SYSTEM SHALL emit exactly the six fixed
  blocks above, in order, with the header carrying the computed `<pct>% (<done>/<total>)`.
- **AC-5 (judgment slots surfaced):** THE SYSTEM SHALL emit each judgment block as an explicit `«fill: …»`
  placeholder, so a not-yet-filled update is visibly incomplete rather than silently blank.
- **AC-6 (git context, non-blocking):** WHEN git is available THE SYSTEM SHALL include the commit
  subjects and changed-file count since `-Since`; WHEN unavailable it SHALL mark the context unavailable
  and still emit the blocks.

## Non-goals (this slice)
- Enforcing that the worker actually *runs* the generator (that's a habit/enforcement question for a
  later channel-1 slice; this slice makes the machinery exist and correct).
- Scaffolder parity (AC-5 of the parent comms spec) — a later slice; the manifest + generator ship to
  spawned projects then.
- Computing the judgment prose — that is the irreducible LLM slot, by design.

## Proof
`app/tests/scripts/milestone-update.spec.js` runs the generator exactly as it is used
(`pwsh -File … -Json`) against synthetic temp manifests and asserts every AC above.
