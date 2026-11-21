/* The old Dimau Companion (Lali, Lumi, Tiko...) has been replaced by Volau, the one assistant for every Dimau app.
   This file now only loads Volau with this app's own setup. Pages that still call DimauCompanion get Volau instead. */
(function () {
  'use strict';
  var me = document.currentScript;
  var id = (me && me.getAttribute('data-app')) || '';
  var host = location.hostname;
  var MAP = {
    'fiji-culture-corner': 'culture-corner', 'viti-market': 'viti-market', 'vitiauto': 'vitiauto', 'dimau-homes': 'fiji-homes',
    'myfiji': 'myfiji', 'fiji-guide': 'fiji-guide', 'fijilearn': 'fijilearn', 'fijian-bible': 'bible',
    'fiji-history-virtual-museum': 'museum', 'fiji-history-library': 'reading-room', 'fiji-corpus-desk': 'reading-room',
    'fiji-3d-living-topography': 'fiji-3d', 'fiji-navigate': 'fiji-navigate', 'dimau-3d-studio': '3d-studio',
    'sota-kece': 'sota-kece', 'bulavata': 'sota-kece', 'qele': 'vanua-os', 'donovandimau-fiji-agriculture': 'vanua-grow',
    'sema-accounting': 'sema', 'bula-score': 'bula-score', 'fiji-tap': 'fiji-tap', 'dimau-fintech': 'dimau-fintech',
    'dimau-group': 'dimau-group', 'soli-fiji': 'soli-fiji', 'mydebtcalculator': 'debt-calculator', 'fhtb-calculator-site': 'fhtb',
    'fiji-digital': 'fiji-digital', 'dimau-rating-hub': 'rating-hub', 'dimau-ops': 'dimau-ops', 'donovan-command-centre': 'dimau-ops'
  };
  var HOSTS = [
    [/fijiculturecorner/, 'culture-corner'], [/fijihistory/, 'museum'], [/dimau-fintech/, 'dimau-fintech'], [/dimau-?group/, 'dimau-group'],
    [/sema-accounting/, 'sema'], [/qele\./, 'vanua-os'], [/villageos\./, 'villageos'], [/sotakece/, 'sota-kece'], [/fijilearn/, 'fijilearn']
  ];
  var app = MAP[id] || '';
  if (id === 'villageos') app = /qele\./.test(host) ? 'vanua-os' : 'villageos';
  if (!app) for (var i = 0; i < HOSTS.length; i++) if (HOSTS[i][0].test(host)) { app = HOSTS[i][1]; break; }
  if (!app) app = id || 'demo';

  window.DimauCompanion = window.DimauCompanion || {
    mount: function () { return null; }, open: function () { if (window.Volau) window.Volau.open(); }, profiles: {}
  };
  if (window.__nvvWidget || document.querySelector('script[src*="volau.dimau-fintech.com/widget/widget.js"]')) return;
  if (window.self !== window.top) return; // never inside embedded frames
  var s = document.createElement('script');
  s.src = 'https://volau.dimau-fintech.com/widget/widget.js';
  s.setAttribute('data-app', app);
  s.setAttribute('data-side', (me && me.getAttribute('data-side')) || 'left');
  s.async = true;
  if (app === 'sota-kece') {
    // Sota reserves help in its footer instead of covering page controls.
    s.addEventListener('load', function () {
      var widget = Array.from(document.body.children).find(function (el) {
        return el.shadowRoot && el.shadowRoot.querySelector('.bub[aria-label^="Open Volau"]');
      });
      if (!widget || !window.Volau || typeof window.Volau.open !== 'function') return;
      var style = document.createElement('style');
      style.textContent = '.bub,.hint{display:none!important}.panel{position:fixed;left:12px;right:auto;bottom:12px;width:min(380px,calc(100vw - 24px));height:min(600px,calc(100dvh - 24px))}';
      widget.shadowRoot.appendChild(style);
      document.documentElement.classList.add('sota-help-ready');
      var dock = document.createElement('footer');
      dock.className = 'sota-help-dock';
      dock.innerHTML = '<span>Need a hand?</span><button type="button" class="bv-help-link" data-sota-help aria-haspopup="dialog">Ask Volau</button>';
      document.querySelector('#app')?.after(dock);
      var opener;
      document.addEventListener('click', function (event) {
        var button = event.target.closest('[data-sota-help]');
        if (!button) return;
        opener = button;
        window.Volau.open();
        widget.shadowRoot.querySelector('textarea')?.focus();
      });
      widget.shadowRoot.querySelector('.x')?.addEventListener('click', function () {
        if (opener?.isConnected) opener.focus();
      });
    });
  }
  (document.head || document.documentElement).appendChild(s);
})();
