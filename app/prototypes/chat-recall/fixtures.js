// Blind fixtures for the chat-recall prototype — a WIDER, harder corpus.
//
// CHATS is everything the pipeline may see (real chat shape: { id, name,
// messages:[{cls,text}] }). GROUND_TRUTH is the answer key — NEVER passed into the
// pipeline; the runner reads it only AFTER an answer, to score. "Blind" = the AI
// never sees the key it is graded against.
//
// The corpus mixes topics like a real project history so retrieval must actually
// discriminate. Note several chats are a DECOY for one query and the RIGHT answer
// for another (role reversal), exactly like real history.

'use strict';

const chats = [
  // --- the canonical decision (owner's own example) ---
  { id: 'tax-chat-decision', name: 'Tax app planning', messages: [
    { cls: 'user', text: 'Starting the tax prep assistant. First priority is deductions and taxable-income only. Crypto can wait.' },
    { cls: 'bot', text: 'Understood. v1 scoped to deductions + taxable income. Crypto deferred to a later update.' },
    { cls: 'user', text: 'How should the user interact with the tax app day to day?' },
    { cls: 'bot', text: 'Options: a form-driven wizard, a dashboard, or a conversational chat interface like PCC has.' },
    { cls: 'user', text: 'Let us do it — build the chat interface into the tax app. Make that the primary surface, not forms.' },
    { cls: 'bot', text: 'Decision recorded: the tax app will use a conversational chat interface as its primary surface (forms secondary), reusing the PCC chat pattern.' },
    { cls: 'user', text: 'What went wrong last time was we let scope creep into crypto. Do not repeat that.' },
    { cls: 'bot', text: 'Acknowledged. Scope guard: crypto stays out of v1; the earlier crypto scope-creep is the failure to avoid.' },
  ] },

  // --- hard look-alike: same keywords, but DEFERRED, not decided ---
  { id: 'tax-ui-ideas-deferred', name: 'Tax app UI ideas', messages: [
    { cls: 'user', text: 'Should the tax app use a chat interface like PCC has?' },
    { cls: 'bot', text: 'It could. A chat interface for the tax app would be friendly, but it is a big build.' },
    { cls: 'user', text: 'Hmm, let us not decide the chat interface yet. Park building the chat into the tax app for now.' },
    { cls: 'bot', text: 'Understood — no decision made. Building the chat interface into the tax app is deferred; revisit later.' },
  ] },

  // --- paraphrase-gap target: how we pay for the AI (login vs paid API) ---
  { id: 'auth-login-decision', name: 'Worker auth', messages: [
    { cls: 'user', text: 'For the worker, do we use a paid API key or the existing account sign-in?' },
    { cls: 'bot', text: 'Two options: a metered API key, or driving Claude Code through the claude.ai login you already pay for.' },
    { cls: 'user', text: 'Use the login. I do not want a separate metered bill per message.' },
    { cls: 'bot', text: 'Decision: the app drives the worker through the claude.ai login, not a paid API key. No per-message metered billing.' },
  ] },

  // --- negation target: decided AGAINST doing e-file ourselves ---
  { id: 'efile-decision', name: 'E-file approach', messages: [
    { cls: 'user', text: 'Do we transmit tax returns to the IRS ourselves?' },
    { cls: 'bot', text: 'Self-transmitting needs an authorized transmitter and heavy compliance.' },
    { cls: 'user', text: 'Then no — we are not going to self-transmit. Hand e-file off to a provider.' },
    { cls: 'bot', text: 'Decision: we will NOT build e-file transmission ourselves; defer e-file to an authorized provider.' },
  ] },

  // --- role reversal: a "decoy" for the tax query, the ANSWER for the crash query ---
  { id: 'model-crash-fix', name: 'Model switcher bug', messages: [
    { cls: 'user', text: 'The model dropdown crashed the chat when a model was retired.' },
    { cls: 'bot', text: 'Reproduced. Added auto-fallback so a retired model never crashes the chat — it falls back down the chain.' },
    { cls: 'user', text: 'Good, ship that fix.' },
    { cls: 'bot', text: 'Fallback fix shipped; the retired-model crash is resolved.' },
  ] },

  // --- deploy/tests target ---
  { id: 'ci-decision', name: 'CI on push', messages: [
    { cls: 'user', text: 'Running the whole app suite before every commit is too slow locally.' },
    { cls: 'bot', text: 'We can move the full end-to-end suite off the pre-commit hook and run it on GitHub after each push instead.' },
    { cls: 'user', text: 'Yes. Turn off the pre-commit app-launch run by default and let CI run the suite on push.' },
    { cls: 'bot', text: 'Decision: full test suite runs on GitHub CI on push; the pre-commit auto-run is off by default (opt-in via a flag).' },
  ] },

  // --- pure decoys (plausible, keyword-overlapping, no matching decision) ---
  { id: 'decoy-pcc-sidebar', name: 'PCC sidebar tweaks', messages: [
    { cls: 'user', text: 'The PCC chat interface sidebar is cramped — widen it.' },
    { cls: 'bot', text: 'Widened the PCC chat panel and moved the model switcher. UI-only, unrelated to the tax app.' },
  ] },
  { id: 'decoy-deductions', name: 'Deduction categories', messages: [
    { cls: 'user', text: 'List common deduction categories for the tax app.' },
    { cls: 'bot', text: 'Standard deduction, mortgage interest, charitable gifts, medical over threshold, SALT cap. Reference only, no decision.' },
  ] },
  { id: 'decoy-backup-tiers', name: 'Backup policy', messages: [
    { cls: 'user', text: 'How often should projects back up off-machine?' },
    { cls: 'bot', text: 'Projects earn off-machine backup; local-only is a valid tier. Nothing about the tax app or e-file here.' },
  ] },
  { id: 'decoy-crypto-someday', name: 'Crypto someday', messages: [
    { cls: 'user', text: 'When we eventually add crypto to the tax app, what is involved?' },
    { cls: 'bot', text: 'Cost-basis, exchange imports, wash-sale rules. Deferred — no build decision made.' },
  ] },
  { id: 'decoy-meta-naming', name: 'Naming chats feature', messages: [
    { cls: 'user', text: 'We should auto-name chats and build a chat history search into the app.' },
    { cls: 'bot', text: 'Agreed as a feature idea; that is about PCC chat history, not the tax app interface.' },
  ] },
  { id: 'decoy-perf', name: 'Startup perf', messages: [
    { cls: 'user', text: 'The app takes a moment to boot; can we speed startup?' },
    { cls: 'bot', text: 'Coalesced some detector script spawns. Perf only — no product decision.' },
  ] },

  // --- supersession pair: an approval and a LATER reversal. A general search for "v1 done"
  // should surface BOTH (not force one); which one is current is a Phase-3 advanced concern. ---
  { id: 'v1-signoff', name: 'v1 sign-off', messages: [
    { cls: 'user', text: 'Is v1 finished? I think we are done.' },
    { cls: 'bot', text: 'All v1 scope is complete and verified.' },
    { cls: 'user', text: 'Great — I approve v1 as done. Ship it.' },
    { cls: 'bot', text: 'Decision: v1 is approved as done and shipped.' },
  ] },
  { id: 'v1-reopened', name: 'v1 reopened', messages: [
    { cls: 'user', text: 'A tax deduction bug slipped through — v1 is not really done after all.' },
    { cls: 'bot', text: 'Understood.' },
    { cls: 'user', text: 'I changed my mind: reopen v1. We are NOT done until the deduction bug is fixed.' },
    { cls: 'bot', text: 'Decision: v1 reopened; the earlier "v1 done" approval is reversed pending the deduction fix.' },
  ] },
];

// ---- ANSWER KEY (blind to the pipeline; runner-only) ----
// category is documentation for the report; expectNone means "no chat should be picked".
const GROUND_TRUTH = [
  { category: 'canonical', query: 'When did we decide to build the chat interface into the tax app?',
    expectChatId: 'tax-chat-decision', mustMention: ['chat interface', 'primary surface'],
    rejectChatIds: ['tax-ui-ideas-deferred', 'decoy-pcc-sidebar', 'decoy-meta-naming'] },

  { category: 'went-wrong', query: 'What did we say went wrong before with the tax app scope?',
    expectChatId: 'tax-chat-decision', mustMention: ['crypto', 'scope'], rejectChatIds: ['decoy-crypto-someday'] },

  { category: 'paraphrase-gap', query: 'How are we paying for the model — a subscription or metered per message?',
    expectChatId: 'auth-login-decision', mustMention: ['login'], rejectChatIds: [] },

  { category: 'negation', query: 'What did we decide NOT to build ourselves for filing returns?',
    expectChatId: 'efile-decision', mustMention: ['provider'], rejectChatIds: [] },

  { category: 'role-reversal', query: 'Where did we fix the crash when a model was retired?',
    expectChatId: 'model-crash-fix', mustMention: ['fallback'], rejectChatIds: [] },

  { category: 'temporal-first', query: 'What was the first priority we set for the tax app?',
    expectChatId: 'tax-chat-decision', mustMention: ['deduction'], rejectChatIds: [] },

  { category: 'deploy', query: 'What did we decide about when the full test suite runs?',
    expectChatId: 'ci-decision', mustMention: ['CI', 'push'], rejectChatIds: [] },

  // Multi-result: both the approval and the later reversal match — return BOTH, don't force one.
  { category: 'multi-supersession', query: 'When did we agree that v1 was done?',
    expectChatIds: ['v1-signoff', 'v1-reopened'], mustMention: ['v1'], rejectChatIds: [] },

  // Anti-hallucination: never discussed. Must return NONE, not fabricate a chat.
  { category: 'no-answer', query: 'Which chat did we pick the color theme for the tax app?',
    expectNone: true },
];

module.exports = { chats, stageB: chats, GROUND_TRUTH };
