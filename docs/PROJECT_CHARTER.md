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
