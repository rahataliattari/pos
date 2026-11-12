// Universal POS — app logic (Stage 2: offline billing MVP).
// The UI reads/writes ONLY the local database. Network is used for login and the connectivity check.
// Sync engine comes in Stage 3.

const S = {
  session: null,          // { user_id, email, shop_id, shop_name, role }
  cfg: { tax_rate: 0, cashier_discount: false, cashier_price: false, receipt_header: '', receipt_footer: '', paper: 58, lang: 'ur' },
  cart: [],
  tab: 'bill',
  online: false,
  productPage: 0, productQuery: '',
  salesPage: 0,
  sb: null                // supabase client (login only, for now)
};

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = iso => { try { return new Date(iso).toLocaleString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } };
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
  if (!navigator.onLine) return false;
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
  $('chip-fail').hidden = !f; $('chip-fail').textContent = `✕ ${f}`;
}

// ───────── Settings ─────────
async function loadCfg() {
  for (const k of Object.keys(S.cfg)) S.cfg[k] = await getSetting('cfg_' + k, S.cfg[k]);
  setLang(S.cfg.lang);
}
async function saveCfg(k, v) { S.cfg[k] = v; await setSetting('cfg_' + k, v); }

// ───────── Boot ─────────
async function boot() {
  if (typeof Dexie === 'undefined' || typeof db === 'undefined') {
    $('boot').textContent = I18N.ur.lib_missing + ' / ' + I18N.en.lib_missing;
    return;
  }
  try { await db.open(); } catch (e) { $('boot').textContent = 'Database error: ' + e.message; return; }
  if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch (e) {} }
  await loadCfg();
  S.session = await getSetting('session');
  $('boot').hidden = true;
  if (S.session) await showApp(); else showLogin();
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);
  setInterval(refreshStatus, 20000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ───────── Login ─────────
function applyStaticText() {
  $('login-title').textContent = t('app_name');
  $('lbl-email').textContent = t('email'); $('lbl-pass').textContent = t('password');
  $('btn-login').textContent = t('login');
  $('syncnote').textContent = t('sync_note');
  $('btn-lang').textContent = LANG === 'ur' ? 'EN' : 'اردو';
  $('nav').innerHTML = [['bill', 'tab_bill'], ['products', 'tab_products'], ['sales', 'tab_sales'], ['settings', 'tab_settings']]
    .map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'active' : ''}">${t(l)}</button>`).join('');
}
function showLogin() { $('app').hidden = true; $('login').hidden = false; applyStaticText(); }

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
  if (!(await pingServer())) { err.textContent = t('login_need_online'); err.hidden = false; return; }
  $('btn-login').disabled = true;
  try {
    const sb = getSb();
    const { data, error } = await sb.auth.signInWithPassword({ email: $('in-email').value.trim(), password: $('in-pass').value });
    if (error) throw new Error(t('login_failed'));
    const user = data.user;
    // Membership is decided by the SERVER (RLS), never by the client.
    const { data: rows, error: e2 } = await sb.from('shop_members').select('shop_id, role, shops(name)').eq('user_id', user.id);
    if (e2) throw new Error(e2.message);
    if (!rows || !rows.length) throw new Error(t('no_shop'));
    const make = r => ({ user_id: user.id, email: user.email, shop_id: r.shop_id, shop_name: (r.shops && r.shops.name) || '', role: r.role });
    if (rows.length === 1) return await finishLogin(make(rows[0]));
    $('login-form').hidden = true;
    const box = $('shop-choice'); box.hidden = false;
    box.innerHTML = `<h3>${t('choose_shop')}</h3>` + rows.map((r, i) =>
      `<button class="btn secondary block" style="margin-bottom:8px" data-shop="${i}">${esc(r.shops && r.shops.name)} (${t(r.role)})</button>`).join('');
    box.onclick = ev => { const b = ev.target.closest('[data-shop]'); if (b) finishLogin(make(rows[+b.dataset.shop])); };
  } catch (ex) { err.textContent = ex.message || t('err_generic'); err.hidden = false; }
  finally { $('btn-login').disabled = false; }
}
async function finishLogin(session) {
  await setSetting('session', session);
  await setSetting('shop_id', session.shop_id);
  S.session = session;
  $('login-form').hidden = false; $('shop-choice').hidden = true; $('in-pass').value = '';
  await showApp();
}
async function doLogout() {
  if (!confirm(t('logout_confirm'))) return;
  try { if (S.sb) await S.sb.auth.signOut(); } catch (e) {}
  // Local business data is kept on purpose: pending records must never be deleted before server confirmation.
  await delSetting('session'); await delSetting('shop_id');
  S.session = null; S.cart = [];
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
  if (showApp._timer) return;
  showApp._timer = setInterval(async () => { if (S.session) { const p = await pendingCount(), f = await failedCount();
    $('chip-pend').hidden = !p; $('chip-pend').textContent = `${t('pending')}: ${p}`;
    $('chip-fail').hidden = !f; $('chip-fail').textContent = `✕ ${f}`; } }, 5000);
}

function switchTab(tab) {
  S.tab = tab;
  for (const k of ['bill', 'products', 'sales', 'settings']) $('view-' + k).hidden = k !== tab;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'products') { S.productPage = 0; renderProducts(); }
  if (tab === 'sales') { S.salesPage = 0; renderSales(); }
  if (tab === 'settings') renderSettings();
}

async function toggleLang() {
  await saveCfg('lang', LANG === 'ur' ? 'en' : 'ur');
  setLang(S.cfg.lang); applyStaticText();
  renderBillShell(); renderCart(); switchTab(S.tab);
}

// ───────── Billing ─────────
function renderBillShell() {
  $('view-bill').innerHTML = `
    <div class="row">
      <input id="bill-search" class="grow" type="search" placeholder="${t('search_ph')}" autocomplete="off">
      <button class="btn secondary" id="btn-scan" type="button">${t('scan')}</button>
    </div>
    <div class="results" id="bill-results" hidden></div>
    <div class="card" id="bill-cart"></div>
    <div class="card" id="bill-pay"></div>`;
}

let searchTimer;
async function doBillSearch(q) {
  const box = $('bill-results');
  if (!q.trim()) { box.hidden = true; box.innerHTML = ''; return; }
  const list = await searchProducts(S.session.shop_id, q, 20);
  const stocks = await getStocks(S.session.shop_id, list.map(p => p.id));
  box.hidden = false;
  box.innerHTML = list.length ? list.map(p => `
    <div class="result" data-add="${p.id}">
      <div><div>${esc(LANG === 'ur' && p.name_ur ? p.name_ur : p.name)}</div>
        <div class="muted">${t('stock')}: ${stocks[p.id]} ${esc(p.unit || '')}${p.barcode ? ' · ' + esc(p.barcode) : ''}</div></div>
      <div class="price">${money(p.sale_price)}</div>
    </div>`).join('') : `<div class="result muted">${t('no_results')}</div>`;
}

async function addToCartById(id) {
  const p = await db.products.get(id);
  if (p) await addToCart(p);
}
async function addToCart(p) {
  const line = S.cart.find(l => l.product_id === p.id);
  if (line) line.qty = Math.round((line.qty + 1) * 1000) / 1000;
  else S.cart.push({ product_id: p.id, product_name: p.name, unit: p.unit || '', unit_price: p.sale_price, cost_price: p.cost_price || 0, qty: 1 });
  const stock = await getStock(S.session.shop_id, p.id);
  const l = S.cart.find(x => x.product_id === p.id);
  l.warn = stock - l.qty < 0;
  const s = $('bill-search'); if (s) { s.value = ''; } $('bill-results').hidden = true;
  renderCart(); persistCart();
}

async function handleBarcode(code) {
  const p = await findByBarcode(S.session.shop_id, code.trim());
  if (p) { await addToCart(p); toast(p.name); }
  else toast(t('no_results') + ': ' + code);
}

function cartTotals() {
  const subtotal = S.cart.reduce((s, l) => s + Math.round(l.qty * l.unit_price * 100) / 100, 0);
  const d = Math.min(Math.max(num(S.discount), 0), subtotal);
  const tax = Math.round((subtotal - d) * num(S.cfg.tax_rate)) / 100;   // same rounding as saveSale()
  return { subtotal: Math.round(subtotal * 100) / 100, discount: Math.round(d * 100) / 100, tax, total: Math.round((subtotal - d + tax) * 100) / 100 };
}

function renderCart() {
  const box = $('bill-cart'), pay = $('bill-pay');
  if (!box) return;
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
        <button type="button" data-dec="${i}">−</button>
        <input type="number" inputmode="decimal" step="any" min="0" value="${l.qty}" data-qty="${i}">
        <button type="button" data-inc="${i}">+</button>
        <button type="button" data-rm="${i}" style="color:var(--err)">✕</button>
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
  const ip = $('in-paid'); if (ip && !S.paidManual) ip.value = S.paid;
  const bal = Math.round((tt.total - num(S.paid)) * 100) / 100;
  const b = $('bal-line'); if (b) b.textContent = bal > 0 ? t('balance') + ': ' + money(bal) : bal < 0 ? t('change') + ': ' + money(-bal) : '';
}

let persistTimer;
function persistCart() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => setSetting('cart_draft', S.cart).catch(() => {}), 300);
}

async function completeSale() {
  const btn = $('btn-complete'); btn.disabled = true;
  try {
    const tt = cartTotals();
    const sale = await saveSale({
      discount: tt.discount, tax_rate: num(S.cfg.tax_rate), paid: num(S.paid),
      payment_method: 'cash', created_by: S.session.user_id
    }, S.cart.filter(l => l.qty > 0).map(l => ({ product_id: l.product_id, product_name: l.product_name, qty: l.qty, unit_price: l.unit_price, cost_price: l.cost_price })));
    S.cart = []; S.discount = 0; S.paid = 0; S.paidManual = false;
    await setSetting('cart_draft', []);
    renderCart(); refreshStatus();
    await showReceipt(sale.id);
  } catch (ex) { toast((ex && ex.message) || t('err_generic'), 4000); btn.disabled = false; }
}

// ───────── Receipt ─────────
function receiptHtml(sale, items) {
  const c = S.cfg;
  return `<div class="receipt">
    <div class="c"><b>${esc(S.session.shop_name)}</b></div>
    ${c.receipt_header ? `<div class="c">${esc(c.receipt_header)}</div>` : ''}
    <hr>
    <div>${esc(t('invoice'))}: ${esc(sale.invoice_no)}</div>
    <div>${esc(fmtDate(sale.created_at))}</div>
    <hr>
    <table>${items.map(i => `<tr><td colspan="2">${esc(i.product_name)}</td></tr>
      <tr><td>${i.qty} × ${money(i.unit_price)}</td><td class="r">${money(i.line_total)}</td></tr>`).join('')}</table>
    <hr>
    <table>
      <tr><td>${t('subtotal')}</td><td class="r">${money(sale.subtotal)}</td></tr>
      ${sale.discount ? `<tr><td>${t('discount')}</td><td class="r">-${money(sale.discount)}</td></tr>` : ''}
      ${sale.tax ? `<tr><td>${t('tax')}</td><td class="r">${money(sale.tax)}</td></tr>` : ''}
      <tr><td><b>${t('total')}</b></td><td class="r"><b>${money(sale.total)}</b></td></tr>
      <tr><td>${t('paid')}</td><td class="r">${money(sale.paid)}</td></tr>
      ${sale.paid < sale.total ? `<tr><td>${t('balance')}</td><td class="r">${money(sale.total - sale.paid)}</td></tr>` : ''}
    </table>
    <hr>
    <div class="c">${esc(c.receipt_footer || t('thanks'))}</div>
  </div>`;
}

async function showReceipt(saleId) {
  const r = await getSaleWithItems(saleId);
  if (!r) return;
  const html = receiptHtml(r.sale, r.items);
  openModal(`<h2>${t('receipt')}</h2>${html}
    <div class="row" style="margin-top:12px">
      <button class="btn grow" id="btn-print">${t('print')}</button>
      <button class="btn secondary grow" data-close>${t('new_sale')}</button>
    </div>`);
  $('btn-print').onclick = () => {
    $('receipt-print').innerHTML = html;
    document.documentElement.style.setProperty('--paper', (S.cfg.paper || 58) + 'mm');
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 500);
  };
}

// ───────── Barcode camera scan (where BarcodeDetector exists) ─────────
let scanStream = null, scanTimer = null;
async function startScan() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices) { toast(t('scan_unsupported'), 3500); return; }
  openModal(`<h2>${t('scan')}</h2><video id="scanvideo" playsinline muted></video>
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
  const html = list.map(s => `
    <div class="card" data-sale="${s.id}">
      <div class="row"><div class="grow"><b>${esc(s.invoice_no)}</b><div class="muted">${esc(fmtDate(s.created_at))}</div></div>
        <div class="price">${money(s.total)}</div></div>
      <div class="muted">${s.sync_status === 'synced' ? '✓' : '⏳ ' + t('pending')}</div>
    </div>`).join('');
  if (!append) $('sales-list').innerHTML = html || `<div class="muted" style="text-align:center;padding:20px">${t('no_sales')}</div>`;
  else $('sales-list').insertAdjacentHTML('beforeend', html);
  $('sales-more').innerHTML = list.length === 30 ? `<button class="btn secondary block" id="btn-moresales">${t('more')}</button>` : '';
}

// ───────── Settings screen ─────────
async function renderSettings() {
  const c = S.cfg, own = isOwner(), dis = own ? '' : 'disabled';
  $('view-settings').innerHTML = `
    <div class="card">
      <div>${t('shop')}: <b>${esc(S.session.shop_name)}</b></div>
      <div class="muted">${esc(S.session.email)} · ${t('role')}: ${t(S.session.role)}</div>
      <div class="muted" dir="ltr" style="text-align:start">${t('device_id')}: ${esc(await getDeviceId())}</div>
    </div>
    <div class="card">
      <label>${t('language')}</label>
      <select id="set-lang"><option value="ur" ${c.lang === 'ur' ? 'selected' : ''}>اردو</option><option value="en" ${c.lang === 'en' ? 'selected' : ''}>English</option></select>
      ${own ? '' : `<div class="muted" style="margin-top:8px">${t('owner_only')}</div>`}
      <label>${t('tax_rate')}</label><input id="set-tax" type="number" inputmode="decimal" step="any" min="0" value="${c.tax_rate}" ${dis}>
      <label><input type="checkbox" id="set-cdisc" style="width:auto;min-height:0" ${c.cashier_discount ? 'checked' : ''} ${dis}> ${t('cashier_discount')}</label>
      <label><input type="checkbox" id="set-cprice" style="width:auto;min-height:0" ${c.cashier_price ? 'checked' : ''} ${dis}> ${t('cashier_price')}</label>
      <label>${t('receipt_header')}</label><input id="set-rh" value="${esc(c.receipt_header)}">
      <label>${t('receipt_footer')}</label><input id="set-rf" value="${esc(c.receipt_footer)}">
      <label>${t('paper_width')}</label>
      <select id="set-paper"><option value="58" ${c.paper == 58 ? 'selected' : ''}>58 mm</option><option value="80" ${c.paper == 80 ? 'selected' : ''}>80 mm</option></select>
    </div>
    <button class="btn secondary block" id="btn-export" style="margin-bottom:10px">${t('export_data')}</button>
    <button class="btn danger block" id="btn-logout">${t('logout')}</button>`;
}

// ───────── Event wiring (delegation) ─────────
document.addEventListener('click', async ev => {
  const el = ev.target;
  const tab = el.closest('[data-tab]'); if (tab) return switchTab(tab.dataset.tab);
  if (el.closest('[data-close]')) return closeModal();
  if (el === $('modal')) return closeModal();
  const add = el.closest('[data-add]'); if (add) return addToCartById(add.dataset.add);
  const inc = el.closest('[data-inc]'); if (inc) { const l = S.cart[+inc.dataset.inc]; l.qty = Math.round((l.qty + 1) * 1000) / 1000; renderCart(); return persistCart(); }
  const dec = el.closest('[data-dec]'); if (dec) { const l = S.cart[+dec.dataset.dec]; l.qty = Math.max(0, Math.round((l.qty - 1) * 1000) / 1000); if (l.qty === 0) S.cart.splice(+dec.dataset.dec, 1); renderCart(); return persistCart(); }
  const rm = el.closest('[data-rm]'); if (rm) { S.cart.splice(+rm.dataset.rm, 1); renderCart(); return persistCart(); }
  if (el.closest('#btn-scan')) return startScan();
  if (el.closest('#btn-complete')) return completeSale();
  if (el.closest('#btn-addprod')) return openProductForm(null);
  const ed = el.closest('[data-edit]'); if (ed) return openProductForm(ed.dataset.edit);
  if (el.closest('#btn-moreprod')) { S.productPage++; return renderProducts(true); }
  const sale = el.closest('[data-sale]'); if (sale) return showReceipt(sale.dataset.sale);
  if (el.closest('#btn-moresales')) { S.salesPage++; return renderSales(true); }
  if (el.closest('#btn-lang')) return toggleLang();
  if (el.closest('#btn-logout')) return doLogout();
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

document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'bill-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => doBillSearch(el.value), 120); }
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
    if (p) { await addToCart(p); ev.target.value = ''; }
  }
});

document.addEventListener('change', async ev => {
  const id = ev.target.id;
  if (id === 'set-lang') { await saveCfg('lang', ev.target.value); setLang(ev.target.value); applyStaticText(); renderBillShell(); renderCart(); renderSettings(); }
  else if (isOwner() && id === 'set-tax') { await saveCfg('tax_rate', Math.max(0, num(ev.target.value))); }
  else if (isOwner() && id === 'set-cdisc') { await saveCfg('cashier_discount', ev.target.checked); }
  else if (isOwner() && id === 'set-cprice') { await saveCfg('cashier_price', ev.target.checked); }
  else if (id === 'set-rh') { await saveCfg('receipt_header', ev.target.value); }
  else if (id === 'set-rf') { await saveCfg('receipt_footer', ev.target.value); }
  else if (id === 'set-paper') { await saveCfg('paper', +ev.target.value); }
});

$('login-form').addEventListener('submit', doLogin);

boot();
