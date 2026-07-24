# Gate 0 — controlled PCC-vs-direct-Claude usage proof (ADR-0020, post-T1)

> ## ⛔ HALTED 2026-07-24 — evidence correction (read before using any number in this file)
> Gate 0 started and was stopped at its own stop condition ("a defect that makes the measurements
> materially false"). Every `claude` launch used `spawn('claude', args, {shell:true})`, which on Windows
> concatenates the args array **unquoted** — 15 arguments in, **55 out**. `--append-system-prompt` kept
> only the word `You`; the rest became stray positional arguments, and `claude -p` treated the first,
> **`are`**, as the whole prompt. The cold arm additionally passed its prompt as positional argv while
> production uses stdin.
>
> - **Gate 0 run A1 is INVALID** and contributes nothing to any verdict.
> - **Step 2 / PR #61's cold arm was mangled the same way**; its cold-vs-warm comparison is **INVALID**,
>   its "cold resume contradicts the root cause" conclusion is **WITHDRAWN**, **Fork B is no longer
>   provisionally favored**, and the original root-cause hypothesis returns to **UNTESTED**.
>   Old evidence is preserved for audit history, not deleted.
> - Corrected by the spawn-contract PR (`app/claude-spawn.js` + `spawn-contract.test.js`), which proves
>   the argument boundary at the real Windows process boundary. See ADR-0020 Amendment 3.
>
> **Gate 0 does not restart until separately authorized from the corrected main.** When it does, every
> rule below still applies unchanged.

Status: **FROZEN 2026-07-24 by owner ruling** (locked before any measurement usage was spent), then
**HALTED** the same day by the defect above.
Baseline commit under test: **`9bbf296a0506e459f3c34ab4a6f9f9835ada932e`** (main, T1 merged) — a
re-authorized Gate 0 must re-baseline to the corrected main.

## 1. Question this answers
After the app-level multipliers were removed (T2 turn cap, T6 invisible calls, T7 payload caps, T1
deterministic owner-triggered rollover), **is PCC's cold-`claude -p`-per-message worker path still
pathological compared with equivalent direct Claude work?**

Fork it decides: (A) still pathological → T3 warm worker becomes mandatory engineering; (B) not
pathological → the cold path is operationally acceptable, T3 stays open as strategic, not emergency.

## 2. Locked rules (owner-specified — not negotiable)
- Baseline: main `9bbf296a0506e459f3c34ab4a6f9f9835ada932e`.
- Same Claude account, model, repository, task sequence and comparison window.
- Equivalent tool authority in both arms.
- **≥3 valid repeats per arm.**
- Deliberately varied inter-message gaps.
- No application or worker restart during a run.
- Failed / stopped / missing-telemetry runs are **INVALID, never favorable evidence**.
- Primary metric: **`cache_creation` tokens per equivalent completed task.**
- **PASS ≤ ~1.3× direct · FAIL ≥ ~2× direct · otherwise INCONCLUSIVE.**
- Measurement run only: no production-code change, no new driver, no PR, no CI, no verification receipt.
- Stop only for a defect that makes the measurements materially false.

## 3. Instrumentation (disclosed change, made BEFORE freeze)
The warm/direct arm (`measure-direct.js`) was hardcoded to 3 short trivia prompts with no gap control,
while the cold/PCC arm (`measure-usage.js`) already took `--mode/--turns/--gap/--label`. The two arms
therefore **could not be run on the same task sequence or the same gap schedule** — both locked rules —
and comparing tool-heavy work against trivia would have made every ratio **materially false** (the
explicit stop condition). Minimal fix, confined to measurement tooling (no production code, no new
driver):
- `measure-usage.js` now **exports** `SHORT_PROMPTS` / `REAL_PROMPTS` / `WORK_PROMPTS`.
- `measure-direct.js` **imports** those sets (does not copy them) and accepts `--mode/--turns/--gap/--label`,
  so both arms send **byte-identical** task strings. Verified: in `--mode work --turns 6`, every prompt
  in the direct arm is `===` to the cold arm's.
- `measure-direct.js`'s hard kill was a **fixed 180 s**, which would have silently truncated any gapped
  run — including the ~65-min TTL probe — and produced a partial result easy to mistake for a complete
  one. It is now scaled to the gap schedule.
Nothing about *how* a turn is spawned or measured changed. Both arms spawn via `workerEnv()`
(DECISION-003: paid API credentials stripped — session usage only). Lint clean.

## 4. STAGE 1 — repeated scaled measurement (run first)
Real tool-using work (`--mode work` → Read/Glob/Grep over real repo files), 6 turns per run,
model pinned `claude-sonnet-5`, read-only tool profile in both arms.

| Run | Arm | Command | Gap |
|---|---|---|---|
| A1 | PCC (cold) | `node tools/measure-usage.js --mode work --turns 6 --gap 0 --model claude-sonnet-5 --label g0-pcc-A` | 0 s |
| A2 | PCC (cold) | `… --gap 60 --label g0-pcc-B` | 60 s |
| A3 | PCC (cold) | `… --gap 300 --label g0-pcc-C` | 300 s |
| B1 | direct (warm) | `node tools/measure-direct.js --mode work --turns 6 --gap 0 --model claude-sonnet-5 --label g0-direct-A` | 0 s |
| B2 | direct (warm) | `… --gap 60 --label g0-direct-B` | 60 s |
| B3 | direct (warm) | `… --gap 300 --label g0-direct-C` | 300 s |
| T1p | PCC (cold) | `node tools/measure-usage.js --mode work --turns 3 --gap 3900 --model claude-sonnet-5 --label g0-pcc-ttl` | **3900 s (65 min)** |
| T2p | direct (warm) | `node tools/measure-direct.js --mode work --turns 3 --gap 3900 --model claude-sonnet-5 --label g0-direct-ttl` | **3900 s (65 min)** |

Gaps 0 / 60 / 300 s deliberately vary within the 1-hour TTL; the 3900 s probe deliberately crosses it.

**Metric (amended after the Codex pre-run review — see §12).** Per run: `cache_creation` summed over
completed turns ÷ completed turns, reported **two ways**:
- **(i) STEADY STATE, excluding turn 1 — PRIMARY.**
- (ii) whole run including turn 1 — reported alongside, secondary.

**Why steady state is primary.** Turn 1 is a one-time startup cache paid once per chat in *both* arms
(measured: cold ~25.3K create / 0 read; warm ~17.9K create / 7.4K read — already only ~1.4× apart). Over a
6-turn run that single turn dominates the total, so a whole-run ratio would sit near ~1.4× **even if
steady-state cold were 10× worse than warm** — a structural false-PASS path. The pathology ADR-0020
alleges is a *sustained per-message* cost (~410K/msg in the incident), which is precisely the steady-state
figure. Whole-run is still reported so nothing is hidden, but it cannot carry the verdict.

**Early stop.** If Stage 1 clearly FAILS or shows pathological escalation, **stop** — do not spend usage on
Stage 2 to reconfirm a failure.

## 5. STAGE 2 — single full-size paired sanity check
Proceed **only** if Stage 1 is within the PASS band with no pathological escalation. N=1 per arm: it can
**contradict** the scaled result, it cannot by itself decide one.

**PCC arm — the real Electron app at `9bbf296`:**
1. Representative file/tool work until measured conversation growth reaches ~150K past the frozen startup baseline.
2. **Confirm the meter driver is `context`** (see §6).
3. Click "Continue in fresh chat".
4. Confirm the carried recent conversation + project handoff are visible and bounded.
5. Confirm nothing was sent automatically.
6. Send the next unfinished-task instruction from the fresh chat.
7. Prove the work continues successfully.
8. Preserve the raw usage telemetry for this run.

**Direct arm — equivalence procedure (amended after the Codex pre-run review — see §12).** "Equivalent
continuation" is not left to judgement, because a cleaner/smaller hand-built handoff would bias the N=1
check in PCC's favour. Binding procedure:
1. Capture the **exact carried-context text PCC placed in its composer** at PCC-arm step 4, verbatim,
   before it is sent.
2. Start a fresh direct session and send **that same text** as its first message — same bytes, no
   editing, trimming, or improving.
3. Use the **same tool authority** (read-only profile) and the **same model** as the PCC arm.
4. Send the **same next-unfinished-task instruction** used at PCC-arm step 6.
5. Cut both arms at the **same task boundary** and compare `cache_creation` per completed task over the
   post-boundary turns.
If the direct arm's carried context is not byte-identical to PCC's, the pair is **INVALID**.

Keep Stage 2 gaps **short** — the TTL question is already isolated in Stage 1. Do not let the full-size
run become a multi-day experiment.

## 6. Clock-time / false-100% guard (mandatory)
The Chat Length meter reaches 100% for **three** different reasons — ~150K measured growth, **40 owner
messages**, or **6 hours** of elapsed wall-clock span. A visible 100% reading, or a visible "Continue in
fresh chat" button, is therefore **NOT sufficient Gate 0 evidence.**

For the Stage 2 PCC run, record and prove:
- meter **driver = `context`**;
- measured growth ≈150K past the frozen startup baseline;
- neither the 6-hour elapsed-time nor the 40-message condition is being mistaken for the context threshold.

If time or message count hits 100% first, that is **not** the Gate 0 rollover point — continue only as
safely needed until telemetry proves the context threshold. **A run that cannot distinguish the driver is
INVALID.**

## 7. Validity rules
INVALID (excluded, never favorable): errors or is stopped; telemetry missing/unparseable for any turn;
app or worker restarts mid-run; task sequence diverges between arms; tool authority differs between arms;
or (Stage 2) the driver cannot be proven to be `context`.

## 8. Verdict rule
**PASS only if all four hold:**
1. the repeated scaled PCC/direct ratio is within the locked PASS band;
2. the long-gap probe shows no pathological cache creation;
3. the full-size paired sanity check does not contradict the scaled result;
4. the real PCC rollover is context-triggered, bounded, visible, and successfully continues the unfinished task.

Full-size pair boundaries: ≤~1.3× supports PASS · ≥~2× is FAIL · between, or invalid telemetry, or failure
to reach a proven context-driven threshold, or conflict with the scaled repeats → INCONCLUSIVE.
**A scaled PASS plus a contradictory, invalid or unavailable full-size pair is NOT an overall PASS.**

## 9. Final claim boundary
A PASS licenses exactly: *"PCC's cold-per-message path is not pathologically more expensive than
equivalent direct Claude work in repeated representative tool-using tasks, including a narrow post-TTL
probe, and one real large-context paired run confirmed that owner-triggered rollover at ~150K context
growth bounded the chat and allowed unfinished work to continue."*
It does **not** license a claim covering every possible giant context, attachment pattern, or agentic workload.

## 10. Residue (recorded, NOT fixed during Gate 0)
> The gauge labeled **Chat Length** can show 100% because a chat spans six hours even when the chat is not
> token-heavy.

Post-crisis UI/design residue. Do not interrupt Gate 0 to fix it.

## 11. Out of scope
T8, T4, full T9, T3, and any unrelated work.

## 12. Codex pre-run review — VERDICT FAIL, three flaws, all fixed before any run
The single pre-run review (as ordered: one review, no repeated reviews between runs) returned **FAIL** and
found three design flaws, **all of which biased toward a FALSE PASS**. All three were corrected before any
measurement usage was spent:

1. **Metric would have masked the pathology.** Whole-run-primary over 6 turns lets turn 1's one-time
   startup cache dilute the steady-state signal, pinning the ratio near ~1.4× regardless of real
   per-message cost. → **Fixed:** steady state (excluding turn 1) is now PRIMARY (§4).
2. **The arms differed by more than warmth.** The cold arm passed `--fallback-model` (mirroring
   `askClaude`); the warm arm did not — breaking the premise the entire ratio rests on. → **Fixed:**
   `measure-direct.js` now resolves the fallback chain from the same `models.json` and passes the same flag.
3. **Stage 2's direct arm was under-specified**, so a cleaner hand-built handoff could bias the N=1 check
   toward PCC. → **Fixed:** binding byte-identical carried-context procedure (§5); mismatch ⇒ INVALID.

Codex also confirmed as sound: the cold arm faithfully matches PCC's real chat spawn (read-only flags,
`CHANNEL_PROMPT`, `--session-id`/`--resume`); the Stage 2 `driver == "context"` guard is genuinely
conservative (`driver` becomes `context` only when context strictly beats messages and time), so it blocks
false context claims rather than inventing them; and the warm-arm gap scheduling and scaled kill-timeout
are internally consistent.

**Disclosure:** these amendments were made *after* the single review and were **not re-reviewed** — per the
owner's instruction not to run repeated reviews between runs. Codex could not verify actual cache/TTL
behaviour (it does not spend plan usage), so token behaviour remains proven only by the runs themselves.
