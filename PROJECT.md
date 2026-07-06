# PROJECT.md — current project brief

Read this first. It's the always-current summary of where this project is, so a
new session never starts from zero.

## What this is
PCC (Project Control Cockpit): a local-first desktop app for building projects
with an LLM without the usual babysitting — verified truth, no repeating
yourself, no fake "done." Full direction: docs/DECISIONS.md (DECISION-102).

## Where we are now
Building the desktop app (Electron), on branch feat/cockpit-desktop-app.
Working so far: a chat wired to Claude Code, standing rules in CLAUDE.md, a
left-side menu, Project and Rules views, one-click corrections, and this
project memory.

## What's next
Keep adding features one working piece at a time, snapshotting as we go. Near
term: verification (catching fake "done") and honest, structural detections.

## Key decisions
- DECISION-102: PCC is a chat-centered local-first desktop app; supersedes the
  read-only web dashboard (DECISION-087).
