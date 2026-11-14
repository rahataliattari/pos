// Universal POS — Purchases & suppliers screens. Loaded BEFORE app.js (functions only).
// Reuses customers.js helpers (balChip, waNumber, renderLedger, custLedger) and the db.js supplier/purchase functions.

const SUP_PAGE = 30;
const canPurchase = () => S.session && ['owner', 'manager'].includes(S.session.role);
const newPur = () => ({ supplier: null, lines: [], paid: 0, paidManual: false, updateCost: true, q: '' });

// ───────── Main view: purchases list | suppliers ─────────
async function renderPurchases(append = false) {
  const v = $('view-purchases');
  const seg = S.purSeg || 'list';
  if (!append) {
    const sum = await payableSummary(S.session.shop_id);
    v.innerHTML = `
      <div class="seg"><button type="button" data-purseg="list" class="${seg === 'list' ? 'on' : ''}">${ic('truck', 18)} ${t('purchases')}</button>
        <button type="button" data-purseg="suppliers" class="${seg === 'suppliers' ? 'on' : ''}">${ic('users', 18)} ${t('suppliers')}</button></div>
      <div class="udcard pay"><div class="udic">${ic('wallet', 26)}</div>
        <div class="grow"><div class="muted">${t('total_payable')}</div><div class="big">Rs ${money(sum.total)}</div>
          <div class="muted">${sum.count} ${t('owed_n')}</div></div></div>
      ${seg === 'list'
        ? `<button class="btn block" id="btn-newpur" type="button" style="margin-bottom:10px">${ic('plus', 18)} ${t('new_purchase')}</button>`
        : `<div class="row" style="margin-bottom:10px"><input id="sup-search" class="grow" type="search" placeholder="${t('cust_search')}" autocomplete="off" value="${esc(S.supQuery || '')}">
            <button class="btn" id="btn-addsup" type="button">${ic('plus', 18)} ${t('add_supplier')}</button></div>`}
      <div id="pur-list"></div><div id="pur-more"></div>`;
  }
  const box = $('pur-list'); if (!box) return;
  if (seg === 'list') {
    const list = await listPurchases(S.session.shop_id, S.purPage || 0, SUP_PAGE);
    const smap = {};
    (await db.suppliers.bulkGet([...new Set(list.map(p => p.supplier_id).filter(Boolean))])).forEach(s => { if (s) smap[s.id] = s.name; });
    const html = list.map(p => `
      <div class="card" data-pur="${p.id}" style="cursor:pointer">
        <div class="row"><div class="grow"><b>${esc(p.ref_no)}</b><div class="muted">${esc(fmtDate(p.created_at))}</div></div>
          <div class="price">${money(p.total)}</div></div>
        ${p.supplier_id && smap[p.supplier_id] ? `<div class="muted">${ic('truck', 14)} ${esc(smap[p.supplier_id])}${p.paid < p.total ? ` · <span class="owe-t">${t('payable')}: ${money(p.total - p.paid)}</span>` : ''}</div>` : ''}
      </div>`).join('');
    if (!append) box.innerHTML = html || `<div class="muted" style="text-align:center;padding:24px">${t('no_purchases')}</div>`;
    else box.insertAdjacentHTML('beforeend', html);
    $('pur-more').innerHTML = list.length === SUP_PAGE ? `<button class="btn secondary block" id="btn-morepur">${t('more')}</button>` : '';
  } else {
    const list = await listSuppliers(S.session.shop_id, S.supQuery, S.supPage || 0, SUP_PAGE);
    const bals = await getSupplierBalances(S.session.shop_id, list.map(c => c.id));
    const html = list.map(c => `
      <div class="card custcard" data-sup="${c.id}"><div class="avatar sm">${ic('truck', 20)}</div>
        <div class="grow"><b>${esc(c.name)}</b>${c.phone ? `<div class="muted" dir="ltr" style="text-align:start">${esc(c.phone)}</div>` : ''}</div>
        ${balChip(bals[c.id])}</div>`).join('');
    if (!append) box.innerHTML = html || `<div class="muted" style="text-align:center;padding:24px">${t('no_suppliers')}</div>`;
    else box.insertAdjacentHTML('beforeend', html);
    $('pur-more').innerHTML = list.length === SUP_PAGE ? `<button class="btn secondary block" id="btn-moresup">${t('more')}</button>` : '';
  }
}

// ───────── Supplier detail / forms ─────────
async function openSupplierDetail(id) {
  const c = await db.suppliers.get(id);
  if (!c || c.deleted_at) return;
  const shop = S.session.shop_id;
  const bal = await getSupplierBalance(shop, id);
  custLedger = (await getSupplierLedger(shop, id)).reverse();
  custShown = 25;
  openModal(`
    <div class="row"><div class="avatar sm">${ic('truck', 20)}</div>
      <div class="grow"><h2 style="margin:0">${esc(c.name)}</h2>
        ${c.phone ? `<div class="muted" dir="ltr" style="text-align:start">${esc(c.phone)}</div>` : ''}
        ${c.address ? `<div class="muted">${esc(c.address)}</div>` : ''}</div>
      <button class="iconbtn" type="button" data-editsup="${id}" aria-label="${t('edit_supplier')}">${ic('edit', 20)}</button></div>
    <div class="balbox ${bal > 0 ? 'owe' : bal < 0 ? 'adv' : ''}"><span>${bal < 0 ? t('advance') : t('payable')}</span><b>Rs ${money(Math.abs(bal))}</b></div>
    <div class="row" style="margin-bottom:8px">
      <button class="btn grow" type="button" data-suppay="${id}|payment">${ic('up', 18)} ${t('pay_supplier')}</button>
      <button class="btn secondary grow" type="button" data-suppay="${id}|charge">${ic('down', 18)} ${t('add_payable')}</button>
    </div>
    ${c.phone ? `<div class="row" style="margin-bottom:8px"><a class="btn secondary grow lnk" href="tel:${esc(c.phone)}">${ic('phone', 18)} ${t('call')}</a>
      ${waNumber(c.phone) ? `<a class="btn secondary grow lnk" target="_blank" rel="noopener" href="https://wa.me/${waNumber(c.phone)}">${ic('chat', 18)} WhatsApp</a>` : ''}</div>` : ''}
    <h3 style="margin:12px 0 4px">${ic('book', 18)} ${t('ledger')}</h3>
    <div id="ledger-box"></div>
    <div class="row" style="margin-top:12px">
      <button class="btn secondary grow" type="button" data-close>${t('close')}</button>
      <button class="btn danger" type="button" data-delsup="${id}" aria-label="${t('delete')}">${ic('trash', 18)}</button>
    </div>`);
  renderLedger();
}

function openSupplierForm(id, onSaved) {
  (async () => {
    const c = id ? await db.suppliers.get(id) : {};
    openModal(`<h2>${id ? t('edit_supplier') : t('add_supplier')}</h2>
      <form id="sup-form">
        <label>${t('name')}</label><input name="name" required value="${esc(c.name)}">
        <label>${t('phone')}</label><input name="phone" type="tel" inputmode="tel" dir="ltr" placeholder="03001234567" value="${esc(c.phone)}">
        <label>${t('address')}</label><input name="address" value="${esc(c.address)}">
        <label>${t('opening_balance')}</label><input name="opening_balance" type="number" inputmode="decimal" step="any" value="${c.opening_balance || ''}">
        <label>${t('note')}</label><input name="note" value="${esc(c.note)}">
        <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button>
          <button class="btn secondary" type="button" data-close>${t('cancel')}</button></div>
      </form>`);
    $('sup-form').onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target).entries());
      try {
        const rec = await saveSupplier({ ...(id ? { id } : {}), ...f });
        toast(t('saved')); refreshStatus();
        if (onSaved) return onSaved(rec);
        closeModal(); S.supPage = 0;
        if (S.tab === 'purchases') renderPurchases();
        if (id) openSupplierDetail(id);
      } catch (ex) { toast(ex.message || t('err_generic'), 4000); }
    };
  })();
}

async function openSupplierPayForm(id, kind) {
  const c = await db.suppliers.get(id);
  const bal = await getSupplierBalance(S.session.shop_id, id);
  openModal(`<h2>${kind === 'payment' ? t('pay_title') : t('payable_title')}: ${esc(c.name)}</h2>
    <div class="muted">${t('supplier_balance_now')}: <b>Rs ${money(bal)}</b></div>
    <form id="pay-form"><label>${t('amount')}</label>
      <input name="amount" type="number" inputmode="decimal" step="any" min="0" required value="${kind === 'payment' && bal > 0 ? bal : ''}">
      <label>${t('note')}</label><input name="note">
      <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button>
        <button class="btn secondary" type="button" data-opensup="${id}">${t('cancel')}</button></div></form>`);
  $('pay-form').onsubmit = async ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    if (!(num(f.amount) > 0)) return toast(t('bad_amount'));
    try {
      await addSupplierPayment(id, num(f.amount), kind, f.note);
      toast(t('saved')); refreshStatus();
      if (S.tab === 'purchases') renderPurchases();
      openSupplierDetail(id);
    } catch (ex) { toast(ex.message || t('err_generic'), 4000); }
  };
}

async function deleteSupplier(id) {
  if (!confirm(t('confirm_delete_sup'))) return;
  try {
    await softDeleteSupplier(S.session.shop_id, id);
    closeModal(); S.supPage = 0; renderPurchases(); refreshStatus();
  } catch (ex) { toast(ex.message === 'BALANCE_NOT_ZERO' ? t('cannot_delete_sup') : (ex.message || t('err_generic')), 4000); }
}

// ───────── Purchase detail ─────────
async function showPurchase(id) {
  const r = await getPurchaseWithItems(id);
  if (!r) return;
  const p = r.purchase;
  const sup = p.supplier_id ? await db.suppliers.get(p.supplier_id) : null;
  openModal(`<h2>${t('purchase_detail')}</h2>
    <div class="card"><b>${esc(p.ref_no)}</b><div class="muted">${esc(fmtDate(p.created_at))}</div>
      ${sup ? `<div>${ic('truck', 16)} ${esc(sup.name)}</div>` : ''}${p.note ? `<div class="muted">${esc(p.note)}</div>` : ''}</div>
    ${r.items.map(i => `<div class="lrow"><div class="grow"><b>${esc(i.product_name)}</b><div class="muted">${i.qty} × ${money(i.unit_cost)}</div></div><b>${money(i.line_total)}</b></div>`).join('')}
    <div class="totals" style="margin-top:8px"><div class="grand"><span>${t('total')}</span><span>${money(p.total)}</span></div>
      <div><span>${t('paid_now')}</span><span>${money(p.paid)}</span></div>
      ${p.paid < p.total ? `<div class="owe-t"><span>${t('payable')}</span><span>${money(p.total - p.paid)}</span></div>` : ''}</div>
    <div style="margin-top:12px"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}

// ───────── New purchase form ─────────
const purTotal = () => Math.round(S.pur.lines.reduce((s, l) => s + Math.round(l.qty * l.unit_cost * 100) / 100, 0) * 100) / 100;

function openPurchaseForm() {
  if (!S.pur) S.pur = newPur();
  const P = S.pur;
  openModal(`<h2>${t('new_purchase')}</h2>
    <div class="custrow" id="btn-picksup" role="button" tabindex="0"><span class="lic">${ic('truck', 18)}</span>
      <div class="grow">${P.supplier ? `<b>${esc(P.supplier.name)}</b>` : `<span class="muted">${t('no_supplier')}</span>`}</div>
      <span class="btn secondary sm">${P.supplier ? t('change_customer') : t('pick_supplier')}</span></div>
    <input id="pur-search" type="search" placeholder="${t('add_items')}" autocomplete="off" value="${esc(P.q)}">
    <div id="pur-results"></div>
    <div id="pur-lines"></div>
    <div id="pur-pay"></div>`);
  purResults(); renderPurLines();
}

async function purResults() {
  const box = $('pur-results'); if (!box) return;
  const q = S.pur.q.trim();
  if (!q) { box.innerHTML = ''; return; }
  const list = await searchProducts(S.session.shop_id, q, 6);
  box.innerHTML = list.length ? list.map(p => `<div class="card custcard" data-puradd="${p.id}"><div class="grow"><b>${esc(p.name)}</b>${p.name_ur ? ` <span class="muted">${esc(p.name_ur)}</span>` : ''}</div>
      <span class="muted">${t('cost')}: ${money(p.cost_price)}</span>${ic('plus', 18)}</div>`).join('')
    : `<div class="muted" style="padding:8px;text-align:center">${t('no_results')}</div>`;
}

function renderPurLines() {
  const P = S.pur, box = $('pur-lines'), pay = $('pur-pay'); if (!box) return;
  box.innerHTML = P.lines.map((l, i) => `
    <div class="line"><div><div>${esc(l.product_name)}</div>
      <div class="row" style="margin-top:4px"><span class="muted">${t('cost_each')}</span>
        <input type="number" inputmode="decimal" step="any" min="0" value="${l.unit_cost}" data-pcost="${i}" style="width:90px">
        <span class="muted">= <b id="pl-${i}">${money(l.qty * l.unit_cost)}</b></span></div></div>
      <div class="qtybox"><input type="number" inputmode="decimal" step="any" min="0" value="${l.qty}" data-pqty="${i}">
        <button type="button" data-prm="${i}" style="color:var(--err)" aria-label="${t('delete')}">${ic('x', 18)}</button></div></div>`).join('');
  if (!P.lines.length) { pay.innerHTML = ''; return; }
  const tot = purTotal();
  if (!P.paidManual) P.paid = tot;
  pay.innerHTML = `
    <div class="totals" style="margin-top:8px"><div class="grand"><span>${t('total')}</span><span id="pur-grand">${money(tot)}</span></div>
      <div style="margin-top:6px"><span>${t('paid_now')}</span><input id="pur-paid" type="number" inputmode="decimal" step="any" min="0" value="${P.paid}" style="width:130px"></div>
      <div class="muted" id="pur-bal"></div></div>
    <div class="warn" id="pur-warn" hidden>${t('need_supplier')}</div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pur-upcost" style="width:auto;min-height:0" ${P.updateCost ? 'checked' : ''}> ${t('update_cost')}</label>
    <div class="row" style="margin-top:12px"><button class="btn grow" id="btn-savepur" type="button">${t('save_purchase')}</button>
      <button class="btn secondary" type="button" data-purcancel>${t('cancel')}</button></div>`;
  updatePurTotals();
}

function updatePurTotals() {
  const P = S.pur, tot = purTotal();
  if (!P.paidManual) { P.paid = tot; const ip = $('pur-paid'); if (ip) ip.value = tot; }
  const g = $('pur-grand'); if (g) g.textContent = money(tot);
  const bal = Math.round((tot - num(P.paid)) * 100) / 100;
  const b = $('pur-bal'); if (b) b.textContent = bal > 0 ? t('payable') + ': ' + money(bal) : '';
  const w = $('pur-warn'); if (w) w.hidden = !(bal > 0 && !P.supplier);
}

async function addPurLine(id) {
  const p = await db.products.get(id); if (!p) return;
  const P = S.pur, ex = P.lines.find(l => l.product_id === id);
  if (ex) ex.qty = Math.round((ex.qty + 1) * 1000) / 1000;
  else P.lines.push({ product_id: id, product_name: p.name, qty: 1, unit_cost: p.cost_price || 0 });
  P.q = ''; P.paidManual = false;
  openPurchaseForm();
}

async function savePurchaseNow() {
  const P = S.pur, tot = purTotal();
  if (!P.lines.length || P.lines.some(l => !(l.qty > 0))) return toast(t('need_items'));
  if (num(P.paid) < tot && !P.supplier) { updatePurTotals(); return toast(t('need_supplier'), 3500); }
  const btn = $('btn-savepur'); btn.disabled = true;
  try {
    await savePurchase({ supplier_id: P.supplier ? P.supplier.id : null, paid: num(P.paid), update_cost: P.updateCost, created_by: S.session.user_id },
      P.lines.map(l => ({ product_id: l.product_id, product_name: l.product_name, qty: l.qty, unit_cost: l.unit_cost })));
    S.pur = null; closeModal(); toast(t('saved')); refreshStatus();
    S.purSeg = 'list'; S.purPage = 0; renderPurchases();
  } catch (ex) { toast(ex.message || t('err_generic'), 4000); btn.disabled = false; }
}

function openSupplierPicker() {
  openModal(`<h2>${t('pick_supplier')}</h2>
    <div class="row"><input id="pick-search" class="grow" type="search" placeholder="${t('cust_search')}" autocomplete="off">
      <button class="iconbtn green" id="pick-new" type="button" aria-label="${t('add_supplier')}">${ic('plus', 22)}</button></div>
    <button class="btn secondary block" id="pick-walkin" type="button" style="margin-top:8px">${t('no_supplier')}</button>
    <div id="pick-list" style="margin-top:8px"></div>
    <div style="margin-top:10px"><button class="btn secondary block" type="button" id="pick-back">${t('cancel')}</button></div>`);
  const load = async () => {
    const list = await listSuppliers(S.session.shop_id, $('pick-search') ? $('pick-search').value : '', 0, 40);
    const bals = await getSupplierBalances(S.session.shop_id, list.map(c => c.id));
    const box = $('pick-list'); if (!box) return;
    box.innerHTML = list.length ? list.map(c => `<div class="card custcard" data-pickid="${c.id}"><div class="avatar sm">${ic('truck', 20)}</div>
      <div class="grow"><b>${esc(c.name)}</b></div>${balChip(bals[c.id])}</div>`).join('') : `<div class="muted" style="text-align:center;padding:16px">${t('no_suppliers')}</div>`;
  };
  let timer;
  $('pick-search').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 150); };
  $('pick-list').onclick = async ev => {
    const el = ev.target.closest('[data-pickid]'); if (!el) return;
    const c = await db.suppliers.get(el.dataset.pickid);
    S.pur.supplier = { id: c.id, name: c.name }; openPurchaseForm();
  };
  $('pick-walkin').onclick = () => { S.pur.supplier = null; openPurchaseForm(); };
  $('pick-back').onclick = () => openPurchaseForm();
  $('pick-new').onclick = () => openSupplierForm(null, rec => { S.pur.supplier = { id: rec.id, name: rec.name }; openPurchaseForm(); });
  load();
}
