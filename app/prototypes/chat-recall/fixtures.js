// Blind fixtures for the chat-recall prototype.
//
// CHATS is everything the pipeline is allowed to see (mirrors the real chat
// object shape: { id, name, messages:[{ cls, text }] }). GROUND_TRUTH is the
// answer key — it is NEVER passed into the pipeline; only the runner reads it,
// AFTER the pipeline has answered, to score the result. That is what "blind"
// means here.
//
// Stage A: grep the TARGET chat alone (one haystack) — tests summary + judge.
// Stage B: bury TARGET among DECOYS — tests retrieval ("which chat was it in").

'use strict';

// ---- TARGET: a long chat whose known answer matches the owner's own example
// question ("when did we decide to build the chat interface into the tax app?").
const target = {
  id: 'target-tax-chat',
  name: 'Tax app planning',
  messages: [
    { cls: 'user', text: 'Starting the tax prep assistant. First priority is deductions and taxable-income only. Crypto can wait.' },
    { cls: 'bot', text: 'Understood. Scoping v1 to deductions + taxable income. Crypto deferred to a later update.' },
    { cls: 'user', text: 'What integrations does the IRS free-file program require for e-file?' },
    { cls: 'bot', text: 'E-file requires an authorized transmitter; most small apps defer to a provider rather than self-transmit.' },
    { cls: 'user', text: 'Ok park e-file. How should the user actually interact with the tax app day to day?' },
    { cls: 'bot', text: 'Options: a form-driven wizard, a dashboard, or a conversational chat interface like PCC has.' },
    { cls: 'user', text: 'I like the chat idea. It worked well in PCC.' },
    { cls: 'bot', text: 'A chat interface would let users ask "is this deductible?" in plain English instead of hunting through forms.' },
    { cls: 'user', text: 'Yeah. Let us do it - build the chat interface into the tax app. Make that the primary surface, not forms.' },
    { cls: 'bot', text: 'Decision recorded: the tax app will use a conversational chat interface as its primary surface (forms secondary). Reusing the PCC chat pattern.' },
    { cls: 'user', text: 'Good. Also remember we might want receipt photo upload later, but not now.' },
    { cls: 'bot', text: 'Noted as a future idea: receipt photo upload, deferred.' },
    { cls: 'user', text: 'One more - what went wrong last time was we let scope creep into crypto. Do not repeat that.' },
    { cls: 'bot', text: 'Acknowledged. Scope guard: crypto stays out of v1; the earlier crypto scope-creep is the failure to avoid.' },
  ],
};

// ---- DECOYS: plausible, same-project-adjacent chats that a dumb keyword search
// might wrongly surface (they mention "tax", "chat", "app", "interface", "build").
const decoys = [
  {
    id: 'decoy-pcc-ui',
    name: 'PCC sidebar tweaks',
    messages: [
      { cls: 'user', text: 'The PCC chat interface sidebar is too cramped. Can we widen it?' },
      { cls: 'bot', text: 'We can widen the chat panel and move the model switcher. This is a PCC UI change, unrelated to the tax app.' },
      { cls: 'user', text: 'Do it. Build the wider layout.' },
      { cls: 'bot', text: 'Wider PCC chat layout applied.' },
    ],
  },
  {
    id: 'decoy-deductions',
    name: 'Deduction categories',
    messages: [
      { cls: 'user', text: 'List the common deduction categories for the tax app.' },
      { cls: 'bot', text: 'Standard deduction, mortgage interest, charitable gifts, medical over threshold, SALT cap.' },
      { cls: 'user', text: 'Which are most error prone?' },
      { cls: 'bot', text: 'SALT and medical thresholds. No decision needed here, just reference.' },
    ],
  },
  {
    id: 'decoy-backup',
    name: 'Backup policy',
    messages: [
      { cls: 'user', text: 'How often should projects back up off-machine?' },
      { cls: 'bot', text: 'Projects earn off-machine backup; local-only is a valid tier. Nothing about the tax app chat here.' },
    ],
  },
  {
    id: 'decoy-model',
    name: 'Model switcher bug',
    messages: [
      { cls: 'user', text: 'The model dropdown crashed when a model was retired.' },
      { cls: 'bot', text: 'Added auto-fallback so a retired model never crashes the chat. This is a PCC fix.' },
    ],
  },
  {
    id: 'decoy-crypto',
    name: 'Crypto someday',
    messages: [
      { cls: 'user', text: 'When we do add crypto to the tax app, what is involved?' },
      { cls: 'bot', text: 'Cost-basis tracking, exchange imports, wash-sale rules. Deferred - no build decision made.' },
    ],
  },
];

// ---- ANSWER KEY (blind to the pipeline; runner-only) ----
const GROUND_TRUTH = [
  {
    query: 'When did we decide to build the chat interface into the tax app?',
    expectChatId: 'target-tax-chat',
    // A correct answer must reflect this fact; scored by the judge against these.
    mustMention: ['chat interface', 'primary surface'],
    rejectChatIds: ['decoy-pcc-ui'], // the tempting wrong hit (PCC chat, not tax app)
  },
  {
    query: 'What did we say went wrong before with the tax app scope?',
    expectChatId: 'target-tax-chat',
    mustMention: ['crypto', 'scope'],
    rejectChatIds: ['decoy-crypto'],
  },
];

module.exports = {
  target,
  decoys,
  stageA: [target],            // one haystack
  stageB: [target, ...decoys], // needle among decoys
  GROUND_TRUTH,
};
