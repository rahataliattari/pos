// Sales: history list, sale detail / receipt (with print, return, edit, void, delete buttons) and partial return.
// Moved out of app.js (step 3 of the restructuring) — NO behaviour change. Loaded BEFORE app.js.
// Called from elsewhere at run time: renderSales (tab switch), showReceipt (after a sale, from verify.js / billing/quick.js).
// Uses (defined elsewhere): S, $, esc, t, money, openModal, closeModal, toast, getSaleWithItems, voidSale, listSales, doPrint, startEditSale …
// The click wiring (data-sale, #btn-moresales) is still in app.js "Event wiring" (moves in a later step).

// ───────── Sales history ─────────
async function renderSales(append = false) {
  const v = $('view-sales');
  if (!append) v.innerHTML = `<div class="row u-mb-8"><h3 class="grow u-m-0">${t('sales_hist')}</h3><button class="btn secondary sm" id="btn-verify" type="button">${ic('check', 16)} ${t('vf_btn')}</button></div><div id="sales-list"></div><div id="sales-more"></div>`;
  const list = await listSales(S.session.shop_id, S.salesPage, 30);
  const cmap = {};
  const cids = [...new Set(list.map(s => s.customer_id).filter(Boolean))];
  (await db.customers.bulkGet(cids)).forEach(c => { if (c) cmap[c.id] = c.name; });
  const html = list.map(s => `
    <div class="card" data-sale="${s.id}">
      <div class="row"><div class="grow"><b${s.status === 'void' ? ' class="u-text-decoration-line-through"' : ''}>${esc(s.invoice_no)}</b>${s.status === 'void' ? ` <span class="owe-t">${t('sale_void')}</span>` : ''}<div class="muted">${esc(fmtDate(s.created_at))}</div></div>
        <div class="price">${money(s.total)}</div></div>
      ${s.customer_id && cmap[s.customer_id] ? `<div class="muted">${ic('user', 14)} ${esc(cmap[s.customer_id])}${s.paid < s.total ? ` · <span class="owe-t">${t('udhaar')}: ${money(s.total - s.paid)}</span>` : ''}</div>` : ''}
      <div class="muted">${s.sync_status === 'synced' ? ic('check', 14) : ic('clock', 14) + ' ' + t('pending')}</div>
    </div>`).join('');
  if (!append) $('sales-list').innerHTML = html || `<div class="muted u-ta-center u-p-20">${t('no_sales')}</div>`;
  else $('sales-list').insertAdjacentHTML('beforeend', html);
  $('sales-more').innerHTML = list.length === 30 ? `<button class="btn secondary block" id="btn-moresales">${t('more')}</button>` : '';
}

// ───────── Partial return ─────────
async function showReturnForm(saleId) {
  const r = await getSaleWithItems(saleId); if (!r) return;
  openModal(`<h2>${t('return_items')}</h2>
    ${r.items.filter(i => i.qty > 0).map(i => `<div class="card"><div class="row"><div class="grow"><b>${esc(i.product_name)}</b>
      <div class="muted">${t('qty')}: ${i.qty}${i.unit_name ? ' ' + esc(i.unit_name) : ''} × ${money(i.unit_price)}</div></div>
      <input type="number" inputmode="decimal" step="any" min="0" max="${i.qty}" value="0" data-ret="${i.id}" class="u-w-90"></div></div>`).join('')}
    <div class="row u-mt-10"><button class="btn grow" id="btn-ret-ok">${t('save')}</button>
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
    <label class="pcbox"><input type="checkbox" id="rc-color" ${S.cfg.print_color ? 'checked' : ''}> ${t('pc_label')}</label>
    <div class="row u-mt-8">
      <button class="btn grow" id="btn-print">${ic('print', 18)} ${t('print')}</button>
      ${wa ? `<a class="btn secondary lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(receiptText(r.sale, r.items, cust))}">${ic('chat', 18)} ${t('rc_wa')}</a>` : ''}
      <button class="btn secondary grow" data-close>${t('new_sale')}</button>
    </div>
    ${r.sale.status === 'void' ? `<div class="warn u-mt-10">${t('sale_void')}${r.sale.void_reason ? ': ' + esc(r.sale.void_reason) : ''}</div>`
      + (canEditProducts() ? `<button class="btn danger block u-mt-10" id="btn-delvoid">${t('del_void_sale')}</button>` : '')
      : canEditProducts() ? `<button class="btn block u-mt-10" id="btn-editsale">${ic('edit', 18)} ${t('edit_btn')}</button><button class="btn secondary block u-mt-10" id="btn-return">${t('return_items')}</button><button class="btn danger block u-mt-10" id="btn-void">${t('void_sale')}</button>` : ''}
    ${r.sale.returned_total > 0 ? `<div class="muted u-mt-8">${t('returned_total')}: ${money(r.sale.returned_total)}${r.sale.refunded > 0 ? ' · ' + t('refund_cash') + ': ' + money(r.sale.refunded) : ''}</div>` : ''}`);
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

// ───────── Events for this screen (dispatched by events.js) ─────────
onUI('click', 40, ev => {
  const el = ev.target;
  const sale = el.closest('[data-sale]'); if (sale) { showReceipt(sale.dataset.sale); return true; }
  if (el.closest('#btn-moresales')) { S.salesPage++; renderSales(true); return true; }
});
