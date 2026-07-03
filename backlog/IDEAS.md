# Idea Backlog

This file is the single intake location for non-canonical ideas.

Ideas are placeholders, not active tasks and not project truth.

If an idea needs more detail, add one supporting file under `backlog/details/` and link it from the placeholder entry below.

## Entry Format

```markdown
- IDEA-000: Short title
  Status: proposed | under-review | promoted-to-task | rejected | archived
  Summary: One short sentence.
  Details: backlog/details/<file>.md or none
  Notes: Optional short note.
```

## Entries

- IDEA-001: Add optional CI or pre-commit enforcement for PCC state and governance checks
  Status: proposed
  Summary: Add lightweight automated enforcement so state validation and governance rules are checked without relying only on manual discipline.
  Details: none
  Notes: Defer until after the first real PCC control-loop proof task unless drift risk rises again.

- IDEA-002: Harvest still-live roadmap items from archived scope into tracked backlog placeholders
  Status: proposed
  Summary: Review the archived original scope and promote any still-relevant future ideas into explicit backlog placeholders.
  Details: none
  Notes: Do this only for items still considered live candidates, not for every historical thought in the archive.

- IDEA-003: Enforce live state against JSON schemas at runtime
  Status: proposed
  Summary: Wire schema validation into the local validate/advance/generate flow so schemas become enforced gates instead of documentation only.
  Details: none
  Notes: Good follow-on after the fresh-session restart path is stronger.

- IDEA-004: Fail validation when the live worker directive diverges from generator output
  Status: proposed
  Summary: Extend local validation so a stale or hand-edited worker directive cannot silently drift from canonical task state.
  Details: none
  Notes: Likely implement by regenerating to a temp path and comparing against the live directive.
