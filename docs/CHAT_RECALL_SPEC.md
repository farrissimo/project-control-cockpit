# CHAT_RECALL_SPEC — Robust chat history, summaries & recall

Status: DRAFT (scoping). Owner-driven feature. Parity: ships to spawned projects
by default (DECISION-113). Supersedes nothing yet; roadmap entry to be added.

## Why (the owner's pain, in his words)
- "I forget which chat something was decided, or how something got messed up, or
  an idea I had that didn't get captured."
- Built-in LLM chat search (ChatGPT / Gemini / Claude) "sucks" — you have to
  guess the exact words you originally typed. Remember the *concept* but not the
  *phrasing* → you get nothing.
- Wants an **extremely robust** chat history: auto-named chats, a high-level
  summary per chat (what was discussed / decided / went right / went wrong /
  loose ideas), and a way to *find* things across all chats without magic syntax.

## The core insight (why this design differs from the search boxes that suck)
Keyword search boxes fail because they do **literal matching on raw text** — the
user must supply the exact words. But AI agents *are* good at finding things in a
repo, because they don't "search": they **grep → open promising files → read →
reason → retry**. Retrieval-by-agent, not retrieval-by-keyword.

So we do NOT build a search box. We make chat history **greppable repo truth**
and let the agent find things the same way it finds code. The grep is a cheap
local net; the AI makes the query smarter going in and judges/polishes the hits
coming out.

## Design principles
1. **Local-first.** Storage is local files. The grep is local and deterministic
   — zero tokens. Only the two AI bookends (query-expand, judge/polish) cost
   tokens, and only when the user actually searches. Nothing runs in background.
2. **Never lose data.** The full transcript is always kept, unfiltered. Filtering
   only ever produces an *additional* summary layer — it never replaces the raw
   copy. Valuable data cannot be lost to summarization.
3. **Quote, don't invent.** Summaries and recall answers quote the transcript;
   they never fabricate. Reuse the existing pattern from the DECISIONS.md
   extractor (renderer.js — "scans THIS chat's transcript, quoted, never
   invented").
4. **Structured beats prose.** Free-text summaries can't reliably distinguish a
   done task from a pending one, nor preserve a decision's rationale (research:
   arxiv 2606.06337, DIAL-SUMMER). Use fixed fields.
5. **On-demand, owner-controlled.** No silent background token spend. Auto-name
   after the first real exchange; summaries and searches run when triggered.
6. **Extractable.** Data lives in `.cockpit` / repo files, not only in the app's
   localStorage, so it survives a cleared cache, is backed up, and is greppable
   from the CLI with the app deleted (PCC extractability test).

## Data model — three tiers per chat
Each chat writes to durable files (proposed: `.cockpit/chats/<chat-id>/`):

| Tier | File | Contents | Used for |
|------|------|----------|----------|
| Raw  | `transcript.jsonl` | Full message history, unfiltered | Safety net; fallback grep |
| Summary | `summary.md` (+ `summary.json`) | Structured card (below) | Fast-lane grep; the recall material |
| Meta | in `summary.json` | name, dates, project, chat-id, "important events" flags | Filters, display |

localStorage remains the live working copy; these files are the durable mirror,
written on chat update (debounced) and regenerable on demand.

### Summary schema (structured, concise)
- **Title** — auto-generated, ≤ ~6 words; owner can lock it (locked titles are
  never auto-overwritten).
- **Gist** — 1–2 sentences: what this chat was about.
- **Decided** — concrete decisions, each with a short quote + rough timestamp.
- **Went right / Went wrong** — notable outcomes, evidence-linked where possible.
- **Open ideas** — loose ideas/TODOs raised but not resolved ("don't lose it").
- **Important events** — flagged moments (a decision, a reversal, a bug found, a
  scope change). This is the "smart enough to highlight important events" ask.

## Recall — the "smart grep" pipeline (global)
One **"Search history"** action at the **top of the chat-list sidebar** (global,
because you're searching across all chats — matches where ChatGPT/Claude/Cursor
put it). Behind it, three stages:

1. **Expand (AI, cheap):** turn the plain-English question into good grep terms
   + synonyms, so results aren't limited to the user's literal words.
   e.g. "when did we decide to build the chat into the tax app?" →
   `tax app, chat interface, embed, decision`.
2. **Grep (local, free):** keyword search over `summary.md` first (fast lane). If
   empty/weak, escalate to `transcript.jsonl` (safety net). Deterministic, no
   tokens. Grep is **recall-oriented, not precision**: literal substring matching
   has vocabulary-gap holes (proven — see battery below), so it ORDERS/narrows but
   must never be the thing that decides. The judge (stage 3) is the precision stage.
3. **Judge + polish (AI):** read only the handful of candidate chats, compare
   against the *original* question, discard noise, and return the RELEVANT matches
   — zero, one, or several — each with a quote and a **link to the chat**, ranked.
   It does NOT force a single "winner" and does NOT adjudicate which decision
   superseded another (owner: basic search finds matches to your phrase; it is not
   the app's job to decide which one "won"). If two chats genuinely match (e.g. an
   approval and a later reversal), show BOTH. Still returns nothing, honestly, when
   the topic is truly absent (anti-hallucination). Only touches the candidates,
   never the whole archive.

### Advanced, intent-aware search (Phase 3 — after basic is proven)
A later mode detects the *intent* behind a phrase and adds interpretation on top of
the matches. Example (owner's): "when I approved v2 but then changed my mind" — the
approval is in one chat, the reversal in a later one; advanced search returns BOTH
and the finisher FLAGS the newer as the reversal / current state. Basic search never
does this editorializing; it just surfaces high-quality matches.

### Scaling (measured — app/prototypes/chat-recall/scale.js, deterministic, free)
The AI judge reads only a small candidate set, so its quality is corpus-size-
independent; the thing that can break at scale is retrieval. Probe at 25 / 100 / 1000
chats (needles among keyword-overlapping fillers):
- **Performance:** grep is ~0.1ms / 0.3ms / 1.1ms per query — never a bottleneck.
- **Retrieval recall:** needle stays in the judge's top-8 candidates **7/7 at every
  scale** WHEN the query words appear in the chat — score-ranking floats the real
  answer above spurious hits (even 257 competing hits at N=1000).
- **The real limit is vocabulary, not size:** a query worded differently from the
  chat can miss. Below a few hundred chats the recall-safe candidate top-up masks it;
  beyond that (many grep hits crowd the candidate slots) it needs a stronger
  **semantic** retrieval tier. Plan for it in the high-hundreds+, not before.

Optional per-search "just grep it" toggle → skip the AI bookends for a
zero-token literal search (fast but dumb — the escape hatch, not the default).

## Auto-naming
- Instant PROVISIONAL name from the first message (no AI) so the list never shows
  a wall of "New chat".
- The real AI name is generated when you are DONE with a chat — when you **leave it**
  (switch away / start a new one) or **generate its summary** — NOT after turn one.
  Rationale (owner): the actual subject usually emerges near the END of a chat ("I
  usually ask the question at or near the end"), so naming off the opening is wrong.
- It re-names each time you leave, so the title tracks the latest state. Gated to only
  spend a worker call when the chat has GROWN since it was last named (revisiting is
  free). AI-generated ≤ ~6-word title; the provisional name stands if the call fails.
- Owner can rename; a manual rename **locks** the title against all future auto-naming
  (a repeatedly-requested feature in prior art).

## Summary card UX (owner's original idea — stands alone, no search needed)
The auto-name and the summary card are valuable **on their own**, independent of
recall/grep. Even with zero search, being able to glance at a chat's name and pop
its high-level summary is the "historical record" the owner asked for.
- A small **summary button sits right next to each chat's name** in the chat list.
- Clicking it opens the structured summary card (schema above) in an intuitive,
  non-disruptive place — a slide-over / panel next to the chat, not a full page
  swap — so it reads like "peek at what this chat was about" without leaving where
  you are.
- The card is regenerable (a "refresh summary" affordance) and shows when it was
  last built.
- Build order: this (name + card) is Phase 1 and ships value before any search
  exists. Recall (Phase 2) reuses the very summaries this produces.

## Prototype & test plan (build this FIRST, before any UI)
Goal: prove the expand→grep→judge pipeline works on a **known** payload while the
pipeline stays **blind** to the answers.

- **Stage A — single long chat:** one long synthetic transcript with 2–3 planted,
  known answers (e.g. a decision made at a known point). Run the full pipeline
  with a known question; assert it surfaces the planted answer with a correct
  quote. Tests summary quality + judge/polish + query-expand.
- **Stage B — needle in decoys:** bury the same known-answer chat among 4–5 decoy
  chats. The global grep must pick the right chat and reject the decoys. This is
  the real "which chat was it in" test — Stage A alone can't test retrieval
  because there's only one haystack.
- **Hard look-alike decoy (the real "filter wrong answers" test):** include a
  decoy whose keywords are near-identical to the query but whose *answer is wrong*
  — e.g. a chat where the same build was only *deferred*, not decided. The
  finisher must tell "we decided" from "we talked about it and parked it."
- Fixtures carry the ground-truth answers; the pipeline never sees them (blind).
- Deterministic parts (file layout, grep) are unit-testable; the AI bookends run
  as a real worker call in the prototype run (nondeterministic, run manually, not
  in CI).

### Prototype result (built, app/prototypes/chat-recall, blind, real claude -p)
- **Wider battery: 12 chats, 8 adversarial queries — real pipeline 8/8 clean sweep.**
  Categories: canonical, went-wrong, paraphrase-gap (query shares no words with the
  chat), negation ("decide NOT to"), role-reversal (a decoy for one query is the
  answer for another), temporal-first, deploy, and **no-answer/anti-hallucination**
  (a topic never discussed — must return NONE, and does).
- **Built-in control:** the dumb keyword-only path (`--dry` stub) scores **6/8** on
  the same corpus — it fails exactly the two cases needing judgment: the hard
  look-alike (picks the *deferred* chat) and no-answer (hallucinates a chat, because
  literal grep always returns *something*). Keyword-only failing where the AI finisher
  succeeds, on the same input, is the evidence that the finisher's judgment is load-bearing.
- **What the harder corpus caught (and the fix):** a first real run scored 6/8 —
  went-wrong and negation returned "not found" because the literal grep missed the
  right chat on a vocabulary gap (`retrieved=false`), so the judge never saw it. Fix:
  make retrieval RECALL-safe — grep hits first, then top up the judge's candidate set
  from the rest (summaries are cheap), so grep can narrow but never silently hide the
  answer. Re-run: 8/8. **Scale caveat:** feeding a wide candidate set is robust for
  dozens of chats; at hundreds+ the retrieval tier needs a stronger (semantic) net.

## Phasing
- **Phase 1:** summary/name engine + durable three-tier storage + auto-name +
  summary card UI.
- **Phase 2:** the smart-grep recall (this is the fix for the owner's #1 pain).
- **Later (owner's call, after living with it):** idea-capture backlog surface,
  evidence timeline (commits/verifications per chat). NOT auto-writing to
  DECISIONS.md — the summary *links to* it; DECISIONS.md stays manual + quote-
  gated (avoids polluting source-of-truth with a paraphrase).

## Parity
Scaffolder seeds the storage layout, summary engine, and recall UI into every new
project (DECISION-113). Silent omission is the failure.

## Open questions
- Exact storage path under `.cockpit` vs project root (extractability).
- Debounce/trigger policy for writing the durable mirror.
- Whether "important events" flagging is AI-judged or rule-assisted.
