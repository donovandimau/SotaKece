/* Sota Kece — Motion Wallpaper access rule.
   Free for the first 365 days of an account; after that the Creator plan unlocks it.
   Pure logic is exported for tests; the modal is browser-only.
   Note: this is the in-app check. Paid enforcement must also be checked server-side
   before any export is stored or shared, because browser code can be altered. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SotaSubscriptionGuard = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const FREE_DAYS = 365;
  const DAY = 86400000;

  function accountAgeDays(createdAt, now) {
    const start = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
    const end = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : Date.now());
    if (!Number.isFinite(start)) return null;
    return Math.max(0, Math.floor((end - start) / DAY));
  }

  /* user: { created_at, app_metadata?: { creator_plan?: boolean }, user_metadata?: {...} } */
  function checkMotionAccess(user, now) {
    if (!user) return { allowed: false, reason: 'signed-out', ageDays: null, freeDaysLeft: 0 };
    const meta = Object.assign({}, user.user_metadata || {}, user.app_metadata || {});
    const subscribed = meta.creator_plan === true || meta.plan === 'creator';
    const ageDays = accountAgeDays(user.created_at, now);
    if (ageDays === null) return { allowed: subscribed, reason: subscribed ? 'subscribed' : 'unknown-age', ageDays, freeDaysLeft: 0 };
    const freeDaysLeft = Math.max(0, FREE_DAYS - ageDays);
    if (ageDays <= FREE_DAYS) return { allowed: true, reason: 'free-year', ageDays, freeDaysLeft };
    if (subscribed) return { allowed: true, reason: 'subscribed', ageDays, freeDaysLeft: 0 };
    return { allowed: false, reason: 'upgrade-required', ageDays, freeDaysLeft: 0 };
  }

  function showUpgradeModal(opts) {
    opts = opts || {};
    const old = document.getElementById('sk-upgrade-modal');
    if (old) old.remove();
    const d = document.createElement('dialog');
    d.id = 'sk-upgrade-modal';
    d.className = 'mw-modal';
    const signedOut = opts.reason === 'signed-out';
    d.innerHTML =
      '<div class="mw-modal-card"><p class="mw-eyebrow">Motion wallpapers</p>' +
      '<h2>' + (signedOut ? 'Sign in to bring your picture to life' : 'Your free year has ended') + '</h2>' +
      '<p>' + (signedOut
        ? 'Motion wallpapers are free for your first year on Sota Kece.'
        : 'Keep making and exporting motion wallpapers with the Sota Kece Creator plan.') + '</p>' +
      '<div class="mw-modal-actions">' +
      (signedOut ? '<a class="mw-btn mw-primary" href="/">Sign in</a>'
                 : '<button type="button" class="mw-btn mw-primary" data-upgrade>Upgrade to Creator</button>') +
      '<button type="button" class="mw-btn" data-close>Not now</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
      if (e.target.closest('[data-upgrade]') && typeof opts.onUpgrade === 'function') opts.onUpgrade();
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    return d;
  }

  return { FREE_DAYS, accountAgeDays, checkMotionAccess, showUpgradeModal };
});
