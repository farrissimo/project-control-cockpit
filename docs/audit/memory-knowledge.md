# Audit grid — Memory & knowledge   (ADR-0009 category; status: done)

**Scope:** does PCC actually retain knowledge and prevent repeating mistakes across chats/sessions, or just
claim to? Two of the owner's #1 pains — "lost context between chats" and "repeating yourself." Graded against
the integrity contract Part 1 and the ADR-0009 yardstick. Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** mapped chat summaries, chat recall (search), cross-chat handoff,
the routing-log analytics, and durable file-truth — asking of each: is it honest (fails closed, no fabrication),
and does anything actually carry knowledge forward? **Verdict: what's built is tested-holds and honest; the one
"gap" (no proactive repeat-prevention) is a *deliberate* accepted-residue (DECISION-008), not an oversight.** No
control built.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Chat summaries** (per-chat gist/decided/wentWrong/…) | machinery-enforced (honest, fails closed) | `chat-summary.js` prompt hard-instructs "quote, invent nothing"; `safeJsonParse` → on junk returns null → handler **bails before writing any file** (error card, never a fabricated summary); `normalizeSummary` coerces to schema; unit-tested `chat-summary.spec.js` | A durable, honest per-chat record that never invents content | the AI call itself isn't in CI (unit tests are deterministic); the durable disk mirror is best-effort — but a miss is now **traced** (`appErr('chat-summary.mirror')`, closed in the incident-response category) |
| **Chat recall** (search: expand→grep→judge) | machinery-enforced (recall-safe + anti-hallucination) | `chat-recall.js`: `selectCandidates` tops up from all chats so **grep can never hide a chat from the judge**; `parseTerms` folds the question's own words in; judge prompt requires a **verbatim quote** to prove a match, returns approval AND its later reversal; unit-tested `chat-recall.spec.js` (7) | Past context is findable without the LLM inventing a hit | **pull-based** (owner must search); the judge stage has known LLM variance (`CHAT_RECALL_SPEC.md`: a stochastic single-run miss, then 5/5 on re-measure) — honestly disclosed, not a hard guarantee; grep tier is literal-substring (vocabulary gap), swappable at scale |
| **Cross-chat handoff** (fresh-chat orientation) | machinery-enforced (deterministic) | `generate-handoff.ps1` (no LLM, read-only, always exit 0): assembles project-state + live git + honestly-parsed verdict (**refuses** to trust a `ci_execution` claim from a hand-editable file) + 3 most-recent decisions; points the new chat at PROJECT.md/ROADMAP/DECISIONS/CLAUDE.md | A new chat resumes from canonical files, not a worker's memory | "next action" points at PROJECT.md **prose** (human-maintained), not a machine field — by design |
| **Worker-directive handoff** | machinery-enforced (deterministic envelope) | `generate-worker-directive.ps1` **refuses** to draft if project/task state disagree; `HANDOFF_PACKET_SPEC.md` demands "no hidden reliance on prior chat history" | The task envelope can't be built on inconsistent state | section *content* (Current Truth/scope) is human/LLM-authored prose |
| **Durable file truth** (PROJECT.md, DECISIONS.md, state, git) | machinery-enforced (extractable) + prose (upkeep) | the real "memory" — extractable, greppable with app deleted; DECISIONS.md surfaced 3-at-a-time into handoffs | Knowledge survives a cleared cache / dead chat | only as current as PROJECT.md/DECISIONS.md are kept; no enforcement that a lesson lands in DECISIONS.md (deliberately manual + quote-gated) |
| **Repeat-failure block** (single task) | machinery-enforced | `finalize-worker-handback.ps1`: a retry whose attempts ≥ ceiling → forces `blocked` + `owner_decision_request` + logs `repeated_failure_blocked` | Stops a 3rd unattended attempt at the *same* failing task | scoped to one `task_id`; not cross-chat learning |

## The "gap" — a DELIBERATE accepted-residue (DECISION-008), not an oversight
**"Don't repeat mistakes" has no general enforcement mechanism.** Knowledge retention is entirely **pull-based**:
a lesson in one chat's `wentWrong` only carries forward if the owner *searches* recall for it. Nothing
proactively injects "you tried this before and it failed" into a new chat.

This is **deliberate and recorded**, not a hole to plug:
- **DECISION-008 "Avoid Fake Intelligence Metrics"** (Active) — PCC refuses to fabricate a signal it cannot
  honestly compute.
- `summarize-routing-log.ps1` states verbatim that repeated-instruction frequency is **"Deliberately and
  permanently declined (pcc-postbrr-002) rather than approximated"** — honestly measuring it would require
  invasive capture of raw chat content into the log, a new instrumentation change, not a read-only report.

Building a proactive "repeat-detector" would mean either that invasive capture or a fabricated heuristic — the
exact fake-intelligence DECISION-008 forbids. So this is **accepted-residue**: the honest mechanisms (durable
files + pull-based recall + the single-task ceiling) are what carry knowledge; a guaranteed cross-chat
"never repeat" is **not built, by decision.** Surfaced here for the owner's active acceptance at sign-off.

## Verdict against the integrity contract
Every knowledge mechanism that IS built is honest and mostly tested: summaries fail closed on junk and never
fabricate; recall is recall-safe (grep can't hide a chat) and anti-hallucination (verbatim-quote required);
handoff is deterministic and refuses to over-report a verdict from a forgeable file. The one thing PCC does
**not** do — proactively guarantee "don't repeat mistakes" — is a **deliberate DECISION-008 boundary**, disclosed
plainly rather than faked. **No control built; recorded honest + the residue named** — the expected outcome for a
known-hard area.
