/* Shared inline-SVG icon sprite for the cockpit mockups.
   Include as the FIRST element inside <body>: <script src="_icons.js"></script>
   Then reference an icon with: <svg class="ic"><use href="#i-shield"/></svg> */
(function(){
  var S = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">'
  + sym('i-chat','<path d="M4 5h16v11H9l-5 4z"/>')
  + sym('i-cockpit','<circle cx="12" cy="12" r="8"/><path d="M12 12l5-3"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>')
  + sym('i-evidence','<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/>')
  + sym('i-project','<path d="M4 7h6l2 2h8v10H4z"/>')
  + sym('i-shield','<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>')
  + sym('i-route','<circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/><path d="M7 18h6a4 4 0 0 0 4-4V8"/>')
  + sym('i-sync','<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><path d="M4 20v-4h4"/>')
  + sym('i-book','<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18h13"/>')
  + sym('i-target','<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>')
  + sym('i-worker','<rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 8V4.5"/><circle cx="12" cy="3.4" r="1.1"/><circle cx="9.2" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13" r="1" fill="currentColor" stroke="none"/>')
  + sym('i-pulse','<path d="M3 12h4l2-5 3 10 2-5h6"/>')
  + sym('i-flask','<path d="M9 3h6"/><path d="M10 3v6l-5 8.5A1.6 1.6 0 0 0 6.4 20h11.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/>')
  + sym('i-verify','<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M8.5 12l2.3 2.3L15.5 10"/>')
  + sym('i-gate','<rect x="3" y="6" width="3.2" height="13" rx="1"/><path d="M6 9h14M6 13h14"/>')
  + sym('i-commit','<circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6"/>')
  + sym('i-cloud','<path d="M7 18h10a4 4 0 0 0 .3-8A5 5 0 0 0 7.4 9 3.5 3.5 0 0 0 7 18z"/>')
  + sym('i-bell','<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>')
  + sym('i-check','<path d="M5 12l4 4L19 7"/>')
  + sym('i-alert','<path d="M12 3l9 16H3z"/><path d="M12 9v5"/><circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none"/>')
  + sym('i-stop','<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9 12h6"/>')
  + sym('i-question','<path d="M9.2 9a2.8 2.8 0 1 1 4 2.6c-1 .6-1.4 1.2-1.4 2.2"/><circle cx="11.8" cy="17.5" r=".8" fill="currentColor" stroke="none"/>')
  + sym('i-clock','<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>')
  + sym('i-flag','<path d="M6 21V4"/><path d="M6 5h11l-2 3 2 3H6"/>')
  + sym('i-chevron','<path d="M6 9l6 6 6-6"/>')
  + sym('i-expand','<path d="M4 14v6h6M20 10V4h-6"/><path d="M20 4l-7 7M4 20l7-7"/>')
  + sym('i-dot','<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>')
  + sym('i-key','<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M17 5l2 2M15 7l2 2"/>')
  + sym('i-eye','<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>')
  + sym('i-pencil','<path d="M4 20l3.5-1L18 8.5 15.5 6 5 16.5z"/><path d="M14 7l3 3"/>')
  + sym('i-terminal','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><path d="M13 15h4"/>')
  + sym('i-brain','<path d="M9.5 4a2.5 2.5 0 0 0-2.5 2.5A2.5 2.5 0 0 0 5.5 11a2.5 2.5 0 0 0 1.5 4.5A2.5 2.5 0 0 0 9.5 19h.5V4z"/><path d="M14.5 4A2.5 2.5 0 0 1 17 6.5 2.5 2.5 0 0 1 18.5 11a2.5 2.5 0 0 1-1.5 4.5A2.5 2.5 0 0 1 14.5 19H14V4z"/>')
  + '</svg>';
  function sym(id, body){ return '<symbol id="'+id+'" viewBox="0 0 24 24">'+body+'</symbol>'; }
  var d = document.createElement('div'); d.style.display='none'; d.innerHTML = S;
  (document.body || document.documentElement).insertBefore(d, (document.body||document.documentElement).firstChild);
})();
