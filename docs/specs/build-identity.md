# Build identity (status: active)

## Objective
Let the owner see which build of PCC he is actually running — version, commit, build
date — from inside the app. Today the app cannot answer "am I current?": the version
string is hardcoded and never surfaced, so answering it required grepping the packaged
binary. An app whose premise is trustworthy self-report must be able to identify itself.

Scope is IDENTITY only ("which build is this"), not currency ("is a newer one available").
Currency needs a network/repo comparison and is a deliberate follow-up.

## Behavior
A build stamp is written at package time (`npm run dist`) into `app/build-info.json`:
version, commit SHA, build timestamp (UTC, ISO-8601), and whether the working tree was
dirty at build time. (The short SHA is derived on read, not stored — one source of truth.)
It is a build artifact, git-ignored, and bundled into the package (the packaged app has no
`.git` to read).

- **Packaged:** the app reads the bundled stamp.
- **Dev (`npm start`):** no stamp is required — the app derives identity live from git.
- **Missing / malformed / unreadable stamp:** the app reports `unknown` and says so
  plainly. It NEVER falls back to a plausible-looking value, and never presents a
  package.json version alone as if it were a build identity — that is the fake-green
  this repo exists to kill.
- **Dirty build:** reported as dirty. A build made from an uncommitted tree is not
  identifiable by SHA alone and must not claim to be.

The identity is surfaced in the app UI and over IPC (`pcc:buildInfo`).

## Acceptance criteria
- AC-1: WHEN the build stamp is written THE SYSTEM SHALL record version, full SHA, UTC
  ISO-8601 build time, and a boolean dirty flag, and SHALL refuse to write a stamp whose
  inputs would not identify a build.
- AC-2: WHERE the app is packaged and a valid stamp is bundled THE SYSTEM SHALL report
  that stamp's identity over `pcc:buildInfo`.
- AC-3: WHERE the app runs from source with no stamp THE SYSTEM SHALL derive the identity
  live from git rather than reporting unknown.
- AC-4: IF the stamp is absent, malformed, or unreadable AND git is unavailable THE SYSTEM
  SHALL report status `unknown` with a reason, and SHALL NOT report a version or SHA.
- AC-5: IF the working tree is dirty at build time THE SYSTEM SHALL record `dirty: true`
  and the app SHALL surface that the build is not SHA-identifiable.
- AC-6: WHEN `npm run dist` runs THE SYSTEM SHALL write the stamp before packaging, so the
  packaged app can never ship without one.
- AC-7: WHEN the app renders its identity THE SYSTEM SHALL display the short SHA and build
  date, or an explicit "unknown build" — never a blank or a bare version number.

## Follow-up (not this slice)
Currency check ("a newer build exists"): compare the stamp's SHA to a repo/remote when one
is reachable, fail closed to unknown when not.
