// Universal POS — billing/cart.js: bill helpers, search + product tiles, cart, checkout, payment, hold, complete sale, edit a bill,
// and the selling-unit selector of a cart line. (Quick Bill = billing/quick.js; held bills / quotes = billing/hold-quotes.js.)
// Moved out of app.js (step 4 of the restructuring) — NO behaviour change. Loaded BEFORE app.js.
// Uses (defined elsewhere): S, $, PAY_METHODS, esc, money, num, t, openModal, closeModal, toast, saveSale, getStock, listProducts …
// The click/input wiring of the bill screen is still in app.js "Event wiring" (moves in a later step).

// ───────── Bill helpers ─────────
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
    <div class="tiles" id="tiles"></div><div id="tiles-more" class="u-mt-10"></div>
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
    : `<div class="muted u-grid-column-1-1 u-ta-center u-p-24">${S.billQuery ? t('no_results') : t('no_products')}</div>`;
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
  openModal(`<h2>${t('checkout')}</h2><div id="bill-cart"></div><div id="bill-pay" class="u-mt-8"></div>`);
  renderCart();
}

function cartTotals() {
  // Same steps and rounding as saveSale() (db.js), so the total shown on screen is exactly the total that gets saved.
  // (Before: tax was worked out on the UNROUNDED % discount, which made some bills differ by 1 paisa from the saved bill.)
  const subtotal = round2(S.cart.reduce((s, l) => s + lineTotal(l), 0));
  const discount = round2(saleDiscountFor(subtotal));
  const tax = round2((subtotal - discount) * num(S.cfg.tax_rate) / 100);
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) };
}

function renderCart() {
  const box = $('bill-cart'), pay = $('bill-pay');
  if (!box || !pay) return;
  if (!S.cart.length) {
    box.innerHTML = `<div class="muted u-ta-center u-p-16">${t('cart_empty')}</div>`;
    pay.hidden = true; return;
  }
  pay.hidden = false;
  box.innerHTML = S.cart.map((l, i) => `
    <div class="line">
      <div>
        <div>${esc(l.product_name)}</div>
        ${l.units && l.units.length ? `<select data-cunit="${i}" class="u-mt-4"><option value="-1">${esc(l.unit)}</option>${l.units.map((u, k) => `<option value="${k}" ${u.name === l.unit_name ? 'selected' : ''}>${esc(u.name)} (${u.factor} ${esc(l.unit)})</option>`).join('')}</select>` : ''}
        <div class="row u-mt-4">
          ${canPrice() ? `<input type="number" inputmode="decimal" step="any" min="0" value="${l.unit_price}" data-price="${i}" class="u-w-90">` : `<span class="muted">${money(l.unit_price)}</span>`}
          <span class="muted">× ${l.qty} = <b id="lt-${i}">${money(lineTotal(l))}</b></span>
        </div>
        <div class="row u-mt-4 u-flexwrap-wrap">
          <span class="muted">${t('amt_label')}</span><input type="number" inputmode="decimal" step="any" min="0" value="${l.amount != null ? l.amount : ''}" placeholder="Rs" data-lamt="${i}" class="u-w-92">
          ${isKg(l) ? `<span class="muted">${t('gram_label')}</span><input type="number" inputmode="numeric" step="any" min="0" placeholder="g" data-lgram="${i}" class="u-w-80">` : ''}
        </div>
        ${isKg(l) || isLitre(l) ? `<div class="sa-chips u-m-6n0n0">${(isKg(l)
            ? [[0.1, LANG === 'ur' ? '100 گرام' : '100 g'], [0.25, LANG === 'ur' ? 'پاؤ' : '¼ kg'], [0.5, LANG === 'ur' ? 'آدھا کلو' : '½ kg'], [0.75, LANG === 'ur' ? 'پون کلو' : '¾ kg'], [1, LANG === 'ur' ? '1 کلو' : '1 kg']]
            : [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, '1']]).map(([v, lb]) => `<button type="button" class="sa-chip ${l.amount == null && l.qty === v ? 'on' : ''}" data-lq="${i}|${v}">${lb}</button>`).join('')}</div>` : ''}
        ${canDiscount() ? `<div class="row u-mt-4"><span class="muted">${t('disc_pct')}</span><input type="number" inputmode="decimal" step="any" min="0" max="100" value="${l.disc || ''}" placeholder="0" data-ldisc="${i}" class="u-w-72"></div>` : ''}
        ${l.warn ? `<div class="warn">${t('stock_warn')}</div>` : ''}
      </div>
      <div class="qtybox">
        <button type="button" data-dec="${i}">${ic('minus', 18)}</button>
        <input type="number" inputmode="decimal" step="any" min="0" value="${l.qty}" data-qty="${i}">
        <button type="button" data-inc="${i}">${ic('plus', 18)}</button>
        <button type="button" data-rm="${i}" class="u-c-err" aria-label="${t('delete')}">${ic('x', 18)}</button>
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
    ${S.editing ? `<div class="warn u-mb-8">${t('edit_banner').replace('{no}', esc(S.editing.invoice))} <button type="button" class="btn secondary sm" id="btn-edit-cancel">${t('edit_cancel')}</button></div>` : ''}
    <div class="custrow" id="btn-pickcust" role="button" tabindex="0"><span class="lic">${ic('user', 18)}</span>
      <div class="grow">${S.saleCust ? `<b>${esc(S.saleCust.name)}</b>` : `<span class="muted">${t('walk_in')}</span>`}</div>
      <span class="btn secondary sm">${S.saleCust ? t('change_customer') : t('pick_customer')}</span></div>
    <div class="warn" id="cust-warn" ${bal > 0 && !S.saleCust ? '' : 'hidden'}>${t('need_customer')}</div>
    <div class="totals">
      <div><span>${t('subtotal')}</span><span>${money(tt.subtotal)}</span></div>
      ${canDiscount() ? `<div><span>${t('discount')}</span><span class="row u-gap-6 u-flexwrap-nowrap"><select id="in-dmode" class="u-w-74"><option value="rs" ${S.discMode !== 'pct' ? 'selected' : ''}>Rs</option><option value="pct" ${S.discMode === 'pct' ? 'selected' : ''}>%</option></select><input id="in-discount" type="number" inputmode="decimal" step="any" min="0" value="${(S.discMode === 'pct' ? S.discPct : S.discount) || ''}" class="u-w-100"></span></div>
        ${S.discMode === 'pct' && tt.discount ? `<div class="muted"><span></span><span id="disc-amt">− ${money(tt.discount)}</span></div>` : ''}` : ''}
      ${num(S.cfg.tax_rate) ? `<div><span>${t('tax')} (${S.cfg.tax_rate}%)</span><span>${money(tt.tax)}</span></div>` : ''}
      <div class="grand"><span>${t('total')}</span><span id="grand">${money(tt.total)}</span></div>
      ${S.paySplit
        ? `<div class="u-mt-6"><span>${t('paid')}</span><b id="split-sum">${money(S.paid)}</b></div>
           ${PAY_METHODS.map(k => `<div><span>${pmName(k)}</span><input type="number" inputmode="decimal" step="any" min="0" data-split="${k}" value="${(S.splitAmt || {})[k] || ''}" class="u-w-130"></div>`).join('')}
           <div class="u-mt-6"><button type="button" class="btn secondary sm" id="btn-unsplit">${t('pm_single')}</button></div>`
        : `<div class="u-mt-6"><span>${t('paid')}</span><input id="in-paid" type="number" inputmode="decimal" step="any" min="0" value="${S.paid}" class="u-w-130"></div>
           <div class="u-mt-6"><span>${t('pm_label')}</span><span class="row u-gap-6 u-flexwrap-nowrap"><select id="in-pm" class="u-w-130">${PAY_METHODS.map(k => `<option value="${k}" ${(S.payMethod || 'cash') === k ? 'selected' : ''}>${pmName(k)}</option>`).join('')}</select><button type="button" class="btn secondary sm" id="btn-split">${t('pm_split')}</button></span></div>`}
      <div class="muted" id="bal-line">${bal > 0 ? t('balance') + ': ' + money(bal) : bal < 0 ? t('change') + ': ' + money(-bal) : ''}</div>
    </div>
    <button class="btn block u-mt-10" id="btn-complete">${t('complete_sale')}</button>
    ${S.editing ? '' : `<div class="row u-mt-8"><button class="btn secondary grow" id="btn-hold" type="button">${ic('clock', 18)} ${t('hold_btn')}</button><button class="btn secondary grow" id="btn-quote" type="button">${ic('receipt', 18)} ${t('quote_btn')}</button></div>`}`;
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
  if (S.cart.length && !await askConfirm(t('edit_replace_cart'))) return;
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

// ───────── Bill: change the selling unit of a line (stock still goes down in the base unit — see saveSale) ─────────
// (the unit translations and the product-form fields are in products.js)
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

// ───────── Events for this screen (dispatched by events.js) ─────────
onUI('click', 20, ev => {
  const el = ev.target;
  const tinc = el.closest('[data-tinc]'); if (tinc) { addToCartById(tinc.dataset.tinc); return true; }
  const tdec = el.closest('[data-tdec]'); if (tdec) { decById(tdec.dataset.tdec); return true; }
  const add = el.closest('[data-add]'); if (add) { addToCartById(add.dataset.add); return true; }
  const inc = el.closest('[data-inc]'); if (inc) { const l = S.cart[+inc.dataset.inc]; l.amount = null; l.qty = Math.round((l.qty + 1) * 1000) / 1000; refreshBill(); persistCart(); return true; }
  const dec = el.closest('[data-dec]'); if (dec) { const l = S.cart[+dec.dataset.dec]; l.amount = null; l.qty = Math.max(0, Math.round((l.qty - 1) * 1000) / 1000); if (l.qty === 0) S.cart.splice(+dec.dataset.dec, 1); refreshBill(); persistCart(); return true; }
  const lq = el.closest('[data-lq]'); if (lq) { const [i, v] = lq.dataset.lq.split('|'); const l = S.cart[+i]; l.amount = null; l.qty = +v; refreshBill(); persistCart(); return true; }
  if (el.closest('#btn-editsale-x')) { return true; }
  if (el.closest('#btn-edit-cancel')) { billResetState(); closeModal(); refreshBill(); renderBillShell(); loadTiles(); return true; }
  const rm = el.closest('[data-rm]'); if (rm) { S.cart.splice(+rm.dataset.rm, 1); refreshBill(); persistCart(); return true; }
  if (el.closest('#btn-checkout')) { openCheckout(); return true; }
  if (el.closest('#btn-moretiles')) { S.billPage++; loadTiles(true); return true; }
  if (el.closest('#btn-scan')) { startScan(); return true; }
  if (el.closest('#btn-complete')) { completeSale(); return true; }
  if (el.closest('#btn-split')) { S.paySplit = true; S.splitAmt = { [S.payMethod || 'cash']: num(S.paid) }; S.paidManual = true; renderPay(); return true; }
  if (el.closest('#btn-unsplit')) { S.paySplit = false; S.splitAmt = {}; S.paidManual = false; renderPay(); return true; }
  if (el.closest('#btn-hold')) { bpHold(); return true; }
  if (el.closest('#btn-quote')) { bpQuote(); return true; }
  if (el.closest('#btn-heldlist')) { bpListOpen(); return true; }
});

onUI('input', 20, ev => {
  const el = ev.target;
  if (el.id === 'bill-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.billQuery = el.value; loadTiles(); }, 150); return true; }
  if (el.dataset.qty != null) { const l = S.cart[+el.dataset.qty]; l.qty = num(el.value); if (l.amount != null) { l.amount = null; const a = document.querySelector(`[data-lamt="${el.dataset.qty}"]`); if (a) a.value = ''; } persistCart(); updateTotalsOnly(); return true; }
  if (el.dataset.lamt != null) {       // sell by amount: "Rs 100 of this item" -> qty is worked out from the price
    const i = +el.dataset.lamt, l = S.cart[i], v = num(el.value);
    if (v > 0 && l.unit_price > 0) { l.amount = Math.round(v * 100) / 100; l.qty = Math.round(v / l.unit_price * 1000) / 1000; } else { l.amount = null; }
    const q = document.querySelector(`[data-qty="${i}"]`); if (q && v > 0) q.value = l.qty; const g = document.querySelector(`[data-lgram="${i}"]`); if (g) g.value = '';
    persistCart(); updateTotalsOnly(); return true; }
  if (el.dataset.lgram != null) {      // grams (kg items)
    const i = +el.dataset.lgram, l = S.cart[i], v = num(el.value); l.amount = null; l.qty = Math.round(v) / 1000;
    const q = document.querySelector(`[data-qty="${i}"]`); if (q) q.value = l.qty; const a = document.querySelector(`[data-lamt="${i}"]`); if (a) a.value = '';
    persistCart(); updateTotalsOnly(); return true; }
  if (el.dataset.price != null) { S.cart[+el.dataset.price].unit_price = num(el.value); persistCart(); updateTotalsOnly(); return true; }
  if (el.dataset.ldisc != null) { S.cart[+el.dataset.ldisc].disc = clampPct(el.value); persistCart(); updateTotalsOnly(); return true; }
  if (el.dataset.split != null) { S.splitAmt = S.splitAmt || {}; S.splitAmt[el.dataset.split] = num(el.value); S.paid = splitSum(); S.paidManual = true; updateTotalsOnly(); return true; }
  if (el.id === 'in-discount') { if (S.discMode === 'pct') S.discPct = clampPct(el.value); else S.discount = num(el.value); updateTotalsOnly(); return true; }
  if (el.id === 'in-paid') { S.paid = num(el.value); S.paidManual = true; updateTotalsOnly(); return true; }
});

onUI('keydown', 20, async ev => {
  if (ev.key === 'Enter' && ev.target.id === 'bill-search') {
    ev.preventDefault();
    const code = ev.target.value.trim();
    if (!code) return true;
    // Hardware/Bluetooth barcode scanners type the code and press Enter.
    if (!planHasBarcode()) return true;
    const p = await findByBarcode(S.session.shop_id, code);
    if (p) { await addToCart(p, true); ev.target.value = ''; }
    return true;
  }
});

onUI('change', 20, ev => {
  const id = ev.target.id;
  if (id === 'in-dmode') { S.discMode = ev.target.value === 'pct' ? 'pct' : 'rs'; renderPay(); return true; }
  if (id === 'in-pm') { S.payMethod = ev.target.value; return true; }
});
