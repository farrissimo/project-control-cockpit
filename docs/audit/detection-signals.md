# Audit grid — Detection & signals   (ADR-0009 category; status: done)

**Scope:** PCC's honest detectors are a core owner-facing trust surface. The trust question: does every detector
declare its boundary as **data** (never guess), fail to an honest **unknown** when it can't tell, and never paint
a **false green**? Graded against the integrity contract Part 1 (esp. malformed-fails-closed, displayed-truth)
and the ADR-0009 yardstick. Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** audited each `detect-*.ps1` and the two renderer signals for the
"green over unchecked" bug class — a `clear` badge emitted when the detector actually checked nothing. **Verdict:
found a real break → built the minimum control.** One detector (bloat) was missing the empty/malformed-config
guard its siblings already had, and false-greened over an unchecked project.

## Grid

| Detector | Boundary as data? | Fails closed to `unknown`? | Four-part format? | Tested? |
|---|---|---|---|---|
| **untracked** (`detect-untracked.ps1`) | yes (git) | yes — git failure → unknown | yes | contract |
| **drift** (`detect-drift.ps1`) | yes (`app-build-scope.json` + baseline) | yes — missing file / empty globs / missing baseline → unknown | yes | F9 baseline + contract |
| **stale-docs** (`detect-stale-docs.ps1`) | yes (`doc-freshness-map.json` + baseline) | yes — missing file / zero rules / missing baseline → unknown | yes | F9 + zero-rules + contract |
| **repo-sync** (`detect-repo-sync.ps1`) | yes (git + `backup-policy.json`) | yes — non-git → unknown; no policy → honest `notice`, never false clear | yes | contract |
| **bloat** (`detect-bloat.ps1`) | yes (`bloat-thresholds.json`) | **yes — NOW (fixed this category)**: missing / malformed / nothing-declared → unknown | yes | contract + F10 + **2 new** malformed/empty-config tests |
| **high-stakes** (`detect-high-stakes.ps1`) | yes (`high-stakes-rules.json` + baseline) | yes — missing file / missing baseline / empty-globs-and-deletions-off → unknown | yes | baseline + contract |
| **sycophancy** (renderer) | weak (keyword heuristic, self-declared) | **no** — short/absent answer → `clear` "not evaluated" (green-over-unevaluated) | yes | none (renderer, outside script harness) |
| **chat-rollover** (renderer) | yes (declared turn/hour thresholds) | n/a (always computes from real counts) | yes | none |

**App-layer safety (holds):** `main.js runDetector` resolves `{signal:'unknown', observed:'Detector could not
run'}` on any crash/non-JSON — a crashed detector shows UNKNOWN, never a fabricated green; the stakes surface
mirrors this (`tier:'UNKNOWN'` on any classifier failure). Signal vocabulary is bounded to
`clear|notice|unknown` (asserted by `detectors.spec.js`).

## The break found → FIXED (the minimum control)
**`detect-bloat.ps1` was the ONE config-driven detector missing the empty/malformed-config guard its siblings
already have** (drift, stale-docs, high-stakes each gained it in the F9 / 2026-07-14 metric-honesty fixes; bloat
was left behind). Reproduced live on the pre-fix script:
- A **present but malformed** `bloat-thresholds.json` → the parse error was swallowed (`catch { }`), config
  became null, zero files were scanned → it reported **`clear` "within the size/count limits you set."**
- A well-formed config declaring **no `source_globs` and no `dependency_manifests`** → also `clear` over zero
  files.

Both are the exact "green badge over unchecked" false-green this project's metric-honesty audit exists to kill.
Consequence is real on scaffolded / hand-edited projects (a JSON typo, or a config that forgets `source_globs`),
and it was **untested** (the suite only exercised bloat with a valid config). **Fixed** (`detect-bloat.ps1`),
mirroring the sibling pattern:
1. Config present but unparseable (`$cfg -eq $null`) → **`unknown`** with plain-language "could not be read as
   valid JSON."
2. Config valid but **nothing declared to scan** (`source_globs` and `dependency_manifests` both empty) →
   **`unknown`** "a clear would be a green over an unchecked project." (Includes the PowerShell `@($null).Count
   === 1` trap fix — a naive `.Count -eq 0` guard silently misses an absent key; filtered with `Where-Object`.)
3. A valid config whose globs currently match nothing still reports `clear` (a legitimate empty result, exactly
   as the sibling detectors treat a declared-but-unmatched boundary) — the fix only catches the *unchecked* case.

Pinned by **2 new tests** (`detectors.spec.js`): malformed config → unknown; nothing-declared → unknown
(red-proven on the pre-fix script, green after). The fix travels to every spawned project via the wholesale
`scripts/` copy (parity). Full detectors suite: 17/17 green.

## Disclosed residue (probed, judged — not built)
- **Sycophancy signal green-over-unevaluated** (renderer): a short/absent answer renders a green `clear` labelled
  "not evaluated." Same bug *class*, **lower consequence** — it is explicitly framed as a weak "nudge, never a
  verdict," so the trust cost is small, and it lives in the renderer outside the deterministic script harness.
  Noted; not fixed in this slice (the honest label mitigates it, and the anti-sycophancy teeth are the
  high-stakes detector + second-opinion, which are sound). Recommend aligning its badge to `unknown` when it
  didn't evaluate, IF it's ever promoted from a nudge to a relied-on signal.

## Verdict against the integrity contract
The detector layer is **strong** — boundaries are data, the four-part honest format is uniform, and the app
fails closed to UNKNOWN on any crash. The one real hole (bloat false-greening over a malformed/empty config) is
**fixed and test-pinned**, closing the last instance of the green-over-unchecked class among the config-driven
detectors. The lower-consequence sycophancy nudge is disclosed with a recommendation. **This category found a
real break and closed it with the minimum control** — the audit working on a live owner-facing trust surface.
