// Universal POS — Web Push (client). Server side: supabase/schema.sql (push_subscriptions) + Edge Function push-notify.
// Loaded AFTER contact.js and BEFORE app.js. Push works only in the live build (the demo has no server).
// Android/Chrome/Edge: works even when the app is closed. iPhone: only after "Add to Home Screen" (iOS 16.4+).

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushB64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
const pushBuf = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function pushReg() { try { return await navigator.serviceWorker.ready; } catch (e) { return null; } }
async function pushStatus() {          // 'unsupported' | 'blocked' | 'on' | 'off'
  if (window.POS_DEMO || !pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await pushReg(); const sub = reg && (await reg.pushManager.getSubscription());
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}
async function pushSave(sub) {         // store/refresh the subscription on the server (it can rotate)
  const j = sub.toJSON(), sid = S.session ? S.session.shop_id : null;
  const { error } = await getSb().rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_shop: sid, p_ua: (navigator.userAgent || '').slice(0, 180) });
  if (error) throw new Error(error.message);
}
async function pushEnable() {
  if (window.POS_DEMO) { toast(t('pu_demo'), 3500); return false; }
  if (!pushSupported()) { toast(t('pu_unsupported'), 5000); return false; }
  const key = window.POS_CONFIG && POS_CONFIG.VAPID_PUBLIC; if (!key) { toast(t('pu_nokey'), 4000); return false; }
  if (!(await pingServer())) { toast(t('login_need_online'), 3500); return false; }
  try {
    if ((await Notification.requestPermission()) !== 'granted') { toast(t('pu_denied'), 4000); return false; }
    const reg = await pushReg(); if (!reg) throw new Error('service worker');
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushB64(key) });
    await pushSave(sub); await setSetting('push_on', true);
    toast(t('pu_done')); return true;
  } catch (e) { toast((e && e.message) || t('err_generic'), 5000); return false; }
}
async function pushDisable() {
  try {
    const reg = await pushReg(), sub = reg && (await reg.pushManager.getSubscription());
    if (sub) { try { await getSb().rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); } catch (e) {} await sub.unsubscribe(); }
    await setSetting('push_on', false); toast(t('pu_done_off'));
  } catch (e) { toast(t('err_generic')); }
}
async function pushRefresh() {         // after login: keep an existing subscription attached to the current user
  try {
    if (window.POS_DEMO || !pushSupported() || Notification.permission !== 'granted' || !(await getSetting('push_on', false))) return;
    const reg = await pushReg(), sub = reg && (await reg.pushManager.getSubscription()); if (sub && navigator.onLine) await pushSave(sub);
  } catch (e) {}
}
function pushNotify(action, body) {    // fire-and-forget: a failed push must never block the real action
  if (window.POS_DEMO) return;
  try { getSb().functions.invoke('push-notify', { body: { action, ...(body || {}) } }).catch(() => {}); } catch (e) {}
}
async function pushCardHtml() {        // small settings block (shop users + admin inbox)
  const st = await pushStatus();
  const txt = { on: t('pu_state_on'), off: t('pu_state_off'), blocked: t('pu_state_blocked'), unsupported: window.POS_DEMO ? t('pu_demo') : t('pu_unsupported') }[st];
  return `<div id="pu-card"><div class="muted">${t('pu_title')}: <b>${txt}</b></div>${st === 'on' ? `<button class="btn secondary block u-mt-8" data-pu="off">${ic('bell', 18)} ${t('pu_off')}</button>` : st === 'off' ? `<button class="btn block u-mt-8" data-pu="on">${ic('bell', 18)} ${t('pu_on')}</button>` : ''}</div>`;
}
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-pu]'); if (!b) return;
  if (b.dataset.pu === 'on') await pushEnable(); else await pushDisable();
  const c = $('pu-card'); if (c) c.outerHTML = await pushCardHtml();
});
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', ev => {   // user tapped a notification
  if (!ev.data || ev.data.type !== 'push-open') return;
  const d = ev.data.data || {};
  if (d.kind === 'ticket' || d.kind === 'reset') {
    if (ctIsAdmin()) loadAdmin().then(() => { SAS.tab = 'inbox'; if ($('sa').hidden) showSuperAdmin(); else saRender(); }, () => toast(t('offline'), 4000));
    else if (S.session) ctOpen();
  }
});
