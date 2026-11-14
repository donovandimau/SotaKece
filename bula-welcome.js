/* Bula welcome button — Dimau Fintech apps.
 * One file, copied into every app. Load with:
 *   <script src="/bula-welcome.js" data-app="soli-fiji" defer></script>
 * Any element with [data-bula-open] becomes the live welcome button.
 * If the page has none, a floating "Bula! Welcome to …" pill is added.
 * Optional: data-mount="brand" puts the pill beside the app's logo in its header (short "Bula!" on phones),
 *   or data-mount="after:<css>", "before:<css>" or "in:<css>" places it next to / inside that element. Falls back to floating if neither is found.
 * Optional: data-mount-2 names the element the button sits under when the header row has no room
 *   (default: straight under that row).
 * Optional: data-share adds a Share button beside the pill (uses the Dimau share chooser when the page loads it).
 * Optional: data-position="bottom-left|bottom-right|top-left|top-right", data-offset="72" (px from edge).
 * No inline scripts or styles are used, so strict Content-Security-Policy headers are fine.
 */
(function () {
  'use strict';
  if (window.BulaWelcome) return;

  var APPS = {
  "sota-kece": {
    "name": "Sota Kece",
    "line": "A Pacific-first home for your people: catch up, share music and make a space that is yours.",
    "items": [
      [
        "Your people",
        "Catch up with friends and family wherever they are, and sit down together in Talanoa."
      ],
      [
        "Your soundtrack",
        "Share a favourite song and give your page its own music."
      ],
      [
        "Your own space",
        "Choose a look for your page so it tells your story."
      ],
      [
        "Current stage",
        "Create your space or sign in to join the circle. Low data by default."
      ]
    ],
    "who": "Fijians and Pacific people, at home and overseas",
    "note": "Create your space or sign in to join the circle."
  },
  "dimau-rating-hub": {
    "name": "Dimau Rating Hub",
    "line": "Find places you can count on across Fiji, and share how their service was.",
    "items": [
      ["Find places", "Search shops, clinics, schools, transport, government counters and more by category, town and rating."],
      ["Compare", "Put organisations side by side before you choose where to go."],
      ["Share your experience", "Sign in with your Dimau account to rate a service, write a review in your own words and save places."],
      ["Current stage", "Sample workspace. The organisations and reviews shown are made-up examples."]
    ],
    "who": "People in Fiji choosing a service, and organisations that want honest feedback",
    "note": "Reviews are personal opinions. The hub is independent of the organisations listed."
  },
  "viti-market": {
    "name": "Viti Market",
    "line": "Fiji's everyday marketplace. Browse independent shops and island-made goods in one place.",
    "items": [
      ["Shop", "Browse food, fashion, home, electronics and more, or search the whole market."],
      ["Save favourites", "Keep items you like in Saved items and find new arrivals and best sellers."],
      ["Buy from local sellers", "Each seller sets their own prices, delivery and pickup options."],
      ["Sell on Viti", "Open your own shop and manage it from the seller dashboard."]
    ],
    "who": "Shoppers and sellers in Fiji",
    "note": "Card payments are not available yet. No card details are collected."
  },
  "soli-fiji": {
    "name": "Soli Fiji",
    "line": "Crowdfunding and investment for all Fijians. Not live yet.",
    "items": [
      [
        "Explore",
        "Crowdfunding and investment for all Fijians. Not live yet."
      ],
      [
        "Current stage",
        "Not live yet. Explore the concept. Real donations, lending and investing are unavailable."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Explore the concept. Real donations, lending and investing are unavailable."
  },
  "myfiji": {
    "name": "MyFiji",
    "line": "Find the Dimau apps in one place. Each service explains its current availability.",
    "items": [
      [
        "Explore",
        "Find the Dimau apps in one place. Each service explains its current availability."
      ],
      [
        "Current stage",
        "Directory. Choose an app, read its stage and open the linked service."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Choose an app, read its stage and open the linked service."
  },
  "fiji-tap": {
    "name": "Fiji Tap",
    "line": "Try a simulated payment journey with example personal and merchant accounts.",
    "items": [
      [
        "Explore",
        "Try a simulated payment journey with example personal and merchant accounts."
      ],
      [
        "Current stage",
        "Simulation. No real money moves. Local account records use encrypted browser storage and manual backups, without cloud sync."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "No real money moves. Local account records use encrypted browser storage and manual backups, without cloud sync."
  },
  "fijilearn": {
    "name": "FijiLearn",
    "line": "Explore interactive courses in maths, language, science, coding and business.",
    "items": [
      [
        "Explore",
        "Explore interactive courses in maths, language, science, coding and business."
      ],
      [
        "Current stage",
        "Available. Try a lesson, then review the available account and classroom options for saving progress."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Try a lesson, then review the available account and classroom options for saving progress."
  },
  "fiji-homes": {
    "name": "Fiji Homes",
    "line": "Affordable homes on partnered iTaukei land, built with the landowners, not taken from them.",
    "items": [
      [
        "Homes and lots",
        "See serviced lots and affordable homes planned on partnered land."
      ],
      [
        "VANUA tool",
        "Look at a piece of land and what could be built on it."
      ],
      [
        "Feasibility model",
        "Work out costs and returns for a development in your browser."
      ],
      [
        "Grants",
        "Find out about grants and support for first homes."
      ],
      [
        "Register interest",
        "Leave your details to hear first when homes become available."
      ]
    ],
    "who": "Families looking for an affordable home, and mataqali who want their land to earn for them.",
    "note": "A Dimau Construction Pte Ltd initiative. Figures are estimates until real quotes are in."
  },
  "bula-score": {
    "name": "Bula Score",
    "line": "Explore a credit dashboard with synthetic scores and sample reports.",
    "items": [
      [
        "Explore",
        "Explore a credit dashboard with synthetic scores and sample reports."
      ],
      [
        "Current stage",
        "Demo. Use the supplied demo credentials. No real credit score, lending offer or credit decision is issued."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Use the supplied demo credentials. No real credit score, lending offer or credit decision is issued."
  },
  "my-debt-calculator": {
    "name": "My Debt Calculator",
    "line": "Compare debt repayment plans using UK pounds.",
    "items": [
      [
        "Explore",
        "Compare debt repayment plans using UK pounds."
      ],
      [
        "Current stage",
        "Planning tool. Review your balances, interest rates and assumptions. Results are estimates, not a credit service or personal advice."
      ]
    ],
    "who": "UK",
    "note": "Review your balances, interest rates and assumptions. Results are estimates, not a credit service or personal advice."
  },
  "fhtb-calculator": {
    "name": "FHTB Calculator",
    "label": "FHTB Calculator",
    "line": "Compare UK home-buying costs, Forces Help to Buy scenarios and overpayments.",
    "items": [
      [
        "Explore",
        "Compare UK home-buying costs, Forces Help to Buy scenarios and overpayments."
      ],
      [
        "Current stage",
        "Planning tool. Use the displayed assumptions. Estimates do not confirm scheme eligibility, mortgage approval or personal advice."
      ]
    ],
    "who": "UK",
    "note": "Use the displayed assumptions. Estimates do not confirm scheme eligibility, mortgage approval or personal advice."
  },
  "fiji-culture-corner": {
    "name": "Fiji Culture Corner",
    "line": "Explore homeware, stationery and apparel concepts inspired by Fiji.",
    "items": [
      [
        "Explore",
        "Explore homeware, stationery and apparel concepts inspired by Fiji."
      ],
      [
        "Current stage",
        "Concept catalogue. No products are for sale. Prices, stock, maker provenance and fulfilment are not confirmed; checkout is disabled."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "No products are for sale. Prices, stock, maker provenance and fulfilment are not confirmed; checkout is disabled."
  },
  "fiji-navigate": {
    "name": "Fiji Navigate",
    "line": "Explore driving and walking routes across Fiji.",
    "items": [
      [
        "Explore",
        "Explore driving and walking routes across Fiji."
      ],
      [
        "Current stage",
        "In development. Check the selected destination and current road conditions before travelling."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Check the selected destination and current road conditions before travelling."
  },
  "fiji-3d": {
    "name": "Fiji 3D Maps",
    "line": "Explore Fiji’s islands and landscapes in interactive 3D.",
    "items": [
      [
        "Explore",
        "Explore Fiji’s islands and landscapes in interactive 3D."
      ],
      [
        "Current stage",
        "Available. Use the map controls to pan, rotate and zoom. Coverage and downloaded areas can vary."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Use the map controls to pan, rotate and zoom. Coverage and downloaded areas can vary."
  },
  "fiji-museum": {
    "name": "Fiji: A Living History",
    "line": "Explore an independent virtual museum of Fiji’s history and culture.",
    "items": [
      [
        "Explore",
        "Explore an independent virtual museum of Fiji’s history and culture."
      ],
      [
        "Current stage",
        "Available. Visit the galleries and Great Bure. Read the source and reconstruction labels; cultural and expert review remains ongoing."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Visit the galleries and Great Bure. Read the source and reconstruction labels; cultural and expert review remains ongoing."
  },
  "dimau-fintech": {
    "name": "Dimau Fintech",
    "line": "Explore Dimau’s products, ventures and current development stages.",
    "items": [
      [
        "Explore",
        "Explore Dimau’s products, ventures and current development stages."
      ],
      [
        "Current stage",
        "Portfolio. Open a product card to see what is available today and what remains proposed."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Open a product card to see what is available today and what remains proposed."
  },
  "fiji-digital": {
    "name": "Fiji Digital",
    "line": "Explore a proposed digital public infrastructure programme for Fiji.",
    "items": [
      [
        "Explore",
        "Explore a proposed digital public infrastructure programme for Fiji."
      ],
      [
        "Current stage",
        "Concept. The programme is an independent proposal. It does not operate government identity, payment or data-exchange services."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "The programme is an independent proposal. It does not operate government identity, payment or data-exchange services."
  },
  "villageos": {
    "name": "Koro",
    "line": "Explore village services and organise community records.",
    "items": [
      [
        "Explore",
        "Explore village services and organise community records."
      ],
      [
        "Current stage",
        "In development. Recorded information does not create an official registry entry or confirm government integration."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Recorded information does not create an official registry entry or confirm government integration."
  },
  "vanua-os": {
    "name": "Vanua OS",
    "line": "Organise land information, meeting records and partnership planning.",
    "items": [
      [
        "Explore",
        "Organise land information, meeting records and partnership planning."
      ],
      [
        "Current stage",
        "In development. Workspace records are not an official title, lease approval or verification of consent."
      ]
    ],
    "who": "Fiji and international visitors",
    "note": "Workspace records are not an official title, lease approval or verification of consent."
  }
};

  var FLAG = '<svg class="bw-flag" viewBox="0 0 60 30" aria-hidden="true"><defs><clipPath id="bwfjc"><rect width="30" height="15"/></clipPath></defs><rect width="60" height="30" fill="#68BFE5"/><g clip-path="url(#bwfjc)"><rect width="30" height="15" fill="#012169"/><path d="M0,0L30,15M30,0L0,15" stroke="#fff" stroke-width="3.5"/><path d="M0,0L30,15M30,0L0,15" stroke="#C8102E" stroke-width="1.4"/><path d="M15,0V15M0,7.5H30" stroke="#fff" stroke-width="5"/><path d="M15,0V15M0,7.5H30" stroke="#C8102E" stroke-width="2.6"/></g><g transform="translate(45,14.5)"><path d="M-6,-9 L6,-9 L6,3 Q6,7 0,10 Q-6,7 -6,3 Z" fill="#fff" stroke="#012169" stroke-width="0.3"/><rect x="-6" y="-9" width="12" height="2.3" fill="#C8102E"/><rect x="-6" y="0.85" width="12" height="1.6" fill="#C8102E"/><rect x="-0.7" y="-6.7" width="1.4" height="15.2" fill="#C8102E"/></g></svg>';

  var CSS = [
    '@keyframes bw-ring{0%{box-shadow:0 0 0 0 rgba(104,191,229,.75),0 6px 20px rgba(1,33,105,.25)}70%{box-shadow:0 0 0 12px rgba(104,191,229,0),0 6px 20px rgba(1,33,105,.25)}100%{box-shadow:0 0 0 0 rgba(104,191,229,0),0 6px 20px rgba(1,33,105,.25)}}',
    '@keyframes bw-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.7)}}',
    '@keyframes bw-in{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}',
    '.bw-live{position:relative;cursor:pointer;animation:bw-ring 2.2s ease-out infinite;font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}',
    'button.bw-live{appearance:none;-webkit-appearance:none}',
    '.bw-live:hover{filter:brightness(1.08)}',
    '.bw-live:focus-visible{outline:3px solid #68BFE5;outline-offset:3px}',
    '.bw-dot{flex:none;width:8px;height:8px;border-radius:50%;background:#2ee57a;box-shadow:0 0 8px #2ee57a;animation:bw-dot 1.4s ease-in-out infinite}',
    '.bw-flag{flex:none;width:22px;height:11px;border-radius:2px;display:block}',
    '.bw-pill{position:fixed;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);padding:8px 14px 8px 12px;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:linear-gradient(135deg,#012169,#0a4d8c 60%,#1f8fbf);color:#fff;font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.01em;white-space:nowrap}',
    '.bw-pill .bw-txt{overflow:hidden;text-overflow:ellipsis}',
    '.bw-pill,.bw-pill:hover,.bw-pill:focus{border:1px solid rgba(255,255,255,.35)!important;border-radius:999px!important;background:linear-gradient(135deg,#012169,#0a4d8c 60%,#1f8fbf)!important;color:#fff!important;font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif!important;text-transform:none!important;min-height:0!important;width:auto!important;box-sizing:border-box!important}',
    '.bw-pill .bw-short{display:none}',
    '.bw-group{display:inline-flex!important;align-items:center;gap:6px;flex:none!important;margin:0 8px}',
    '.bw-group.bw-float{position:fixed;z-index:2147483000;margin:0}',
    '.bw-pill.bw-full .bw-long{display:inline!important}.bw-pill.bw-full .bw-short{display:none!important}',
    '.bw-own-line .bw-pill{max-width:100%;min-width:0}',
    '.bw-own-line{display:flex!important;margin:4px 16px 8px!important;width:max-content;max-width:calc(100% - 32px);flex-basis:100%;grid-column:1/-1}',
    '.bw-group .bw-pill.bw-inline{margin:0!important}',
    '.bw-share,.bw-share:hover{display:inline-flex!important;align-items:center;gap:6px;height:30px;padding:0 12px!important;border:1px solid rgba(10,77,140,.35)!important;border-radius:999px!important;background:#fff!important;color:#0a4d8c!important;font:600 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif!important;cursor:pointer;box-shadow:0 2px 8px rgba(1,33,105,.15);min-height:0!important;width:auto!important;text-transform:none!important}',
    '.bw-share:hover{background:#eef6fc!important}',
    '.bw-share:focus-visible{outline:3px solid #68BFE5;outline-offset:2px}',
    '@media (max-width:640px){.bw-share .bw-share-txt{display:none}.bw-share,.bw-share:hover{width:30px!important;padding:0!important;justify-content:center}.bw-group{margin:0 4px}}',
    '.bw-pill.bw-inline{position:relative!important;z-index:5;align-self:center;flex:none!important;margin:0 8px!important;padding:6px 12px 6px 10px!important;max-width:none}',
    '@media (max-width:640px){.bw-pill.bw-inline .bw-long{display:none}.bw-pill.bw-inline .bw-short{display:inline}.bw-pill.bw-inline{margin:0 4px!important;padding:6px 10px 6px 8px!important;gap:6px!important;font-size:12px!important}}',
    '@media (max-width:560px){.bw-pill{font-size:12px;padding:7px 12px 7px 10px}}',
    '@media (prefers-reduced-motion:reduce){.bw-live,.bw-dot{animation:none}}',
    '.bw-back{position:fixed;inset:0;z-index:2147483600;background:rgba(3,14,34,.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;padding:0}',
    '@media (min-width:640px){.bw-back{align-items:center;padding:24px}}',
    '.bw-card{--bw-bg:#fff;--bw-ink:#10213a;--bw-sub:#4a5a73;--bw-line:#e3e9f2;--bw-soft:#f2f7fc;background:var(--bw-bg);color:var(--bw-ink);width:100%;max-width:560px;max-height:88vh;overflow:auto;border-radius:22px 22px 0 0;box-shadow:0 20px 60px rgba(0,0,0,.35);animation:bw-in .28s ease-out;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left;letter-spacing:normal;text-transform:none}',
    '@media (min-width:640px){.bw-card{border-radius:22px}}',
    '.bw-card:focus{outline:none}',
    '@media (prefers-color-scheme:dark){.bw-card{--bw-bg:#0f1b2e;--bw-ink:#eef4fb;--bw-sub:#a9b8cc;--bw-line:#23344f;--bw-soft:#162640}}',
    '.bw-head{position:relative;padding:22px 22px 18px;background:linear-gradient(135deg,#012169,#0a4d8c 55%,#1f8fbf);color:#fff}',
    '.bw-head .bw-flag{width:36px;height:18px;margin-bottom:12px;box-shadow:0 2px 6px rgba(0,0,0,.25)}',
    '.bw-hi{margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85}',
    '.bw-title{margin:4px 0 8px;font-size:24px;line-height:1.2;font-weight:800;color:#fff}',
    '.bw-line{margin:0;font-size:15px;opacity:.95;color:#fff}',
    '.bw-x{position:absolute;top:12px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:20px;line-height:36px;cursor:pointer}',
    '.bw-x:hover{background:rgba(255,255,255,.28)}',
    '.bw-body{padding:18px 22px 22px}',
    '.bw-h{margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bw-sub)}',
    '.bw-list{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:8px}',
    '.bw-list li{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border:1px solid var(--bw-line);border-radius:12px;background:var(--bw-soft)}',
    '.bw-n{flex:none;width:24px;height:24px;border-radius:50%;background:#0a4d8c;color:#fff!important;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px}',
    '.bw-list b{display:block;font-size:15px;color:var(--bw-ink)}',
    '.bw-list div span{display:block;font-size:14px;color:var(--bw-sub)}',
    '.bw-p{margin:0 0 12px;font-size:14px;color:var(--bw-sub)}',
    '.bw-p b{color:var(--bw-ink)}',
    '.bw-note{margin:0 0 16px;padding:10px 12px;border-left:3px solid #68BFE5;background:var(--bw-soft);border-radius:0 10px 10px 0;font-size:13px;color:var(--bw-sub)}',
    '.bw-go{display:block;width:100%;padding:13px 16px;border:0;border-radius:12px;background:linear-gradient(135deg,#012169,#1f8fbf);color:#fff;font:700 15px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer}',
    '.bw-go:hover{filter:brightness(1.1)}',
    '.bw-foot{margin:12px 0 0;text-align:center;font-size:12px;color:var(--bw-sub)}',
    '.bw-foot a{color:inherit;text-decoration:underline}'
  ].join('\n');

  function addStyles() {
    try {
      var sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {
      var s = document.createElement('style');
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var me = document.currentScript;
  var appId = (me && me.getAttribute('data-app')) || '';
  var app = APPS[appId] || { name: document.title.split(/[—|\-]/)[0].trim() || 'our app', line: '', items: [], who: '', note: '' };
  var isUK = /fhtb|debt/i.test(appId);
  var welcomePrefix = isUK ? '' : 'Bula! ';
  if (isUK) FLAG = '';
  var position = (me && me.getAttribute('data-position')) || 'bottom-left';
  var offset = parseInt((me && me.getAttribute('data-offset')) || '16', 10);
  var mount = (me && me.getAttribute('data-mount')) || '';
  var withShare = !!(me && me.hasAttribute('data-share'));
  var mount2 = (me && me.getAttribute('data-mount-2')) || '';

  var backEl = null, lastFocus = null;

  function open() {
    if (backEl) return;
    lastFocus = document.activeElement;
    var items = app.items.map(function (it, i) {
      return '<li><span class="bw-n">' + (i + 1) + '</span><div><b>' + esc(it[0]) + '</b><span>' + esc(it[1]) + '</span></div></li>';
    }).join('');
    backEl = document.createElement('div');
    backEl.className = 'bw-back';
    backEl.innerHTML =
      '<div class="bw-card" role="dialog" aria-modal="true" aria-labelledby="bw-title">' +
        '<div class="bw-head">' + FLAG +
          '<p class="bw-hi">' + (isUK ? 'UK planning tool' : 'Bula vinaka') + '</p>' +
          '<h2 class="bw-title" id="bw-title">Welcome to ' + esc(app.name) + '</h2>' +
          (app.line ? '<p class="bw-line">' + esc(app.line) + '</p>' : '') +
          '<button type="button" class="bw-x" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="bw-body">' +
          (items ? '<h3 class="bw-h">What you can do here</h3><ul class="bw-list">' + items + '</ul>' : '') +
          (app.who ? '<p class="bw-p"><b>Who it’s for:</b> ' + esc(app.who) + '</p>' : '') +
          (app.langs ? '<p class="bw-p"><b>Languages:</b> ' + esc(app.langs) + '</p>' : '') +
          (app.note && !app.items.some(function(it){return it[1].indexOf(app.note)!==-1;}) ? '<p class="bw-note">' + esc(app.note) + '</p>' : '') +
          '<button type="button" class="bw-go">Start exploring</button>' +
          '<p class="bw-foot">By Dimau Fintech · <a href="https://myfiji.dimau-fintech.com/" target="_blank" rel="noopener">See all our apps</a></p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(backEl);
    backEl.addEventListener('click', function (e) {
      if (e.target === backEl || e.target.closest('.bw-x') || e.target.closest('.bw-go')) close();
    });
    document.addEventListener('keydown', onKey, true);
    var card = backEl.querySelector('.bw-card');
    if (card) { card.tabIndex = -1; card.focus({ preventScroll: true }); card.scrollTop = 0; }
  }

  function close() {
    if (!backEl) return;
    backEl.remove();
    backEl = null;
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab' && backEl) {
      var f = backEl.querySelectorAll('button,a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function wire(el) {
    if (el.__bw) return;
    el.__bw = true;
    el.classList.add('bw-live');
    if (!el.querySelector('.bw-dot')) {
      var dot = document.createElement('span');
      dot.className = 'bw-dot';
      dot.setAttribute('aria-hidden', 'true');
      el.insertBefore(dot, el.firstChild);
    }
    if (el.tagName !== 'BUTTON') { el.setAttribute('role', 'button'); el.tabIndex = 0; }
    el.setAttribute('aria-haspopup', 'dialog');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', welcomePrefix + 'Welcome to ' + app.name + '. What this app does');
    el.addEventListener('click', function (e) { e.preventDefault(); open(); });
    el.addEventListener('keydown', function (e) {
      if (el.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); }
    });
  }

  function makePill() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bw-pill';
    b.innerHTML = FLAG + '<span class="bw-txt bw-long">' + welcomePrefix + 'Welcome to ' + esc(app.label || app.name) + '</span><span class="bw-txt bw-short">' + (isUK ? 'Welcome' : 'Bula!') + '</span>';
    wire(b);
    return b;
  }

  // Find the app's own logo/name block in its header and return [parent, nodeToInsertAfter].
  function brandSpot() {
    if (mount && mount !== 'brand') {
      var mode = 'in', sel = mount, mm = /^(after|before|in):(.*)$/.exec(mount);
      if (mm) { mode = mm[1]; sel = mm[2]; }
      var m = null;
      try { m = document.querySelector(sel); } catch (e) { m = null; }
      if (!m) return null;
      if (mode === 'after') return [m.parentElement, m];
      if (mode === 'before') return [m.parentElement, m.previousSibling, true];
      return [m, m.lastChild];
    }
    var logo = document.querySelector('img[src*="dimau-owner-logo"],img[src*="dimau-fintech-logo"],img[alt*="Dimau" i]');
    if (!logo) return null;
    var r = logo.getBoundingClientRect();
    if (r.width === 0 || r.top > 160) return null;
    var node = logo, vw = window.innerWidth;
    while (node.parentElement && node.parentElement !== document.body) {
      var pw = node.parentElement.getBoundingClientRect().width;
      if (pw >= vw * 0.85) break;
      node = node.parentElement;
    }
    if (!node.parentElement || node.parentElement === document.body) return null;
    // If this block is only the logo, step past the app name that follows it.
    var after = node;
    var hasText = function (el) { return (el.textContent || '').trim().length > 0; };
    var isControl = function (el) { return el.matches('button,input,select,form,[role=button]') || !!el.querySelector('button,input,select,form'); };
    while (!hasText(after) && after.nextElementSibling && hasText(after.nextElementSibling) && !isControl(after.nextElementSibling)) {
      after = after.nextElementSibling;
    }
    return [node.parentElement, after];
  }

  var SHARE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="18" cy="5" r="3" fill="currentColor"/><circle cx="6" cy="12" r="3" fill="currentColor"/><circle cx="18" cy="19" r="3" fill="currentColor"/><path d="M8.6 10.7l6.8-4M8.6 13.3l6.8 4" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
  function shareThis() {
    var data = { url: location.origin + location.pathname, title: app.name, text: app.line || document.title };
    if (window.DimauShare && window.DimauShare.open) { window.DimauShare.open(data); return; }
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    try { navigator.clipboard.writeText(data.url); } catch (e) { /* nothing more to do */ }
  }
  function makeShare() {
    var s = document.createElement('button');
    s.type = 'button';
    s.className = 'bw-share';
    s.setAttribute('aria-label', 'Share ' + app.name);
    s.innerHTML = SHARE_ICON + '<span class="bw-share-txt">Share</span>';
    s.addEventListener('click', function (e) { e.preventDefault(); shareThis(); });
    return s;
  }

  // el is what gets placed: the pill alone, or a group holding the pill and a Share button.
  function place(el, pill) {
    var spot = brandSpot();
    if (spot) {
      pill.classList.add('bw-inline');
      el.classList.remove('bw-float');
      if (el !== pill) el.removeAttribute('style'); else pill.removeAttribute('style');
      var base = Math.max(spot[0].scrollWidth, spot[0].clientWidth);
      var docBase = Math.max(document.documentElement.scrollWidth, window.innerWidth);
      spot[0].insertBefore(el, spot[1] ? spot[1].nextSibling : (spot[2] ? spot[0].firstChild : null));
      // Always show the whole "Bula! Welcome to ...". If it does not fit beside the name,
      // give it its own line under the header (or float it, with data-mount-2="float").
      var row = spot[0];
      el.classList.remove('bw-own-line');
      pill.classList.add('bw-full');
      // Shared shell: utility controls use the same aligned row at every breakpoint.
      if (mount2 === 'float') { el.remove(); floating(el, pill); return true; }
      el.classList.add('bw-own-line');
      var target = null;
      if (mount2) { try { var m2 = /^(after|before|in):(.*)$/.exec(mount2); target = document.querySelector(m2 ? m2[2] : mount2); } catch (e) { target = null; } }
      (target || row).after(el);
      return true;
    }
    return false;
  }

  function floating(el, pill) {
    if (el !== pill) { pill.classList.add('bw-inline'); el.classList.add('bw-float'); } else pill.classList.remove('bw-inline');
    var v = position.indexOf('top') === 0 ? 'top' : 'bottom';
    var h = position.indexOf('right') > -1 ? 'right' : 'left';
    el.style[v] = 'calc(' + offset + 'px + env(safe-area-inset-' + v + ', 0px))';
    el.style[h] = '16px';
    document.body.appendChild(el);
  }

  function addPill() {
    var pill = makePill(), el = pill;
    if (withShare) {
      el = document.createElement('span');
      el.className = 'bw-group';
      el.appendChild(pill);
      el.appendChild(makeShare());
    }
    if (mount) {
      if (!place(el, pill)) floating(el, pill);
      // Apps that redraw the page (React, Next.js) can drop the pill; put it back.
      setInterval(function () { if (!el.isConnected && !place(el, pill)) floating(el, pill); }, 800);
    } else floating(el, pill);
  }

  function init() {
    addStyles();
    var targets = document.querySelectorAll('[data-bula-open]');
    if (targets.length) { targets.forEach(wire); return; }
    if (mount) {
      // Wait for the app to finish drawing before placing the pill in its layout.
      var go = function () { addPill(); };
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    } else addPill();
  }

  window.BulaWelcome = { open: open, close: close, apps: APPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* Contextual guidance: local-only, no analytics, no form-value collection. */
(function () {
  'use strict';
  if (window.DimauGuidance) return;
  var script = document.currentScript;
  var appId = script && script.getAttribute('data-app') || 'dimau-ops';
  var app = window.BulaWelcome && window.BulaWelcome.apps[appId] || {name: document.title, items: [], note: ''};
  var topics = ({"bula-score":{"your fjscore":"FjScore is the prototype’s 0–999 score. This example demonstrates how a credit dashboard can present a score and its contributing factors. It is not your real score or a lender’s decision.","my credit score":"Start here for the sample score, its band and the factors used in this demonstration. Open each factor to understand the example breakdown.","my credit report":"This screen groups the sample accounts, credit checks, addresses and public-record information. None of these records comes from a real consumer credit file.","credit report":"A credit report groups account and repayment information. This report uses invented records so you can explore the layout safely.","accounts":"This counts the sample credit accounts included in the report. Open an account to inspect its example balance, limit, status and repayment history.","open accounts":"These are the sample accounts marked open. A closed account can still appear separately in the example report.","total balances":"This is the sum of the balances shown on the sample accounts. It represents amounts outstanding in this demonstration, not money held in a bank account.","card utilisation":"Utilisation compares the balance on a card with its available credit limit. For example, a balance of 200 against a limit of 1,000 uses 20% of that limit. The dashboard’s figures are illustrative.","hard searches (12m)":"The example count covers application-related checks within a twelve-month period. It is different from a soft check. These are sample events, not actual searches of your file.","searches (12m)":"This summarises example credit checks over twelve months. Open the search detail to see the organisation, date and whether the example is marked hard or soft.","public records":"This area demonstrates where judgments, insolvencies or bankruptcies would be listed in a report. An empty sample section is not a verification of your legal or financial history.","credit accounts":"Each row is a sample loan, card or other credit account. Select a row to see its balance, limit and monthly repayment record. Read the legend before interpreting its colours.","search footprint":"This lists sample organisations that checked the example file. The hard/soft label explains the type of search; dates show when the example event occurred.","who's checked me":"Review the example search footprint here. No bank or other organisation has checked your real credit file through this demo.","address history":"The example report shows addresses and the dates associated with them. These invented addresses demonstrate how current and previous records can be displayed.","addresses on file":"View the sample address history. Open a row to see its details. This prototype does not retrieve or verify your actual address.","score over time":"Follow the example score across months. The chart shows changes within this synthetic dataset, not a prediction of future borrowing decisions.","fjscore over time":"Read the horizontal axis for the month and the vertical axis for the example score. Open a point or its detail where available to inspect the figure.","score milestones":"These markers describe notable moments in the example score history. They are milestones in the sample data, not achievements recorded for you.","what's affecting your score":"The prototype groups the inputs that contribute to the example score. A displayed weight describes this model’s emphasis, not a guarantee that a lender uses the same formula.","payment history":"This factor illustrates whether repayments in the sample data arrived on time. Read the monthly legend and account detail together rather than relying on colour alone.","credit utilisation":"This factor compares sample card balances and limits. The percentage changes as either value changes; the example is for understanding the model.","loans & cards i can get":"Browse illustrative products and eligibility estimates. No application is sent and no lender has approved you. Product names, rates and likelihoods in this prototype are not live offers.","eligibility checker":"The checker demonstrates how an eligibility screen could work using sample data. It does not assess your real circumstances, perform a credit search or promise acceptance.","what you can get":"These are example product matches. Read the displayed assumptions; they are not current lending offers or approvals.","improve my score":"Explore the suggested actions attached to the example report. They explain the prototype’s factors; no specific score increase or real-world outcome is guaranteed.","boost your score":"This section demonstrates possible actions related to the sample score. Open an item for its explanation and treat any projected change as illustrative.","track your progress":"This shows progress within the demonstration. It does not monitor or change a real credit file.","recent alerts":"These example notifications show how a customer might learn about a new search, changed balance or other update. They are not real account alerts.","all alerts":"Review the sample changes in one place. Open an alert to understand its example event and date.","changes to my file":"This is the sample alert feed. It helps you explore the information a change notification can contain, without monitoring real records.","new hard search detected":"This is a simulated application-related credit check. No real search took place. The reporting workflow demonstrates how a customer might flag an unfamiliar event.","cyclone protection active":"This demonstrates a proposed disaster-protection state in the prototype. It does not confirm protection for a real account or a policy adopted by any lender.","balance reduced":"An example account balance has decreased relative to the previous sample record. It is not a payment confirmation or a change to your real finances.","report an error":"Explore how to identify an account and describe a suspected mistake in the sample report. This demo does not send a complaint to a lender or credit bureau.","raise a dispute":"Choose the sample record and reason, then describe the example correction. Use fictional details only. This prototype does not create a real dispute.","your disputes":"These are example dispute records and statuses. They demonstrate a tracking screen; they do not establish that an organisation received or investigated a complaint.","account (optional)":"Choose a sample account if your example dispute relates to that account. Leave it unselected for an issue affecting another part of the report.","reason":"Choose the category that best describes the example error, then add fictional details explaining the expected correction.","details":"Describe the sample issue clearly: what is shown and what should be different. Do not enter real account numbers, identity documents or private financial information.","submit dispute":"This demonstrates submitting a dispute within the prototype. It does not deliver a real complaint to a lender or start a formal investigation.","your details":"The profile contains sample identity and contact details. It is not a verified identity record.","preferences":"Explore the example notification and contact choices. Changing them here does not subscribe you to a live credit-monitoring service.","my details & preferences":"Open the sample profile and preference controls. Use fictional data while testing.","email":"Use the supplied demo account to explore the interface. A real email address is not needed for the sample dashboard.","password":"The demo credentials are supplied on the sign-in screen. Do not reuse a password from another account. Help never reads this field’s value.","sign in":"Open the sample dashboard with the demo credentials. This is an interface demonstration, not access to a real credit file.","create a free account":"This is a prototype account-entry control. It does not establish a licensed credit-bureau account or verify a real identity.","open navigation":"Open the menu to move between the score, report, accounts, searches, alerts and profile. Choosing a page does not submit a credit application.","open account menu":"Open the profile menu for the available account options and sign-out control.","share bula score link":"Open the share chooser for the public app link. Review the destination before sending; sharing the app link does not share your entered form values."},"soli-fiji":{"discover":"Browse the sample campaigns and their stated purpose. Open a campaign to read its story, target and updates before comparing it with others.","donate":"This area demonstrates giving to a campaign. Donations are different from repayable loans or ownership investments. Real payments remain unavailable in this pilot.","lend":"This area demonstrates repayable community funding. Review the example repayment terms and risks. It is not an active lending offer.","invest":"This area demonstrates raising capital in exchange for an interest in a venture. Example returns and valuations are not guarantees, and investing is not live.","ledger":"A ledger lists example money movements so you can compare incoming and outgoing amounts. The sample entries are not evidence of real transfers.","map":"Explore the locations attached to sample campaigns. Select a marker to open its campaign; the map is a discovery aid, not a land-title or ownership record.","leaders":"This view compares the activity shown in the pilot dataset. It is not an independent verification of a person, campaign or organisation.","raised":"This is the funding amount displayed for the example campaign. Compare it with the target and stage; it is not confirmation that real money was collected.","target":"The target is the amount the example campaign aims to raise. It is distinct from the amount already shown as raised.","your account":"Explore the pilot’s account area and sample activity. Payments, lending, investing and identity verification are not enabled for real use."},"fiji-tap":{"tap to pay":"Try the simulated payment flow. The demonstration shows the steps between a shopper and merchant; it does not charge a card or transfer money.","personal account":"Explore the sample shopper balance, spending and payment history. These figures do not represent funds you can withdraw or spend.","merchant account":"Explore how a shop could review a simulated payment. A success screen in this demo is not proof that funds settled.","balance":"This is a demonstration balance. It is different from an actual bank or mobile-wallet balance and cannot be spent.","amount":"Enter the amount to use in the simulation and check the currency shown. This does not authorise a real payment.","payment history":"Review the demonstration transactions and their displayed statuses. They are sample records, not bank statements.","builds your credit":"This illustrates the proposed link between payment activity and a credit history. The demo does not report your activity to a credit bureau."},"fijilearn":{"daily review":"Practise previously introduced ideas in a short review. Read the feedback after each answer and try again where needed.","five subjects":"Choose Maths, English, Science, Social Studies or Vosa Vakaviti to see the available learning material.","for teachers":"Use the teacher view to review the class progress made available by the app. A class code connects a learner to a class; check the code with the teacher.","class code":"Enter the code supplied by your teacher for the intended class. Check its spelling before joining.","progress":"Progress indicates the lessons or steps completed in the app. It is a learning aid rather than a formal assessment or qualification.","streak":"A streak tracks consecutive learning activity as counted by the app. Missing a day does not erase the knowledge you have gained.","certificates":"These recognise activity completed in the app. They are not an accredited school qualification.","maths":"Choose a course, work through one step at a time and read the explanation after each answer.","review":"Revisit the material and its feedback. Repeated practice can help you notice which steps need more attention."},"fiji-homes":{"homes and lots":"Browse the housing pipeline and model homes. Read the stage and assumptions on each entry; a concept is not a completed or available home.","vanua tool":"VANUA is the developer’s internal property ledger. Landowner-facing land-book work is in the separate Qele app.","feasibility model":"Compare a development’s assumed costs and revenues. Change one input at a time and inspect the resulting totals. Estimates need real quotes before they support a decision.","grants":"Explore the grant information and calculator assumptions shown on this page. Eligibility and availability need confirmation with the relevant provider.","register interest":"Use this form to express interest in the project described. An expression of interest is not a reservation, purchase contract or guarantee of allocation.","costs":"These are the development cost assumptions used by the model. Check the currency, quantity, timing and whether tax is included.","returns":"These are modelled outcomes based on the displayed assumptions. They are not guaranteed income or a formal property valuation."},"my-debt-calculator":{"all your debts":"Add each debt separately so balances, rates and minimum payments can be compared. Check the units and payment frequency before relying on the totals.","balance":"Enter the outstanding balance for this debt. This is the amount still owed, not the credit limit or original amount borrowed.","interest rate":"Use the rate and time period requested by this field. A monthly rate and an annual rate are different; check your statement before entering a figure.","minimum payment":"This is the amount assumed to be payable for the period shown. Check the actual minimum and due date with the lender.","your payoff plan":"Compare repayment scenarios using the model’s assumptions. Changing the extra-payment amount shows a new estimate; it does not arrange or make payments.","money saved":"The model compares estimated interest under its scenarios. Savings depend on the rates, balances and payments entered and are not guaranteed.","most expensive first":"This approach prioritises the debt with the greatest interest cost under the model. Review all minimum payments and obligations before using a plan.","private":"The calculator’s published description says your numbers stay on your device. Take care when using any separate export or sharing control."},"fhtb-calculator":{"forces help to buy":"Explore the advance and repayment assumptions used by this calculator. Confirm entitlement and current scheme terms through the official service process before committing to a purchase.","mortgage":"Compare the estimated borrowing and repayment figures. These calculations are planning illustrations, not a mortgage offer or affordability approval.","deposit":"The deposit is the part of the purchase price funded upfront. Keep it separate from legal, moving and other purchase costs when checking your budget.","all the costs":"Review each purchase cost included by the calculator. Estimates can change by property, location and transaction; check the displayed assumptions and actual quotes.","overpayments":"Compare what happens in the model if you pay more than the regular instalment. Check the lender’s limits and charges before making real overpayments.","stamp duty":"This is a planning calculation using the page’s assumptions. Tax treatment depends on the property and buyer circumstances; verify the current official rules before exchange.","salary":"Enter the pay figure requested by the field and check whether it expects an annual or monthly amount. The estimate does not confirm scheme entitlement.","compare":"Compare properties or scenarios using consistent assumptions. A lower estimated monthly payment does not by itself mean a lower total cost."},"fiji-culture-corner":{"heritage pieces":"Browse concepts inspired by Fijian design. Names, imagery, materials and cultural review remain subject to approval; the catalogue does not verify a maker or origin.","homeware":"Explore the proposed designs and finishes. These are concepts, not confirmed stock or an offer for sale.","stationery and apparel":"Browse the sample stationery and clothing concepts. Sizes, materials, pricing and availability need confirmation before sales can open.","50 concepts":"The catalogue presents designs in development. Do not treat an illustration as a photograph of an available product.","shortlist":"Use the shortlist to keep track of concepts that interest you during the preview. This does not reserve stock or place an order.","checkout":"Real checkout is disabled. Products, fulfilment, policies and payments must be approved before orders can be accepted."},"fiji-navigate":{"search anywhere":"Enter a place name, then check the selected result and location before requesting a route. Similar place names can refer to different destinations.","driving and walking":"Choose the travel mode before comparing the proposed route. A route estimate cannot confirm that every road or path is currently passable.","real roads":"The map uses road and track data to propose routes. Follow actual signs, closures and conditions; map data can be incomplete or out of date.","3d view":"Tilt, rotate and zoom to understand the terrain. The visual perspective does not change the actual distance or certify safe access.","offline":"Use the app’s available download controls before losing connectivity. Check the completion status and what the saved area includes.","destination":"Choose where you intend to go and check the result on the map. Requesting a route does not confirm access to private land.","my location":"This control requests your device’s location when permitted. Check accuracy on the map; buildings and signal conditions can affect the result."},"fiji-3d":{"fly anywhere":"Pan, rotate, tilt and zoom the map to explore Fiji. Use the map controls to reset your view if you lose your position.","real terrain":"The terrain depicts elevations from the map’s data source. It is a visual reference, not a survey or engineering measurement.","places":"Select a place marker to see its information. A marker identifies a mapped point, not proof of ownership, permission or current opening hours.","roads":"Read the mapped roads and tracks alongside current local information. A line on the map does not guarantee safe or public access.","directions":"Choose an origin and destination, then review the route and mode. Follow current signs and conditions when travelling.","search":"Search for a place, check the result on the map and open its details. Use a more specific name if several results look similar."},"fiji-museum":{"walk the rooms":"Move through the virtual galleries using the available navigation controls. Open the room’s story and object details for more context.","narrated stories":"Select Listen to hear the available narration. Select Read to use the written story. Audio availability can differ between rooms.","listen":"Start the available narration for this story. You can switch back to Read to stop listening and use the written version.","read":"Open the written story and explore it at your own pace. Check any source, interpretation or reconstruction labels shown with the material.","collections":"Open an object or picture to inspect its description and any source information. A digital reconstruction is different from a photograph of an original object.","reading room":"Read the longer material associated with a period or subject. Use the provided source information to distinguish historical evidence from interpretation."},"myfiji":{"one home screen":"This directory links to the available Dimau apps. Choose a card to open that service, then read its own stage and guidance.","pay and send":"Open the linked payment or community-funding app. Check its current demo or service status before entering information.","money and credit":"Open the relevant score or planning tool. Calculators and sample dashboards do not create a financial account or approve borrowing.","maps and travel":"Open the map or navigation tool. Check the chosen destination, data availability and current local conditions.","learn and explore":"Open FijiLearn or the museum for the available lessons and stories. Each service has its own controls and content.","favourites":"Use favourites to keep frequently used app links easy to find. A favourite does not change the linked service’s availability."},"dimau-fintech":{"our apps":"Explore the product cards and open an app to see its current capabilities and stage. A listing is not a promise that every planned service is live.","myfiji":"MyFiji is the directory that brings the app links together. Each linked service explains its own status.","fiji digital":"Read the proposed network and its building blocks. Distinguish the programme plan from services that have actually been released.","explore fiji in 3d":"Use the map to explore the places presented. Map coverage does not establish service availability at every location."},"fiji-digital":{"payments":"This describes a proposed shared payments network. Read the stated implementation stage; a programme diagram is not an active payment service.","digital id":"This describes the identity component of the programme. It does not issue or verify your identity from this information page.","data exchange":"This describes the proposed exchange of information between services. The diagram does not itself authorise access to anyone’s records.","village os":"This describes the village-service part of the programme. Open its product to review what is currently implemented.","live status":"Read the stage and date shown for each component. A planned item is distinct from a tested or published service."},"qele":{"land book":"Record and review the parcels, meetings and leases represented in your land book. Entered records are not a legal confirmation of title or lease approval.","parcels":"Review each parcel’s description, area and status. Check the units and supporting records before using the information in a partnership proposal.","bose":"Use this area to record the meeting information and decisions relevant to the land book. An app entry does not replace the required formal process.","leases":"Track the lease information and stage shown. A status in this app is not proof that a lease has been granted or registered.","partnership":"Compare the illustrated partnership structures and assumptions. Modelled rent or equity is not an agreed contract or guaranteed return.","readiness":"The readiness score summarises the information recorded for the partnership pack. It does not establish legal eligibility or official approval."},"dimau-ops":{"today":"See the current priorities and reported activity. Open the underlying project or work record for the evidence behind a status.","projects":"Choose a project to view its published site or saved revision. The version selector determines which address is shown.","live":"This view uses the project’s recorded published address. Check its deployment status for the latest verification result.","latest saved revision":"This is the saved amendment candidate when one exists. A candidate is not necessarily the version already published to customers.","monitor":"Review recorded runs and deployment activity. A recent check-in alone is not evidence that work was completed.","command room":"Read the owner’s instructions and decisions alongside the project context. This is the shared coordination record.","ai room":"Read the agents’ coordination notes. Check the linked project and work records for the resulting changes.","work":"Review tasks and their current status. A claimed task is in progress; completion should be supported by a saved result.","share studio":"Preview how a project link will appear when shared. Check the selected address and version before choosing a destination.","automatic publishing":"The service checks the candidate source and technical status before publication. Failed checks or explicit holds remain visible."},"vanua-os":{"land book":"Record and review the parcels, meetings and leases represented in your land book. Entered records are not a legal confirmation of title or lease approval.","parcels":"Review each parcel’s description, area and status. Check the units and supporting records before using the information in a partnership proposal.","bose":"Use this area to record the meeting information and decisions relevant to the land book. An app entry does not replace the required formal process.","leases":"Track the lease information and stage shown. A status in this app is not proof that a lease has been granted or registered.","partnership":"Compare the illustrated partnership structures and assumptions. Modelled rent or equity is not an agreed contract or guaranteed return.","readiness":"The readiness score summarises the information recorded for the partnership pack. It does not establish legal eligibility or official approval."}})[appId] || {};
  if(appId==='bula-score'){
    app.line='Explore a sample credit score and report, and learn what each part means.';
    app.note='Synthetic-data demonstration only. No real credit file, application, approval or dispute is created.';
  }
  var shades = ['#e0f2fe', '#bae6fd', '#ccecff', '#d7f0ff', '#b8dff5', '#c4e8f9'];
  var dialog, opener, launcher, picking = false, banner, list, search;
  var selector = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,label,button,a,summary,input,select,textarea,figure,figcaption,img,svg[aria-label],[role="button"],[role="tab"],[role="img"],[data-tip],[data-help]';
  var excluded = '#dg-dialog,#dg-launcher,#dg-picker,script,style,noscript,[aria-hidden="true"],[hidden]';
  var css = `
    #dg-launcher{position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483001;display:flex;align-items:center;gap:8px;min-height:44px;padding:10px 16px;border:1px solid #4685a6;border-radius:999px;background:#bae6fd;color:#12354b;box-shadow:0 4px 16px #12354b33;font:700 14px/1.3 system-ui,sans-serif;cursor:pointer;width:auto}
    #dg-dialog{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(560px,calc(100vw - 24px));max-width:560px;max-height:calc(100dvh - 32px);padding:0;border:1px solid #4685a6;border-radius:22px;background:var(--dg-sky,#e0f2fe);color:#12354b;box-shadow:0 20px 70px #12354b55;font:16px/1.55 system-ui,sans-serif;text-align:left;overflow:auto;overscroll-behavior:contain}
    #dg-dialog::backdrop{background:#092c4870;backdrop-filter:blur(3px)}
    #dg-dialog *{box-sizing:border-box} #dg-dialog h2,#dg-dialog h3,#dg-dialog p{color:#12354b;margin:0 0 12px;line-height:1.5}
    #dg-dialog h2{font-size:24px;line-height:1.2} #dg-dialog h3{font-size:16px} #dg-dialog .dg-head{position:sticky;top:0;padding:20px 64px 16px 22px;background:#bae6fd;border-bottom:1px solid #74b5d7;z-index:2}
    #dg-dialog .dg-body{padding:20px 22px} #dg-dialog button{font:600 15px/1.35 system-ui,sans-serif;min-height:44px;border:1px solid #4685a6;border-radius:12px;padding:10px 14px;background:#f0f9ff;color:#12354b;cursor:pointer;letter-spacing:normal;text-transform:none}
    #dg-dialog .dg-close{position:absolute;right:12px;top:12px;width:44px;padding:0;font-size:25px;border-radius:50%;background:#d7f0ff}
    #dg-dialog .dg-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px} #dg-dialog .dg-primary{background:#14577a;color:#fff;border-color:#14577a}
    #dg-dialog .dg-note{border-left:3px solid #4685a6;padding:10px 12px;background:#f0f9ff;border-radius:4px 10px 10px 4px;font-size:14px}
    #dg-dialog label{display:block;color:#12354b;font-weight:700;margin:12px 0 6px} #dg-dialog input{display:block;width:100%;min-height:46px;padding:10px 12px;border:1px solid #4685a6;border-radius:10px;background:#fff;color:#12354b;font:16px/1.4 system-ui,sans-serif}
    #dg-dialog .dg-list{display:grid;gap:8px} #dg-dialog .dg-item{text-align:left;width:100%;display:block;white-space:normal;overflow-wrap:anywhere;background:var(--dg-sky,#ccecff)}
    #dg-dialog .dg-kind{display:block;font-size:12px;font-weight:500;color:#315970;margin-top:3px} #dg-dialog .dg-copy{white-space:pre-line;overflow-wrap:anywhere}
    #dg-picker{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483646;width:max-content;max-width:calc(100vw - 16px);padding:12px 16px;border:1px solid #4685a6;border-radius:14px;background:#bae6fd;color:#12354b;box-shadow:0 4px 20px #12354b44;font:600 14px/1.5 system-ui,sans-serif}
    #dg-picker button{margin-left:10px;min-height:44px;padding:8px 12px;border:1px solid #4685a6;border-radius:10px;background:#f0f9ff;color:#12354b;font:inherit}
    #dg-dialog :focus-visible,#dg-launcher:focus-visible,#dg-picker button:focus-visible{outline:3px solid #0c4a6e;outline-offset:3px}
    html.dg-picking body{cursor:help} html.dg-picking #dg-launcher{visibility:hidden}
    .bw-card{--bw-bg:#e0f2fe!important;--bw-ink:#12354b!important;--bw-sub:#315970!important;--bw-line:#74b5d7!important;--bw-soft:#ccecff!important;background:#e0f2fe!important;color:#12354b!important}
    .bw-head{background:#bae6fd!important;color:#12354b!important}.bw-title,.bw-line,.bw-hi{color:#12354b!important}.bw-x{background:#d7f0ff!important;color:#12354b!important;min-width:44px;min-height:44px}
    .bw-list li:nth-child(3n+2){background:#d7f0ff!important}.bw-list li:nth-child(3n){background:#b8dff5!important}
    [data-dg-popup]{background:var(--dg-sky,#ccecff)!important;color:#12354b!important;border-color:#74b5d7!important}
    [data-dg-popup] :is(h1,h2,h3,h4,p,label,li,dt,dd){color:#12354b}
    @media(max-width:560px){#dg-dialog .dg-body{padding:16px}#dg-dialog .dg-head{padding-left:16px}#dg-launcher{width:44px;height:44px;justify-content:center;padding:0;font-size:20px}#dg-launcher span{display:none}}
    @media(prefers-reduced-motion:reduce){#dg-dialog,.bw-card{animation:none!important;transition:none!important}}
    @media print{#dg-dialog,#dg-launcher,#dg-picker{display:none!important}}
  `;
  function text(e) {
    if (!e) return '';
    // Never read entered values, passwords, editable content, or hidden application state.
    if(e.matches('input,textarea,select')) return e.getAttribute('aria-label') || (e.labels && Array.from(e.labels).map(function(l){return l.textContent;}).join(' ')) || e.getAttribute('placeholder') || 'Input field';
    var clone=e.cloneNode(true);clone.querySelectorAll('input,textarea,select,[contenteditable],script,style').forEach(function(n){n.remove();});
    return (e.getAttribute('aria-label') || e.getAttribute('alt') || clone.textContent || '').replace(/\s+/g,' ').trim();
  }
  function plain(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function shade(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return shades[h%shades.length];}
  function el(tag, content, cls) {var e=document.createElement(tag);if(content)e.textContent=content;if(cls)e.className=cls;return e;}
  function visible(e){return !e.closest(excluded) && !e.closest('[inert]') && e.getClientRects().length>0 && getComputedStyle(e).visibility!=='hidden' && !e.isContentEditable;}
  function kind(e){return e.matches('input,select,textarea,label')?'Field':e.matches('button,a,summary,[role="button"],[role="tab"]')?'Control':e.matches('h1,h2,h3,h4,h5,h6')?'Section':e.matches('img,svg,figure,[role="img"]')?'Image or chart':'Content';}
  function section(e){var box=e.closest('article,section,.card,.tile,.field,fieldset,form');var h=box&&box.querySelector('h1,h2,h3,h4,legend,.k');return h?text(h):'';}
  function topicFor(title, heading){
    var key=plain(title).toLowerCase(), context=plain(heading).toLowerCase();
    if(topics[key])return topics[key];
    if(topics[context])return topics[context];
    var items=app.items||[];
    for(var i=0;i<items.length;i++)if(key===items[i][0].toLowerCase())return items[i][1];
    return '';
  }
  function explain(e){
    var title=text(e)||section(e)||'This item', heading=section(e), specific=e.getAttribute('data-help')||topicFor(title,heading);
    var type=kind(e), action='';
    if(e.matches('input,textarea,select')){
      var inputType=e.getAttribute('type');
      action=e.matches('select')?'Choose one of the listed options.':inputType==='checkbox'?'Select this box only if the statement matches your choice.':inputType==='range'?'Move the slider to compare the outcomes shown on this page.':inputType==='password'?'Enter your password here. Help does not read or display it.':'Enter the information requested by this label. Check any units and examples shown beside it.';
      if(e.required) action+=' This field is required.';
      var helpId=e.getAttribute('aria-describedby');
      if(helpId){var hint=helpId.split(/\s+/).map(function(id){return text(document.getElementById(id));}).filter(Boolean).join(' ');if(hint)specific=specific||hint;}
    } else if(e.matches('a[href]')){
      var href=e.getAttribute('href');
      action=href&&href.charAt(0)==='#'?'This link takes you to the matching section of this page.':'Use this link to open its destination. Opening help does not follow the link.';
    } else if(e.matches('button,[role="button"],[role="tab"],summary')) action=e.disabled||e.getAttribute('aria-disabled')==='true'?'This control is currently unavailable. Read the adjacent status or requirements before trying again.':'Close help, then select this control to use it. Opening help does not activate it.';
    else if(type==='Image or chart') action='Use the caption, legend and available controls to explore this visual.';
    else action='Read this together with the surrounding '+(heading?'“'+heading+'” section':'section')+'. Use its related controls to explore further.';
    return {title:title,copy:specific,action:action,heading:heading,type:type};
  }
  function close(){if(dialog&&dialog.open)dialog.close();}
  function openShell(title, sky){
    var wasPicking=picking;stopPicking(false);
    if(!dialog.open){opener=wasPicking?launcher:document.activeElement;dialog.showModal();}
    dialog.style.setProperty('--dg-sky',sky||shade(title));
    dialog.textContent='';
    var head=el('div',null,'dg-head'), h=el('h2',title);h.id='dg-title';head.appendChild(h);
    var x=el('button','×','dg-close');x.type='button';x.setAttribute('aria-label','Close help');x.onclick=close;head.appendChild(x);dialog.appendChild(head);
    var body=el('div',null,'dg-body');dialog.appendChild(body);dialog.scrollTop=0;x.focus();return body;
  }
  function showItem(e){
    var d=explain(e),body=openShell(d.title.length>90?d.title.slice(0,87)+'…':d.title,shade(d.title));
    if(d.title.length>90)body.appendChild(el('p',d.title,'dg-copy'));
    if(d.copy){body.appendChild(el('h3','What this means'));body.appendChild(el('p',d.copy,'dg-copy'));}
    else {body.appendChild(el('h3',d.type==='Content'?'Read in context':'About this '+d.type.toLowerCase()));body.appendChild(el('p',d.heading?'This item belongs to “'+d.heading+'”.':'This is part of '+app.name+'.'));
      var parent=e.closest('article,section,.card,.tile,.field,fieldset,figure');
      var nearby=parent&&Array.from(parent.querySelectorAll('p,figcaption')).find(function(p){return p!==e&&visible(p)&&text(p)!==d.title;});
      if(nearby)body.appendChild(el('p',text(nearby),'dg-copy'));
    }
    body.appendChild(el('h3','How to use it'));body.appendChild(el('p',d.action));
    var row=el('div',null,'dg-actions'),back=el('button','All page help');back.type='button';back.onclick=showPage;row.appendChild(back);
    var done=el('button','Got it','dg-primary');done.type='button';done.onclick=close;row.appendChild(done);body.appendChild(row);
  }
  function candidates(){var seen=new Set();return Array.from(document.querySelectorAll(selector)).filter(function(e){if(!visible(e))return false;var label=text(e);if(!label)return false;var key=kind(e)+'|'+label+'|'+section(e);if(seen.has(key))return false;seen.add(key);return true;});}
  function showPage(){
    var items=candidates(),body=openShell('Help with this page','#e0f2fe');
    body.appendChild(el('p','Choose a topic below, or select “Explain anything” and then tap any part of the page.'));
    var actions=el('div',null,'dg-actions'),pick=el('button','Explain anything','dg-primary');pick.type='button';pick.onclick=startPicking;actions.appendChild(pick);
    if(window.BulaWelcome){var welcome=el('button','About '+app.name);welcome.type='button';welcome.onclick=function(){close();window.BulaWelcome.open();};actions.appendChild(welcome);}body.appendChild(actions);
    var label=el('label','Find help on this page');label.htmlFor='dg-search';body.appendChild(label);
    search=el('input');search.id='dg-search';search.type='search';search.placeholder='Search a word, feature or field';body.appendChild(search);
    list=el('div',null,'dg-list');body.appendChild(list);
    function render(){list.textContent='';var q=search.value.toLowerCase();var matches=items.filter(function(e){return (text(e)+' '+section(e)).toLowerCase().includes(q);});var page=0;
      function more(){var end=Math.min(page+40,matches.length);for(;page<end;page++){var e=matches[page],b=el('button',text(e),'dg-item');b.type='button';b.style.setProperty('--dg-sky',shades[page%shades.length]);b.appendChild(el('span',kind(e)+(section(e)?' · '+section(e):''),'dg-kind'));b.onclick=(function(target){return function(){showItem(target);};})(e);list.appendChild(b);}if(page<matches.length){var next=el('button','More topics ('+(matches.length-page)+')');next.type='button';next.onclick=function(){next.remove();more();};list.appendChild(next);}}
      if(!matches.length)list.appendChild(el('p','No matching items on this screen. Try a different word or use Explain anything.'));else more();
    }search.addEventListener('input',render);render();
  }
  function stopPicking(restore){picking=false;document.documentElement.classList.remove('dg-picking');if(banner){banner.remove();banner=null;}if(restore&&launcher)launcher.focus();}
  function startPicking(){close();picking=true;document.documentElement.classList.add('dg-picking');banner=el('div','Tap something for help.','');banner.id='dg-picker';banner.setAttribute('role','status');var cancel=el('button','Cancel');cancel.type='button';cancel.onclick=function(){stopPicking(true);};banner.appendChild(cancel);document.body.appendChild(banner);cancel.focus();}
  function init(){
    try{var sheet=new CSSStyleSheet();sheet.replaceSync(css);document.adoptedStyleSheets=document.adoptedStyleSheets.concat([sheet]);}catch(err){var style=el('style',css);document.head.appendChild(style);}
    dialog=el('dialog');dialog.id='dg-dialog';dialog.setAttribute('aria-labelledby','dg-title');dialog.addEventListener('close',function(){if(opener&&opener.isConnected)opener.focus({preventScroll:true});});document.body.appendChild(dialog);
    dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    launcher=el('button','?');launcher.appendChild(el('span','Help with this page'));launcher.id='dg-launcher';launcher.type='button';launcher.setAttribute('aria-label','Help with this page');launcher.setAttribute('aria-haspopup','dialog');launcher.onclick=showPage;document.body.appendChild(launcher);
    document.addEventListener('click',function(e){if(!picking||e.target.closest('#dg-picker'))return;var target=e.target.closest(selector)||e.target;if(!visible(target))return;e.preventDefault();e.stopImmediatePropagation();showItem(target);},true);
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&picking){e.preventDefault();stopPicking(true);}},true);
    // Existing app pop-ups keep their interactions; only their surface palette changes.
    var popupSelector='[role="dialog"],[role="alertdialog"],[role="tooltip"],[role="menu"],[role="listbox"],dialog,.bs-tip,.bw-card,.mapboxgl-popup-content,.maplibregl-popup-content';
    function paint(root){if(root.nodeType!==1)return;var nodes=[];if(root.matches(popupSelector))nodes.push(root);nodes.push.apply(nodes,root.querySelectorAll(popupSelector));nodes.forEach(function(p){if(p.id==='dg-dialog'||p.hasAttribute('data-dg-popup'))return;p.setAttribute('data-dg-popup','');p.style.setProperty('--dg-sky',shade(p.getAttribute('aria-label')||text(p).slice(0,80)||p.className));});}
    paint(document.body);new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(paint);});if(!launcher.isConnected)document.body.appendChild(launcher);if(!dialog.isConnected)document.body.appendChild(dialog);}).observe(document.body,{childList:true,subtree:true});
  }
  window.DimauGuidance={open:showPage,explain:showItem,version:'2026-09-24'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
