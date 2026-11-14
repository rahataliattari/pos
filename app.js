// Universal POS — app logic (Stage 2: offline billing MVP).
// The UI reads/writes ONLY the local database. Network is used for login and the connectivity check.
// Sync engine: sync.js (Stage 3).

const S = {
  session: null,          // { user_id, email, shop_id, shop_name, role }
  cfg: { tax_rate: 0, cashier_discount: false, cashier_price: false, receipt_header: '', receipt_footer: '', shop_phone: '', shop_address: '', shop_tax_no: '', paper: 58, lang: 'ur', theme: 'green' },
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
// Mobile number (03xx..., +92 3xx..., 923xx...) -> internal email. An input containing '@' is used as an email as-is.
function loginIdToEmail(v) {
  v = (v || '').trim();
  if (v.includes('@')) return v.toLowerCase();
  let d = v.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d;
  if (!/^923\d{9}$/.test(d)) throw new Error(t('bad_phone'));
  return `${d}@${POS_CONFIG.LOGIN_DOMAIN}`;
}
const EYE = shown => ic(shown ? 'eyeoff' : 'eye', 22);
function pwField(id, ph, style = '') {          // password input with a show/hide eye button
  return `<div class="pwwrap" ${style ? `style="${style}"` : ''}><input id="${id}" type="password" placeholder="${ph}" autocapitalize="none" autocorrect="off" spellcheck="false"><button type="button" class="eye" data-eye="${id}" aria-label="show/hide password">${EYE(false)}</button></div>`;
}
function initEyes() { document.querySelectorAll('button.eye[data-eye]:empty').forEach(b => { b.innerHTML = EYE(false); }); }
document.addEventListener('click', ev => {
  const b = ev.target.closest('button.eye[data-eye]'); if (!b) return;
  const inp = document.getElementById(b.dataset.eye); if (!inp) return;
  const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = EYE(show);
});
const homeHello = () => (S.session && S.session.user_name) || t('greeting');   // Home header: the signed-in person's name
const displayLogin = e => String(e || '').replace('@' + (window.POS_CONFIG && POS_CONFIG.LOGIN_DOMAIN), '');

function applyStaticText() {
  $('login-title').textContent = t('app_name');
  $('lbl-email').textContent = t('phone'); $('lbl-pass').textContent = t('password');
  $('btn-login').textContent = t('login');
  $('syncnote').textContent = (typeof saAnnouncement === 'function' && saAnnouncement()) || t('sync_note');
  $('btn-lang').textContent = LANG === 'ur' ? 'EN' : 'اردو';
  $('hdr-avatar').innerHTML = ic('store', 24);
  $('nav').innerHTML = [['home', 'tab_home', 'home'], ['products', 'tab_inventory', 'box'], ['bill', 'tab_sale', 'cart'], ['sales', 'tab_sales', 'receipt'], ['settings', 'tab_more', 'settings']]
    .map(([k, l, icon]) => `<button data-tab="${k}" class="${k === 'bill' ? 'fab ' : ''}${S.tab === k ? 'active' : ''}"><span class="ico">${ic(icon, k === 'bill' ? 28 : 22)}</span><span>${t(l)}</span></button>`).join('');
}
function showLogin() { $('app').hidden = true; $('login').hidden = false; applyStaticText(); const ip = $('in-pass'); if (ip) ip.type = 'password'; initEyes(); }

function getSb() {
  if (!S.sb) {
    if (typeof supabase === 'undefined') throw new Error(t('lib_missing'));
    S.sb = supabase.createClient(POS_CONFIG.SUPABASE_URL, POS_CONFIG.SUPABASE_KEY);
  }
  return S.sb;
}

async function doLogin(e) {
  e.preventDefault();
  const err = $('login-err'); err.hidden = true;
  let loginEmail;
  try { loginEmail = loginIdToEmail($('in-email').value); } catch (ex) { err.textContent = ex.message; err.hidden = false; return; }
  if (!(await pingServer())) { err.textContent = t('login_need_online'); err.hidden = false; return; }
  $('btn-login').disabled = true;
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
    const { data: all, error: e2 } = await sb.from('shop_members').select('shop_id, role, active, name, shops(name, suspended, archived, expires_at)').eq('user_id', user.id);
    if (e2) throw new Error(e2.message);
    if (isAdm && (!all || !all.length)) return enterAdminOnly();
    if (!all || !all.length) throw new Error(t('no_shop'));
    // blocked shops (suspended / archived / expired) and deactivated members can't log in; Super Admin is never blocked
    const rows = isAdm ? all : all.filter(r => r.active !== false && r.shops && !r.shops.suspended && !r.shops.archived && new Date(r.shops.expires_at).getTime() >= Date.now());
    if (!rows.length) { try { await sb.auth.signOut(); } catch (x) {} throw new Error(t('sa_shop_blocked')); }
    const make = r => ({ user_id: user.id, email: user.email, shop_id: r.shop_id, shop_name: (r.shops && r.shops.name) || '', user_name: r.name || '', role: r.role, admin: isAdm, expires_at: r.shops && r.shops.expires_at });
    if (rows.length === 1) return await finishLogin(make(rows[0]));
    $('login-form').hidden = true;
    const box = $('shop-choice'); box.hidden = false;
    box.innerHTML = `<h3>${t('choose_shop')}</h3>` + rows.map((r, i) =>
      `<button class="btn secondary block" style="margin-bottom:8px" data-shop="${i}">${esc(r.shops && r.shops.name)} (${t(r.role)})</button>`).join('');
    box.onclick = ev => { const b = ev.target.closest('[data-shop]'); if (b) finishLogin(make(rows[+b.dataset.shop])); };
  } catch (ex) { err.textContent = ex.message || t('err_generic'); err.hidden = false; }
  finally { $('btn-login').disabled = false; }
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
  await setSetting('session', session);
  await setSetting('shop_id', session.shop_id);
  S.session = session;
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
  $('hdr-shop').textContent = S.session.shop_name || t('app_name');
  applyStaticText();
  const draft = await getSetting('cart_draft', []);
  if (Array.isArray(draft) && !S.cart.length) S.cart = draft;
  renderBillShell(); renderCart();
  switchTab(S.tab);
  refreshStatus();
  if (typeof syncStart === 'function') syncStart();
  if (!window.POS_DEMO && navigator.onLine) saLoadAnnouncement().catch(() => {});
  if (showApp._timer) return;
  showApp._timer = setInterval(async () => { if (S.session) { const p = await pendingCount(), f = await failedCount();
    $('chip-pend').hidden = !p; $('chip-pend').textContent = `${t('pending')}: ${p}`;
    $('chip-fail').hidden = !f; $('chip-fail').innerHTML = `${ic('x', 12)} ${f}`; } }, 5000);
}

const TAB_TITLE = { home: null, bill: 'tab_bill', products: 'tab_products', sales: 'tab_sales', customers: 'customers', purchases: 'mod_purchases', expenses: 'mod_expenses', reports: 'mod_reports', settings: 'tab_settings' };
const VIEWS = ['home', 'bill', 'products', 'sales', 'customers', 'purchases', 'expenses', 'reports', 'settings'];
function switchTab(tab) {
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
  const mods = [
    { tab: 'bill', ic: 'cart', l: 'tab_bill' }, { tab: 'products', ic: 'box', l: 'tab_products' },
    { tab: 'sales', ic: 'receipt', l: 'tab_sales' }, { tab: 'customers', ic: 'users', l: 'mod_customers' },
    { tab: 'expenses', ic: 'wallet', l: 'mod_expenses' }, { tab: 'purchases', ic: 'truck', l: 'mod_purchases' },
    { tab: 'reports', ic: 'chart', l: 'mod_reports' }, { tab: 'settings', ic: 'settings', l: 'tab_settings' }
  ];
  const dateStr = new Date().toLocaleDateString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'full' });
  $('view-home').innerHTML = `
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
    <div class="mods">${mods.map(m => m.soon
      ? `<button class="mod soon" disabled><span class="soonb">${t('soon')}</span><span class="mi">${ic(m.ic, 28)}</span>${t(m.l)}</button>`
      : `<button class="mod" data-tab="${m.tab}"><span class="mi">${ic(m.ic, 28)}</span>${t(m.l)}</button>`).join('')}</div>`;
}

// ───────── Billing: search + product tiles ─────────
function renderBillShell() {
  $('view-bill').innerHTML = `
    <div class="searchbar">
      <input id="bill-search" class="grow" type="search" placeholder="${t('search_ph')}" autocomplete="off" value="${esc(S.billQuery)}">
      <button class="iconbtn green" id="btn-scan" type="button" aria-label="${t('scan')}">${ic('scan', 22)}</button>
      ${canEditProducts() ? `<button class="iconbtn" id="btn-addprod2" type="button" aria-label="${t('add_product')}">${ic('plus', 22)}</button>` : ''}
    </div>
    <div class="tiles" id="tiles"></div><div id="tiles-more" style="margin-top:10px"></div>`;
}

function cartLine(id) { return S.cart.find(l => l.product_id === id); }

function renderTiles() {
  const box = $('tiles'); if (!box) return;
  box.innerHTML = S.tiles.length ? S.tiles.map(p => {
    const l = cartLine(p.id), st = S.tileStocks[p.id];
    return `<div class="tile ${l ? 'sel' : ''}" data-add="${p.id}">
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
  const line = cartLine(p.id);
  if (line) line.qty = Math.round((line.qty + 1) * 1000) / 1000;
  else S.cart.push({ product_id: p.id, product_name: p.name, unit: p.unit || '', unit_price: p.sale_price, cost_price: p.cost_price || 0, qty: 1 });
  const stock = await getStock(S.session.shop_id, p.id);
  const l = cartLine(p.id);
  l.warn = stock - l.qty < 0;
  S.tileStocks[p.id] = stock;
  if (clearSearch && S.billQuery) { S.billQuery = ''; const s = $('bill-search'); if (s) s.value = ''; loadTiles(); }
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
  const show = S.tab === 'bill' && S.cart.length > 0;
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
  const subtotal = S.cart.reduce((s, l) => s + Math.round(l.qty * l.unit_price * 100) / 100, 0);
  const d = Math.min(Math.max(num(S.discount), 0), subtotal);
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
        <div class="row" style="margin-top:4px">
          ${canPrice() ? `<input type="number" inputmode="decimal" step="any" min="0" value="${l.unit_price}" data-price="${i}" style="width:90px">` : `<span class="muted">${money(l.unit_price)}</span>`}
          <span class="muted">× ${l.qty} = <b>${money(l.qty * l.unit_price)}</b></span>
        </div>
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
  if (S.paidManual !== true) S.paid = tt.total;
  const bal = Math.round((tt.total - num(S.paid)) * 100) / 100;
  pay.innerHTML = `
    <div class="custrow" id="btn-pickcust" role="button" tabindex="0"><span class="lic">${ic('user', 18)}</span>
      <div class="grow">${S.saleCust ? `<b>${esc(S.saleCust.name)}</b>` : `<span class="muted">${t('walk_in')}</span>`}</div>
      <span class="btn secondary sm">${S.saleCust ? t('change_customer') : t('pick_customer')}</span></div>
    <div class="warn" id="cust-warn" ${bal > 0 && !S.saleCust ? '' : 'hidden'}>${t('need_customer')}</div>
    <div class="totals">
      <div><span>${t('subtotal')}</span><span>${money(tt.subtotal)}</span></div>
      ${canDiscount() ? `<div><span>${t('discount')}</span><input id="in-discount" type="number" inputmode="decimal" step="any" min="0" value="${S.discount || ''}" style="width:110px"></div>` : ''}
      ${num(S.cfg.tax_rate) ? `<div><span>${t('tax')} (${S.cfg.tax_rate}%)</span><span>${money(tt.tax)}</span></div>` : ''}
      <div class="grand"><span>${t('total')}</span><span id="grand">${money(tt.total)}</span></div>
      <div style="margin-top:6px"><span>${t('paid')}</span><input id="in-paid" type="number" inputmode="decimal" step="any" min="0" value="${S.paid}" style="width:130px"></div>
      <div class="muted" id="bal-line">${bal > 0 ? t('balance') + ': ' + money(bal) : bal < 0 ? t('change') + ': ' + money(-bal) : ''}</div>
    </div>
    <button class="btn block" id="btn-complete" style="margin-top:10px">${t('complete_sale')}</button>`;
}

function updateTotalsOnly() {
  const tt = cartTotals();
  if (!S.paidManual) S.paid = tt.total;
  const g = $('grand'); if (g) g.textContent = money(tt.total);
  renderBillBar();
  const ip = $('in-paid'); if (ip && !S.paidManual) ip.value = S.paid;
  const bal = Math.round((tt.total - num(S.paid)) * 100) / 100;
  const b = $('bal-line'); if (b) b.textContent = bal > 0 ? t('balance') + ': ' + money(bal) : bal < 0 ? t('change') + ': ' + money(-bal) : '';
  const w = $('cust-warn'); if (w) w.hidden = !(bal > 0 && !S.saleCust);
}

let persistTimer;
function persistCart() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => setSetting('cart_draft', S.cart).catch(() => {}), 300);
}

async function completeSale() {
  const tt = cartTotals();
  // Unpaid part of a bill is udhaar: it must belong to a named customer.
  if (num(S.paid) < tt.total && !S.saleCust) { const w = $('cust-warn'); if (w) w.hidden = false; return toast(t('need_customer'), 3500); }
  const btn = $('btn-complete'); btn.disabled = true;
  try {
    const sale = await saveSale({
      customer_id: S.saleCust ? S.saleCust.id : null,
      discount: tt.discount, tax_rate: num(S.cfg.tax_rate), paid: num(S.paid),
      payment_method: 'cash', created_by: S.session.user_id
    }, S.cart.filter(l => l.qty > 0).map(l => ({ product_id: l.product_id, product_name: l.product_name, qty: l.qty, unit_price: l.unit_price, cost_price: l.cost_price })));
    S.cart = []; S.discount = 0; S.paid = 0; S.paidManual = false; S.saleCust = null;
    await setSetting('cart_draft', []);
    S.tiles.length && Object.keys(S.tileStocks).length && loadTiles();
    refreshBill(); refreshStatus();
    await showReceipt(sale.id);
  } catch (ex) { toast((ex && ex.message) || t('err_generic'), 4000); btn.disabled = false; }
}

// ───────── Partial return ─────────
async function showReturnForm(saleId) {
  const r = await getSaleWithItems(saleId); if (!r) return;
  openModal(`<h2>${t('return_items')}</h2>
    ${r.items.filter(i => i.qty > 0).map(i => `<div class="card"><div class="row"><div class="grow"><b>${esc(i.product_name)}</b>
      <div class="muted">${t('qty')}: ${i.qty} × ${money(i.unit_price)}</div></div>
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
      : canEditProducts() ? `<button class="btn secondary block" id="btn-return" style="margin-top:10px">${t('return_items')}</button><button class="btn danger block" id="btn-void" style="margin-top:10px">${t('void_sale')}</button>` : ''}
    ${r.sale.returned_total > 0 ? `<div class="muted" style="margin-top:8px">${t('returned_total')}: ${money(r.sale.returned_total)}${r.sale.refunded > 0 ? ' · ' + t('refund_cash') + ': ' + money(r.sale.refunded) : ''}</div>` : ''}`);
  if ($('btn-return')) $('btn-return').onclick = () => showReturnForm(saleId);
  if ($('btn-void')) $('btn-void').onclick = async () => {
    if (!confirm(t('void_confirm'))) return;
    const reason = prompt(t('void_reason')) ;
    if (reason === null) return;
    try { await voidSale(saleId, reason); toast(t('saved')); closeModal(); if (S.tab === 'sales') { S.salesPage = 0; renderSales(); } if (S.tab === 'home') renderHome(); }
    catch (e) { toast(e.message || t('err_generic'), 4000); }
  };
  $('btn-print').onclick = () => doPrint(html, S.cfg.paper);
}

// ───────── Barcode camera scan (where BarcodeDetector exists) ─────────
let scanStream = null, scanTimer = null;
async function startScan() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices) { toast(t('scan_unsupported'), 3500); return; }
  openModal(`<h2>${t('scan')}</h2><div class="scanwrap"><video id="scanvideo" playsinline muted></video><div class="scanframe"><i class="scanline"></i></div></div>
    <div style="margin-top:10px"><button class="btn secondary block" data-close>${t('cancel')}</button></div>`);
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('scanvideo'); v.srcObject = scanStream; await v.play();
    const det = new BarcodeDetector();
    scanTimer = setInterval(async () => {
      try {
        const codes = await det.detect(v);
        if (codes.length) { const val = codes[0].rawValue; closeModal(); await handleBarcode(val); }
      } catch (e) {}
    }, 300);
  } catch (e) { closeModal(); toast(t('scan_unsupported'), 3500); }
}
function stopScan() {
  clearInterval(scanTimer); scanTimer = null;
  if (scanStream) { scanStream.getTracks().forEach(tr => tr.stop()); scanStream = null; }
}

// ───────── Products ─────────
async function renderProducts(append = false) {
  const v = $('view-products');
  if (!append) {
    v.innerHTML = `
      <div class="row"><input id="prod-search" class="grow" type="search" placeholder="${t('search_ph')}" value="${esc(S.productQuery)}">
        ${canEditProducts() ? `<button class="btn" id="btn-addprod">+ ${t('add_product')}</button>` : ''}</div>
      ${canEditProducts() ? '' : `<div class="muted" style="margin:6px 0">${t('read_only')}</div>`}
      <div id="prod-list" style="margin-top:8px"></div><div id="prod-more"></div>`;
  }
  const list = await listProducts(S.session.shop_id, S.productQuery, S.productPage, 30);
  const stocks = await getStocks(S.session.shop_id, list.map(p => p.id));
  const html = list.map(p => `
    <div class="card" ${canEditProducts() ? `data-edit="${p.id}"` : ''}>
      <div class="row"><div class="grow"><b>${esc(p.name)}</b>${p.name_ur ? ` <span class="muted">${esc(p.name_ur)}</span>` : ''}
        <div class="muted">${p.barcode ? esc(p.barcode) + ' · ' : ''}${t('stock')}: ${stocks[p.id]} ${esc(p.unit || '')}</div></div>
        <div class="price">${money(p.sale_price)}</div></div>
      ${p.min_stock && stocks[p.id] <= p.min_stock ? `<div class="warn">${t('stock')}: ${stocks[p.id]} ≤ ${p.min_stock}</div>` : ''}
    </div>`).join('');
  const target = $('prod-list');
  if (!append) target.innerHTML = html || `<div class="muted" style="text-align:center;padding:20px">${t('no_products')}</div>`;
  else target.insertAdjacentHTML('beforeend', html);
  $('prod-more').innerHTML = list.length === 30 ? `<button class="btn secondary block" id="btn-moreprod">${t('more')}</button>` : '';
}

async function openProductForm(id) {
  const p = id ? await db.products.get(id) : {};
  const stock = id ? await getStock(S.session.shop_id, id) : 0;
  openModal(`<h2>${id ? t('edit_product') : t('add_product')}</h2>
    <form id="prod-form">
      <label>${t('name')}</label><input name="name" required value="${esc(p.name)}">
      <label>${t('name_ur')}</label><input name="name_ur" value="${esc(p.name_ur)}">
      <label>${t('barcode')}</label><input name="barcode" inputmode="numeric" dir="ltr" value="${esc(p.barcode)}">
      <div class="row"><div class="grow"><label>${t('cost')}</label><input name="cost_price" type="number" inputmode="decimal" step="any" min="0" value="${p.cost_price ?? ''}"></div>
        <div class="grow"><label>${t('sale_price')}</label><input name="sale_price" type="number" inputmode="decimal" step="any" min="0" required value="${p.sale_price ?? ''}"></div></div>
      <div class="row"><div class="grow"><label>${t('unit')}</label><input name="unit" value="${esc(p.unit || 'pcs')}"></div>
        <div class="grow"><label>${t('min_stock')}</label><input name="min_stock" type="number" inputmode="decimal" step="any" min="0" value="${p.min_stock ?? ''}"></div></div>
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
      await saveProduct({ ...(id ? { id } : {}), name: f.name, name_ur: f.name_ur, barcode: f.barcode,
        cost_price: f.cost_price, sale_price: f.sale_price, unit: f.unit, min_stock: f.min_stock },
        { openingStock: f.opening, adjust: f.adjust, adjustNote: f.adjust_note });
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
  if (!append) v.innerHTML = `<h3 style="margin:0 0 8px">${t('sales_hist')}</h3><div id="sales-list"></div><div id="sales-more"></div>`;
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
      <label><input type="checkbox" id="set-cprice" style="width:auto;min-height:0" ${c.cashier_price ? 'checked' : ''} ${dis}> ${t('cashier_price')}</label>`;

  const receipt = `<label>${t('receipt_header')}</label><input id="set-rh" value="${esc(c.receipt_header)}" ${rdis}>
      <label>${t('receipt_footer')}</label><input id="set-rf" value="${esc(c.receipt_footer)}" ${rdis}>
      <label>${t('set_phone')}</label><input id="set-sp" inputmode="tel" dir="ltr" value="${esc(c.shop_phone)}" ${rdis}>
      <label>${t('set_addr')}</label><input id="set-sa" value="${esc(c.shop_address)}" ${rdis}>
      <label>${t('set_ntn')}</label><input id="set-sn" dir="ltr" value="${esc(c.shop_tax_no)}" ${rdis}>
      <label>${t('paper_width')}</label>
      <select id="set-paper"><option value="58" ${c.paper == 58 ? 'selected' : ''}>58 mm</option><option value="80" ${c.paper == 80 ? 'selected' : ''}>80 mm</option><option value="a4" ${c.paper === 'a4' ? 'selected' : ''}>A4</option></select>`;

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
    <div class="card">
      <div>${t('shop')}: <b>${esc(S.session.shop_name)}</b></div>
      ${S.session.user_name ? `<div><b>${esc(S.session.user_name)}</b></div>` : ''}<div class="muted">${esc(displayLogin(S.session.email))} · ${t('role')}: ${t(S.session.role)}</div>
    </div>
    ${account ? sec('account', 'user', t('set_sec_account'), account) : ''}
    ${sec('billing', 'receipt', t('set_sec_billing'), billing)}
    ${sec('receipt', 'print', t('set_sec_receipt'), receipt)}
    ${sec('look', 'settings', t('set_sec_look'), look)}
    ${sec('data', 'download', t('set_sec_data') + warnDot, data)}
    <div style="margin-top:12px">
    ${(window.POS_DEMO || (S.session && S.session.admin)) ? `<button class="btn block" id="btn-sa-open" style="margin-bottom:10px">${ic('shield', 18)} ${t('sa_open')}</button>` : ''}
    <button class="btn secondary block" id="btn-help" style="margin-bottom:10px">${ic('help', 18)} ${t('help_btn')}</button>
    <button class="btn danger block" id="btn-logout">${ic('logout', 18)} ${t('logout')}</button></div>`;
  if (typeof syncUi === 'function') syncUi();
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
  const inc = el.closest('[data-inc]'); if (inc) { const l = S.cart[+inc.dataset.inc]; l.qty = Math.round((l.qty + 1) * 1000) / 1000; refreshBill(); return persistCart(); }
  const dec = el.closest('[data-dec]'); if (dec) { const l = S.cart[+dec.dataset.dec]; l.qty = Math.max(0, Math.round((l.qty - 1) * 1000) / 1000); if (l.qty === 0) S.cart.splice(+dec.dataset.dec, 1); refreshBill(); return persistCart(); }
  const rm = el.closest('[data-rm]'); if (rm) { S.cart.splice(+rm.dataset.rm, 1); refreshBill(); return persistCart(); }
  if (el.closest('#btn-checkout')) return openCheckout();
  if (el.closest('#btn-moretiles')) { S.billPage++; return loadTiles(true); }
  if (el.closest('#btn-addprod2')) return openProductForm(null);
  if (el.closest('#btn-scan')) return startScan();
  if (el.closest('#btn-complete')) return completeSale();
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
  else if (el.dataset.qty != null) { S.cart[+el.dataset.qty].qty = num(el.value); persistCart(); updateTotalsOnly(); }
  else if (el.dataset.price != null) { S.cart[+el.dataset.price].unit_price = num(el.value); persistCart(); updateTotalsOnly(); }
  else if (el.id === 'in-discount') { S.discount = num(el.value); updateTotalsOnly(); }
  else if (el.id === 'in-paid') { S.paid = num(el.value); S.paidManual = true; updateTotalsOnly(); }
});

document.addEventListener('keydown', async ev => {
  if (ev.key === 'Enter' && ev.target.id === 'bill-search') {
    ev.preventDefault();
    const code = ev.target.value.trim();
    if (!code) return;
    // Hardware/Bluetooth barcode scanners type the code and press Enter.
    const p = await findByBarcode(S.session.shop_id, code);
    if (p) { await addToCart(p, true); ev.target.value = ''; }
  }
});

document.addEventListener('change', async ev => {
  const id = ev.target.id;
  if (id === 'set-lang') { await saveCfg('lang', ev.target.value); setLang(ev.target.value); applyStaticText(); renderBillShell(); switchTab('settings'); }
  else if (id === 'pur-upcost') { S.pur.updateCost = ev.target.checked; }
  else if (id === 'import-file') {
    const f = ev.target.files[0]; if (!f) return;
    try { const n = await syncImportFile(f); toast(t('import_done').replace('{n}', n), 4000); renderSettings(); }
    catch (e) { toast(e.message || t('import_bad'), 4500); }
    ev.target.value = '';
  }
  else if (id === 'set-theme') { await saveCfg('theme', ev.target.value); applyTheme(); }
  else if (isOwner() && id === 'set-tax') { await saveCfg('tax_rate', Math.max(0, num(ev.target.value))); }
  else if (isOwner() && id === 'set-cdisc') { await saveCfg('cashier_discount', ev.target.checked); }
  else if (isOwner() && id === 'set-cprice') { await saveCfg('cashier_price', ev.target.checked); }
  else if (id === 'set-rh') { await saveCfg('receipt_header', ev.target.value); shopCfgChanged(); }
  else if (id === 'set-rf') { await saveCfg('receipt_footer', ev.target.value); shopCfgChanged(); }
  else if (id === 'set-sp') { await saveCfg('shop_phone', ev.target.value.trim()); shopCfgChanged(); }
  else if (id === 'set-sa') { await saveCfg('shop_address', ev.target.value.trim()); shopCfgChanged(); }
  else if (id === 'set-sn') { await saveCfg('shop_tax_no', ev.target.value.trim()); shopCfgChanged(); }
  else if (id === 'set-paper') { await saveCfg('paper', ev.target.value === 'a4' ? 'a4' : +ev.target.value); }
});

$('login-form').addEventListener('submit', doLogin);

boot();
