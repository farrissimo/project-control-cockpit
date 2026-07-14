# How to Trust a "Done" — a calibration guide for the owner

*Plain-English companion to the machine-checked completion machinery (COMPLETION_CONTRACT_SPEC.md, the release gate, the verifier verdict). Those enforce "done." This one helps **you** decide how much to trust a "done" when you can't check the code yourself.*

---

## The one idea

**"Done" is never 100% — for anyone, coder or not.** You're never buying certainty. You're buying *confidence*. The skill is knowing **how much** confidence a given "done" has earned, by asking two questions:

1. **What proof stands behind it?**
2. **Is that proof a fact, or an opinion?**

That's the whole guide. The rest is how to answer those fast.

---

## Every "done" is really two questions

| Question | Who can answer it | How |
|---|---|---|
| **Was it built right?** | The machinery — *you don't need to read code* | Facts: real tests, CI, a live check |
| **Was it the RIGHT thing?** | **Only you** | Does it match what you actually wanted? |

The AIs can prove "built right." **Only you can confirm "the right thing."** That's why a UI change *feels* more trustworthy — you can finally see "yes, that's what I meant." Relying on that isn't laziness; it's the one check that is genuinely yours. Spend your attention there.

---

## The proof ladder — fact or opinion?

From weakest to strongest. The higher you are, the more it's a **fact**, not an **opinion**.

| Level | What you're told | Trust | It's a… |
|---|---|---|---|
| **0** | "The worker says it's done." | Lowest | Opinion (self-report — the thing this whole project distrusts) |
| **1** | Worker **and** Codex/verifier agree (hashed out over the bridge) | Better | *Two* opinions — adversarial, catches a lot, but they can share blind spots and both be wrong the same way |
| **2** | A real **test ran and passed**, a **file diff you can see**, or a **visual you can look at** | Good | A fact — something actually happened |
| **3** | **CI went green on the exact version** (a separate machine ran it), a **live check** (app launched, the button worked), or a **mutation proof** (the tests are proven to catch a break) | Highest | A fact, confirmed *independently* — hardest to fake |

**Key point:** Level 1 (two AIs agree) is still two opinions. A test that actually ran (Level 2–3) is a fact. Push important work up the ladder toward facts.

---

## Match the proof to the stakes

You were right that a tiny task shouldn't get a mountain of checks. So tier it:

| Task type | Example | Proof to require | Notes |
|---|---|---|---|
| **Tiny / reversible** | wording, a small file edit, a cosmetic tweak | Level 0–1 is fine | Don't burn effort. If it's wrong, it's cheap to redo. |
| **Normal** | a feature, a logic change | At least **Level 2** — a real test or a visible result | "Two AIs agreed" alone isn't enough here. |
| **Risky / hard-to-reverse** | touches your data, money, state, security, or anything you can't easily undo | Demand **Level 3** — CI green on the exact version **and** a live check | **Never accept an opinion here.** |

Picking a low tier for a small task is a *conscious, bounded bet* — fine, because it's cheap to fix. The danger is accepting a low tier for a **high-stakes** task.

---

## How to read a "done" report in 10 seconds

Look for these — they tell you the level instantly:

- **Evidence or assertion?** Does it show *what it checked* (commands run, real results), or just say "done"? "Done" with no evidence = Level 0.
- **Does it say what was NOT proven?** An honest report includes a line like *"tests pass, but I couldn't verify X."* If there's **no "not proven" line at all**, that's a yellow flag — real work almost always has an unproven edge.
- **Is a fact attached?** A CI result, a test count, a live-check, a screenshot — or just the AI's word?
- **For anything risky:** did you (or a real proof) see the thing actually work?

---

## The honest limits (so you're never fooled)

- **100% doesn't exist.** Not for you, not for a senior engineer. You're always accepting *some* risk; the goal is to make it small enough for what the thing is.
- **Two AIs agreeing can both be wrong.** They share training and blind spots — consensus is not truth. That's *why* fact-based proof beats consensus.
- **A verifier can check the wrong target.** If the task was misunderstood at the *start*, both AIs can agree it's "done" against the wrong goal. That's the "was it the RIGHT thing?" question — and it's **yours**, guarded by aligning *before* work starts, not after.
- **Light-tier work can still slip.** That's an accepted, bounded cost you chose on purpose. Fine — as long as it was a *conscious* tier choice, not a blind one.

---

## The one question to ask when unsure

> **"Is this 'done' backed by a fact or an opinion — and does the proof match how much this matters?"**

If it's a fact and the stakes are covered: accept it. If it's an opinion and the task is risky: send it back for a real check. That single question is the whole guide.
