# Governed Remote Send Runbook

Use this only when the owner explicitly asks you to send a message into an existing PCC chat and cannot
operate the app directly. The purpose is to preserve PCC governance: the message must enter the target
chat through PCC, and PCC must launch the worker itself.

This is an operations runbook, not a product feature. Prefer a first-class app endpoint in the future;
ADR-0030 tracks that governed parent-child dispatch capability.

## Rules

- Do not run the target project work directly from your own Codex/Claude chat.
- Do not edit transcript or chat JSON files to fake a send.
- Do not grant build authority from chat text. Authority must go through PCC's `requestJob` and `approveJob` IPC.
- Use this only with explicit owner approval for the specific work.
- Verify the canonical chat store and the spawned worker before saying it launched.

## What This Preserves

- The target PCC chat receives the owner message as a normal user message.
- The active worker/provider selection in PCC is honored.
- Build authority is bound to the target chat id and expires normally.
- PCC chooses the sandbox (`workspace-write` only after approval, otherwise `read-only`).
- The reply lands back in the same PCC chat.

## Procedure

1. Confirm PCC's active project.

   ```powershell
   Get-Content -Raw "$env:APPDATA\pcc-cockpit\projects.json"
   ```

2. Find the active/latest chat for that project. For current canonical chat storage, check:

   ```powershell
   Get-Content -Raw "C:\path\to\project\.cockpit\chats\chats.json"
   ```

   The per-chat `transcript.jsonl` mirror may lag until after a worker reply. Treat
   `.cockpit\chats\chats.json` as the live canonical chat store.

3. If the running PCC app has no reachable debug port, restart PCC with a temporary local port.

   ```powershell
   $p = Get-Process electron -ErrorAction SilentlyContinue |
     Where-Object { $_.MainWindowTitle -eq 'PCC Cockpit' } |
     Select-Object -First 1
   if ($p) { Stop-Process -Id $p.Id -Force; Start-Sleep -Seconds 2 }

   $electron = Join-Path (Resolve-Path '.\app\node_modules\electron\dist').Path 'electron.exe'
   Start-Process -WindowStyle Hidden -FilePath $electron `
     -ArgumentList @('--remote-debugging-port=50133', '.') `
     -WorkingDirectory 'C:\ProjectControlCockpit\app'
   ```

   Then confirm the port:

   ```powershell
   Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:50133/json/version'
   ```

4. Connect to the renderer and send through PCC's own APIs.

   Run from `C:\ProjectControlCockpit\app`. Replace the message and job name. This calls the same
   renderer function as the composer, so it persists the user message and starts the worker through
   `pcc:send`.

   ```powershell
   @'
   const { chromium } = require('@playwright/test');

   (async () => {
     const msg = `OWNER-APPROVED MESSAGE GOES HERE`;
     const jobName = 'Short bounded job name';

     const browser = await chromium.connectOverCDP('http://127.0.0.1:50133');
     const pages = browser.contexts().flatMap((c) => c.pages());
     const page = pages.find((p) => p.url().startsWith('file:')) || pages[0];

     await page.waitForSelector('#composer', { timeout: 15000 });
     await page.waitForFunction(
       () => typeof activeId === 'string' && activeId.length > 0 && typeof sendMessage === 'function',
       null,
       { timeout: 15000 }
     );

     const before = await page.evaluate(() => ({
       activeId,
       project: activeProjectPath,
       worker: getSelectedWorker(),
       sendType: typeof sendMessage,
     }));

     const req = await page.evaluate(
       async ({ chatId, jobName }) => window.pcc.requestJob('new_project', jobName, chatId),
       { chatId: before.activeId, jobName }
     );
     const appr = await page.evaluate(async () => window.pcc.approveJob());
     const auth = await page.evaluate(
       async ({ chatId }) => window.pcc.authorityState(chatId),
       { chatId: before.activeId }
     );

     if (!req.ok || !appr.ok || auth.mode !== 'authorized_running') {
       throw new Error('PCC did not grant build authority: ' + JSON.stringify({ req, appr, auth }));
     }

     await page.evaluate(async ({ msg }) => { await sendMessage(msg); }, { msg });
     console.log(JSON.stringify({ before, req, appr, auth }, null, 2));
     await browser.close();
   })().catch((e) => {
     console.error(e && e.stack || e);
     process.exit(1);
   });
   '@ | node
   ```

5. Verify the governed launch.

   Check the canonical store contains the user message:

   ```powershell
   Get-Content -Raw "C:\path\to\project\.cockpit\chats\chats.json" |
     Select-String -Pattern 'distinct phrase from the sent message'
   ```

   Check authority is bound to the chat:

   ```powershell
   Get-Content -Raw "$env:APPDATA\pcc-cockpit\authority-store.json"
   ```

   Check the worker came from PCC. For Codex, a governed build launch should look like
   `codex.exe exec --sandbox workspace-write ...`; for a read-only chat it should be `--sandbox read-only`.

   ```powershell
   Get-Process | Where-Object { $_.ProcessName -match 'electron|node|codex|claude' } |
     Select-Object Id,ProcessName,StartTime,MainWindowTitle,CommandLine |
     Sort-Object StartTime
   ```

## Failure Signals

- If the canonical store did not change, the send did not land.
- If authority is missing, the worker may launch read-only and cannot do approved work.
- If no worker process appears, PCC accepted the message but did not start work yet or failed before spawn.
- If only a per-chat `transcript.jsonl` mirror is unchanged, wait for the assistant reply and check
  `chats.json`; the mirror is not the live source.

## Known Example

On 2026-07-29, this was used to send an owner-approved ITM trust-window stress-test launch into active
chat `dab94078-67a9-44fe-bbbc-19736def9466` for `C:\ITM\ITM`. PCC granted build authority with
`requestJob`/`approveJob`, the canonical chat store recorded the user message, and PCC launched
`codex.exe exec --sandbox workspace-write`.
