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
      <div class="row" style="margin-bottom:10px">
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
      <div class="grow"><b>${esc(c.name)}</b>${c.phone ? `<div class="muted" dir="ltr" style="text-align:start">${esc(c.phone)}</div>` : ''}</div>
      ${balChip(bals[c.id])}
    </div>`).join('');
  const box = $('cust-list');
  if (!box) return;
  if (!append) box.innerHTML = html || `<div class="muted" style="text-align:center;padding:24px">${t('no_customers')}</div>`;
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
      <div class="grow"><h2 style="margin:0">${esc(c.name)}</h2>
        ${c.phone ? `<div class="muted" dir="ltr" style="text-align:start">${esc(c.phone)}</div>` : ''}
        ${c.address ? `<div class="muted">${esc(c.address)}</div>` : ''}</div>
      <button class="iconbtn" type="button" data-editcust="${id}" aria-label="${t('edit_customer')}">${ic('edit', 20)}</button></div>
    <div class="balbox ${bal > 0 ? 'owe' : bal < 0 ? 'adv' : ''}"><span>${bal < 0 ? t('advance') : t('udhaar')}</span><b>Rs ${money(Math.abs(bal))}</b></div>
    <div class="row" style="margin-bottom:8px">
      <button class="btn grow" type="button" data-pay="${id}|receipt">${ic('down', 18)} ${t('receive_payment')}</button>
      <button class="btn secondary grow" type="button" data-pay="${id}|charge">${ic('up', 18)} ${t('add_udhaar')}</button>
    </div>
    <div class="row" style="margin-bottom:8px">
      ${c.phone ? `<a class="btn secondary grow lnk" href="tel:${esc(c.phone)}">${ic('phone', 18)} ${t('call')}</a>` : ''}
      ${wa && bal > 0 ? `<a class="btn secondary grow lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">${ic('chat', 18)} ${t('remind')}</a>` : ''}
    </div>
    <h3 style="margin:12px 0 4px">${ic('book', 18)} ${t('ledger')}</h3>
    <div id="ledger-box"></div>
    <div class="row" style="margin-top:12px">
      <button class="btn secondary grow" type="button" data-close>${t('close')}</button>
      ${canManageCustomers() ? `<button class="btn danger" type="button" data-delcust="${id}" aria-label="${t('delete')}">${ic('trash', 18)}</button>` : ''}
    </div>`);
  renderLedger();
}

function renderLedger() {
  const box = $('ledger-box'); if (!box) return;
  if (!custLedger.length) { box.innerHTML = `<div class="muted" style="text-align:center;padding:16px">${t('no_ledger')}</div>`; return; }
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
  }).join('') + (custLedger.length > custShown ? `<button class="btn secondary block" type="button" id="btn-moreledger" style="margin-top:8px">${t('more')}</button>` : '');
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
        <div class="row" style="margin-top:14px">
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
      <div class="row" style="margin-top:14px">
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
    <button class="btn secondary block" id="pick-walkin" type="button" style="margin-top:8px">${t('walk_in')}</button>
    <div id="pick-list" style="margin-top:8px"></div>
    <div style="margin-top:10px"><button class="btn secondary block" type="button" id="pick-back">${t('cancel')}</button></div>`);
  const load = async () => {
    const q = $('pick-search') ? $('pick-search').value : '';
    const list = await listCustomers(S.session.shop_id, q, 0, 40);
    const bals = await getCustomerBalances(S.session.shop_id, list.map(c => c.id));
    const box = $('pick-list'); if (!box) return;
    box.innerHTML = list.length ? list.map(c => `
      <div class="card custcard" data-pickid="${c.id}"><div class="avatar sm">${ic('user', 20)}</div>
        <div class="grow"><b>${esc(c.name)}</b>${c.phone ? `<div class="muted" dir="ltr" style="text-align:start">${esc(c.phone)}</div>` : ''}</div>
        ${balChip(bals[c.id])}</div>`).join('')
      : `<div class="muted" style="text-align:center;padding:16px">${t('no_customers')}</div>`;
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
