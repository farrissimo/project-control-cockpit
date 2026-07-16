// DUMB DRIVER — Operation Understudy.
//
// Executes exactly ONE owner action against a running DPCC and reports exactly what the screen
// says afterwards.
//
// WHAT IT WILL NOT DO (this is the whole point — an "intelligent hands" layer that quietly helps
// would turn the run into a fake pass): it does not retry; it does not pick a "close enough" or
// a first-of-several control; it does not choose between multiple windows; it does not diagnose;
// it does not explain a failure the app didn't explain; it does not substitute or reinterpret the
// requested action; and it applies no defaults for missing/ill-typed fields — it rejects them.
// If the requested label isn't on screen, it says ACTION FAILED and stops, which is exactly what
// the real owner would hit.
//
// WHAT IT DOES DO, DISCLOSED IN FULL (there is no other behaviour):
//  1. SETTLE_MS — after any action that TOUCHES THE APP (click/type/read/wait) it waits this
//     constant before reading the screen, identically for every one of them. It is a fixed number,
//     not a judgment about which action "needs longer"; to wait on the worker, the owner issues an
//     explicit `wait`. (`done` never touches the app — it exits without a wait or a screen read.)
//  2. FAIL-CLOSED UNCERTAINTY — every internal failure resolves toward ACTION FAILED or an explicit
//     "could not", never toward proceeding on a guess. Concretely: a locator/equality/count call
//     that throws is treated as "no match" (=> ACTION FAILED, never a click), and an unreadable
//     screen is reported verbatim as "(could not read the screen)" rather than blanked or invented.
//     The direction is always toward telling the owner it didn't work.
//
// Attaches over CDP to an already-running app (start-app.js launches it), same mechanism the
// official @playwright/mcp uses. Every call appends to two separate logs:
//   owner.log  — only what the owner could see/do   (the evidence for judging usability)
//   trace.log  — everything, incl. technical detail (sealed; evaluator only, brain never sees)
//
// Usage: node driver.js '<json action>'
const { chromium } = require('C:\\ProjectControlCockpit\\app\\node_modules\\playwright\\index.js');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OWNER_LOG = path.join(DIR, 'owner.log');
const TRACE_LOG = path.join(DIR, 'trace.log');
const CDP = 'http://127.0.0.1:9333';
// Fixed, disclosed settle delay — identical for every action. Not a per-action judgment.
const SETTLE_MS = 1200;

const stamp = () => new Date().toISOString();
const owner = (s) => fs.appendFileSync(OWNER_LOG, s + '\n', 'utf8');
const trace = (s) => fs.appendFileSync(TRACE_LOG, '[' + stamp() + '] ' + s + '\n', 'utf8');

const VERBS = ['click', 'type', 'read', 'wait', 'done'];

(async () => {
  const raw = process.argv[2];
  let act;
  try { act = JSON.parse(raw); } catch (e) {
    console.log('SCHEMA REJECT: not valid JSON'); trace('SCHEMA REJECT: ' + raw); process.exit(2);
  }
  if (!VERBS.includes(act.action)) {
    console.log('SCHEMA REJECT: unknown action "' + act.action + '"'); trace('SCHEMA REJECT: ' + raw); process.exit(2);
  }

  trace('ACTION: ' + JSON.stringify(act));
  owner('\n>>> OWNER: ' + JSON.stringify(act));

  if (act.action === 'done') {
    if (typeof act.verdict !== 'string' || !act.verdict.trim()) {
      console.log('SCHEMA REJECT: done needs a non-empty "verdict"'); trace('done without verdict'); process.exit(2);
    }
    console.log('RUN ENDED: ' + act.verdict); owner('<<< run ended: ' + act.verdict); process.exit(0);
  }

  const browser = await chromium.connectOverCDP(CDP, { timeout: 20000 });
  const pages = browser.contexts().flatMap((c) => c.pages());
  if (pages.length === 0) { console.log('ACTION FAILED: the application window is not there.'); trace('no page over CDP'); process.exit(3); }
  // Picking [0] out of several windows would be the driver deciding which one the owner meant.
  // The owner sees one screen; if the app has several, that is a fact he'd face, not one we resolve.
  if (pages.length > 1) {
    console.log('ACTION FAILED: ' + pages.length + ' application windows are open — the driver will not choose between them.');
    trace('ambiguous pages: ' + pages.length); process.exit(3);
  }
  const page = pages[0];

  let result = 'OK';
  try {
    if (act.action === 'click') {
      // Resolve ONLY by EXACT visible label — the app must be navigable by what it literally says.
      // exact:true and an ambiguity check are load-bearing: a partial match with .first() would let
      // this driver silently pick a control the owner did not ask for. That is the "intelligent
      // hands quietly helping the test pass" hole this whole design exists to close. (Caught by
      // codex review 2026-07-16 — the first version did exactly that.)
      // Gather EVERY exact match from both strategies and de-duplicate by element identity.
      // Preferring one strategy over the other is itself judgment: a button and a text node both
      // matching exactly is a genuinely ambiguous screen, and resolving it silently is the driver
      // helping. (codex round 2 caught exactly that — the previous version preferred role.)
      const handles = [];
      for (const loc of [page.getByRole('button', { name: act.target, exact: true }),
                         page.getByText(act.target, { exact: true })]) {
        for (const h of await loc.elementHandles().catch(() => [])) handles.push(h);
      }
      const distinct = [];
      for (const h of handles) {
        let dup = false;
        for (const k of distinct) if (await h.evaluate((a, b) => a === b, k).catch(() => false)) { dup = true; break; }
        if (!dup) distinct.push(h);
      }
      if (distinct.length === 0) throw new Error('no visible control labelled exactly "' + act.target + '"');
      if (distinct.length > 1) throw new Error(distinct.length + ' distinct controls are labelled exactly "' + act.target + '" — ambiguous, the driver will not choose');
      await distinct[0].click({ timeout: 8000 });
    } else if (act.action === 'type') {
      // The brain must name where it is typing, and there is exactly one place an owner can type:
      // the chat box. Accepting any target and silently routing to #input would mean the driver
      // decided what the owner meant. (codex round 3.)
      if (act.target !== 'chat input') throw new Error('the only place you can type is "chat input", not "' + act.target + '"');
      if (typeof act.text !== 'string' || !act.text.trim()) throw new Error('no text to type');
      const box = page.locator('#input');
      const send = page.locator('#send');
      if (!(await box.count().catch(() => 0))) throw new Error('no chat input on screen');
      if (!(await send.count().catch(() => 0))) throw new Error('no Send control on screen');
      await box.fill(act.text, { timeout: 8000 });
      await send.click({ timeout: 8000 });
    } else if (act.action === 'wait') {
      // No silent default, no silent clamp: an unusable duration is the brain's error to see,
      // not something the driver quietly picks a nicer number for. (codex round 3.)
      // typeof check, not Number(): coercing "10" into 10 would be the driver deciding what was meant.
      const s = act.seconds;
      if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) throw new Error('wait needs a positive NUMBER "seconds"; got ' + JSON.stringify(act.seconds));
      if (s > 120) throw new Error('wait of ' + s + 's exceeds the 120s ceiling — ask for 120 or less');
      await page.waitForTimeout(s * 1000);
    }
  } catch (e) {
    result = 'ACTION FAILED: ' + e.message.split('\n')[0];
  }

  await page.waitForTimeout(SETTLE_MS);

  // The ONLY thing the brain gets: what is on the screen.
  let screen = '(could not read the screen)';
  try { screen = await page.locator('body').ariaSnapshot(); } catch (e) { trace('ariaSnapshot failed: ' + e.message); }

  console.log('RESULT: ' + result);
  console.log('--- SCREEN ---');
  console.log(screen);

  owner('<<< RESULT: ' + result);
  owner('<<< SCREEN:\n' + screen);
  trace('RESULT: ' + result + ' | screen chars: ' + screen.length);

  await browser.close().catch(() => {});
})().catch((e) => { console.log('ACTION FAILED: ' + e.message); trace('DRIVER CRASH: ' + e.stack); process.exit(4); });
