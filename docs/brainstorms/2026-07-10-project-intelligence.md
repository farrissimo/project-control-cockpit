# PCC Architecture Brainstorm: Search → Project Memory & Intelligence

> RAW SOURCE ARTIFACT — preserved verbatim (owner's brainstorm, developed with GPT,
> 2026-07-10). Per this document's own principle, raw evidence is never replaced by a
> summary. The synthesized vision lives in ../PROJECT_INTELLIGENCE_VISION.md; this is
> the primary source it draws from. Do not edit — this is the record as received.

## Context

This discussion began as a review of PCC's new global search capability
and expanded into a broader architectural direction.

Current implementation (as described):

-   Chats are treated as first-class project artifacts.
-   Every chat is saved locally.
-   When a chat is considered complete, a summary is generated.
-   A global search bar accepts natural-language queries.
-   AI rewrites/expands the query.
-   Local retrieval (Orama / hybrid retrieval plus local search) finds
    candidate results.
-   AI reranks and filters those results before presenting them.

The realization during this discussion was that this is much larger than
a search feature.

------------------------------------------------------------------------

# Core Insight

Instead of viewing this as "searching chats," PCC may be creating a
complete historical evidence layer for AI-built software projects.

Chat is not merely conversation.

In an AI-built project, chat frequently contains:

-   original ideas
-   architectural reasoning
-   rejected alternatives
-   owner intent
-   corrections
-   approvals
-   design tradeoffs
-   misunderstandings
-   governance evolution

Code alone cannot reconstruct those things.

------------------------------------------------------------------------

# Search becomes project memory

The system could answer questions such as:

-   Why was this decision made?
-   Have we solved this before?
-   What promises remain unfinished?
-   What contradicts this decision?
-   What discussions led to this feature?
-   What changed over time?
-   What did we originally intend?

------------------------------------------------------------------------

# Beyond chat

The long-term vision expands beyond transcripts.

Potential evidence sources include:

-   chats
-   summaries
-   source code
-   git history
-   commits
-   tasks
-   owner decisions
-   verification reports
-   tests
-   logs
-   state files
-   backups
-   checkpoints
-   documentation

Together they represent the complete project history.

------------------------------------------------------------------------

# Project archaeology

The history engine could reconstruct chains such as:

idea

↓

discussion

↓

owner correction

↓

approved task

↓

implementation

↓

tests

↓

verification

↓

revision

This is substantially richer than git history alone.

------------------------------------------------------------------------

# Process intelligence

Instead of only retrieving information, the system could analyze itself.

Examples:

-   What caused the most rework?
-   Which safeguards prevented failures?
-   Which task types consistently succeed?
-   Which models repeatedly require correction?
-   Where is owner babysitting highest?
-   Has babysitting decreased over time?
-   Which assumptions remain untested?

------------------------------------------------------------------------

# Important architectural considerations

The discussion also identified several design concerns.

## Chat lifecycle

Separate:

-   active transcript
-   provisional summary
-   final summary
-   reopened chat

Summaries should not become authoritative simply because time elapsed.

## Preserve raw evidence

Never replace transcripts with summaries.

Summaries are navigation.

Raw chats remain the source of truth.

## Provenance

Search results should identify whether information came from:

-   raw chat
-   summary
-   decision
-   task
-   code
-   verification
-   test
-   commit

## Authority

Search should distinguish:

-   mentioned
-   discussed
-   owner approved
-   implemented
-   tested
-   independently verified

Those are different states.

------------------------------------------------------------------------

# Long-term direction

The key realization from the discussion:

The search feature may actually be the foundation for PCC's historical
intelligence layer.

Search is merely the first interface.

The underlying capability becomes:

-   project memory
-   project archaeology
-   forensic history
-   decision lineage
-   process analytics
-   organizational learning
-   evidence-backed project intelligence

In short:

Instead of indexing conversations, PCC would be indexing the complete
reasoning history of software development.

That historical record could become one of PCC's most valuable
capabilities because AI-built software generates much of its engineering
knowledge inside conversations rather than only inside code.
