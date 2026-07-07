# PCC test suite

Automated tests for the Cockpit app. One runner (`@playwright/test`), three
layers, all via **`npm test`** from `app/`.

## Layers

| Dir | Layer | What it proves |
|---|---|---|
| `tests/e2e/` | **End-to-end** | The real Electron app launches and every button/control does the right thing. `buttons.spec.js` clicks all 7 nav views, Send, corrections, copy blocks, Capture decisions, chats panel, New chat, model switcher, Signals refresh, handoff, memory save, verify, lifecycle. `dialogs.spec.js` covers the in-app prompt (New project, rename, cancel) and delete. `ipc.spec.js` exercises all 15 `window.pcc.*` channels (plus a negative case) through the real preload bridge into the real main-process handlers. `robustness.spec.js` asserts real outcomes: state persists across an app reload, and the busy guard blocks double-submit. `multiproject.spec.js` proves switching between projects re-points every read, refuses non-PCC folders, and keeps chat history isolated per project. `crosscheck.spec.js` covers the "Second opinion" button (Claude→Codex cross-check). `security.spec.js` guards the renderer sandbox (no Node/`ipcRenderer` leak, contextIsolation on, CSP present, pwsh-only). `smoke.spec.js` is the minimal launch check. |
| `tests/scripts/` | **Script contract** | The deterministic PowerShell detectors/status scripts emit valid four-part JSON, run exactly as `main.js` invokes them. Proves the truth engine works standalone (the extractability guarantee). `encoding.spec.js` guards the UTF-8 output fix so non-ASCII text can't silently blank a panel again. |
| `tests/external/` | **Opt-in real-boundary smoke** | NOT in `npm test` or the commit hook. `npm run test:external-smoke` proves the real `claude`, `codex`, and `pwsh` binaries are installed and launchable (version check only — no paid/real turn). Catches the one gap the fakes can't: a missing/renamed worker or verifier before a release. |

## The faked boundary

Tests must be **offline, free, and deterministic**, so the expensive/non-deterministic
externals are faked, never called:

- `tests/fakebin/claude.cmd` + `claude.js` — a fake worker that drains stdin and
  returns a canned reply.
- `tests/fakebin/codex.cmd` — a fake verifier that prints a `PASS` verdict.

`tests/helpers/launch.js` prepends `fakebin` to `PATH` and points Electron at a
throwaway user-data dir (so `localStorage` never leaks between tests). The local
PowerShell detectors and `git` still run for real — they're fast and safe.

## Commands

```
npm test              # all layers
npm run test:e2e      # Electron button + IPC tests only
npm run test:scripts  # PowerShell script-contract tests only
```

## Auto-run on commit

`.githooks/pre-commit` runs `npm test` whenever `app/` or `scripts/` changes are
staged, and blocks the commit on failure (docs-only commits stay fast). Enabled
with `git config core.hooksPath .githooks` (set per-machine; re-run after a fresh
clone). Emergency bypass: `git commit --no-verify` or `PCC_SKIP_TESTS=1 git commit`.

## Requirements

Node + `pwsh` (PowerShell 7) on PATH. `npm install` in `app/` pulls Playwright;
no separate browser download is needed (it drives the app's own Electron).
