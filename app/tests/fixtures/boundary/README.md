# Boundary fixtures

Realistic **worker/verifier failure shapes** the default fakes don't cover, so
tests can prove the app handles ugly reality honestly (surfaces failures, never
turns a non-PASS into a fake PASS, never shows a silent blank).

Each fixture is `{ stdout, stderr, exitCode, delayMs }`, replayed by the fake
`claude`/`codex` when `PCC_FAKE_CLAUDE_FIXTURE` / `PCC_FAKE_CODEX_FIXTURE` points
at it. Used by `tests/e2e/boundary.spec.js`.

These are **hand-authored to match real-world shapes**, not captured live — and they
stay that way ON PURPOSE. They are *failure* shapes (auth error, rate-limit,
out-of-usage, empty output) that cannot be summoned deterministically without breaking
the machine's real Claude/Codex auth or waiting to hit a usage cap. Faking that they were
"captured live" would be dishonest, so they remain honestly labeled as hand-authored.

The parsers that consume STRUCTURED output — where a guessed shape could actually break a
shipped feature — ARE now pinned to **real, secret-redacted captures**: see `../real/` and
`tests/unit/real-captures.spec.js`. If a real failure occurs during normal use, capture +
redact it and drop it in here (see `../real/README.md`).
