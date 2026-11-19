// Universal POS — Customers & credit (udhaar) screens.
// Loaded BEFORE app.js; only declares functions. It uses the globals S, $, t, esc, money, num, fmtDate, toast,
// openModal, closeModal (app.js) and the customer functions in db.js at call time.

const CUST_PAGE = 30;
let custLedger = [], custShown = 0;

const canManageCustomers = () => S.session && ['owner', 'manager'].includes(S.session.role);

// Balance chip: red = customer owes us, green = advance, grey = clear.
function balChip(bal) {
  if (bal > 0) return `<span class="bal owe">Rs ${money(bal)}</span>`;
  if (bal < 0) return `<span class="bal adv">${t('advance')} ${money(-bal)}</span>`;
  return `<span class="bal zero">${t('clear')}</span>`;
}

// Pakistani numbers: 03xx… → 923xx… for wa.me links. Returns '' when the number is not usable.
function waNumber(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  return d.length >= 11 ? d : '';
}

// ───────── List ─────────
async function renderCustomers(append = false) {
  const v = $('view-customers');
  if (!append) {
    const sum = await creditSummary(S.session.shop_id);
    v.innerHTML = `
      <div class="udcard"><div class="udic">${ic('wallet', 26)}</div>
        <div class="grow"><div class="muted">${t('total_udhaar')}</div>
          <div class="big">Rs ${money(sum.total)}</div>
          <div class="muted">${sum.count} ${t('owes_n')}</div></div></div>
      ${typeof bulkRemindBtn === 'function' ? bulkRemindBtn(sum) : ''}
      <div class="row u-mb-10">
        <input id="cust-search" class="grow" type="search" placeholder="${t('cust_search')}" autocomplete="off" value="${esc(S.custQuery || '')}">
        <button class="btn" id="btn-addcust" type="button">${ic('plus', 18)} ${t('add_customer')}</button>
      </div>
      <div id="cust-list"></div><div id="cust-more"></div>`;
  }
  const list = await listCustomers(S.session.shop_id, S.custQuery, S.custPage || 0, CUST_PAGE);
  const bals = await getCustomerBalances(S.session.shop_id, list.map(c => c.id));
  const html = list.map(c => `
    <div class="card custcard" data-cust="${c.id}">
      <div class="avatar sm">${ic('user', 20)}</div>
      <div class="grow"><b>${esc(c.name)}</b>${c.phone ? `<div class="muted u-ta-start" dir="ltr">${esc(c.phone)}</div>` : ''}</div>
      ${balChip(bals[c.id])}
    </div>`).join('');
  const box = $('cust-list');
  if (!box) return;
  if (!append) box.innerHTML = html || `<div class="muted u-ta-center u-p-24">${t('no_customers')}</div>`;
  else box.insertAdjacentHTML('beforeend', html);
  $('cust-more').innerHTML = list.length === CUST_PAGE ? `<button class="btn secondary block" id="btn-morecust">${t('more')}</button>` : '';
}

// ───────── Detail + ledger ─────────
async function openCustomerDetail(id) {
  const c = await db.customers.get(id);
  if (!c || c.deleted_at) return;
  const shop = S.session.shop_id;
  const bal = await getCustomerBalance(shop, id);
  custLedger = (await getCustomerLedger(shop, id)).reverse();
  custShown = 25;
  const wa = waNumber(c.phone);
  const msg = t('remind_msg').replace('{name}', c.name).replace('{shop}', S.session.shop_name || '').replace('{amt}', money(bal));
  openModal(`
    <div class="row"><div class="avatar sm">${ic('user', 20)}</div>
      <div class="grow"><h2 class="u-m-0">${esc(c.name)}</h2>
        ${c.phone ? `<div class="muted u-ta-start" dir="ltr">${esc(c.phone)}</div>` : ''}
        ${c.address ? `<div class="muted">${esc(c.address)}</div>` : ''}</div>
      <button class="iconbtn" type="button" data-editcust="${id}" aria-label="${t('edit_customer')}">${ic('edit', 20)}</button></div>
    <div class="balbox ${bal > 0 ? 'owe' : bal < 0 ? 'adv' : ''}"><span>${bal < 0 ? t('advance') : t('udhaar')}</span><b>Rs ${money(Math.abs(bal))}</b></div>
    <div class="row u-mb-8">
      <button class="btn grow" type="button" data-pay="${id}|receipt">${ic('down', 18)} ${t('receive_payment')}</button>
      <button class="btn secondary grow" type="button" data-pay="${id}|charge">${ic('up', 18)} ${t('add_udhaar')}</button>
    </div>
    <div class="row u-mb-8">
      ${c.phone ? `<a class="btn secondary grow lnk" href="tel:${esc(c.phone)}">${ic('phone', 18)} ${t('call')}</a>` : ''}
      ${wa && bal > 0 ? `<a class="btn secondary grow lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">${ic('chat', 18)} ${t('remind')}</a>` : ''}
    </div>
    <h3 class="u-m-12n0n4">${ic('book', 18)} ${t('ledger')}</h3>
    <div id="ledger-box"></div>
    <div class="row u-mt-12">
      <button class="btn secondary grow" type="button" data-close>${t('close')}</button>
      ${canManageCustomers() ? `<button class="btn danger" type="button" data-delcust="${id}" aria-label="${t('delete')}">${ic('trash', 18)}</button>` : ''}
    </div>`);
  renderLedger();
}

function renderLedger() {
  const box = $('ledger-box'); if (!box) return;
  if (!custLedger.length) { box.innerHTML = `<div class="muted u-ta-center u-p-16">${t('no_ledger')}</div>`; return; }
  const icon = { opening: 'book', sale: 'receipt', receipt: 'down', charge: 'up', purchase: 'truck', payment: 'up' };
  box.innerHTML = custLedger.slice(0, custShown).map(r => {
    const isDoc = r.type === 'sale' || r.type === 'purchase';
    const label = isDoc ? `${t('l_' + r.type)} ${esc(r.ref || '')}` : t('l_' + r.type);
    const sub = isDoc ? `${t('total')} ${money(r.total)} · ${t(r.type === 'purchase' ? 'paid_now' : 'paid')} ${money(r.paid)}` : esc(r.note || '');
    return `<div class="lrow ${r.type}" ${r.type === 'sale' ? `data-sale="${r.id}"` : r.type === 'purchase' ? `data-pur="${r.id}"` : ''}>
      <span class="lic">${ic(icon[r.type], 18)}</span>
      <div class="grow"><div><b>${label}</b></div><div class="muted">${esc(fmtDate(r.at))}${sub ? ' · ' + sub : ''}</div></div>
      <div class="lamt"><b>${r.delta < 0 ? '−' : '+'}${money(Math.abs(r.delta))}</b><div class="muted">${t('running')}: ${money(r.running)}</div></div>
    </div>`;
  }).join('') + (custLedger.length > custShown ? `<button class="btn secondary block u-mt-8" type="button" id="btn-moreledger">${t('more')}</button>` : '');
}

// ───────── Add / edit customer ─────────
// onSaved(rec) is used by the checkout picker to select a customer that was just created.
function openCustomerForm(id, onSaved) {
  (async () => {
    const c = id ? await db.customers.get(id) : {};
    const canOpen = !id || canManageCustomers();
    openModal(`<h2>${id ? t('edit_customer') : t('add_customer')}</h2>
      <form id="cust-form">
        <label>${t('name')}</label><input name="name" required value="${esc(c.name)}">
        <label>${t('phone')}</label><input name="phone" type="tel" inputmode="tel" dir="ltr" placeholder="03001234567" value="${esc(c.phone)}">
        <label>${t('address')}</label><input name="address" value="${esc(c.address)}">
        ${canOpen ? `<label>${t('opening_balance')}</label><input name="opening_balance" type="number" inputmode="decimal" step="any" value="${c.opening_balance || ''}">` : ''}
        <label>${t('note')}</label><input name="note" value="${esc(c.note)}">
        <div class="row u-mt-14">
          <button class="btn grow" type="submit">${t('save')}</button>
          <button class="btn secondary" type="button" data-close>${t('cancel')}</button>
        </div>
      </form>`);
    $('cust-form').onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target).entries());
      try {
        const rec = await saveCustomer({ ...(id ? { id } : {}), name: f.name, phone: f.phone, address: f.address, note: f.note,
          ...(canOpen ? { opening_balance: f.opening_balance } : {}) });
        toast(t('saved')); refreshStatus();
        if (onSaved) return onSaved(rec);
        closeModal(); S.custPage = 0;
        if (S.tab === 'customers') renderCustomers();
        if (id) openCustomerDetail(id);
      } catch (ex) { toast(ex.message || t('err_generic'), 4000); }
    };
  })();
}

// ───────── Receive payment / add credit ─────────
async function openPaymentForm(id, kind) {
  const c = await db.customers.get(id);
  const bal = await getCustomerBalance(S.session.shop_id, id);
  openModal(`<h2>${kind === 'receipt' ? t('receive_title') : t('charge_title')}: ${esc(c.name)}</h2>
    <div class="muted">${t('cust_balance_now')}: <b>Rs ${money(bal)}</b></div>
    <form id="pay-form">
      <label>${t('amount')}</label>
      <input name="amount" type="number" inputmode="decimal" step="any" min="0" required value="${kind === 'receipt' && bal > 0 ? bal : ''}">
      <label>${t('note')}</label><input name="note">
      <div class="row u-mt-14">
        <button class="btn grow" type="submit">${t('save')}</button>
        <button class="btn secondary" type="button" data-opencust="${id}">${t('cancel')}</button>
      </div>
    </form>`);
  $('pay-form').onsubmit = async ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    if (!(num(f.amount) > 0)) return toast(t('bad_amount'));
    try {
      await addCustomerPayment(id, num(f.amount), kind, f.note);
      toast(t('saved')); refreshStatus();
      if (S.tab === 'customers') renderCustomers();
      openCustomerDetail(id);
    } catch (ex) { toast(ex.message || t('err_generic'), 4000); }
  };
}

async function deleteCustomer(id) {
  if (!confirm(t('confirm_delete_cust'))) return;
  try {
    await softDeleteCustomer(S.session.shop_id, id);
    closeModal(); S.custPage = 0; renderCustomers(); refreshStatus();
  } catch (ex) { toast(ex.message === 'BALANCE_NOT_ZERO' ? t('cannot_delete_bal') : (ex.message || t('err_generic')), 4000); }
}

// ───────── Customer picker for the checkout sheet ─────────
async function openCustomerPicker() {
  openModal(`<h2>${t('pick_customer')}</h2>
    <div class="row"><input id="pick-search" class="grow" type="search" placeholder="${t('cust_search')}" autocomplete="off">
      <button class="iconbtn green" id="pick-new" type="button" aria-label="${t('add_customer')}">${ic('plus', 22)}</button></div>
    <button class="btn secondary block u-mt-8" id="pick-walkin" type="button">${t('walk_in')}</button>
    <div id="pick-list" class="u-mt-8"></div>
    <div class="u-mt-10"><button class="btn secondary block" type="button" id="pick-back">${t('cancel')}</button></div>`);
  const load = async () => {
    const q = $('pick-search') ? $('pick-search').value : '';
    const list = await listCustomers(S.session.shop_id, q, 0, 40);
    const bals = await getCustomerBalances(S.session.shop_id, list.map(c => c.id));
    const box = $('pick-list'); if (!box) return;
    box.innerHTML = list.length ? list.map(c => `
      <div class="card custcard" data-pickid="${c.id}"><div class="avatar sm">${ic('user', 20)}</div>
        <div class="grow"><b>${esc(c.name)}</b>${c.phone ? `<div class="muted u-ta-start" dir="ltr">${esc(c.phone)}</div>` : ''}</div>
        ${balChip(bals[c.id])}</div>`).join('')
      : `<div class="muted u-ta-center u-p-16">${t('no_customers')}</div>`;
  };
  let timer;
  $('pick-search').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 150); };
  $('pick-list').onclick = async ev => {
    const el = ev.target.closest('[data-pickid]'); if (!el) return;
    const c = await db.customers.get(el.dataset.pickid);
    S.saleCust = { id: c.id, name: c.name };
    openCheckout();
  };
  $('pick-walkin').onclick = () => { S.saleCust = null; openCheckout(); };
  $('pick-back').onclick = () => openCheckout();
  $('pick-new').onclick = () => openCustomerForm(null, rec => { S.saleCust = { id: rec.id, name: rec.name }; openCheckout(); });
  load();
}

// ───────── Events for this screen (dispatched by events.js) ─────────
onUI('click', 60, ev => {
  const el = ev.target;
  if (el.closest('#btn-pickcust')) { openCustomerPicker(); return true; }
  if (el.closest('#btn-addcust')) { openCustomerForm(null); return true; }
  if (el.closest('#btn-morecust')) { S.custPage++; renderCustomers(true); return true; }
  if (el.closest('#btn-moreledger')) { custShown += 25; renderLedger(); return true; }
  const pay = el.closest('[data-pay]'); if (pay) { const [cid, kind] = pay.dataset.pay.split('|'); openPaymentForm(cid, kind); return true; }
  const oc = el.closest('[data-opencust]'); if (oc) { openCustomerDetail(oc.dataset.opencust); return true; }
  const ec = el.closest('[data-editcust]'); if (ec) { openCustomerForm(ec.dataset.editcust); return true; }
  const dc = el.closest('[data-delcust]'); if (dc) { deleteCustomer(dc.dataset.delcust); return true; }
  const cu = el.closest('[data-cust]'); if (cu) { openCustomerDetail(cu.dataset.cust); return true; }
});

onUI('input', 60, ev => {
  const el = ev.target;
  if (el.id === 'cust-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.custQuery = el.value; S.custPage = 0; renderCustomers(); }, 200); return true; }
});


// ═════════ Bulk udhaar reminders (WhatsApp) — moved here from extras.js ═════════
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
    <div class="muted u-m-6n0">${t('br_hint')}</div>
    ${noPhone ? `<div class="warn">${t('br_nophone').replace('{n}', noPhone)}</div>` : ''}
    <div class="u-mt-8">${withPhone.map(c => {
      const msg = t('remind_msg').replace('{name}', c.name).replace('{shop}', S.session.shop_name || '').replace('{amt}', money(bals[c.id]));
      return `<div class="lrow"><div class="grow"><b>${esc(c.name)}</b><div class="muted" id="brl-${c.id}">${log[c.id] ? t('br_last') + ': ' + esc(fmtDate(log[c.id])) : ''}</div></div>
        <b class="owe-t">Rs ${money(bals[c.id])}</b>
        <a class="btn sm lnk u-mis-8" target="_blank" rel="noopener" data-ex="sent|${c.id}" href="https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(msg)}">${ic('chat', 16)}</a></div>`; }).join('') || `<div class="muted u-ta-center u-p-16">${t('br_none')}</div>`}</div>
    <div class="u-mt-10"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}
const bulkRemindBtn = sum => (typeof canManageCustomers === 'function' && canManageCustomers() && sum.count) ? `<button class="btn secondary block u-mb-10" id="btn-bulkrem">${ic('chat', 18)} ${t('br_btn')} (${sum.count})</button>` : '';

document.addEventListener('click', async ev => {
  const el = ev.target;
  if (el.closest('#btn-bulkrem')) return exBulkRemind();
  const s = el.closest('[data-ex]');
  if (s) { const [a, id] = s.dataset.ex.split('|'); if (a === 'sent') { const log = await getSetting('remind_log', {}); log[id] = new Date().toISOString(); await setSetting('remind_log', log); const l = $('brl-' + id); if (l) l.textContent = t('br_sent') + ' ✓'; } }
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'br-min') { clearTimeout(exBulkRemind._t); exBulkRemind._t = setTimeout(() => { BR.min = num(ev.target.value); exBulkRemind(); setTimeout(() => { const i = $('br-min'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { /* number inputs have no caret API */ } } }, 0); }, 500); }
});
