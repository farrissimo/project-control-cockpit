@echo off
REM Fake `codex` verifier. Ignores args/prompt; prints a deterministic PASS
REM verdict so verify-work.ps1 returns a real-looking verdict without calling
REM the real Codex CLI (which costs usage and is non-deterministic).
echo VERDICT: PASS
echo EVIDENCE:
echo - fake verifier: deterministic test output
echo NOT PROVEN: this is a stubbed verifier used only in the test suite
