@echo off
REM Fake `codex` for tests. Ignores args/prompt; prints deterministic output that
REM serves BOTH consumers: verify-work.ps1 (needs a VERDICT line) and
REM second-opinion.ps1 (needs a recognizable reply). Never calls real Codex.
echo AGREE
echo FAKE-CODEX-REPLY: deterministic stub for verify + second-opinion
echo VERDICT: PASS
echo EVIDENCE:
echo - fake verifier: deterministic test output
echo NOT PROVEN: this is a stubbed verifier used only in the test suite
