// Launch DPCC and leave it running with a debug port so the dumb driver can attach per action.
// Real app, real worker, real detectors — the owner's actual environment, not a fixture world.
const { _electron } = require('C:\\ProjectControlCockpit\\app\\node_modules\\playwright\\index.js');

(async () => {
  const app = await _electron.launch({
    args: ['.', '--pcc-test-instance', '--remote-debugging-port=9333'],
    cwd: 'C:\\ProjectControlCockpit\\app',
    timeout: 90000,
  });
  const w = await app.firstWindow({ timeout: 90000 });
  await w.waitForLoadState('domcontentloaded');
  await w.waitForTimeout(8000);
  console.log('DPCC UP on CDP 9333 — ' + (await w.title()));
  // Hold it open; the driver attaches over CDP for each action.
  await new Promise(() => {});
})().catch((e) => { console.error('LAUNCH FAILED: ' + e.message); process.exit(1); });
