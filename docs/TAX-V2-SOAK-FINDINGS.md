# Tax Prep Cockpit V2 — Hard E2E Soak Findings

The "rubber meets the road" test: can PCC build a genuinely COMPLEX project end-to-end,
driven only from the owner's seat (chat + buttons), through its own intake wizard and
lifecycle? A fresh project (does NOT touch V1). Driver: Opus as the owner. Worker:
Sonnet 5. Started 2026-07-08.

Blueprint (from real owner intake answers + prior-art research):
- Owner: single, IT consultant, works from home full-time, no employees/contractors ever,
  owns home outright, 20×20 (400 sq ft) office, real utilities, Roth IRA $17/wk, HODLs
  crypto (Coinbase/Uphold/Robinhood + owns CoinTracker annual), self-describes as lazy,
  crypto is his tax-time hell.
- V2 = evolved-but-lean: Crypto Command Center (3-exchange checklist organized around
  CoinTracker; HODL guidance), home-office both-methods estimator (simplified vs regular),
  tailored "what lowers your taxes" guidance (incl. honest Roth-vs-SEP note), lessons log,
  readiness view. Local, private, no filing, labeled estimates only.
- Key corrections vs V1 baked into the blueprint: CoinTracker DOES support Uphold now;
  1099-DA issued by all three exchanges for TY2025; HODL ≈ likely little taxable activity.

---

## VERDICT — the hard e2e PASSED

**PCC built a genuinely complex project end-to-end, driven only from the owner's seat, and it
actually works — correctly.** This is the "rubber meets the road" test that broke CCB; PCC did
not fall apart under it.

- **Intake (V2-G1):** PCC's own wizard asked all the right questions across two gates and
  synthesized an accurate blueprint. Exactly the "help a non-coder get a real product" promise.
- **Scaffold (V2-G2):** the complex project was born with the full FIXED engine, `doctor` clean,
  born-current — proving new projects inherit PCC's maturity.
- **Build:** all 7 bounded tasks built through the Work loop, each committed (clean history).
  The worker showed real care with the tax logic — it **proactively caught a phone/internet
  double-count** risk and flagged it rather than silently double-counting.
- **Independent confirmation (driving the real product):** every computed value matched hand
  math exactly — home office simplified **$1,500** (400 sq ft capped at 300×$5) and actual
  **$1,960** (20% × $9,800), phone **$960**, internet **$810**, total deductions **$3,730**,
  tax savings **$1,119** (30%). Honest throughout: "estimate — TurboTax/CPA decides" labels,
  Roth-doesn't-help / SEP-would honesty, depreciation flagged-not-computed, crypto left to
  CoinTracker. **All state persisted across a full close-and-relaunch.**

**Honest caveats:**
- **V2-F2** (cockpit closed once mid-turn during the heavy Electron install; recovered, finished).
- The build ran through Plan→Work and each task was committed; I confirmed the product works by
  driving it independently. To *formally* close the phase through PCC's own gate (per DECISION-110)
  the product would need an automated test for a `local_execution` proof — a small final step, not
  yet done. The app itself is proven working.

## Findings

### V2-F1 — "New project" is buried in the Project tab; the app lands on Chat — LOW/MED
A first-time owner launches to the Chat view. The "New project…" button lives in the
Project tab, so starting a project requires knowing to navigate there first. Minor, but
it's the same "visionary lands on a dev dashboard, not an obvious next action" texture the
V1 soak flagged (deferred Overview redesign).

### G/observation — intake step 1 is a clean plain-language name prompt — POSITIVE
Clicking New project opens a simple modal: "What would you like to call the new project?"
— no jargon. Good first step.

---

### V2-G1 — PCC's intake wizard asked all the right questions — POSITIVE (big)
Driven as the owner, the chat-first intake was genuinely strong: it ran a gated interview,
plain language, one/two questions at a time, and asked exactly the right things —
**kind of app → who it's for → the problem → what "done" looks like → hard constraints →
risk tolerance → check-in cadence**, then a **second scope gate** (in/out of scope → risks
→ assumptions → open questions). It reflected every answer back accurately, proactively
surfaced the crucial constraint ("connect to exchanges via API, or stay hands-off?"), and
refused to skip the scope gate "since this touches your taxes." It then synthesized a
**complete, accurate blueprint** for approval — capturing every nuance (owns home outright,
CoinTracker as source of truth / never calc gains, depreciation flagged-not-computed,
business-use % manual, Roth-vs-SEP honesty, estimates-only). This is exactly the "ask the
right questions so a non-coder gets a real product" promise, working.

### V2-G2 — The complex project is born with the FULL, FIXED engine (doctor clean) — POSITIVE (big)
Scaffolded to `C:\TaxPrepCockpitV2`, git-initialized. Verified on disk it inherited **all**
this session's fixes: `pcc-baseline` tag + `engine_version: 1` (born-current), the fixed
`app-build-scope` (pcc-baseline baseline + `product/**`), product-scoped bloat config,
`verify-product.ps1` + `product-run.json` (local-execution proof), and the execution-proof
gate. Its own `doctor` reports **"Overall: OK. No issues or warnings found."** — a brand-new
COMPLEX project passes its own health check cleanly (the F7 fix, proven on a real new
project). This directly proves the owner's core goal: new projects inherit PCC's maturity.

### V2-F2 — The cockpit window closed mid-turn during the Electron product's heavy build — MED (investigating)
Building task #1 (an Electron shell in `product/`, chosen over the worker's leaner static-HTML
recommendation for robust file storage), the PCC window closed on its own mid-turn — Playwright
reported "Target page has been closed" (NOT my timeout; the driver caught it and returned). The
worker had gotten as far as writing main.js/preload/renderer and running `npm install electron`
(~heavy), but didn't commit or reply. Likely the one-time heavy install moment (V1's Electron
build did NOT crash the cockpit, and the install is now complete, so subsequent turns are
lighter). Two honest takeaways: (1) building a heavy Electron product *through* the Electron
cockpit is a stress point worth watching; (2) the worker's original recommendation (static HTML,
zero deps, no install) was the leaner call — my Electron override traded simplicity for
robustness and hit this. Continuing on Electron since the shell + install are already done.

## Timeline
1. Fresh-slate launch (clean UDD) lands on Chat with the home cockpit (PCC) active. Went to
   Project → New project → named "Tax Prep Cockpit V2".
2. Drove the full intake as the owner (7 setup Qs + a 4-part scope gate). PCC synthesized an
   accurate blueprint; approved with one refinement (Roth-vs-SEP honesty).
3. Scaffolded to C:\TaxPrepCockpitV2 — born current, doctor clean. Next: switch to it, advance
   define→plan, and build the product through the loop.
