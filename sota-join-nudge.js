/* Keep the join action on the existing account button so every entry point is counted once. */
(function () {
  'use strict';
  document.addEventListener('click', function (event) {
    if (!event.target.closest || !event.target.closest('#sk-sign-up')) return;
    try {
      if (window.SKEvent) window.SKEvent('cta_click', { cta: 'join' });
      else if (window.dimau && window.dimau.track) window.dimau.track('cta_click', { cta: 'join' });
    } catch (_) {}
  }, true);
})();
