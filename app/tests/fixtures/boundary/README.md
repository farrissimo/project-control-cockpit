# Boundary fixtures

Realistic **worker/verifier failure shapes** the default fakes don't cover, so
tests can prove the app handles ugly reality honestly (surfaces failures, never
turns a non-PASS into a fake PASS, never shows a silent blank).

Each fixture is `{ stdout, stderr, exitCode, delayMs }`, replayed by the fake
`claude`/`codex` when `PCC_FAKE_CLAUDE_FIXTURE` / `PCC_FAKE_CODEX_FIXTURE` points
at it. Used by `tests/e2e/boundary.spec.js`.

These are **hand-authored to match real-world shapes**, not captured live. The
honest next step (GPT's #1 recommendation) is to replace them with real,
secret-redacted captures from actual Claude/Codex runs — the replay mechanism is
already here, so that's a drop-in swap.
