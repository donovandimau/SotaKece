(() => {
  'use strict';
  if (typeof window === 'undefined' || window.DimauSessionMessages) return;
const sessionLineIndexes = new Map();
  function nextSessionLine(bucket, lines, appName) {
    const key = 'dimau.session-lines.v1.' + appName + '.' + bucket;
    let index = sessionLineIndexes.get(key) || 0;
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null && /^\d+$/.test(stored)) index = Number(stored) || 0;
    } catch (_) {}
    const next = (index + 1) % lines.length;
    sessionLineIndexes.set(key, next);
    try { localStorage.setItem(key, String(next)); } catch (_) {}
    return lines[index % lines.length];
  }
  function playfulFarewell(appName, hour = new Date().getHours()) {
    const lines = [
      'Logged out. Off to do some “real work”, supposedly. 🌿',
      'Session closed. Try not to accidentally break anything on the way out. 🚶',
      'Signed out. Here’s hoping your dignity survived that last meeting. 💀',
      appName + ' promises not to gossip while you’re gone. 🤐',
      'Session ended. Have fun wasting the company’s money. 👀',
      'Out for now. I’ll be here scratching my head until you come back. 🔋'
    ];
    if (hour < 5) lines.push('It’s past midnight. Are we going to pretend to do some real work now? 🌙');
    if (hour < 5 || hour >= 22) {
      lines.push('Logging out late. Go to sleep before your eyes start looking like you drank grog all night. 🛌');
      return nextSessionLine(hour < 5 ? 'after-midnight' : 'evening', lines, appName);
    }
    return nextSessionLine('day', lines, appName);
  }
  function lateWelcome(appName, hour = new Date().getHours()) {
    if (hour >= 5 && hour < 22) return '';
    return nextSessionLine('late-arrival', ['', 'Signed in late. Brave of you to trust your judgment at this hour. 🫠'], appName);
  }
async function confirmAccountExit(title, name, detail) {
  if (document.querySelector('[data-account-exit]')) return false;
  const first = typeof name === 'string' && !name.includes('@') && name.trim().split(/\s+/)[0];
  const farewell = 'Take care' + (first ? ', ' + first : '') + '. Enjoy the rest of your day.';
  const dialog = document.createElement('dialog');
  if (!dialog.showModal) return window.confirm([title, farewell, detail].filter(Boolean).join('\n\n'));
  dialog.dataset.accountExit = '';
  dialog.setAttribute('aria-labelledby', 'account-exit-heading');
  dialog.setAttribute('aria-describedby', 'account-exit-message');
  dialog.style.cssText = 'box-sizing:border-box;width:min(25rem,90vw);padding:1.5rem;border:1px solid #839ba6;border-radius:1rem;background:white;color:#18323c;box-shadow:0 1rem 3rem #17374344;font:1rem/1.5 system-ui';
  const heading = document.createElement('h2');
  heading.id = 'account-exit-heading';
  heading.textContent = title;
  const message = document.createElement('p');
  message.id = 'account-exit-message';
  message.style.whiteSpace = 'pre-line';
  message.textContent = detail ? farewell + '\n\n' + detail : farewell;
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:.65rem;flex-wrap:wrap';
  const cancel = document.createElement('button');
  const leave = document.createElement('button');
  cancel.textContent = 'Cancel';
  leave.textContent = 'Sign out';
  for (const button of [cancel, leave]) {
    button.type = 'button';
    button.style.cssText = 'flex:1;min-height:44px;padding:.5rem;border-radius:.6rem;border:1px solid #526b75;background:white;color:#18323c;font:inherit';
  }
  leave.style.background = '#15556b';
  leave.style.color = 'white';
  actions.append(cancel, leave);
  dialog.append(heading, message, actions);
  document.body.append(dialog);
  return new Promise(resolve => {
    function finish(confirmed) { dialog.close(); dialog.remove(); resolve(confirmed); }
    cancel.onclick = () => finish(false);
    leave.onclick = () => finish(true);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    cancel.autofocus = true;
    dialog.showModal();
    cancel.focus();
  });
}
  function show(text) {
    document.querySelector('[data-session-message]')?.remove();
    const note = document.createElement('div');
    note.dataset.sessionMessage = '';
    note.setAttribute('role','status');
    note.style.cssText = 'position:fixed;inset:auto auto max(1rem,env(safe-area-inset-bottom)) 50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 2rem);box-sizing:border-box;z-index:2147483646;padding:.8rem 1rem;border-radius:.75rem;background:#153c49;color:white;font:1rem/1.5 system-ui;pointer-events:none';
    document.body.appendChild(note);
    note.textContent = text;
    setTimeout(() => note.remove(), 9000);
  }
  const key = 'dimau.exit-notice.v1';
  function signedOut(app, willNavigate = false) {
    const text = playfulFarewell(app);
    if (willNavigate) {
      try { sessionStorage.setItem(key, JSON.stringify({text, time:Date.now()})); } catch (_) { show(text); }
    } else show(text);
  }
  function restore() {
    try {
      const notice = JSON.parse(sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
      if (notice && typeof notice.text === 'string' && Date.now() - notice.time < 30000) show(notice.text);
    } catch (_) {}
  }
  window.DimauSessionMessages = {confirmAccountExit, playfulFarewell, lateWelcome, signedOut, show};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore, {once:true});
  else restore();
})();
window.confirmSotaSignOut = async function(client, app) {
  if (!await window.DimauSessionMessages.confirmAccountExit('Sign out of ' + app + '?')) return;
  if (!client) { window.DimauSessionMessages.show('Account sign-out is unavailable. Please reload and try again.'); return; }
  const result = await client.auth.signOut();
  if (result.error) { window.DimauSessionMessages.show('Sign-out could not be confirmed. Please try again.'); return; }
  window.DimauSessionMessages.signedOut(app, true);
  location.reload();
};
