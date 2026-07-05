# Project Charter

## Project Name

Project Control Cockpit

## Purpose

Project Control Cockpit is a lean, local-first AI project control board designed to reduce owner babysitting in AI-assisted project work. It keeps projects moving through bounded task cycles, clean handoffs, explicit verification, and canonical machine state.

## Core Problem

AI-assisted project work currently requires too much manual owner intervention. The owner repeatedly has to restate rules, copy/paste context between chats, manage handoffs, detect fake completion, verify work manually, prevent drift, and keep project state coherent.

## Primary Goal

Reduce owner babysitting while keeping project work honest, stateful, verifiable, and moving.

## Non-Negotiable Rule

If the system becomes another thing the owner has to babysit, it is failing.

## Core Design Rule: Modularity / Extractability (added post-V1, `DECISION-074`, 2026-07-04)

Every PCC capability must be a script (or other clearly bounded unit) with a documented input/output contract over the `.cockpit/` file bridge, with no shared hidden state with any other script — such that it could, in principle, be run against a different repo given only its documented inputs. A capability that instead reaches into another script's internal state, or only works because of an undocumented shared assumption, is rejected or redesigned on sight, regardless of how useful it is.

This rule was added later than the rest of this charter (PCC's first weeks were spent proving the babysitting-reduction loop, not auditing modularity), but it is not a lesser or optional rule for that reason — it is promoted here to sit beside the Non-Negotiable Rule above as core project philosophy, not left as a footnote in `docs/CCB_PCC_RELATIONSHIP.md`. It exists because a sibling project (CCB) claimed the same modularity at the documentation level while defeating it at the state level (satellite modules bolted onto a shared monolith that could not later be cleanly pulled apart), and PCC's discrete-scripts-over-a-file-bridge design was found to already avoid that trap by construction — the job now is to *not lose* that property as PCC grows, not to retrofit it later at cost. Any task drafted from this point forward is checked against this rule before it is checked against anything else.

## V1 Mission

Build a first working version that can manage one bounded project task from task definition through worker directive, Claude Code execution handoff, evidence return, verification verdict, and state update.

## V1 Must Prove

The system can:

1. Maintain canonical project and task state.
2. Generate a clean worker directive.
3. Hand the directive to Claude Code through a local file bridge.
4. Receive worker results and evidence.
5. Verify the result against an explicit completion contract.
6. Update state only after adequate verification.
7. Produce the next clear action.

## V1 Non-Negotiables

* Reduce owner babysitting.
* Preserve machine state.
* Use clean handoff packets.
* Use explicit completion contracts.
* Verify before updating project truth.
* Route deterministic work to local tools first.
* Support manual reset / fork / rollover.
* Avoid fake truth detection or vague intelligence scoring.
* Stay lean.

## Explicitly Out of Scope for V1

* Full replacement for Claude Code or Codex.
* Full autonomous project execution.
* Full knowledge base / RAG system.
* Parallel multi-model orchestration.
* Perfect lie detection.
* Large governance framework.
* Broad tool-discovery engine.
* Complex desktop UI before the workflow is proven.

## Success Criteria

V1 succeeds if it completes a real bounded task with less manual owner intervention than the current chat-bridge workflow.

Specific signs of success:

* Fewer repeated owner instructions.
* Fewer manual copy/paste handoffs.
* Clearer worker directives.
* Clearer task status.
* Evidence-based verification.
* No state update without verification.
* Clear next action after each cycle.

## Failure Criteria

V1 fails if it:

* Adds more process than it removes.
* Requires constant manual steering.
* Rubber-stamps weak worker output.
* Loses project truth.
* Creates fake confidence metrics.
* Becomes harder to manage than the project itself.
