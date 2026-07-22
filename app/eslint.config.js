// Minimal ESLint config — targeted at the HALLUCINATION class only (references to
// things that don't exist), not style. `no-undef` is the deterministic catcher for
// undefined identifiers/calls that plain JS + no type-checking would otherwise let
// slip until runtime. Keep this lean: we are not adopting a full style ruleset.
const globals = require('globals');

// Cross-file renderer globals: defined in one <script> (UMD `root.X = api`) and used in
// another. ESLint checks a file in isolation, so declare them here rather than false-flag.
const appGlobals = { PCCOverview: 'readonly', PCCVerification: 'readonly', PCCStakes: 'readonly', PCCProvingWindow: 'readonly', PCCChatHealth: 'readonly' };

const shared = { ...globals.node, ...globals.browser, ...appGlobals };

module.exports = [
  {
    ignores: [
      'node_modules/**', 'dist/**', 'playwright-report/**', 'test-results/**',
      'coverage/**', '**/*.min.js', 'prototypes/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: shared },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: shared },
    rules: { 'no-undef': 'error' },
  },
];
