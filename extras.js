// Universal POS — Extras (Stage 9): bulk udhaar reminders, low-stock / subscription alerts, install button, About screen, notification settings.
// Loaded BEFORE app.js (after billing-plus.js). Uses app.js globals at call time only.

const APP_INFO = { version: '1.9.0', build: 'Stage 9' };
const EXTT = {
  // About
  ab_btn: ['ایپ کے بارے میں', 'About the app'], ab_title: ['ایپ کے بارے میں', 'About'], ab_version: ['ورژن', 'Version'], ab_plan: ['پلان', 'Plan'],
  ab_expiry: ['سبسکرپشن کی میعاد', 'Subscription expires'], ab_device: ['ڈیوائس', 'Device'], ab_support: ['سپورٹ', 'Support'], ab_status: ['حالت', 'Status'],
  ab_pending: ['زیرِ انتظار ریکارڈ', 'Pending records'], ab_mode: ['انسٹال شدہ ایپ', 'Installed app'], ab_browser: ['براؤزر', 'Browser'], ab_demo: ['ڈیمو', 'Demo'],
  // install
  in_btn: ['ایپ انسٹال کریں', 'Install the app'], in_ios: ['iPhone/iPad: Safari میں نیچے "Share" دبائیں، پھر "Add to Home Screen" چنیں۔', 'iPhone/iPad: in Safari tap "Share", then "Add to Home Screen".'],
  in_other: ['براؤزر کے مینو (⋮) میں "Install app" یا "Add to Home screen" چنیں۔', 'In the browser menu (⋮) choose "Install app" or "Add to Home screen".'],
  in_done: ['ایپ انسٹال ہو گئی', 'App installed'],
  // notifications section
  ex_notif_sec: ['نوٹیفکیشن', 'Notifications'], ex_alerts: ['کم اسٹاک اور سبسکرپشن کی یاد دہانی', 'Low-stock and subscription reminders'],
  ex_alerts_note: ['اطلاعات ایپ کھولنے یا بل بنانے پر چیک ہوتی ہیں؛ دن میں ایک بار فون پر نوٹیفکیشن آتا ہے (اگر اوپر نوٹیفکیشن آن ہوں)۔', 'Checked when you open the app or make a bill; one phone notification per day (if notifications are on above).'],
  ex_low_title: ['کم اسٹاک', 'Low stock'], ex_low_body: ['{n} پروڈکٹس کا اسٹاک کم ہے: {names}', '{n} product(s) are low on stock: {names}'],
  ex_exp_title: ['سبسکرپشن', 'Subscription'], ex_exp_body: ['آپ کی سبسکرپشن {n} دن میں ختم ہو رہی ہے۔ تجدید کیلئے رابطہ کریں۔', 'Your subscription ends in {n} day(s). Contact us to renew.'],
  ex_exp_today: ['آپ کی سبسکرپشن آج ختم ہو رہی ہے۔ تجدید کیلئے رابطہ کریں۔', 'Your subscription ends today. Contact us to renew.'],
  ex_see: ['دیکھیں', 'View'], ex_contact: ['رابطہ کریں', 'Contact'],
  // forgot password
  fp_link: ['پاس ورڈ بھول گئے؟', 'Forgot password?'], fp_title: ['پاس ورڈ بھول گئے', 'Forgot password'],
  fp_info: ['اپنا موبائل نمبر لکھیں۔ سپورٹ ٹیم آپ کو اسی نمبر پر کال/واٹس ایپ کر کے شناخت کرے گی اور نیا عارضی پاس ورڈ دے گی۔', 'Enter your mobile number. The support team will call/WhatsApp that number to confirm it is you and give you a new temporary password.'],
  fp_name: ['آپ کا نام (اختیاری)', 'Your name (optional)'], fp_send: ['درخواست بھیجیں', 'Send request'],
  fp_ok: ['درخواست مل گئی ہے۔ سپورٹ جلد آپ سے رابطہ کرے گی۔ تب تک اسی نمبر پر فون کھلا رکھیں۔', 'Request received. Support will contact you soon. Keep your phone reachable on that number.'],
  fp_busy: ['ابھی بہت درخواستیں ہیں، کچھ دیر بعد کوشش کریں', 'Too many requests right now, try again later'],
  // bulk reminders
  br_btn: ['سب کو یاد دہانی', 'Remind all'], br_title: ['ادھار کی یاد دہانی', 'Udhaar reminders'], br_min: ['کم از کم رقم (Rs)', 'Minimum amount (Rs)'],
  br_hint: ['واٹس ایپ پر ہر کسٹمر کیلئے الگ بٹن دبائیں؛ پیغام تیار ہو کر کھلے گا، آپ "بھیجیں" دبائیں۔ (واٹس ایپ خود بخود سب کو نہیں بھیجنے دیتا۔)', 'Tap the WhatsApp button for each customer; the message opens ready and you press Send. (WhatsApp does not allow sending to everyone automatically.)'],
  br_last: ['آخری یاد دہانی', 'Last reminded'], br_none: ['کوئی کسٹمر نہیں', 'No customers'], br_nophone: ['{n} کسٹمرز کا نمبر نہیں لکھا', '{n} customer(s) have no phone number'], br_sent: ['بھیج دیا', 'Sent']
};
for (const k in EXTT) { I18N.ur[k] = EXTT[k][0]; I18N.en[k] = EXTT[k][1]; }

const EX = { prompt: null, alerts: { low: 0, names: [], days: null } };
const exStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const exIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');

// ───────── Install button ─────────
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); EX.prompt = e; if (S.session && S.tab === 'settings') renderSettings(); });
window.addEventListener('appinstalled', () => { EX.prompt = null; toast(t('in_done')); if (S.session && S.tab === 'settings') renderSettings(); });
async function exInstall() {
  if (EX.prompt) { EX.prompt.prompt(); try { await EX.prompt.userChoice; } catch (e) {} EX.prompt = null; return; }
  openModal(`<h2>${t('in_btn')}</h2><p>${exIOS() ? t('in_ios') : t('in_other')}</p><button class="btn secondary block" data-close>${t('close')}</button>`);
}
const exInstallBtn = () => (window.POS_DEMO && location.protocol === 'file:') || exStandalone() ? '' : `<button class="btn secondary block" id="btn-install" style="margin-bottom:10px">${ic('download', 18)} ${t('in_btn')}</button>`;

// ───────── About ─────────
async function exAbout() {
  const s = S.session, ph = await ctApi.phone(), wa = waNumber(ph), pend = (await pendingCount()) + (await failedCount());
  const row = (l, v) => `<div class="kv"><span>${l}</span><b style="user-select:text">${v}</b></div>`;
  const exp = s.expires_at ? new Date(s.expires_at).toLocaleDateString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'medium' }) : '—';
  openModal(`<h2>${t('ab_title')}</h2>
    <div style="text-align:center;margin:6px 0 10px"><img src="icon-192.png" alt="" width="72" height="72" style="border-radius:18px"><div><b>${t('app_name')}</b></div></div>
    <div class="card totals">
      ${row(t('ab_version'), `${APP_INFO.version} (${APP_INFO.build})`)}
      ${row(t('shop'), esc(s.shop_name || '—'))}
      ${row(t('role'), `${esc(s.user_name || '')} · ${t(s.role)}`)}
      ${window.POS_DEMO ? row(t('ab_plan'), t('ab_demo')) : `${row(t('ab_plan'), esc(s.plan_name || '—'))}${row(t('ab_expiry'), esc(exp))}`}
      ${row(t('ab_status'), `${S.online ? t('online') : t('offline')} · ${t('ab_pending')}: ${pend}`)}
      ${row(t('ab_mode'), exStandalone() ? t('yes') : t('ab_browser'))}
      ${row(t('ab_device'), `<span dir="ltr">${esc(String(S.deviceId || '').slice(0, 8))}</span>`)}
    </div>
    ${ph ? `<div class="sa-sec">${t('ab_support')}</div><div class="row" style="margin-bottom:10px"><a class="btn secondary grow lnk" href="tel:${esc(ph)}" dir="ltr">${ic('phone', 18)} ${esc(ph)}</a>${wa ? `<a class="btn secondary lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 18)}</a>` : ''}</div>` : ''}
    <button class="btn secondary block" data-close>${t('close')}</button>`);
}

// ───────── Low-stock / subscription alerts ─────────
async function exLowStock() {
  const sid = S.session.shop_id;
  const all = await db.products.where('[shop_id+name]').between([sid, ''], [sid, '￿']).filter(p => !p.deleted_at && p.is_active !== false && p.min_stock > 0).toArray();
  const st = await getStocks(sid, all.map(p => p.id));
  return all.filter(p => st[p.id] <= p.min_stock);
}
async function exLocalNotify(title, body, tag) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, icon: 'icon-192.png', badge: 'icon-192.png', tag, lang: 'ur', dir: 'auto', data: { kind: 'local' } };
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg && reg.showNotification) await reg.showNotification(title, opts); else new Notification(title, opts);
  } catch (e) {}
}
async function exCheck() {
  if (!S.session) return;
  try {
    const low = await exLowStock(), d = window.POS_DEMO ? null : syncDaysLeft();
    EX.alerts = { low: low.length, names: low.slice(0, 3).map(p => (LANG === 'ur' && p.name_ur ? p.name_ur : p.name)), days: d !== null && d <= 7 ? d : null };
    if (S.tab === 'home') renderHome();
    if (await getSetting('ex_alerts_off', false)) return;
    const today = new Date().toISOString().slice(0, 10);
    if (EX.alerts.low && (await getSetting('ex_n_low', '')) !== today) {
      await setSetting('ex_n_low', today);
      exLocalNotify(t('ex_low_title'), t('ex_low_body').replace('{n}', EX.alerts.low).replace('{names}', EX.alerts.names.join('، ')), 'low-stock');
    }
    if (EX.alerts.days !== null && (await getSetting('ex_n_exp', '')) !== today) {
      await setSetting('ex_n_exp', today);
      exLocalNotify(t('ex_exp_title'), EX.alerts.days <= 0 ? t('ex_exp_today') : t('ex_exp_body').replace('{n}', EX.alerts.days), 'sub-expiry');
    }
  } catch (e) {}
}
function exBannerHtml() {
  const a = EX.alerts, out = [];
  if (a.low) out.push(`<div class="warn" style="margin:0 0 10px;padding:8px 12px;display:flex;gap:8px;align-items:center" data-tab="${canReports() ? 'reports' : 'products'}" role="button">${ic('box', 18)}<span class="grow">${t('ex_low_body').replace('{n}', a.low).replace('{names}', esc(a.names.join('، ')))}</span><b>${t('ex_see')}</b></div>`);
  if (a.days !== null) out.push(`<div class="warn" style="margin:0 0 10px;padding:8px 12px;display:flex;gap:8px;align-items:center" id="ex-exp" role="button">${ic('clock', 18)}<span class="grow">${a.days <= 0 ? t('ex_exp_today') : t('ex_exp_body').replace('{n}', a.days)}</span><b>${t('ex_contact')}</b></div>`);
  return out.join('');
}
function exStartup() {
  exCheck();
  if (!exStartup._t) exStartup._t = setInterval(exCheck, 3 * 3600e3);
  const q = new URLSearchParams(location.search);              // opened from a push notification while the app was closed
  if (q.get('push') && !exStartup._q) { exStartup._q = true; setTimeout(() => { if (S.session) ctOpen(); }, 800); history.replaceState(null, '', location.pathname); }
}

// ───────── Settings: notification block ─────────
async function exNotifBodyHtml() {
  const off = await getSetting('ex_alerts_off', false);
  return `${typeof pushCardHtml === 'function' ? await pushCardHtml() : ''}
    <label style="margin-top:12px"><input type="checkbox" id="set-exalerts" style="width:auto;min-height:0" ${off ? '' : 'checked'}> ${t('ex_alerts')}</label>
    <div class="muted">${t('ex_alerts_note')}</div>`;
}

// ───────── Bulk udhaar reminders ─────────
const BR = { min: 0 };
async function exBulkRemind() {
  const sid = S.session.shop_id;
  const all = await db.customers.where('[shop_id+name]').between([sid, ''], [sid, '￿']).filter(c => !c.deleted_at).toArray();
  const bals = await getCustomerBalances(sid, all.map(c => c.id)), log = await getSetting('remind_log', {});
  const owing = all.filter(c => bals[c.id] > Math.max(0, BR.min)).sort((a, b) => bals[b.id] - bals[a.id]);
  const withPhone = owing.filter(c => waNumber(c.phone)), noPhone = owing.length - withPhone.length;
  const total = round2(owing.reduce((a, c) => a + bals[c.id], 0));
  openModal(`<h2>${t('br_title')}</h2>
    <div class="udcard"><div class="udic">${ic('wallet', 24)}</div><div class="grow"><div class="muted">${t('total_udhaar')}</div><div class="big">Rs ${money(total)}</div><div class="muted">${owing.length} ${t('owes_n')}</div></div></div>
    <label>${t('br_min')}</label><input id="br-min" type="number" inputmode="decimal" min="0" value="${BR.min || ''}">
    <div class="muted" style="margin:6px 0">${t('br_hint')}</div>
    ${noPhone ? `<div class="warn">${t('br_nophone').replace('{n}', noPhone)}</div>` : ''}
    <div style="margin-top:8px">${withPhone.map(c => {
      const msg = t('remind_msg').replace('{name}', c.name).replace('{shop}', S.session.shop_name || '').replace('{amt}', money(bals[c.id]));
      return `<div class="lrow"><div class="grow"><b>${esc(c.name)}</b><div class="muted" id="brl-${c.id}">${log[c.id] ? t('br_last') + ': ' + esc(fmtDate(log[c.id])) : ''}</div></div>
        <b class="owe-t">Rs ${money(bals[c.id])}</b>
        <a class="btn sm lnk" target="_blank" rel="noopener" data-ex="sent|${c.id}" href="https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(msg)}" style="margin-inline-start:8px">${ic('chat', 16)}</a></div>`; }).join('') || `<div class="muted" style="text-align:center;padding:16px">${t('br_none')}</div>`}</div>
    <div style="margin-top:10px"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}
const bulkRemindBtn = sum => (typeof canManageCustomers === 'function' && canManageCustomers() && sum.count) ? `<button class="btn secondary block" id="btn-bulkrem" style="margin-bottom:10px">${ic('chat', 18)} ${t('br_btn')} (${sum.count})</button>` : '';

// ───────── Forgot password (before login; admin-mediated, never resets by itself) ─────────
function exForgot() {
  openModal(`<h2>${t('fp_title')}</h2><p class="muted">${t('fp_info')}</p><form id="fp-form">
    <label>${t('phone')}</label><input name="phone" type="tel" inputmode="numeric" dir="ltr" required placeholder="03001234567">
    <label>${t('fp_name')}</label><input name="name" maxlength="60">
    <div class="row" style="margin-top:14px"><button class="btn grow" type="submit" id="fp-submit">${t('fp_send')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div></form>`);
}
async function exForgotSubmit(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  try { loginIdToEmail(f.phone); } catch (e) { return toast(e.message, 3500); }
  if (!(await pingServer())) return toast(t('login_need_online'), 3500);
  const btn = $('fp-submit'); btn.disabled = true;
  try {
    const { data, error } = await getSb().rpc('request_password_reset', { p_phone: f.phone, p_name: f.name || '' });
    if (error) throw new Error(/busy/.test(error.message) ? t('fp_busy') : /bad_phone/.test(error.message) ? t('bad_phone') : error.message);
    pushNotify('reset_request', { request_id: data });
    $('sheet').innerHTML = `<h2>${t('fp_title')}</h2><div class="vres" style="padding:12px">${t('fp_ok')}</div><div style="margin-top:12px"><button class="btn secondary block" data-close>${t('close')}</button></div>`;
  } catch (e) { toast(e.message || t('err_generic'), 5000); btn.disabled = false; }
}
document.addEventListener('click', ev => { if (ev.target.closest('#lnk-forgot')) { ev.preventDefault(); exForgot(); } });
document.addEventListener('submit', ev => { if (ev.target.id === 'fp-form') { ev.preventDefault(); exForgotSubmit(ev.target); } });

// ───────── Wiring ─────────
document.addEventListener('click', async ev => {
  const el = ev.target;
  if (el.closest('#btn-install')) return exInstall();
  if (el.closest('#btn-about')) return exAbout();
  if (el.closest('#btn-bulkrem')) return exBulkRemind();
  if (el.closest('#ex-exp')) return ctOpen();
  const s = el.closest('[data-ex]');
  if (s) { const [a, id] = s.dataset.ex.split('|'); if (a === 'sent') { const log = await getSetting('remind_log', {}); log[id] = new Date().toISOString(); await setSetting('remind_log', log); const l = $('brl-' + id); if (l) l.textContent = t('br_sent') + ' ✓'; } }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'br-min') { clearTimeout(exBulkRemind._t); exBulkRemind._t = setTimeout(() => { BR.min = num(ev.target.value); exBulkRemind(); setTimeout(() => { const i = $('br-min'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 500); }
});
document.addEventListener('change', async ev => { if (ev.target.id === 'set-exalerts') { await setSetting('ex_alerts_off', !ev.target.checked); if (ev.target.checked) exCheck(); } });
