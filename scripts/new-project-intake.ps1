<#
  PCC new-project intake protocol (COCKPIT_ROADMAP #20).

  Reuses CCB's proven "modular intake logic" (chat-first wizard + three-stage
  capture) adapted to PCC. This script PRINTS the interview protocol for the
  worker (Claude, in PCC's chat) to follow in plain language. The owner never
  runs it directly and never sees field names or JSON - they just answer
  questions in chat, exactly like CCB's wizard.

  Flow the worker follows:
    1. Conduct the plain-language interview below (Setup, then Scope).
    2. At each GATE, summarize in plain language and get a yes before moving on.
    3. When approved, write a blueprint JSON (shape below) to the given path.
    4. Scaffold the project: scripts/bootstrap-project.ps1 -Target <dir>
       -Name "<name>" -Blueprint <blueprint.json>.

  Deterministic: prints text only, no LLM, read-only, exits 0.
#>
param()

$ErrorActionPreference = 'Continue'

$protocol = @'
PCC NEW-PROJECT INTAKE (chat-first, plain language). You are the interviewer.
Reuses CCB's intake model: zero friction, ask plainly, nothing lost, gates before
committing. The owner is a non-coder product lead - never show field names or JSON.

=== SETUP (ask these, one or two at a time, in plain language) ===
1. What would you like to call this project?
2. What kind of thing is it (website, desktop app, mobile app, CLI tool, API,
   automation, or something else)?
3. Who is it for - who uses it when it's done?
4. What problem does it solve? What's broken or missing today?
5. What does "done and working" look like to you?
6. Any hard constraints or things it must NOT do?
7. How much risk are you comfortable with (low / medium / high)?
8. When should I check in with you (every step / major milestones only)?

GATE 1 - Confirm setup: play back what you heard in plain language. Get a yes.

=== SCOPE (guided, plain language) ===
9.  What's clearly IN scope for the first version?
10. What's explicitly OUT of scope (so we don't drift)?
11. What could go wrong (risks), and how might we handle each?
12. What are we assuming is true?
13. Anything still open / undecided?

GATE 2 - Confirm scope: summarize in/out of scope + risks. Get a yes.

=== BLUEPRINT ===
Write this JSON to the path the app gives you (no field names shown to the owner):
{
  "blueprint_version": "1.0",
  "created_at": "<ISO timestamp>",
  "project": {
    "name": "...", "type": "web_app|mobile_app|cli_tool|api|automation|desktop_app|other",
    "target_user": "...", "problem_statement": "...", "desired_outcome": "...",
    "hard_constraints": "...", "risk_tolerance": "low|medium|high",
    "preferred_stopping_point": "every_step|major_milestones_only"
  },
  "scope": {
    "in_scope": ["..."], "out_of_scope": ["..."],
    "risks": [{ "description": "...", "severity": "low|medium|high", "mitigation": "..." }],
    "assumptions": ["..."], "open_questions": ["..."]
  }
}

GATE 3 - Confirm blueprint: show a plain-language summary. Get a yes, THEN write it.

=== SCAFFOLD ===
After the blueprint is written and approved, scaffold the project:
  pwsh -File scripts/bootstrap-project.ps1 -Target "<new project folder>" -Name "<name>" -Blueprint "<blueprint.json>"
That creates the new project's cockpit, brief (from the blueprint), and first commit.

REFUSAL BOUNDARIES: don't invent answers the owner didn't give; leave open
questions open; never claim a step is done that wasn't.
'@

Write-Output $protocol
