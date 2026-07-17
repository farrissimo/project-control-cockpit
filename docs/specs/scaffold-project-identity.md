# Scaffold project identity (dirty-at-birth)   (status: active)

## Objective
A freshly scaffolded PCC project is committed clean (`bootstrap-project.ps1` ends with
a `git init; git add -A; git commit; git tag pcc-baseline` that leaves the tree
clean), but the very first real read of that project by the app -- which happens
automatically the moment the owner opens it, effectively immediately -- mints
`.cockpit/state/project-id.json` (`app/state/chat-store.js`'s `resolveProjectId`,
called from every `pcc:chatsRead`) OUTSIDE any commit. Empirically reproduced (real
`bootstrap-project.ps1`, then the real `chatService.readCanonical` production code
path, not a mock): `git status --short` goes from clean to `?? .cockpit/state/project-id.json`
after that one read. The trust strip reports this honestly ("Uncheckpointed") --
the bug is that a brand-new project is dirty at all, not that it's misreported. This
creates immediate owner work exactly contradicting the "PCC creates a stable starting
checkpoint" expectation.

## Behavior
`bootstrap-project.ps1` mints the project's stable identity itself, in the SAME shape
`resolveProjectId` already expects (`.cockpit/state/project-id.json` ->
`{ projectId, mintedAt }`), and includes it in its own initial commit -- so
`resolveProjectId`'s existing "found an existing minted id" path (`source: 'minted'`)
is taken on the very first app read, and nothing new is written. No change to
`chat-store.js`'s resolution logic at all; this is a scaffold-side fix only, matching
the intake report's instruction not to broaden into a scaffold redesign.

## Acceptance criteria
- AC-1: WHEN a project is freshly scaffolded THE SYSTEM SHALL commit
  `.cockpit/state/project-id.json` as part of the initial bootstrap commit (present,
  tracked, in `git show <bootstrap-commit> --stat`).
- AC-2: WHEN the app performs its first real read of a freshly scaffolded project
  (`chatService.readCanonical`, the actual `pcc:chatsRead` code path) THE SYSTEM SHALL
  leave the working tree clean afterward (`git status --short` empty) -- no new file
  written, because the identity already exists.
- AC-3: WHEN `resolveProjectId` is called on a freshly scaffolded project THE SYSTEM
  SHALL report `source: 'minted'` (found the existing, bootstrap-written id), not
  `source: 'minted-new'` (would have written a new untracked one).
- AC-4: The minted id's SHAPE is unchanged (`{ projectId: 'proj-<uuid>', mintedAt }`) --
  `chat-store.js`'s existing `resolveProjectId`/read logic requires no modification and
  its existing tests (`chat-store.test.js`, `chat-service.test.js`) stay green
  unmodified.

## Test
New file `app/tests/scripts/scaffold-project-identity.spec.js` -- runs the REAL
`bootstrap-project.ps1` in a disposable directory, then drives the REAL
`chatService.readCanonical` (the actual production module, not a mock) against it,
and inspects real git state before/after -- red before the fix (dirty after the first
read), green after.
