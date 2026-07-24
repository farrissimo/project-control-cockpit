// Test fixture: a stand-in for the `claude` CLI that reports EXACTLY what crossed the real Windows
// process boundary. Spawned as `node.exe capture-argv.js <args…>` so the arguments travel through
// CreateProcess for real — this is what makes the spawn-contract proof genuine rather than a source
// inspection. Costs zero plan usage: it never contacts any model.
let stdin = '';
process.stdin.on('data', (d) => { stdin += d.toString(); });
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), stdin }));
});
// If nothing is piped, still report (the caller may not write stdin at all).
process.stdin.on('error', () => {
  process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), stdin }));
});
