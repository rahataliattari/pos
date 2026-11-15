// Universal POS — app logic (Stage 2: offline billing MVP).
// The UI reads/writes ONLY the local database. Network is used for login and the connectivity check.
// Sync engine: sync.js (Stage 3).

const S = {
  session: null,          // { user_id, email, shop_id, shop_name, role }
  cfg: { tax_rate: 0, cashier_discount: false, cashier_price: false, receipt_header: '', receipt_footer: '', shop_phone: '', shop_address: '', shop_tax_no: '', business_type: '', paper: 58, receipt_qr: true, allow_oversell: false, lang: 'en', theme: 'green' },
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
// Billing helpers (Stage 9): per-line % discount, sale discount in Rs or %, payment methods (single or split)
const PAY_METHODS = ['cash', 'jazz', 'easy', 'card', 'bank'];
const lineTotal = l => { const k = 1 - clampPct(l.disc) / 100; return l.amount != null ? Math.round(l.amount * k * 100) / 100 : Math.round(l.qty * linePrice(l) * 100) / 100; };
const isKg = l => /^(kg|kgs|kilo|کلو)/i.test(String(l.unit_name || l.unit || '').trim());
const isLitre = l => /^(l|ltr|litre|liter|لٹر)$/i.test(String(l.unit_name || l.unit || '').trim());
const clampPct = v => Math.min(100, Math.max(0, num(v)));
const linePrice = l => Math.round(l.unit_price * (1 - clampPct(l.disc) / 100) * 100) / 100;     // price after the line's % discount
const splitSum = () => Math.round(PAY_METHODS.reduce((a, k) => a + num((S.splitAmt || {})[k]), 0) * 100) / 100;
function saleDiscountFor(subtotal) {
  const raw = S.discMode === 'pct' ? subtotal * clampPct(S.discPct) / 100 : num(S.discount);
  return Math.min(Math.max(raw, 0), subtotal);
}
function billResetState() {
  S.cart = []; S.discount = 0; S.discPct = 0; S.discMode = 'rs'; S.paid = 0; S.paidManual = false; S.saleCust = null;
  S.paySplit = false; S.splitAmt = {}; S.payMethod = 'cash'; S.editing = null;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = iso => { try { return new Date(iso).toLocaleString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }); } catch (e) { return iso; } };
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

function toast(msg, ms = 2500) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, ms);
}
function openModal(html) { $('sheet').innerHTML = html; $('modal').hidden = false; }
function closeModal() { stopScan(); $('modal').hidden = true; $('sheet').innerHTML = ''; }

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

// ───────── Settings ─────────
async function loadCfg() {
  for (const k of Object.keys(S.cfg)) S.cfg[k] = await getSetting('cfg_' + k, S.cfg[k]);
  setLang(S.cfg.lang);
  applyTheme();
}
function applyTheme() {
  const th = S.cfg.theme === 'orange' ? 'orange' : 'green';
  document.documentElement.dataset.theme = th;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = th === 'orange' ? '#f4510b' : '#0f7b3f';
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
  if (window.POS_DEMO && location.hash === '#superadmin' && S.session) showSuperAdmin();
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
      `<button class="btn secondary block" style="margin-bottom:8px" data-shop="${i}">${esc(r.shops && r.shops.name)} (${t(r.role)})</button>`).join('');
    box.onclick = ev => { const b = ev.target.closest('[data-shop]'); if (b) finishLogin(make(rows[+b.dataset.shop])); };
  } catch (ex) { err.textContent = ex.message || t('err_generic'); err.hidden = false; }
  finally { $('btn-login').disabled = false; $('btn-login').textContent = t('login'); }
}
function enterAdminOnly() {   // platform admin with no shop of their own: straight to Super Admin
  S.isAdmin = true; $('login').hidden = true; $('login-form').hidden = false; $('shop-choice').hidden = true; $('in-pass').value = '';
  return showSuperAdmin();
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
  await avatarLoad();
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

// ───────── Home ─────────
async function renderHome() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const sum = await salesSummary(S.session.shop_id, start.toISOString(), end.toISOString());
  const cs = await creditSummary(S.session.shop_id);
  const ps = canPurchase() ? await payableSummary(S.session.shop_id) : { suppliers: 0 };
  const allMods = [
    { tab: 'bill', ic: 'cart', l: 'tab_bill' }, { tab: 'products', ic: 'box', l: 'tab_products' },
    { tab: 'sales', ic: 'receipt', l: 'tab_sales' }, { tab: 'customers', ic: 'users', l: 'mod_customers' },
    { tab: 'expenses', ic: 'wallet', l: 'mod_expenses' }, { tab: 'purchases', ic: 'truck', l: 'mod_purchases' },
    { tab: 'reports', ic: 'chart', l: 'mod_reports' }, { tab: 'settings', ic: 'settings', l: 'tab_settings' }
  ];
  const dateStr = new Date().toLocaleDateString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'full' });
  const demoBanner = typeof demoBannerHtml === 'function' ? await demoBannerHtml() : '';
  const mods = allMods.filter(m => typeof planAllows !== 'function' || !['customers', 'purchases', 'expenses', 'reports'].includes(m.tab) || planAllows(m.tab));
  $('view-home').innerHTML = `${demoBanner}
    <div class="today"><div class="cal">${ic('calendar', 24)}</div>
      <div class="grow"><div class="muted">${esc(dateStr)}</div>
        <div class="big">Rs ${money(sum.total)}</div>
        <div class="muted">${t('today_sales')} · ${sum.count} ${t('bills_n')}</div></div></div>
    ${cs.customers ? `<div class="udcard" data-tab="customers" style="cursor:pointer"><div class="udic">${ic('wallet', 24)}</div>
      <div class="grow"><div class="muted">${t('total_udhaar')}</div><div class="big">Rs ${money(cs.total)}</div>
        <div class="muted">${cs.count} ${t('owes_n')}</div></div></div>` : ''}
    ${ps.suppliers ? `<div class="udcard pay" data-tab="purchases" style="cursor:pointer"><div class="udic">${ic('truck', 24)}</div>
      <div class="grow"><div class="muted">${t('total_payable')}</div><div class="big">Rs ${money(ps.total)}</div>
        <div class="muted">${ps.count} ${t('owed_n')}</div></div></div>` : ''}
    ${typeof exBannerHtml === 'function' ? exBannerHtml() : ''}
    <button class="qbhome" id="btn-qb-home" type="button"><span class="mi">${ic('bolt', 28)}</span><span class="grow">${t('qb_title')}<small>${t('qb_sub')}</small></span></button>
    <div class="mods">${mods.map(m => m.soon
      ? `<button class="mod soon" disabled><span class="soonb">${t('soon')}</span><span class="mi">${ic(m.ic, 28)}</span>${t(m.l)}</button>`
      : `<button class="mod" data-tab="${m.tab}"><span class="mi">${ic(m.ic, 28)}</span>${t(m.l)}</button>`).join('')}</div>`;
}

// ───────── Billing: search + product tiles ─────────
function renderBillShell() {
  $('view-bill').innerHTML = `${qbSegHtml()}
    <div id="bill-items">
    <div class="searchbar">
      <input id="bill-search" class="grow" type="search" placeholder="${t('search_ph')}" autocomplete="off" value="${esc(S.billQuery)}">
      ${planHasBarcode() ? `<button class="iconbtn green" id="btn-scan" type="button" aria-label="${t('scan')}">${ic('scan', 22)}</button>` : ''}
      <button class="iconbtn" id="btn-heldlist" type="button" aria-label="${t('hold_list')}">${ic('clock', 22)}${(S.heldN || 0) ? `<b class="tbadge abs">${S.heldN}</b>` : ''}</button>
      ${canEditProducts() ? `<button class="iconbtn" id="btn-addprod2" type="button" aria-label="${t('add_product')}">${ic('plus', 22)}</button>` : ''}
    </div>
    <div class="tiles" id="tiles"></div><div id="tiles-more" style="margin-top:10px"></div>
    </div>
    <div id="bill-quick" data-qbroot="inline" hidden></div>`;
  qbSegApply();
}

function cartLine(id) { return S.cart.find(l => l.product_id === id); }

function renderTiles() {
  const box = $('tiles'); if (!box) return;
  box.innerHTML = S.tiles.length ? S.tiles.map(p => {
    const l = cartLine(p.id), st = S.tileStocks[p.id];
    return `<div class="tile ${l ? 'sel' : ''} ${st <= 0 && !S.cfg.allow_oversell ? 'oos' : ''}" data-add="${p.id}">
      <div class="tprice">${money(p.sale_price)}</div>
      <div class="tname">${esc(LANG === 'ur' && p.name_ur ? p.name_ur : p.name)}</div>
      <div class="tstock ${st <= 0 ? 'low' : ''}">${t('stock')}: ${st} ${esc(p.unit || '')}</div>
      ${l ? `<div class="tstep"><button data-tinc="${p.id}" type="button">${ic('plus', 18)}</button><span>${l.qty}</span><button data-tdec="${p.id}" type="button">${ic('minus', 18)}</button></div>` : ''}
    </div>`; }).join('')
    : `<div class="muted" style="grid-column:1/-1;text-align:center;padding:24px">${S.billQuery ? t('no_results') : t('no_products')}</div>`;
}

async function loadTiles(append = false) {
  if (!$('tiles')) renderBillShell();
  if (!append) { S.billPage = 0; S.tiles = []; }
  const list = await listProducts(S.session.shop_id, S.billQuery, S.billPage, 30);
  Object.assign(S.tileStocks, await getStocks(S.session.shop_id, list.map(p => p.id)));
  S.tiles.push(...list);
  renderTiles();
  const more = $('tiles-more'); if (more) more.innerHTML = list.length === 30 ? `<button class="btn secondary block" id="btn-moretiles">${t('more')}</button>` : '';
}

async function addToCartById(id) {
  const p = await db.products.get(id);
  if (p) await addToCart(p);
}
async function addToCart(p, clearSearch = false) {
  const line = cartLine(p.id), stock = await getStock(S.session.shop_id, p.id);
  const allowance = (S.editing && S.editing.oldBase && S.editing.oldBase[p.id]) || 0, avail = Math.round((stock + allowance) * 1000) / 1000;
  const factor = line ? (line.unit_factor || 1) : 1, nextBase = ((line ? line.qty : 0) + 1) * factor;
  let addQty = 1;
  if (!S.cfg.allow_oversell && nextBase > avail + 1e-9) {      // stock rule: out-of-stock items cannot be sold (the owner can switch this off in Settings)
    S.tileStocks[p.id] = stock; renderTiles();
    const left = Math.round((avail - (line ? line.qty * factor : 0)) * 1000) / 1000;
    if (line || left <= 0) return toast(avail <= 0 ? t('oos_none') : t('oos_short').replace('{n}', avail), 3500);
    addQty = Math.round(left / factor * 1000) / 1000;           // a fraction is left (e.g. 0.5 kg): add just that
    toast(t('oos_short').replace('{n}', avail), 3000);
  }
  if (line) line.qty = Math.round((line.qty + addQty) * 1000) / 1000;
  else S.cart.push({ product_id: p.id, product_name: p.name, name_ur: p.name_ur || '', unit: p.unit || '', unit_name: p.unit || '', unit_factor: 1, units: p.units || [], base_price: p.sale_price, base_cost: p.cost_price || 0, unit_price: p.sale_price, cost_price: p.cost_price || 0, qty: addQty });
  const l = cartLine(p.id);
  l.warn = avail - l.qty * (l.unit_factor || 1) < 0;
  S.tileStocks[p.id] = stock;
  if (clearSearch && S.billQuery) { S.billQuery = ''; const sb = $('bill-search'); if (sb) sb.value = ''; loadTiles(); }
  refreshBill(); persistCart();
}
function decById(id) {
  const l = cartLine(id); if (!l) return;
  l.qty = Math.max(0, Math.round((l.qty - 1) * 1000) / 1000);
  if (l.qty === 0) S.cart.splice(S.cart.indexOf(l), 1);
  refreshBill(); persistCart();
}

async function handleBarcode(code) {
  const p = await findByBarcode(S.session.shop_id, code.trim());
  if (p) { await addToCart(p, true); toast(p.name); }
  else toast(t('no_results') + ': ' + code);
}

// Checkout bar (sticky) + checkout sheet
function renderBillBar() {
  const bar = $('billbar');
  const show = S.tab === 'bill' && S.cart.length > 0 && S.billMode !== 'quick';
  if (typeof qbSegBadge === 'function') qbSegBadge();
  bar.hidden = !show; if (!show) return;
  const tt = cartTotals();
  bar.innerHTML = `<div class="bb-info"><div>${ic('cart', 18)} ${S.cart.length} ${t('items_n')}</div><div class="bb-total">Rs ${money(tt.total)}</div></div>
    <button class="btn" id="btn-checkout" type="button">${t('checkout')}</button>`;
}
function refreshBill() {
  renderBillBar(); renderTiles();
  if ($('bill-cart')) { if (!S.cart.length) closeModal(); else renderCart(); }
}
function openCheckout() {
  if (!S.cart.length) return;
  openModal(`<h2>${t('checkout')}</h2><div id="bill-cart"></div><div id="bill-pay" style="margin-top:8px"></div>`);
  renderCart();
}

function cartTotals() {
  const subtotal = S.cart.reduce((s, l) => s + lineTotal(l), 0);
  const d = saleDiscountFor(subtotal);
  const tax = Math.round((subtotal - d) * num(S.cfg.tax_rate)) / 100;   // same rounding as saveSale()
  return { subtotal: Math.round(subtotal * 100) / 100, discount: Math.round(d * 100) / 100, tax, total: Math.round((subtotal - d + tax) * 100) / 100 };
}

function renderCart() {
  const box = $('bill-cart'), pay = $('bill-pay');
  if (!box || !pay) return;
  if (!S.cart.length) {
    box.innerHTML = `<div class="muted" style="text-align:center;padding:16px">${t('cart_empty')}</div>`;
    pay.hidden = true; return;
  }
  pay.hidden = false;
  box.innerHTML = S.cart.map((l, i) => `
    <div class="line">
      <div>
        <div>${esc(l.product_name)}</div>
        ${l.units && l.units.length ? `<select data-cunit="${i}" style="margin-top:4px"><option value="-1">${esc(l.unit)}</option>${l.units.map((u, k) => `<option value="${k}" ${u.name === l.unit_name ? 'selected' : ''}>${esc(u.name)} (${u.factor} ${esc(l.unit)})</option>`).join('')}</select>` : ''}
        <div class="row" style="margin-top:4px">
          ${canPrice() ? `<input type="number" inputmode="decimal" step="any" min="0" value="${l.unit_price}" data-price="${i}" style="width:90px">` : `<span class="muted">${money(l.unit_price)}</span>`}
          <span class="muted">× ${l.qty} = <b id="lt-${i}">${money(lineTotal(l))}</b></span>
        </div>
        <div class="row" style="margin-top:4px;flex-wrap:wrap">
          <span class="muted">${t('amt_label')}</span><input type="number" inputmode="decimal" step="any" min="0" value="${l.amount != null ? l.amount : ''}" placeholder="Rs" data-lamt="${i}" style="width:92px">
          ${isKg(l) ? `<span class="muted">${t('gram_label')}</span><input type="number" inputmode="numeric" step="any" min="0" placeholder="g" data-lgram="${i}" style="width:80px">` : ''}
        </div>
        ${isKg(l) || isLitre(l) ? `<div class="sa-chips" style="margin:6px 0 0">${(isKg(l)
            ? [[0.1, LANG === 'ur' ? '100 گرام' : '100 g'], [0.25, LANG === 'ur' ? 'پاؤ' : '¼ kg'], [0.5, LANG === 'ur' ? 'آدھا کلو' : '½ kg'], [0.75, LANG === 'ur' ? 'پون کلو' : '¾ kg'], [1, LANG === 'ur' ? '1 کلو' : '1 kg']]
            : [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, '1']]).map(([v, lb]) => `<button type="button" class="sa-chip ${l.amount == null && l.qty === v ? 'on' : ''}" data-lq="${i}|${v}">${lb}</button>`).join('')}</div>` : ''}
        ${canDiscount() ? `<div class="row" style="margin-top:4px"><span class="muted">${t('disc_pct')}</span><input type="number" inputmode="decimal" step="any" min="0" max="100" value="${l.disc || ''}" placeholder="0" data-ldisc="${i}" style="width:72px"></div>` : ''}
        ${l.warn ? `<div class="warn">${t('stock_warn')}</div>` : ''}
      </div>
      <div class="qtybox">
        <button type="button" data-dec="${i}">${ic('minus', 18)}</button>
        <input type="number" inputmode="decimal" step="any" min="0" value="${l.qty}" data-qty="${i}">
        <button type="button" data-inc="${i}">${ic('plus', 18)}</button>
        <button type="button" data-rm="${i}" style="color:var(--err)" aria-label="${t('delete')}">${ic('x', 18)}</button>
      </div>
    </div>`).join('');
  renderPay();
}

function renderPay() {
  const pay = $('bill-pay'); if (!pay || !S.cart.length) return;
  const tt = cartTotals();
  if (S.paySplit) S.paid = splitSum(); else if (S.paidManual !== true) S.paid = tt.total;
  const bal = Math.round((tt.total - num(S.paid)) * 100) / 100;
  const pmName = k => t('pm_' + k);
  pay.innerHTML = `
    ${S.editing ? `<div class="warn" style="margin-bottom:8px">${t('edit_banner').replace('{no}', esc(S.editing.invoice))} <button type="button" class="btn secondary sm" id="btn-edit-cancel">${t('edit_cancel')}</button></div>` : ''}
    <div class="custrow" id="btn-pickcust" role="button" tabindex="0"><span class="lic">${ic('user', 18)}</span>
      <div class="grow">${S.saleCust ? `<b>${esc(S.saleCust.name)}</b>` : `<span class="muted">${t('walk_in')}</span>`}</div>
      <span class="btn secondary sm">${S.saleCust ? t('change_customer') : t('pick_customer')}</span></div>
    <div class="warn" id="cust-warn" ${bal > 0 && !S.saleCust ? '' : 'hidden'}>${t('need_customer')}</div>
    <div class="totals">
      <div><span>${t('subtotal')}</span><span>${money(tt.subtotal)}</span></div>
      ${canDiscount() ? `<div><span>${t('discount')}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><select id="in-dmode" style="width:74px"><option value="rs" ${S.discMode !== 'pct' ? 'selected' : ''}>Rs</option><option value="pct" ${S.discMode === 'pct' ? 'selected' : ''}>%</option></select><input id="in-discount" type="number" inputmode="decimal" step="any" min="0" value="${(S.discMode === 'pct' ? S.discPct : S.discount) || ''}" style="width:100px"></span></div>
        ${S.discMode === 'pct' && tt.discount ? `<div class="muted"><span></span><span id="disc-amt">− ${money(tt.discount)}</span></div>` : ''}` : ''}
      ${num(S.cfg.tax_rate) ? `<div><span>${t('tax')} (${S.cfg.tax_rate}%)</span><span>${money(tt.tax)}</span></div>` : ''}
      <div class="grand"><span>${t('total')}</span><span id="grand">${money(tt.total)}</span></div>
      ${S.paySplit
        ? `<div style="margin-top:6px"><span>${t('paid')}</span><b id="split-sum">${money(S.paid)}</b></div>
           ${PAY_METHODS.map(k => `<div><span>${pmName(k)}</span><input type="number" inputmode="decimal" step="any" min="0" data-split="${k}" value="${(S.splitAmt || {})[k] || ''}" style="width:130px"></div>`).join('')}
           <div style="margin-top:6px"><button type="button" class="btn secondary sm" id="btn-unsplit">${t('pm_single')}</button></div>`
        : `<div style="margin-top:6px"><span>${t('paid')}</span><input id="in-paid" type="number" inputmode="decimal" step="any" min="0" value="${S.paid}" style="width:130px"></div>
           <div style="margin-top:6px"><span>${t('pm_label')}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><select id="in-pm" style="width:130px">${PAY_METHODS.map(k => `<option value="${k}" ${(S.payMethod || 'cash') === k ? 'selected' : ''}>${pmName(k)}</option>`).join('')}</select><button type="button" class="btn secondary sm" id="btn-split">${t('pm_split')}</button></span></div>`}
      <div class="muted" id="bal-line">${bal > 0 ? t('balance') + ': ' + money(bal) : bal < 0 ? t('change') + ': ' + money(-bal) : ''}</div>
    </div>
    <button class="btn block" id="btn-complete" style="margin-top:10px">${t('complete_sale')}</button>
    ${S.editing ? '' : `<div class="row" style="margin-top:8px"><button class="btn secondary grow" id="btn-hold" type="button">${ic('clock', 18)} ${t('hold_btn')}</button><button class="btn secondary grow" id="btn-quote" type="button">${ic('receipt', 18)} ${t('quote_btn')}</button></div>`}`;
}

function updateTotalsOnly() {
  const tt = cartTotals();
  if (!S.paidManual) S.paid = tt.total;
  const g = $('grand'); if (g) g.textContent = money(tt.total);
  renderBillBar();
  const ip = $('in-paid'); if (ip && !S.paidManual) ip.value = S.paid;
  const ss = $('split-sum'); if (ss) ss.textContent = money(S.paid);
  const da = $('disc-amt'); if (da) da.textContent = '− ' + money(tt.discount);
  S.cart.forEach((l, i) => { const e = $('lt-' + i); if (e) e.textContent = money(lineTotal(l)); });
  const bal = Math.round((tt.total - num(S.paid)) * 100) / 100;
  const b = $('bal-line'); if (b) b.textContent = bal > 0 ? t('balance') + ': ' + money(bal) : bal < 0 ? t('change') + ': ' + money(-bal) : '';
  const w = $('cust-warn'); if (w) w.hidden = !(bal > 0 && !S.saleCust);
}

let persistTimer;
function persistCart() {
  clearTimeout(persistTimer);
  if (S.editing) return;       // a bill being corrected is never saved as a draft (a reload must not turn it into a second sale)
  persistTimer = setTimeout(() => { if (!S.editing) setSetting('cart_draft', S.cart).catch(() => {}); }, 300);
}

async function completeSale() {
  if (!S.editing && typeof planLimitCheck === 'function') { try { await planLimitCheck('bills'); } catch (e) { return toast(e.message, 5000); } }
  const tt = cartTotals();
  // Unpaid part of a bill is udhaar: it must belong to a named customer.
  const split = S.paySplit ? Object.fromEntries(PAY_METHODS.map(k => [k, round2(num((S.splitAmt || {})[k]))]).filter(([, v]) => v > 0)) : null;
  const used = split ? Object.keys(split) : [S.payMethod || 'cash'];
  const method = used.length > 1 ? 'mixed' : (used[0] || 'cash'), paidAmt = split ? splitSum() : num(S.paid);
  if (paidAmt < tt.total && !S.saleCust) { const w = $('cust-warn'); if (w) w.hidden = false; return toast(t('need_customer'), 3500); }
  // price / stock gates (a zero-price line or an out-of-stock item must not slip through)
  const bad0 = S.cart.filter(l => l.qty > 0 && lineTotal(l) <= 0 && !(l.amount != null)).map(l => l.product_name);
  if (bad0.length) return toast(t('price_missing').replace('{names}', bad0.join('، ')), 5000);
  if (!S.cfg.allow_oversell) {
    const st = await getStocks(S.session.shop_id, S.cart.map(l => l.product_id)), old = (S.editing && S.editing.oldBase) || {};
    const short = S.cart.filter(l => l.qty * (l.unit_factor || 1) > (st[l.product_id] || 0) + (old[l.product_id] || 0) + 1e-9);
    if (short.length) { short.forEach(l => { l.warn = true; }); renderCart(); return toast(t('oos_block').replace('{names}', short.map(l => l.product_name).join('، ')), 5000); }
  }
  const btn = $('btn-complete'); btn.disabled = true;
  const editing = S.editing;
  try {
    const sale = await saveSale({
      edited_from: editing ? editing.id : null, edited_from_no: editing ? editing.invoice : null,
      customer_id: S.saleCust ? S.saleCust.id : null,
      discount: tt.discount, tax_rate: num(S.cfg.tax_rate), paid: paidAmt,
      payment_method: method, pay_split: split, created_by: S.session.user_id
    }, S.cart.filter(l => l.qty > 0).map(l => ({ product_id: l.product_id, product_name: l.product_name, qty: l.qty, unit_name: l.unit_name || null, unit_factor: l.unit_factor || 1, unit_price: linePrice(l), line_total: lineTotal(l), item_discount: round2(l.qty * (l.unit_price - linePrice(l))), cost_price: l.cost_price })));
    billResetState();
    if (editing) { try { await voidSale(editing.id, t('edit_void_reason').replace('{no}', sale.invoice_no), { edited: true }); toast(t('edit_done'), 3000); } catch (e) { toast((e && e.message) || t('err_generic'), 6000); } }
    await setSetting('cart_draft', []);
    S.tiles.length && Object.keys(S.tileStocks).length && loadTiles();
    refreshBill(); refreshStatus(); if (typeof exCheck === 'function') exCheck();
    await showReceipt(sale.id);
  } catch (ex) { toast((ex && ex.message) || t('err_generic'), 4000); btn.disabled = false; }
}

// ───────── Edit a bill (correct a mistake) ─────────
// The old bill is cancelled (stock put back) and the corrected copy is saved as a new bill that points back to it.
async function startEditSale(saleId) {
  const r = await getSaleWithItems(saleId); if (!r || r.sale.status === 'void') return;
  if (r.items.some(i => i.quick)) return qbEdit(saleId);                    // a Quick Bill is corrected in the Quick Bill sheet
  if (r.sale.returned_total > 0) return toast(t('edit_has_return'), 4000);
  if (S.cart.length && !confirm(t('edit_replace_cart'))) return;
  const prods = await db.products.bulkGet(r.items.map(i => i.product_id));
  const cust = r.sale.customer_id ? await db.customers.get(r.sale.customer_id) : null;
  billResetState();
  const oldBase = {};
  r.items.forEach((i, k) => {
    const p = prods[k], f = i.unit_factor || 1;
    oldBase[i.product_id] = round3((oldBase[i.product_id] || 0) + i.qty * f);
    const fixed = Math.abs(i.line_total - i.qty * i.unit_price) > 0.011;
    S.cart.push({ product_id: i.product_id, product_name: i.product_name, name_ur: (p && p.name_ur) || '', unit: (p && p.unit) || i.unit_name || '', unit_name: i.unit_name || (p && p.unit) || '',
      unit_factor: f, units: (p && p.units) || [], base_price: p ? p.sale_price : i.unit_price / f, base_cost: p ? (p.cost_price || 0) : (i.cost_price || 0) / f,
      unit_price: i.unit_price, cost_price: i.cost_price || 0, qty: i.qty, amount: fixed ? i.line_total : null });
  });
  S.saleCust = cust ? { id: cust.id, name: cust.name, phone: cust.phone || '' } : null;
  S.discount = r.sale.discount || 0; S.discMode = 'rs';
  S.paid = r.sale.paid; S.paidManual = r.sale.paid < r.sale.total - 0.005;     // a fully paid bill stays fully paid after the edit; udhaar bills keep their paid amount
  if (r.sale.pay_split) { S.paySplit = true; S.splitAmt = { ...r.sale.pay_split }; } else S.payMethod = PAY_METHODS.includes(r.sale.payment_method) ? r.sale.payment_method : 'cash';
  S.editing = { id: saleId, invoice: r.sale.invoice_no, oldBase };
  closeModal(); if (S.tab !== 'bill') switchTab('bill'); renderBillShell(); loadTiles(); refreshBill(); openCheckout();
}

// ───────── Partial return ─────────
async function showReturnForm(saleId) {
  const r = await getSaleWithItems(saleId); if (!r) return;
  openModal(`<h2>${t('return_items')}</h2>
    ${r.items.filter(i => i.qty > 0).map(i => `<div class="card"><div class="row"><div class="grow"><b>${esc(i.product_name)}</b>
      <div class="muted">${t('qty')}: ${i.qty}${i.unit_name ? ' ' + esc(i.unit_name) : ''} × ${money(i.unit_price)}</div></div>
      <input type="number" inputmode="decimal" step="any" min="0" max="${i.qty}" value="0" data-ret="${i.id}" style="width:90px"></div></div>`).join('')}
    <div class="row" style="margin-top:10px"><button class="btn grow" id="btn-ret-ok">${t('save')}</button>
      <button class="btn secondary grow" data-close>${t('cancel')}</button></div>`);
  $('btn-ret-ok').onclick = async () => {
    const lines = [...document.querySelectorAll('[data-ret]')].map(e => ({ item_id: e.dataset.ret, qty: num(e.value) })).filter(l => l.qty > 0);
    if (!lines.length) return toast(t('ret_none'), 3000);
    if (!confirm(t('ret_confirm'))) return;
    try {
      await returnSaleItems(saleId, lines, '');
      toast(t('saved')); closeModal();
      if (S.tab === 'sales') { S.salesPage = 0; renderSales(); } if (S.tab === 'home') renderHome();
    } catch (e) { toast(e.message || t('err_generic'), 4000); }
  };
}

// ───────── Receipt ─────────
async function showReceipt(saleId) {
  const r = await getSaleWithItems(saleId);
  if (!r) return;
  (await db.products.bulkGet(r.items.map(i => i.product_id))).forEach((p, k) => { r.items[k].name_ur = (p && p.name_ur) || ''; });
  let cust = null;
  if (r.sale.customer_id) {
    const c = await db.customers.get(r.sale.customer_id);
    if (c) cust = { name: c.name, phone: c.phone, balance: await getCustomerBalance(S.session.shop_id, c.id) };
  }
  const html = receiptHtml(r.sale, r.items, cust), wa = cust && waNumber(cust.phone);
  openModal(`<h2>${t('receipt')}</h2><div class="rcwrap">${html}</div>
    <div class="row" style="margin-top:12px">
      <button class="btn grow" id="btn-print">${ic('print', 18)} ${t('print')}</button>
      ${wa ? `<a class="btn secondary lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(receiptText(r.sale, r.items, cust))}">${ic('chat', 18)} ${t('rc_wa')}</a>` : ''}
      <button class="btn secondary grow" data-close>${t('new_sale')}</button>
    </div>
    ${r.sale.status === 'void' ? `<div class="warn" style="margin-top:10px">${t('sale_void')}${r.sale.void_reason ? ': ' + esc(r.sale.void_reason) : ''}</div>`
      + (canEditProducts() ? `<button class="btn danger block" id="btn-delvoid" style="margin-top:10px">${t('del_void_sale')}</button>` : '')
      : canEditProducts() ? `<button class="btn block" id="btn-editsale" style="margin-top:10px">${ic('edit', 18)} ${t('edit_btn')}</button><button class="btn secondary block" id="btn-return" style="margin-top:10px">${t('return_items')}</button><button class="btn danger block" id="btn-void" style="margin-top:10px">${t('void_sale')}</button>` : ''}
    ${r.sale.returned_total > 0 ? `<div class="muted" style="margin-top:8px">${t('returned_total')}: ${money(r.sale.returned_total)}${r.sale.refunded > 0 ? ' · ' + t('refund_cash') + ': ' + money(r.sale.refunded) : ''}</div>` : ''}`);
  if ($('btn-return')) $('btn-return').onclick = () => showReturnForm(saleId);
  if ($('btn-editsale')) $('btn-editsale').onclick = () => startEditSale(saleId);
  if ($('btn-void')) $('btn-void').onclick = async () => {
    if (!confirm(t('void_confirm'))) return;
    const reason = prompt(t('void_reason')) ;
    if (reason === null) return;
    try { await voidSale(saleId, reason); toast(t('saved')); closeModal(); if (S.tab === 'sales') { S.salesPage = 0; renderSales(); } if (S.tab === 'home') renderHome(); }
    catch (e) { toast(e.message || t('err_generic'), 4000); }
  };
  if ($('btn-delvoid')) $('btn-delvoid').onclick = async () => {
    if (!confirm(t('del_void_confirm'))) return;
    try { await deleteVoidSale(saleId); toast(t('saved')); closeModal(); if (S.tab === 'sales') { S.salesPage = 0; renderSales(); } if (S.tab === 'home') renderHome(); refreshStatus(); }
    catch (e) { toast(e.message || t('err_generic'), 4000); }
  };
  $('btn-print').onclick = () => doPrint(html, S.cfg.paper);
}

// ───────── Barcode camera scan (where BarcodeDetector exists) ─────────
let scanStream = null, scanTimer = null;
async function startScan() {
  if (!navigator.mediaDevices) { toast(t('scan_unsupported'), 3500); return; }
  openModal(`<h2>${t('scan')}</h2><div class="scanwrap"><video id="scanvideo" playsinline muted></video><div class="scanframe"><i class="scanline"></i></div></div>
    <div style="margin-top:10px"><button class="btn secondary block" data-close>${t('cancel')}</button></div>`);
  try {
    await posScanStart($('scanvideo'), async val => { closeModal(); await handleBarcode(val); }, false);
  } catch (e) { closeModal(); toast(scanErrorMsg(e), 4500); }
}
function stopScan() {
  clearInterval(scanTimer); scanTimer = null; posScanStop();
  if (scanStream) { scanStream.getTracks().forEach(tr => tr.stop()); scanStream = null; }
}

// ───────── Products ─────────
async function renderProducts(append = false) {
  const v = $('view-products');
  if (!append) {
    v.innerHTML = `
      <div class="row"><input id="prod-search" class="grow" type="search" placeholder="${t('search_ph')}" value="${esc(S.productQuery)}">
        ${canEditProducts() ? `<button class="btn" id="btn-addprod">+ ${t('add_product')}</button>` : ''}</div>
      ${canEditProducts() ? `${typeof catalogStart === 'function' ? `<button class="btn secondary block" id="btn-catalog" style="margin-top:8px">${t('cat_from')}</button>` : ''}` : `<div class="muted" style="margin:6px 0">${t('read_only')}</div>`}
      <div id="prod-list" style="margin-top:8px"></div><div id="prod-more"></div>`;
  }
  const list = await listProducts(S.session.shop_id, S.productQuery, S.productPage, 30);
  const stocks = await getStocks(S.session.shop_id, list.map(p => p.id));
  const html = list.map(p => `
    <div class="card" ${canEditProducts() ? `data-edit="${p.id}"` : ''}>
      <div class="row"><div class="grow"><b>${esc(p.name)}</b>${p.name_ur ? ` <span class="muted">${esc(p.name_ur)}</span>` : ''}
        <div class="muted">${p.barcode && planHasBarcode() ? esc(p.barcode) + ' · ' : ''}${t('stock')}: ${stocks[p.id]} ${esc(p.unit || '')}${(p.units || []).map(u => ` · 1 ${esc(u.name)} = ${u.factor} ${esc(p.unit || '')}`).join('')}</div></div>
        <div class="price">${money(p.sale_price)}</div></div>
      ${p.min_stock && stocks[p.id] <= p.min_stock ? `<div class="warn">${t('stock')}: ${stocks[p.id]} ≤ ${p.min_stock}</div>` : ''}
      ${!p.sale_price ? `<div class="warn">${t('cat_no_price')}</div>` : ''}
    </div>`).join('');
  const target = $('prod-list');
  if (!append) target.innerHTML = html || `<div class="muted" style="text-align:center;padding:20px">${t('no_products')}</div>`;
  else target.insertAdjacentHTML('beforeend', html);
  $('prod-more').innerHTML = list.length === 30 ? `<button class="btn secondary block" id="btn-moreprod">${t('more')}</button>` : '';
}

async function openProductForm(id) {
  const p = id ? await db.products.get(id) : {};
  const stock = id ? await getStock(S.session.shop_id, id) : 0;
  // Size/colour variants only make sense for clothing-type shops (or when the shop type isn't chosen yet).
  const bt = await catalogGetType(S.session.shop_id), showVariants = !bt || bt === 'garments';
  openModal(`<h2>${id ? t('edit_product') : t('add_product')}</h2>
    <form id="prod-form">
      <label>${t('name')}</label><input name="name" required value="${esc(p.name)}">
      <label>${t('name_ur')}</label><input name="name_ur" value="${esc(p.name_ur)}">
      ${planHasBarcode() ? `<label>${t('barcode')}</label><input name="barcode" inputmode="numeric" dir="ltr" value="${esc(p.barcode)}">` : ''}
      <div class="row"><div class="grow"><label>${t('cost')}</label><input name="cost_price" type="number" inputmode="decimal" step="any" min="0" value="${p.cost_price ?? ''}"></div>
        <div class="grow"><label>${t('sale_price')}</label><input name="sale_price" type="number" inputmode="decimal" step="any" min="0" required value="${p.sale_price ?? ''}"></div></div>
      <div class="row"><div class="grow"><label>${t('unit')}</label><input name="unit" value="${esc(p.unit || 'pcs')}"></div>
        <div class="grow"><label>${t('min_stock')}</label><input name="min_stock" type="number" inputmode="decimal" step="any" min="0" value="${p.min_stock ?? ''}"></div></div>
      <label>${t('units_extra')}</label><div class="muted">${t('units_hint')}</div>
      ${[0, 1, 2].map(k => { const u = (p.units || [])[k] || {}; return `<div class="row" style="margin-top:4px">
        <input name="u_name_${k}" placeholder="${t('unit_name_ph')}" value="${esc(u.name || '')}" class="grow">
        <input name="u_factor_${k}" type="number" inputmode="decimal" step="any" min="0" placeholder="${t('unit_factor_ph')}" value="${u.factor ?? ''}" style="width:80px">
        <input name="u_price_${k}" type="number" inputmode="decimal" step="any" min="0" placeholder="${t('sale_price')}" value="${u.price ?? ''}" style="width:90px"></div>`; }).join('')}
      ${id || !showVariants ? '' : `<label>${t('variants_title')}</label><div class="muted">${t('variants_hint')}</div>
        <div class="row" style="margin-top:4px"><input name="v_sizes" class="grow" placeholder="${t('variants_sizes_ph')}">
          <input name="v_colors" class="grow" placeholder="${t('variants_colors_ph')}"></div>`}
      ${id ? `<div class="muted" style="margin-top:8px">${t('stock')}: ${stock}</div>
              <label>${t('stock_adjust')}</label><input name="adjust" type="number" inputmode="decimal" step="any">
              <label>${t('adjust_note')}</label><input name="adjust_note">`
           : `<label>${t('opening_stock')}</label><input name="opening" type="number" inputmode="decimal" step="any" min="0">`}
      <div class="row" style="margin-top:14px">
        <button class="btn grow" type="submit">${t('save')}</button>
        <button class="btn secondary" type="button" data-close>${t('cancel')}</button>
        ${id ? `<button class="btn danger" type="button" id="btn-delprod">${t('delete')}</button>` : ''}
      </div>
    </form>`);
  $('prod-form').onsubmit = async ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    try {
      const base = { name: f.name, name_ur: f.name_ur, barcode: planHasBarcode() ? f.barcode : (p.barcode || ''),
        cost_price: f.cost_price, sale_price: f.sale_price, unit: f.unit, min_stock: f.min_stock,
        units: [0, 1, 2].map(k => ({ name: f['u_name_' + k], factor: f['u_factor_' + k], price: f['u_price_' + k] })) };
      const combos = id ? [] : variantCombos(f.v_sizes, f.v_colors);
      if (combos.length > 40) throw new Error(t('variants_too_many'));
      if (combos.length) {
        // one normal product per size/colour (own stock, own barcode, own price) — all share variant_group
        if (!String(f.name || '').trim()) throw new Error('Name required');
        const group = uuid();
        for (const label of combos)
          await saveProduct({ ...base, name: `${f.name.trim()} - ${label}`, name_ur: f.name_ur ? `${f.name_ur.trim()} - ${label}` : '',
            barcode: '', variant_group: group, variant_label: label }, { openingStock: f.opening });
      } else {
        await saveProduct({ ...(id ? { id } : {}), ...base }, { openingStock: f.opening, adjust: f.adjust, adjustNote: f.adjust_note });
      }
      closeModal(); toast(t('saved')); S.productPage = 0; renderProducts(); refreshStatus();
    } catch (ex) { toast(ex.message || t('err_generic'), 4000); }
  };
  if (id) $('btn-delprod').onclick = async () => {
    if (!confirm(t('confirm_delete'))) return;
    await softDeleteProduct(id); closeModal(); renderProducts(); refreshStatus();
  };
}

// ───────── Sales history ─────────
async function renderSales(append = false) {
  const v = $('view-sales');
  if (!append) v.innerHTML = `<div class="row" style="margin-bottom:8px"><h3 class="grow" style="margin:0">${t('sales_hist')}</h3><button class="btn secondary sm" id="btn-verify" type="button">${ic('check', 16)} ${t('vf_btn')}</button></div><div id="sales-list"></div><div id="sales-more"></div>`;
  const list = await listSales(S.session.shop_id, S.salesPage, 30);
  const cmap = {};
  const cids = [...new Set(list.map(s => s.customer_id).filter(Boolean))];
  (await db.customers.bulkGet(cids)).forEach(c => { if (c) cmap[c.id] = c.name; });
  const html = list.map(s => `
    <div class="card" data-sale="${s.id}">
      <div class="row"><div class="grow"><b${s.status === 'void' ? ' style="text-decoration:line-through"' : ''}>${esc(s.invoice_no)}</b>${s.status === 'void' ? ` <span class="owe-t">${t('sale_void')}</span>` : ''}<div class="muted">${esc(fmtDate(s.created_at))}</div></div>
        <div class="price">${money(s.total)}</div></div>
      ${s.customer_id && cmap[s.customer_id] ? `<div class="muted">${ic('user', 14)} ${esc(cmap[s.customer_id])}${s.paid < s.total ? ` · <span class="owe-t">${t('udhaar')}: ${money(s.total - s.paid)}</span>` : ''}</div>` : ''}
      <div class="muted">${s.sync_status === 'synced' ? ic('check', 14) : ic('clock', 14) + ' ' + t('pending')}</div>
    </div>`).join('');
  if (!append) $('sales-list').innerHTML = html || `<div class="muted" style="text-align:center;padding:20px">${t('no_sales')}</div>`;
  else $('sales-list').insertAdjacentHTML('beforeend', html);
  $('sales-more').innerHTML = list.length === 30 ? `<button class="btn secondary block" id="btn-moresales">${t('more')}</button>` : '';
}

// ───────── Settings screen ─────────
async function renderSettings() {
  const c = S.cfg, own = isOwner(), dis = own ? '' : 'disabled', live = !window.POS_DEMO;
  const rdis = (window.POS_DEMO || canPurchase()) ? '' : 'disabled';   // receipt text: owner/manager (it is shared by all phones)
  // remember which sections are open so a re-render (after saving something) doesn't collapse them
  S.setOpen = S.setOpen || new Set();
  const cur = document.querySelectorAll('#view-settings details[data-sec]');
  if (cur.length) { S.setOpen = new Set([...cur].filter(d => d.open).map(d => d.dataset.sec)); }
  const sec = (id, icon, title, body) => `<details class="sset" data-sec="${id}" ${S.setOpen.has(id) ? 'open' : ''}><summary>${ic(icon, 20)} <span class="grow">${title}</span></summary><div class="sbody">${body}</div></details>`;
  const nConf = live ? await db.conflicts.filter(x => !x.resolved_at).count() : 0, nFail = live ? await failedCount() : 0, nPend = live ? await pendingCount() : 0;

  const account = (live ? `<label>${t('change_pw')}</label>${pwField('set-oldpw', t('cur_password'))}${pwField('set-newpw', t('new_password'), 'margin-top:8px')}<button class="btn block" id="btn-pw" style="margin:8px 0">${t('save')}</button>` : '')
    + (own && live ? `<label>${t('my_phone')}</label><input id="set-newphone" inputmode="tel" dir="ltr" placeholder="03xx xxxxxxx">${pwField('set-phonepw', t('cur_password'), 'margin-top:8px')}<button class="btn block" id="btn-phone" style="margin:8px 0">${t('save')}</button>` : '')
    + (own && live ? `<label>${t('shop_name')}</label><input id="set-shopname" value="${esc(S.session.shop_name)}" maxlength="80"><button class="btn block" id="btn-shopname" style="margin:8px 0">${t('save')}</button>` : '');

  const look = `<label>${t('language')}</label>
      <select id="set-lang"><option value="ur" ${c.lang === 'ur' ? 'selected' : ''}>اردو</option><option value="en" ${c.lang === 'en' ? 'selected' : ''}>English</option></select>
      <label>${t('theme')}</label>
      <select id="set-theme"><option value="green" ${c.theme !== 'orange' ? 'selected' : ''}>${t('theme_green')}</option><option value="orange" ${c.theme === 'orange' ? 'selected' : ''}>${t('theme_orange')}</option></select>`;

  const billing = (own ? '' : `<div class="muted">${t('owner_only')}</div>`) + `
      <label>${t('tax_rate')}</label><input id="set-tax" type="number" inputmode="decimal" step="any" min="0" value="${c.tax_rate}" ${dis}>
      <label><input type="checkbox" id="set-cdisc" style="width:auto;min-height:0" ${c.cashier_discount ? 'checked' : ''} ${dis}> ${t('cashier_discount')}</label>
      <label><input type="checkbox" id="set-oversell" style="width:auto;min-height:0" ${c.allow_oversell ? 'checked' : ''} ${dis}> ${t('set_oversell')}</label>
      <label><input type="checkbox" id="set-cprice" style="width:auto;min-height:0" ${c.cashier_price ? 'checked' : ''} ${dis}> ${t('cashier_price')}</label>`;

  const receipt = `<label>${t('receipt_header')}</label><input id="set-rh" value="${esc(c.receipt_header)}" ${rdis}>
      <label>${t('receipt_footer')}</label><input id="set-rf" value="${esc(c.receipt_footer)}" ${rdis}>
      <label>${t('set_phone')}</label><input id="set-sp" inputmode="tel" dir="ltr" value="${esc(c.shop_phone)}" ${rdis}>
      <label>${t('set_addr')}</label><input id="set-sa" value="${esc(c.shop_address)}" ${rdis}>
      <label>${t('set_ntn')}</label><input id="set-sn" dir="ltr" value="${esc(c.shop_tax_no)}" ${rdis}>
      <label>${t('paper_width')}</label>
      <select id="set-paper"><option value="58" ${c.paper == 58 ? 'selected' : ''}>58 mm</option><option value="80" ${c.paper == 80 ? 'selected' : ''}>80 mm</option><option value="a4" ${c.paper === 'a4' ? 'selected' : ''}>A4</option></select>
      ${planHasQr()
        ? `<label style="margin-top:10px"><input type="checkbox" id="set-rqr" style="width:auto;min-height:0" ${c.receipt_qr !== false ? 'checked' : ''}> ${t('rc_qr_show')}</label>`
        : `<div class="muted" style="margin-top:10px">${ic('shield', 16)} ${t('rc_qr_locked')}</div>`}`;

  const data = (live ? `<div class="muted" id="sync-state"></div>
      <div class="muted">${t('pending')}: ${nPend} · ${t('sync_failed_n')}: ${nFail} · ${t('sync_conflicts')}: ${nConf}</div>
      ${syncDaysLeft() !== null ? `<div class="${syncDaysLeft() <= 7 ? 'warn' : 'muted'}">${syncExpiryText()}</div>` : ''}
      <button class="btn block" id="btn-sync-now" style="margin-top:8px">${t('sync_now')}</button>
      ${nConf ? `<button class="btn secondary block" id="btn-conflicts" style="margin-top:8px">${t('cf_review')}</button>` : ''}
      ${nFail ? `<button class="btn secondary block" id="btn-sync-retry" style="margin-top:8px">${t('sync_retry')}</button>` : ''}
      <button class="btn secondary block" id="btn-import" style="margin-top:8px">${ic('download', 18)} ${t('import_data')}</button><input type="file" id="import-file" accept=".json,application/json" hidden>` : '')
    + `<button class="btn secondary block" id="btn-export" style="margin-top:8px">${ic('download', 18)} ${t('export_data')}</button>`;

  const warnDot = (live && (nFail || nConf || (syncDaysLeft() !== null && syncDaysLeft() <= 7))) ? ' <span class="bal owe">!</span>' : '';
  $('view-settings').innerHTML = `
    <div class="card"><div class="row" style="align-items:center;gap:12px">
      <div><label class="avatar sm" id="set-avatar" for="avatar-file" style="width:64px;height:64px;cursor:pointer" title="${t('pf_change')}" aria-label="${t('pf_change')}">${avatarHtml(30, 'user')}</label><input type="file" id="avatar-file" accept="image/*" hidden></div>
      <div class="grow">
        <div>${t('shop')}: <b>${esc(S.session.shop_name)}</b></div>
        ${S.session.user_name ? `<div><b>${esc(S.session.user_name)}</b></div>` : ''}<div class="muted">${esc(displayLogin(S.session.email))} · ${t('role')}: ${t(S.session.role)}</div>
        <div style="margin-top:6px"><label class="btn secondary sm" for="avatar-file" style="display:inline-flex;cursor:pointer">${t('pf_change')}</label> <button class="btn secondary sm" type="button" id="btn-avatar-del" ${S.avatar ? '' : 'hidden'}>${t('pf_remove')}</button></div>
      </div></div>
    </div>
    ${account ? sec('account', 'user', t('set_sec_account'), account) : ''}
    ${sec('legal', 'shield', t('lg_sec'), legalListHtml(await getSetting(termsKey(), null)))}
    ${sec('billing', 'receipt', t('set_sec_billing'), billing)}
    ${sec('receipt', 'print', t('set_sec_receipt'), receipt)}
    ${sec('look', 'settings', t('set_sec_look'), look)}
    ${sec('notif', 'bell', t('ex_notif_sec'), await exNotifBodyHtml())}
    ${sec('data', 'download', t('set_sec_data') + warnDot, data)}
    <div style="margin-top:12px">
    ${(window.POS_DEMO || (S.session && S.session.admin)) ? `<button class="btn block" id="btn-sa-open" style="margin-bottom:10px">${ic('shield', 18)} ${t('sa_open')}</button>` : ''}
    ${exInstallBtn()}
    <button class="btn secondary block" id="btn-about" style="margin-bottom:10px">${ic('help', 18)} ${t('ab_btn')}</button>
    <button class="btn secondary block" id="btn-contact" style="margin-bottom:10px">${ic('chat', 18)} ${t('ct_btn')}</button>
    <button class="btn secondary block" id="btn-help" style="margin-bottom:10px">${ic('help', 18)} ${t('help_btn')}</button>
    <button class="btn danger block" id="btn-logout">${ic('logout', 18)} ${t('logout')}</button></div>`;
  if (typeof syncUi === 'function') syncUi();
  if (typeof ctPaint === 'function') ctPaint();
}

// ───────── Event wiring (delegation) ─────────
document.addEventListener('click', async ev => {
  const el = ev.target;
  const tab = el.closest('[data-tab]'); if (tab) return switchTab(tab.dataset.tab);
  if (el.closest('[data-close]')) return closeModal();
  if (el === $('modal')) return closeModal();
  const tinc = el.closest('[data-tinc]'); if (tinc) return addToCartById(tinc.dataset.tinc);
  const tdec = el.closest('[data-tdec]'); if (tdec) return decById(tdec.dataset.tdec);
  const add = el.closest('[data-add]'); if (add) return addToCartById(add.dataset.add);
  const inc = el.closest('[data-inc]'); if (inc) { const l = S.cart[+inc.dataset.inc]; l.amount = null; l.qty = Math.round((l.qty + 1) * 1000) / 1000; refreshBill(); return persistCart(); }
  const dec = el.closest('[data-dec]'); if (dec) { const l = S.cart[+dec.dataset.dec]; l.amount = null; l.qty = Math.max(0, Math.round((l.qty - 1) * 1000) / 1000); if (l.qty === 0) S.cart.splice(+dec.dataset.dec, 1); refreshBill(); return persistCart(); }
  const lq = el.closest('[data-lq]'); if (lq) { const [i, v] = lq.dataset.lq.split('|'); const l = S.cart[+i]; l.amount = null; l.qty = +v; refreshBill(); return persistCart(); }
  if (el.closest('#btn-editsale-x')) return;
  if (el.closest('#btn-edit-cancel')) { billResetState(); closeModal(); refreshBill(); renderBillShell(); loadTiles(); return; }
  const rm = el.closest('[data-rm]'); if (rm) { S.cart.splice(+rm.dataset.rm, 1); refreshBill(); return persistCart(); }
  if (el.closest('#btn-checkout')) return openCheckout();
  if (el.closest('#btn-moretiles')) { S.billPage++; return loadTiles(true); }
  if (el.closest('#btn-addprod2')) return openProductForm(null);
  if (el.closest('#btn-scan')) return startScan();
  if (el.closest('#btn-complete')) return completeSale();
  if (el.closest('#btn-split')) { S.paySplit = true; S.splitAmt = { [S.payMethod || 'cash']: num(S.paid) }; S.paidManual = true; return renderPay(); }
  if (el.closest('#btn-unsplit')) { S.paySplit = false; S.splitAmt = {}; S.paidManual = false; return renderPay(); }
  if (el.closest('#btn-hold')) return bpHold();
  if (el.closest('#btn-quote')) return bpQuote();
  if (el.closest('#btn-heldlist')) return bpListOpen();
  if (el.closest('#btn-addprod')) return openProductForm(null);
  const ed = el.closest('[data-edit]'); if (ed) return openProductForm(ed.dataset.edit);
  if (el.closest('#btn-moreprod')) { S.productPage++; return renderProducts(true); }
  const sale = el.closest('[data-sale]'); if (sale) return showReceipt(sale.dataset.sale);
  if (el.closest('#btn-moresales')) { S.salesPage++; return renderSales(true); }
  const sg = el.closest('[data-purseg]'); if (sg) { S.purSeg = sg.dataset.purseg; S.purPage = 0; S.supPage = 0; return renderPurchases(); }
  if (el.closest('#btn-newpur')) { if (!S.pur) S.pur = newPur(); return openPurchaseForm(); }
  if (el.closest('#btn-addsup')) return openSupplierForm(null);
  if (el.closest('#btn-morepur')) { S.purPage++; return renderPurchases(true); }
  if (el.closest('#btn-moresup')) { S.supPage++; return renderPurchases(true); }
  if (el.closest('#btn-picksup')) return openSupplierPicker();
  if (el.closest('#btn-savepur')) return savePurchaseNow();
  if (el.closest('[data-purcancel]')) { S.pur = null; return closeModal(); }
  const pa = el.closest('[data-puradd]'); if (pa) return addPurLine(pa.dataset.puradd);
  const prm = el.closest('[data-prm]'); if (prm) { S.pur.lines.splice(+prm.dataset.prm, 1); S.pur.paidManual = false; return renderPurLines(); }
  const sp = el.closest('[data-suppay]'); if (sp) { const [sid, kind] = sp.dataset.suppay.split('|'); return openSupplierPayForm(sid, kind); }
  const os = el.closest('[data-opensup]'); if (os) return openSupplierDetail(os.dataset.opensup);
  const es = el.closest('[data-editsup]'); if (es) return openSupplierForm(es.dataset.editsup);
  const ds = el.closest('[data-delsup]'); if (ds) return deleteSupplier(ds.dataset.delsup);
  const su = el.closest('[data-sup]'); if (su) return openSupplierDetail(su.dataset.sup);
  const pu = el.closest('[data-pur]'); if (pu) return showPurchase(pu.dataset.pur);
  if (el.closest('#btn-pickcust')) return openCustomerPicker();
  if (el.closest('#btn-addcust')) return openCustomerForm(null);
  if (el.closest('#btn-morecust')) { S.custPage++; return renderCustomers(true); }
  if (el.closest('#btn-moreledger')) { custShown += 25; return renderLedger(); }
  const pay = el.closest('[data-pay]'); if (pay) { const [cid, kind] = pay.dataset.pay.split('|'); return openPaymentForm(cid, kind); }
  const oc = el.closest('[data-opencust]'); if (oc) return openCustomerDetail(oc.dataset.opencust);
  const ec = el.closest('[data-editcust]'); if (ec) return openCustomerForm(ec.dataset.editcust);
  const dc = el.closest('[data-delcust]'); if (dc) return deleteCustomer(dc.dataset.delcust);
  const cu = el.closest('[data-cust]'); if (cu) return openCustomerDetail(cu.dataset.cust);
  if (el.closest('#btn-lang')) return toggleLang();
  if (el.closest('#btn-logout')) return doLogout();
  if (el.closest('#btn-verify')) { openVerify(); return; }
  if (el.closest('#btn-avatar-del')) { avatarSet(''); return; }
  if (el.closest('#btn-pw')) {
    const oldp = $('set-oldpw').value, newp = $('set-newpw').value;
    if (!oldp) return toast(t('cur_password'), 3000);
    if (newp.length < 6) return toast(t('pw_short'), 3500);
    if (!(await pingServer())) return toast(t('login_need_online'), 3500);
    try {
      const sb = getSb();
      const { error: e1 } = await sb.auth.signInWithPassword({ email: S.session.email, password: oldp });
      if (e1) throw new Error(t('login_failed'));
      const { error: e2 } = await sb.auth.updateUser({ password: newp });
      if (e2) throw new Error(e2.message);
      $('set-oldpw').value = ''; $('set-newpw').value = ''; toast(t('saved'));
    } catch (e) { toast(e.message || t('err_generic'), 4500); }
    return;
  }
  if (el.closest('#btn-phone')) {
    let email; try { email = loginIdToEmail($('set-newphone').value); } catch (e) { return toast(e.message, 3500); }
    const pw = $('set-phonepw').value; if (!pw) return toast(t('cur_password'), 3000);
    if (!(await pingServer())) return toast(t('login_need_online'), 3500);
    if (!confirm(t('phone_confirm') + '\n' + displayLogin(email))) return;
    try {
      const { data, error } = await getSb().functions.invoke('admin-users', { body: { action: 'my_phone', phone: $('set-newphone').value, password: pw } });
      if (error || (data && data.error)) throw new Error((data && data.error) || error.message);
      S.session.email = data.email; await setSetting('session', S.session);
      toast(t('saved')); renderSettings();
    } catch (e) { toast(/bad_password/.test(e.message) ? t('login_failed') : t('err_generic') + ': ' + e.message, 4500); }
    return;
  }
  if (el.closest('#btn-shopname')) {
    const name = $('set-shopname').value.trim();
    if (name.length < 2) return toast(t('err_generic'));
    if (!(await pingServer())) return toast(t('login_need_online'), 3500);
    try {
      const { error } = await getSb().rpc('rename_my_shop', { p_shop: S.session.shop_id, p_name: name });
      if (error) throw error;
      S.session.shop_name = name; await setSetting('session', S.session);
      $('hdr-shop').textContent = name; toast(t('saved'));
    } catch (e) { toast(t('err_generic') + ': ' + (e.message || ''), 4000); }
    return;
  }
  if (el.closest('#btn-sync-now')) { toast(t('sync_running')); const r = await syncRun(); syncUi(); if (r && r.offline) toast(t('offline')); renderSettings(); return; }
  if (el.closest('#btn-conflicts')) { syncShowConflicts(); return; }
  if (el.closest('#btn-close-modal')) { closeModal(); renderSettings(); return; }
  { const b = el.closest('[data-cf-ok],[data-cf-local]'); if (b) { syncResolveChoice(b.dataset.cfOk || b.dataset.cfLocal, !!b.dataset.cfLocal); return; } }
  if (el.closest('#btn-import')) { $('import-file').click(); return; }
  if (el.closest('#btn-sync-retry')) { await syncRetryFailed(); renderSettings(); return; }
  if (el.closest('#btn-export')) {
    try {
      const blob = await exportAllData();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pos-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { toast(t('err_generic')); }
  }
});

let searchTimer;
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'bill-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.billQuery = el.value; loadTiles(); }, 150); }
  else if (el.id === 'cust-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.custQuery = el.value; S.custPage = 0; renderCustomers(); }, 200); }
  else if (el.id === 'sup-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.supQuery = el.value; S.supPage = 0; renderPurchases(); }, 200); }
  else if (el.id === 'pur-search') { S.pur.q = el.value; clearTimeout(searchTimer); searchTimer = setTimeout(purResults, 150); }
  else if (el.dataset.pqty != null) { S.pur.lines[+el.dataset.pqty].qty = num(el.value); const l = S.pur.lines[+el.dataset.pqty]; const c = $('pl-' + el.dataset.pqty); if (c) c.textContent = money(l.qty * l.unit_cost); updatePurTotals(); }
  else if (el.dataset.pcost != null) { const l = S.pur.lines[+el.dataset.pcost]; l.unit_cost = num(el.value); const c = $('pl-' + el.dataset.pcost); if (c) c.textContent = money(l.qty * l.unit_cost); updatePurTotals(); }
  else if (el.id === 'pur-paid') { S.pur.paid = num(el.value); S.pur.paidManual = true; updatePurTotals(); }
  else if (el.id === 'prod-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.productQuery = el.value; S.productPage = 0; renderProducts(); }, 200); }
  else if (el.dataset.qty != null) { const l = S.cart[+el.dataset.qty]; l.qty = num(el.value); if (l.amount != null) { l.amount = null; const a = document.querySelector(`[data-lamt="${el.dataset.qty}"]`); if (a) a.value = ''; } persistCart(); updateTotalsOnly(); }
  else if (el.dataset.lamt != null) {       // sell by amount: "Rs 100 of this item" -> qty is worked out from the price
    const i = +el.dataset.lamt, l = S.cart[i], v = num(el.value);
    if (v > 0 && l.unit_price > 0) { l.amount = Math.round(v * 100) / 100; l.qty = Math.round(v / l.unit_price * 1000) / 1000; } else { l.amount = null; }
    const q = document.querySelector(`[data-qty="${i}"]`); if (q && v > 0) q.value = l.qty; const g = document.querySelector(`[data-lgram="${i}"]`); if (g) g.value = '';
    persistCart(); updateTotalsOnly(); }
  else if (el.dataset.lgram != null) {      // grams (kg items)
    const i = +el.dataset.lgram, l = S.cart[i], v = num(el.value); l.amount = null; l.qty = Math.round(v) / 1000;
    const q = document.querySelector(`[data-qty="${i}"]`); if (q) q.value = l.qty; const a = document.querySelector(`[data-lamt="${i}"]`); if (a) a.value = '';
    persistCart(); updateTotalsOnly(); }
  else if (el.dataset.price != null) { S.cart[+el.dataset.price].unit_price = num(el.value); persistCart(); updateTotalsOnly(); }
  else if (el.dataset.ldisc != null) { S.cart[+el.dataset.ldisc].disc = clampPct(el.value); persistCart(); updateTotalsOnly(); }
  else if (el.dataset.split != null) { S.splitAmt = S.splitAmt || {}; S.splitAmt[el.dataset.split] = num(el.value); S.paid = splitSum(); S.paidManual = true; updateTotalsOnly(); }
  else if (el.id === 'in-discount') { if (S.discMode === 'pct') S.discPct = clampPct(el.value); else S.discount = num(el.value); updateTotalsOnly(); }
  else if (el.id === 'in-paid') { S.paid = num(el.value); S.paidManual = true; updateTotalsOnly(); }
});

document.addEventListener('keydown', async ev => {
  if (ev.key === 'Enter' && ev.target.id === 'bill-search') {
    ev.preventDefault();
    const code = ev.target.value.trim();
    if (!code) return;
    // Hardware/Bluetooth barcode scanners type the code and press Enter.
    if (!planHasBarcode()) return;
    const p = await findByBarcode(S.session.shop_id, code);
    if (p) { await addToCart(p, true); ev.target.value = ''; }
  }
});

document.addEventListener('change', async ev => {
  const id = ev.target.id;
  if (id === 'set-lang') { await saveCfg('lang', ev.target.value); setLang(ev.target.value); applyStaticText(); renderBillShell(); switchTab('settings'); }
  else if (id === 'pur-upcost') { S.pur.updateCost = ev.target.checked; }
  else if (id === 'in-dmode') { S.discMode = ev.target.value === 'pct' ? 'pct' : 'rs'; renderPay(); }
  else if (id === 'in-pm') { S.payMethod = ev.target.value; }
  else if (id === 'import-file') {
    const f = ev.target.files[0]; if (!f) return;
    try { const n = await syncImportFile(f); toast(t('import_done').replace('{n}', n), 4000); renderSettings(); }
    catch (e) { toast(e.message || t('import_bad'), 4500); }
    ev.target.value = '';
  }
  else if (id === 'set-theme') { await saveCfg('theme', ev.target.value); applyTheme(); }
  else if (isOwner() && id === 'set-tax') { await saveCfg('tax_rate', Math.max(0, num(ev.target.value))); }
  else if (isOwner() && id === 'set-cdisc') { await saveCfg('cashier_discount', ev.target.checked); }
  else if (isOwner() && id === 'set-oversell') { await saveCfg('allow_oversell', ev.target.checked); }
  else if (isOwner() && id === 'set-cprice') { await saveCfg('cashier_price', ev.target.checked); }
  else if (id === 'set-rh') { await saveCfg('receipt_header', ev.target.value); shopCfgChanged(); }
  else if (id === 'set-rf') { await saveCfg('receipt_footer', ev.target.value); shopCfgChanged(); }
  else if (id === 'set-sp') { await saveCfg('shop_phone', ev.target.value.trim()); shopCfgChanged(); }
  else if (id === 'set-sa') { await saveCfg('shop_address', ev.target.value.trim()); shopCfgChanged(); }
  else if (id === 'set-sn') { await saveCfg('shop_tax_no', ev.target.value.trim()); shopCfgChanged(); }
  else if (id === 'avatar-file') {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try { await avatarSet(await avatarResize(f)); } catch (e) { toast(t('pf_bad'), 3500); }
  }
  else if (id === 'set-rqr') { await saveCfg('receipt_qr', ev.target.checked); }
  else if (id === 'set-paper') { await saveCfg('paper', ev.target.value === 'a4' ? 'a4' : +ev.target.value); }
});

$('login-form').addEventListener('submit', doLogin);

boot();

// ───────── Selling units (Stage 2) ─────────
Object.assign(I18N.ur, {
  units_extra: 'دیگر اکائیاں (اختیاری)', units_hint: 'نام، بنیادی اکائی کی تعداد، قیمت (خالی ہو تو خود حساب ہوگا)',
  unit_name_ph: 'مثلاً کارٹن', unit_factor_ph: 'تعداد'
});
Object.assign(I18N.en, {
  units_extra: 'Other units (optional)', units_hint: 'Name, how many base units it holds, price (blank = calculated)',
  unit_name_ph: 'e.g. carton', unit_factor_ph: 'Qty'
});
// Bill: change the selling unit of a line (stock still goes down in the base unit — see saveSale).
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.dataset || el.dataset.cunit == null) return;
  const l = S.cart[+el.dataset.cunit]; if (!l) return;
  const u = +el.value >= 0 ? l.units[+el.value] : null;
  l.unit_name = u ? u.name : l.unit; l.unit_factor = u ? u.factor : 1;
  l.unit_price = u && u.price != null ? u.price : round2(l.base_price * l.unit_factor);
  l.cost_price = round2(l.base_cost * l.unit_factor);
  getStock(S.session.shop_id, l.product_id).then(st => { l.warn = st - l.qty * l.unit_factor < 0; refreshBill(); });
  refreshBill(); persistCart();
});

// ───────── Variants (Stage 4): size × colour -> one product each ─────────
Object.assign(I18N.ur, {
  variants_title: 'سائز / رنگ کے ویریئنٹس (اختیاری)',
  variants_hint: 'کاما سے الگ کر کے لکھیں۔ ہر سائز/رنگ کی الگ پروڈکٹ بنے گی، اسٹاک الگ ہوگا۔ بارکوڈ بعد میں ہر ایک میں ڈالیں۔',
  variants_sizes_ph: 'سائز: S, M, L', variants_colors_ph: 'رنگ: سفید, کالا',
  variants_too_many: 'ایک ساتھ 40 سے زیادہ ویریئنٹس نہیں بن سکتے'
});
Object.assign(I18N.en, {
  variants_title: 'Size / colour variants (optional)',
  variants_hint: 'Separate with commas. Each size/colour becomes its own product with its own stock. Add barcodes later.',
  variants_sizes_ph: 'Sizes: S, M, L', variants_colors_ph: 'Colours: White, Black',
  variants_too_many: 'Cannot create more than 40 variants at once'
});
function variantCombos(sizes, colors) {
  const split = s => [...new Set(String(s || '').split(/[,،\n]/).map(x => x.trim()).filter(Boolean))];
  const S_ = split(sizes), C_ = split(colors);
  if (!S_.length && !C_.length) return [];
  if (!S_.length) return C_;
  if (!C_.length) return S_;
  return S_.flatMap(s => C_.map(c => `${s} / ${c}`));
}

document.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.matches && ev.target.matches('a[role="button"]')) { ev.preventDefault(); ev.target.click(); } });
