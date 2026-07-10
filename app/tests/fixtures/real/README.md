# Real captures

Genuine, secret-redacted captures of **real** agent runs, used to pin the structured-output
parsers to reality (roadmap #2). Unlike `../boundary/*` (which are hand-authored failure shapes),
these are actual bytes from real CLIs, redacted only where noted.

| File | Captured from | Redaction | Used by |
|------|---------------|-----------|---------|
| `claude-streamjson-success.txt` | `claude -p --input-format stream-json --output-format stream-json --verbose` (a real "reply PONG" turn) | crypto `signature` blob → `[redacted]`; ALL uuids → zeros; `req_`/`msg_` ids → `*_redacted`; the machine username scrubbed (so no home paths leak); cwd genericized. Structure (system / rate_limit_event / thinking / assistant text / result lines) is otherwise verbatim. | `tests/unit/real-captures.spec.js` → `parseStreamJson` |
| `codex-verdict-pass.txt` | `codex exec --sandbox read-only` (a real structured-verdict turn) | session id → zeros. Preamble + duplicated body are verbatim. | `tests/unit/real-captures.spec.js` → `parseVerification` |

## Why these two and not the failure shapes

The parsers are the only place a *guessed* shape can silently break a shipped feature, and success
shapes are the ones we can capture on demand. The **failure** shapes (auth error, rate-limit,
out-of-usage, empty output) live in `../boundary/` and remain **hand-authored** because they cannot
be summoned deterministically — forcing them would require breaking the machine's real Claude/Codex
auth or waiting to hit a usage cap. They are honestly labeled as hand-authored there.

## Capturing a real failure fixture when one occurs naturally

If a real auth/rate-limit/usage failure happens during normal use, capture it instead of inventing:

```
# example — capture whatever the real CLI emitted, then redact any secrets by hand
<the failing command> > capture.txt 2>&1
# inspect, remove any tokens/paths/emails, then save under ../boundary/<name>.json
# as { "stdout": "...", "stderr": "...", "exitCode": N }
```
