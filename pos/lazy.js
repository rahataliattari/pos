// Universal POS — loads big, rarely-needed modules only when needed.
// Super Admin code (superadmin.js + contact-admin.js, ~1000 lines) is fetched ONLY for platform admins; a shopkeeper's phone never gets it.
// The demo file bundles everything inline (window.POS_DEMO), so nothing is fetched there.
const LAZY = {};
function loadScript(src) {
  if (!LAZY[src]) LAZY[src] = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => ok(); s.onerror = () => { delete LAZY[src]; s.remove(); fail(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  return LAZY[src];
}
function loadAdmin() {   // resolves when the Super Admin screens are ready; rejects (offline, first time) so callers can show a message
  if (window.POS_DEMO || typeof ctAdminView === 'function') return Promise.resolve();
  return loadScript('superadmin.js').then(() => loadScript('contact-admin.js'));
}
function openSuperAdmin() {
  return loadAdmin().then(() => showSuperAdmin(), () => toast(t('offline'), 4000));
}
document.addEventListener('click', ev => { if (ev.target.closest('#btn-sa-open')) openSuperAdmin(); });
