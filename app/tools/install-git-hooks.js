// Enable the repo's pre-commit hook on `npm install` (postinstall), so a fresh
// clone is protected without a manual `git config` step. Idempotent; silently
// skips if this isn't a git checkout (e.g. a tarball install).
const { execSync } = require('child_process');
try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
  console.log('[pcc] git pre-commit hook enabled (core.hooksPath=.githooks)');
} catch (e) {
  // Not a git working tree, or git unavailable — nothing to do.
}
