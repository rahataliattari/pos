// Universal POS — app logic (Stage 2: offline billing MVP).
// The UI reads/writes ONLY the local database. Network is used for login and the connectivity check.
// Sync engine: sync.js (Stage 3).

const S = {
  session: null,          // { user_id, email, shop_id, shop_name, role }
  cfg: { tax_rate: 0, cashier_discount: false, cashier_price: false, receipt_header: '', receipt_footer: '', shop_phone: '', shop_address: '', shop_tax_no: '', business_type: '', paper: 58, print_w: 0, print_color: false, receipt_style: 'premium', receipt_qr: true, allow_oversell: false, lang: 'en', theme: 'green' },
  cart: [],
  tab: 'home',
  billQuery: '', billPage: 0, tiles: [], tileStocks: {},
  online: false,
  productPage: 0, productQuery: '',
  salesPage: 0,
  custPage: 0, custQuery: '', saleCust: null,
  purSeg: 'list', purPage: 0, supPage: 0, supQuery: '', pur: null,   // purchases screen + draft purchase
    // customers list + customer chosen for the current bill
  sb: null,               // supabase client
  isAdmin: false
};

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = iso => { try { return new Date(iso).toLocaleString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }); } catch (e) { return iso; } };
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

function toast(msg, ms = 2500) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, ms);
}
function openModal(html) { $('sheet').innerHTML = html; $('modal').hidden = false; }
function closeModal() { stopScan(); S.setSheet = null; $('modal').hidden = true; $('sheet').innerHTML = ''; }

// ───────── Permissions ─────────
const isOwner = () => S.session && S.session.role === 'owner';
const canEditProducts = () => S.session && ['owner', 'manager'].includes(S.session.role);
const canDiscount = () => S.session && (S.session.role !== 'cashier' || S.cfg.cashier_discount);
const canPrice = () => S.session && (S.session.role !== 'cashier' || S.cfg.cashier_price);

// ───────── Connectivity: real server check, not just navigator.onLine ─────────
async function pingServer() {
  if (window.POS_DEMO || !navigator.onLine) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(`${POS_CONFIG.SUPABASE_URL}/rest/v1/rpc/ping`, {
      method: 'POST', cache: 'no-store', signal: ctl.signal,
      headers: { apikey: POS_CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}'
    });
    return r.ok;
  } catch (e) { return false; } finally { clearTimeout(timer); }
}
async function refreshStatus() {
  S.online = await pingServer();
  $('net-dot').classList.toggle('on', S.online);
  $('net-text').textContent = S.online ? t('online') : t('offline');
  if (!S.session) return;
  const p = await pendingCount(), f = await failedCount();
  $('chip-pend').hidden = !p; $('chip-pend').textContent = `${t('pending')}: ${p}`;
  $('chip-fail').hidden = !f; $('chip-fail').innerHTML = `${ic('x', 12)} ${f}`;
}

// ───────── Config (settings values; the Settings screen itself is in settings.js) ─────────
async function loadCfg() {
  for (const k of Object.keys(S.cfg)) S.cfg[k] = await getSetting('cfg_' + k, S.cfg[k]);
  setLang(S.cfg.lang);
  applyTheme();
}
const THEMES = { green: ['#0f7b3f', '#1f9d55'], orange: ['#f4510b', '#ff7a3d'], royal: ['#1d3fb8', '#4a74ee'], gold: ['#2f3445', '#b8892b'] };
const themeName = k => t('theme_' + (THEMES[k] ? k : 'green'));
function applyTheme() {
  const th = THEMES[S.cfg.theme] ? S.cfg.theme : 'green';
  document.documentElement.dataset.theme = th;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = THEMES[th][0];
}
async function saveCfg(k, v) { S.cfg[k] = v; await setSetting('cfg_' + k, v); }

// ───────── Boot ─────────
async function boot() {
  if (typeof Dexie === 'undefined' || typeof db === 'undefined') {
    $('boot').textContent = I18N.ur.lib_missing + ' / ' + I18N.en.lib_missing;
    return;
  }
  try { await db.open(); } catch (e) { $('boot').textContent = 'Database error: ' + e.message; return; }
  if (window.POS_DEMO_INIT) await window.POS_DEMO_INIT();   // demo build only (see demo/)
  if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch (e) {} }
  await loadCfg();
  S.deviceId = await getDeviceId();
  S.session = await getSetting('session');
  $('boot').hidden = true;
  if (S.session) await showApp(); else { showLogin(); restoreAdmin(); }
  if (window.POS_DEMO && location.hash === '#superadmin' && S.session) openSuperAdmin();
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);
  setInterval(refreshStatus, 20000);
  if ('serviceWorker' in navigator && !window.POS_DEMO) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ───────── Login ─────────
// Login is by MOBILE NUMBER ONLY (03xx..., +92 3xx..., 923xx...). Supabase Auth needs an e-mail-shaped id internally, so the number is
// turned into a hidden technical id <92number>@LOGIN_DOMAIN; nobody ever types or sees an e-mail. Anything with '@' is rejected.
function loginIdToEmail(v) {
  v = (v || '').trim();
  v = v.replace(/[\u0660-\u0669]/g, c => c.charCodeAt(0) - 0x660).replace(/[\u06F0-\u06F9]/g, c => c.charCodeAt(0) - 0x6F0);   // Urdu / Arabic digits -> 0-9
  if (v.includes('@')) throw new Error(t('bad_phone'));
  let d = v.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d;
  if (!/^923\d{9}$/.test(d)) throw new Error(t('bad_phone'));
  return `${d}@${POS_CONFIG.LOGIN_DOMAIN}`;
}
const EYE = shown => ic(shown ? 'eyeoff' : 'eye', 22);
function pwField(id, ph, style = '') {          // password input with a show/hide eye button
  return `<div class="pwwrap" ${style ? `style="${style}"` : ''}><input id="${id}" type="password" placeholder="${ph}" autocapitalize="none" autocorrect="off" spellcheck="false"><button type="button" class="eye" data-eye="${id}" aria-label="${t('pw_toggle')}" aria-pressed="false">${EYE(false)}</button></div>`;
}
function initEyes() { document.querySelectorAll('button.eye[data-eye]:empty').forEach(b => { b.innerHTML = EYE(false); }); }
document.addEventListener('click', ev => {
  const b = ev.target.closest('button.eye[data-eye]'); if (!b) return;
  const inp = document.getElementById(b.dataset.eye); if (!inp) return;
  const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = EYE(show); b.setAttribute('aria-pressed', show ? 'true' : 'false');
});
// Language button on the login page (works before sign-in; the choice is remembered like the one in Settings)
document.addEventListener('click', async ev => {
  if (!ev.target.closest || !ev.target.closest('#login-lang')) return;
  const l = LANG === 'ur' ? 'en' : 'ur';
  S.cfg.lang = l; try { await setSetting('cfg_lang', l); } catch (e) { /* remembered next time */ }
  setLang(l); applyStaticText(); const er = $('login-err'); if (er) er.hidden = true;
});
const homeHello = () => (S.session && S.session.user_name) || t('greeting');   // Home header: the signed-in person's name
// Shows the login id as the mobile number (0300…), never the technical e-mail form.
const displayLogin = e => { const m = /^(\d+)@/.exec(String(e || '')); return m ? (m[1].startsWith('92') ? '0' + m[1].slice(2) : m[1]) : String(e || '').split('@')[0]; };

function applyStaticText() {
  $('login-title').textContent = t('app_name');
  $('lbl-email').textContent = t('phone'); $('lbl-pass').textContent = t('password');
  $('btn-login').textContent = t('login');
  const lf = $('lnk-forgot'); if (lf) lf.textContent = t('fp_link');
  if (typeof signupLoginHook === 'function') signupLoginHook();
  const lt = $('login-tag'); if (lt) lt.textContent = t('login_tag');
  const tr = $('login-trust'); if (tr) tr.innerHTML = ['login_t1', 'login_t2', 'login_t3'].map(k => `<span>${t(k)}</span>`).join('');
  const ll = $('login-lang'); if (ll) { ll.textContent = LANG === 'ur' ? 'English' : 'اردو'; ll.lang = LANG === 'ur' ? 'en' : 'ur'; }
  document.querySelectorAll('button.eye').forEach(b => b.setAttribute('aria-label', t('pw_toggle')));
  $('syncnote').textContent = (typeof saAnnouncement === 'function' && saAnnouncement()) || t('sync_note');
  $('btn-lang').textContent = LANG === 'ur' ? 'EN' : 'اردو';
  $('hdr-avatar').innerHTML = avatarHtml(24);
  $('nav').innerHTML = [['home', 'tab_home', 'home'], ['products', 'tab_inventory', 'box'], ['bill', 'tab_sale', 'cart'], ['sales', 'tab_sales', 'receipt'], ['settings', 'tab_more', 'settings']]
    .map(([k, l, icon]) => `<button data-tab="${k}" class="${k === 'bill' ? 'fab ' : ''}${S.tab === k ? 'active' : ''}"><span class="ico">${ic(icon, k === 'bill' ? 28 : 22)}</span><span>${t(l)}</span></button>`).join('');
  if (typeof ctPaint === 'function') ctPaint();
}
function showLogin() { S.avatar = ''; $('app').hidden = true; $('login').hidden = false; applyStaticText(); const ip = $('in-pass'); if (ip) ip.type = 'password'; initEyes();
  const eb = document.querySelector('#login .eye'); if (eb) { eb.innerHTML = EYE(false); eb.setAttribute('aria-pressed', 'false'); } }

function getSb() {
  if (!S.sb) {
    if (typeof supabase === 'undefined') throw new Error(t('lib_missing'));
    // Every request tells the server which device it comes from (inside X-Client-Info, which Supabase's CORS already allows).
    const devFetch = (url, opts = {}) => {
      const h = new Headers(opts.headers || {});
      if (S.deviceId) h.set('X-Client-Info', (h.get('X-Client-Info') || 'supabase-js') + ' dev:' + S.deviceId);
      return fetch(url, { ...opts, headers: h });
    };
    S.sb = supabase.createClient(POS_CONFIG.SUPABASE_URL, POS_CONFIG.SUPABASE_KEY, { global: { fetch: devFetch } });
  }
  return S.sb;
}

async function doLogin(e) {
  e.preventDefault();
  if ($('btn-login').disabled) return;                  // already signing in: ignore extra taps
  const err = $('login-err'); err.hidden = true;
  let loginEmail;
  try { loginEmail = loginIdToEmail($('in-email').value); } catch (ex) { err.textContent = ex.message; err.hidden = false; return; }
  $('btn-login').disabled = true; $('btn-login').textContent = '…';       // instant feedback while the server is checked
  if (!(await pingServer())) { err.textContent = t('login_need_online'); err.hidden = false; $('btn-login').disabled = false; $('btn-login').textContent = t('login'); return; }
  try {
    const sb = getSb();
    const pw = $('in-pass').value;
    let { data, error } = await sb.auth.signInWithPassword({ email: loginEmail, password: pw });
    // pasted passwords often carry a stray space / invisible character: try once more without it
    const clean = pw.replace(/[\s\u200b-\u200f\u202a-\u202e\ufeff]/g, '');
    if (error && clean && clean !== pw) ({ data, error } = await sb.auth.signInWithPassword({ email: loginEmail, password: clean }));
    if (error) {
      const m = String(error.message || '');
      throw new Error(/invalid login credentials/i.test(m) ? t('login_failed') : t('login_failed') + ' (' + m + ')');
    }
    const user = data.user;
    // Membership is decided by the SERVER (RLS), never by the client.
    let isAdm = false;
    try { isAdm = (await sb.rpc('is_platform_admin')).data === true; } catch (x) {}
    const { data: all, error: e2 } = await sb.from('shop_members').select('shop_id, role, active, name, shops(name, suspended, archived, expires_at, approval)').eq('user_id', user.id);
    if (e2) throw new Error(e2.message);
    if (isAdm && (!all || !all.length)) return enterAdminOnly();
    if (!all || !all.length) throw new Error(t('no_shop'));
    // blocked shops (suspended / archived / expired) and deactivated members can't log in; Super Admin is never blocked
    const okShop = r => r.active !== false && r.shops && !r.shops.suspended && !r.shops.archived && (r.shops.approval || 'approved') === 'approved' && new Date(r.shops.expires_at).getTime() >= Date.now();
    const rows = isAdm ? all : all.filter(okShop);
    if (!rows.length) {
      try { await sb.auth.signOut(); } catch (x) {}
      const ap = all.map(r => r.shops && r.shops.approval);   // a sign-up still waiting / refused gets its own message
      throw new Error(ap.includes('pending') ? t('su_pending_login') : ap.includes('rejected') ? t('su_rejected_login') : t('sa_shop_blocked'));
    }
    const make = r => ({ user_id: user.id, email: user.email, shop_id: r.shop_id, shop_name: (r.shops && r.shops.name) || '', user_name: r.name || '', role: r.role, admin: isAdm, expires_at: r.shops && r.shops.expires_at });
    if (rows.length === 1) return await finishLogin(make(rows[0]));
    $('login-form').hidden = true;
    const box = $('shop-choice'); box.hidden = false;
    box.innerHTML = `<h3>${t('choose_shop')}</h3>` + rows.map((r, i) =>
      `<button class="btn secondary block u-mb-8"  data-shop="${i}">${esc(r.shops && r.shops.name)} (${t(r.role)})</button>`).join('');
    box.onclick = ev => { const b = ev.target.closest('[data-shop]'); if (b) finishLogin(make(rows[+b.dataset.shop])); };
  } catch (ex) { err.textContent = ex.message || t('err_generic'); err.hidden = false; }
  finally { $('btn-login').disabled = false; $('btn-login').textContent = t('login'); }
}
function enterAdminOnly() {   // platform admin with no shop of their own: straight to Super Admin
  S.isAdmin = true; $('login').hidden = true; $('login-form').hidden = false; $('shop-choice').hidden = true; $('in-pass').value = '';
  return openSuperAdmin();
}
async function restoreAdmin() {   // page reload: Supabase keeps the auth session, so no need to log in again
  if (window.POS_DEMO || !navigator.onLine || typeof supabase === 'undefined') return;
  try {
    const sb = getSb(); const { data } = await sb.auth.getSession(); if (!data.session) return;
    if ((await sb.rpc('is_platform_admin')).data === true) enterAdminOnly();
  } catch (e) {}
}
async function finishLogin(session) {
  if (!window.POS_DEMO && !session.admin) {         // one ID = the number of devices its plan allows
    try { await deviceRegister(getSb(), session); }
    catch (e) {
      try { await getSb().auth.signOut(); } catch (x) {}
      $('login-form').hidden = false; $('shop-choice').hidden = true; showLogin();
      const el = $('login-err'); el.textContent = e.message || t('err_generic'); el.hidden = false;
      return;
    }
  }
  await setSetting('session', session);
  await setSetting('shop_id', session.shop_id);
  S.session = session;
  if (!window.POS_DEMO && S.sb && navigator.onLine) { try { await syncCheckExpiry(S.sb, session.shop_id); } catch (e) {} }   // learn the plan features (bill QR) right away
  $('login-form').hidden = false; $('shop-choice').hidden = true; $('in-pass').value = '';
  await showApp();
}
async function doLogout() {
  if (window.POS_DEMO) { if (confirm(t('logout_confirm'))) window.POS_DEMO_RESET(); return; }
  if (!confirm(t('logout_confirm'))) return;
  if (typeof syncRun === 'function' && navigator.onLine) { toast(t('sync_running'), 6000); try { await syncRun(); } catch (e) {} }
  const left = (await pendingCount()) + (await failedCount());
  if (left && !confirm(t('logout_unsynced').replace('{n}', left))) return;
  try { if (S.sb) await S.sb.auth.signOut(); } catch (e) {}
  // Local business data is kept on purpose: pending records must never be deleted before server confirmation.
  await delSetting('session'); await delSetting('shop_id');
  S.session = null; S.cart = []; S.saleCust = null; S.pur = null;
  showLogin();
}

// ───────── App shell ─────────
async function showApp() {
  $('login').hidden = true; $('app').hidden = false;
  if (typeof subTick === 'function') { subTick(); await setSetting('session', S.session); if (subState().state !== 'ok') toast(syncExpiryText(), 7000); }
  await avatarLoad();
  if (typeof actLog === 'function') { actLog('s', 'open'); actFlush(); }
  $('hdr-shop').textContent = S.session.shop_name || t('app_name');
  applyStaticText();
  const draft = await getSetting('cart_draft', []);
  if (Array.isArray(draft) && !S.cart.length) S.cart = draft;
  renderBillShell(); renderCart();
  switchTab(S.tab);
  refreshStatus();
  if (typeof syncStart === 'function') syncStart();
  if (typeof bpLoad === 'function') bpLoad().then(() => { if (S.tab === 'bill') renderBillShell(); }).catch(() => {});
  if (typeof pushRefresh === 'function') pushRefresh();
  if (typeof exStartup === 'function') exStartup();
  if (typeof catalogFirstRun === 'function') catalogFirstRun().catch(() => {});
  if (!window.POS_DEMO && navigator.onLine) saLoadAnnouncement().catch(() => {});
  termsGate().catch(() => {});                       // first login: accept the agreement / terms / privacy / refund policy
  if (showApp._timer) return;
  showApp._timer = setInterval(async () => { if (S.session) { const p = await pendingCount(), f = await failedCount();
    $('chip-pend').hidden = !p; $('chip-pend').textContent = `${t('pending')}: ${p}`;
    $('chip-fail').hidden = !f; $('chip-fail').innerHTML = `${ic('x', 12)} ${f}`; } }, 5000);
}

const TAB_TITLE = { home: null, bill: 'tab_bill', products: 'tab_products', sales: 'tab_sales', customers: 'customers', purchases: 'mod_purchases', expenses: 'mod_expenses', reports: 'mod_reports', settings: 'tab_settings' };
const VIEWS = ['home', 'bill', 'products', 'sales', 'customers', 'purchases', 'expenses', 'reports', 'settings'];
function switchTab(tab) {
  const FEAT = { customers: 'customers', purchases: 'purchases', expenses: 'expenses', reports: 'reports' };
  if (FEAT[tab] && typeof planAllows === 'function' && !planAllows(FEAT[tab])) return toast(t('feat_off'), 4000);
  if (tab === 'purchases' && !canPurchase()) return toast(t('owner_mgr_only'), 3000);
  if (typeof actLog === 'function') actLog('s', 'tab:' + tab);
  if ((tab === 'expenses' || tab === 'reports') && !canReports()) return toast(t('owner_mgr_only'), 3000);
  S.tab = tab;
  for (const k of VIEWS) $('view-' + k).hidden = k !== tab;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('hdr-hello').textContent = TAB_TITLE[tab] ? t(TAB_TITLE[tab]) : homeHello();
  if (tab === 'home') renderHome();
  if (tab === 'bill') loadTiles();
  if (tab === 'products') { S.productPage = 0; renderProducts(); }
  if (tab === 'sales') { S.salesPage = 0; renderSales(); }
  if (tab === 'customers') { S.custPage = 0; renderCustomers(); }
  if (tab === 'purchases') { S.purPage = 0; S.supPage = 0; renderPurchases(); }
  if (tab === 'expenses') renderExpenses();
  if (tab === 'reports') renderReports();
  if (tab === 'settings') renderSettings();
  renderBillBar();
  $('view-' + tab).scrollIntoView && document.querySelector('main').scrollTo(0, 0);
}

async function toggleLang() {
  await saveCfg('lang', LANG === 'ur' ? 'en' : 'ur');
  setLang(S.cfg.lang); applyStaticText();
  renderBillShell(); switchTab(S.tab);
}



onUI('click', 10, ev => {
  const el = ev.target;
  const tab = el.closest('[data-tab]'); if (tab) { switchTab(tab.dataset.tab); return true; }
  if (el.closest('[data-close]')) { closeModal(); return true; }
  if (el === $('modal')) { closeModal(); return true; }
});

onUI('click', 65, ev => {
  const el = ev.target;
  if (el.closest('#btn-lang')) { toggleLang(); return true; }
  if (el.closest('#btn-logout')) { doLogout(); return true; }
});


// ───────── Forgot password (before login; admin-mediated, never resets by itself) ─────────
function exForgot() {
  openModal(`<h2>${t('fp_title')}</h2><p class="muted">${t('fp_info')}</p><form id="fp-form">
    <label>${t('phone')}</label><input name="phone" type="tel" inputmode="numeric" dir="ltr" required placeholder="03001234567">
    <label>${t('fp_name')}</label><input name="name" maxlength="60">
    <div class="row u-mt-14"><button class="btn grow" type="submit" id="fp-submit">${t('fp_send')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div></form>`);
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
    $('sheet').innerHTML = `<h2>${t('fp_title')}</h2><div class="vres u-p-12">${t('fp_ok')}</div><div class="u-mt-12"><button class="btn secondary block" data-close>${t('close')}</button></div>`;
  } catch (e) { toast(e.message || t('err_generic'), 5000); btn.disabled = false; }
}
document.addEventListener('click', ev => { if (ev.target.closest('#lnk-forgot')) { ev.preventDefault(); exForgot(); } });
document.addEventListener('submit', ev => { if (ev.target.id === 'fp-form') { ev.preventDefault(); exForgotSubmit(ev.target); } });

$('login-form').addEventListener('submit', doLogin);

boot();


document.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.matches && ev.target.matches('a[role="button"], #pcard-open')) { ev.preventDefault(); ev.target.click(); } });
