/* Shared SIMULATED live-worker stream for the feed mockups. Fake, scripted data on a timer —
   the real feed would stream the worker's actual actions. One deliberate long pause shows the
   "looks stuck" state, then it recovers. Each mockup renders this its own way. */
window.FEED = {
  tools: {
    Think: {icon:'i-brain',     color:'var(--muted)',  verb:'Preparing'},   /* safe label — never real reasoning */
    Read:  {icon:'i-eye',       color:'var(--blue)',   verb:'Reading'},
    Edit:  {icon:'i-pencil',    color:'var(--amber)',  verb:'Editing'},
    Run:   {icon:'i-terminal',  color:'var(--purple)', verb:'Running'},
    Test:  {icon:'i-flask',     color:'var(--green)',  verb:'Testing'}
  },
  // {tool, target, note, gap = seconds until the NEXT action}
  script: [
    {tool:'Think', target:'the next step', note:'preparing the next step', gap:2.2},
    {tool:'Read',  target:'docs/specs/auth-flow.md', note:'re-checking the checklist', gap:2},
    {tool:'Read',  target:'auth-flow.js', gap:1.6},
    {tool:'Edit',  target:'auth-flow.js', note:'adding email + password sign-in', gap:3},
    {tool:'Read',  target:'app-routes.js', gap:1.6},
    {tool:'Edit',  target:'app-routes.js', note:'wiring in the sign-in screen', gap:9},   // <-- long pause = "looks stuck"
    {tool:'Think', target:'the next action', note:'choosing the next action', gap:2.2},
    {tool:'Edit',  target:'auth-flow.test.js', note:'writing the automatic checks', gap:2.6},
    {tool:'Run',   target:'npm test', note:'running the tests', gap:4},
    {tool:'Read', target:'the last check result', note:'reviewing the last result', gap:2.2},
    {tool:'Edit',  target:'auth-flow.js', note:'fixing the failing case', gap:2.6},
    {tool:'Test',  target:'npm test', note:'re-running — all green', gap:3.4}
  ],
  startTime: 0,
  lastEventTime: 0,
  run: function(onEvent){
    var self = this, i = 0;
    self.startTime = Date.now();
    self.lastEventTime = Date.now();
    function next(){
      var e = self.script[i % self.script.length]; i++;
      self.lastEventTime = Date.now();
      try { onEvent(e); } catch(err){}
      setTimeout(next, (e.gap || 2) * 1000);
    }
    setTimeout(next, 500);
  },
  mmss: function(ms){ var s=Math.floor(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); },
  STUCK_MS: 6000
};
