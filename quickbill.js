// Universal POS — Quick Bill (فوری بل): a fast bill for an amount typed by hand, with no product picking.
// Lives INSIDE the Billing tab next to the normal product bill: [ Product bill | Quick Bill ]. Switching keeps both untouched.
// - Always fully paid, walk-in customer (no udhaar), no discount. Tax follows the shop's tax rate like every other bill.
// - Saved through the normal saveSale(), so numbering, sync, receipt/print, reports, cancel and return all work as usual.
// - Its lines are marked quick:true and carry the fixed product_id 'quick-bill' (no real product): stock is NEVER touched.
// - Correcting a saved Quick Bill opens the same form in a sheet (QBE); the billing-tab form (QBI) is left as it was.
// Loaded before app.js; uses app.js globals only when called.
const QB_I18N = {
  qb_title: ['فوری بل', 'Quick Bill'],
  qb_tab_items: ['پروڈکٹ بل', 'Product bill'],
  qb_sub: ['بغیر پروڈکٹ، صرف رقم لکھیں', 'No products, just type the amount'],
  qb_amount: ['رقم (Rs)', 'Amount (Rs)'],
  qb_name: ['تفصیل (اختیاری)', 'Description (optional)'],
  qb_item: ['فوری آئٹم', 'Quick item'],
  qb_add: ['لائن شامل کریں', 'Add line'],
  qb_hint: ['اسٹاک پر کوئی اثر نہیں پڑتا۔ بل مکمل ادائیگی کے ساتھ بنتا ہے۔', 'Stock is not affected. The bill is saved as fully paid.'],
  qb_need_amount: ['پہلے رقم لکھیں', 'Enter an amount first'],
  qb_big: ['رقم بہت زیادہ ہے', 'Amount is too large'],
  qb_busy: ['پہلے موجودہ بل کی درستی مکمل یا منسوخ کریں', 'Finish or cancel the bill you are correcting first']
};
for (const k in QB_I18N) { I18N.ur[k] = QB_I18N[k][0]; I18N.en[k] = QB_I18N[k][1]; }

const QBI = { lines: [], pm: 'cash', busy: false };                    // billing-tab form
const QBE = { lines: [], pm: 'cash', busy: false, edit: null };        // edit sheet; edit = { id, invoice }
const qbRound = n => Math.round((n + Number.EPSILON) * 100) / 100;
const QB_MAX = 1e9;
const qq = (c, n) => c.root.querySelector(`[data-q="${n}"]`);
function qbCtxOf(el) {
  const root = el && el.closest ? el.closest('[data-qbroot]') : null;
  return root ? { root, st: root.dataset.qbroot === 'edit' ? QBE : QBI, isEdit: root.dataset.qbroot === 'edit' } : null;
}

function qbPending(c) { const a = qq(c, 'amt'); const v = a ? parseFloat(a.value) : 0; return isFinite(v) && v > 0 ? v : 0; }
function qbSums(c) {      // same arithmetic as saveSale(): subtotal -> tax -> total, each rounded to 2 decimals
  const pend = qbPending(c);
  const sub = qbRound(c.st.lines.reduce((s, l) => s + l.amount, 0) + (pend && pend <= QB_MAX ? pend : 0));
  const rate = num(S.cfg.tax_rate), tax = qbRound(sub * rate / 100);
  return { sub, rate, tax, total: qbRound(sub + tax) };
}

function qbPanelHtml(st, isEdit) {
  return `${isEdit ? `<h2>${ic('bolt', 22)} ${t('qb_title')}</h2>
      <div class="warn" style="margin-bottom:10px">${t('edit_banner').replace('{no}', esc(st.edit.invoice))}</div>` : ''}
    <div data-q="lines"></div>
    <label>${t('qb_amount')}</label>
    <input data-q="amt" class="qbamt" type="number" inputmode="decimal" step="any" min="0" placeholder="0" autocomplete="off" aria-label="${esc(t('qb_amount'))}">
    <label style="margin-top:8px">${t('qb_name')}</label>
    <input data-q="name" type="text" maxlength="60" autocomplete="off" placeholder="${esc(t('qb_item'))}" aria-label="${esc(t('qb_name'))}">
    <button type="button" class="btn secondary block" data-q="add" style="margin-top:8px">${ic('plus', 18)} ${t('qb_add')}</button>
    <div class="totals" data-q="totals" style="margin-top:10px"></div>
    <div class="muted" style="margin:6px 0">${t('pm_label')}</div>
    <div class="sa-chips">${PAY_METHODS.map(k => `<button type="button" class="sa-chip ${st.pm === k ? 'on' : ''}" data-qbpm="${k}">${t('pm_' + k)}</button>`).join('')}</div>
    <div class="muted" style="font-size:13px;margin-bottom:8px">${t('qb_hint')}</div>
    ${isEdit ? `<div class="row"><button type="button" class="btn grow" data-q="save">${t('complete_sale')}</button>
      <button type="button" class="btn secondary grow" data-close>${t('cancel')}</button></div>`
      : `<button type="button" class="btn block" data-q="save">${t('complete_sale')}</button>`}`;
}
function qbRenderLines(c) {
  const box = qq(c, 'lines'); if (!box) return;
  box.innerHTML = c.st.lines.map((l, i) => `<div class="qbline"><div class="grow">${esc(l.name)}</div><b class="num">${money(l.amount)}</b>
    <button type="button" class="iconbtn" style="width:40px;height:40px;color:var(--err)" data-qbrm="${i}" aria-label="${t('delete')}">${ic('x', 18)}</button></div>`).join('');
}
function qbRenderTotals(c) {
  const box = qq(c, 'totals'); if (!box) return;
  const s = qbSums(c);
  box.innerHTML = (c.st.lines.length > 1 || s.rate ? `<div><span>${t('subtotal')}</span><span>${money(s.sub)}</span></div>` : '')
    + (s.rate ? `<div><span>${t('tax')} (${esc(S.cfg.tax_rate)}%)</span><span>${money(s.tax)}</span></div>` : '')
    + `<div class="grand"><span>${t('total')}</span><span>Rs ${money(s.total)}</span></div>`;
}

// ───────── Billing tab: [ Product bill | Quick Bill ] ─────────
function qbSegHtml() {
  const m = S.billMode === 'quick' ? 'quick' : 'items';
  return `<div class="bseg" id="bill-seg"><button type="button" data-bmode="items" class="${m === 'items' ? 'on' : ''}">${ic('cart', 18)} ${t('qb_tab_items')}<b class="cnt" id="bill-cnt" hidden></b></button>
    <button type="button" data-bmode="quick" class="${m === 'quick' ? 'on' : ''}">${ic('bolt', 18)} ${t('qb_title')}</button></div>`;
}
function qbSegBadge() {
  const b = $('bill-cnt'); if (!b) return;
  const n = (S.cart || []).length; b.hidden = !n; b.textContent = n;
}
function qbMount() {
  const root = $('bill-quick'); if (!root) return;
  root.innerHTML = qbPanelHtml(QBI, false);
  const c = { root, st: QBI }; qbRenderLines(c); qbRenderTotals(c);
}
function qbSegApply() {       // show the chosen half of the Billing tab (called after the tab is drawn and whenever the mode changes)
  const it = $('bill-items'), qk = $('bill-quick'); if (!it || !qk) return;
  const quick = S.billMode === 'quick';
  it.hidden = quick; qk.hidden = !quick;
  document.querySelectorAll('[data-bmode]').forEach(b => b.classList.toggle('on', b.dataset.bmode === (quick ? 'quick' : 'items')));
  if (quick && !qk.firstElementChild) qbMount();
  qbSegBadge();
  if (typeof renderBillBar === 'function') renderBillBar();
  if (quick) setTimeout(() => { const a = qk.querySelector('[data-q="amt"]'); if (a && S.tab === 'bill' && !qk.hidden) a.focus(); }, 80);
}
function qbSetMode(m) {
  S.billMode = m === 'quick' ? 'quick' : 'items';
  if (!$('bill-seg')) { renderBillShell(); return; }       // renderBillShell() calls qbSegApply() itself
  qbSegApply();
}
function qbGo() {             // Home -> "Quick Bill" button
  if (S.editing) return toast(t('qb_busy'), 3500);
  S.billMode = 'quick'; switchTab('bill'); qbSegApply();
}

// ───────── Correct a saved Quick Bill (sheet) ─────────
// The old bill is cancelled (no stock involved) and a corrected copy is saved that points back to it, like editing a normal bill.
// Called from startEditSale() in app.js.
async function qbEdit(saleId) {
  if (S.editing) return toast(t('qb_busy'), 3500);
  const r = await getSaleWithItems(saleId); if (!r || r.sale.status === 'void') return;
  if (r.sale.returned_total > 0) return toast(t('edit_has_return'), 4000);
  QBE.lines = r.items.filter(i => i.qty > 0).map(i => ({ name: i.product_name, amount: qbRound(i.line_total) }));
  if (!QBE.lines.length) return;
  QBE.pm = PAY_METHODS.includes(r.sale.payment_method) ? r.sale.payment_method : 'cash'; QBE.busy = false;
  QBE.edit = { id: saleId, invoice: r.sale.invoice_no };
  openModal(`<div data-qbroot="edit">${qbPanelHtml(QBE, true)}</div>`);
  const c = qbCtxOf($('sheet').querySelector('[data-qbroot]')); qbRenderLines(c); qbRenderTotals(c);
  setTimeout(() => { const a = qq(c, 'amt'); if (a) a.focus(); }, 80);
}

// ───────── Add a line / save ─────────
function qbAdd(c) {
  const a = qq(c, 'amt'), n = qq(c, 'name'); if (!a) return false;
  const v = parseFloat(a.value);
  if (!(isFinite(v) && v > 0)) { toast(t('qb_need_amount'), 2500); a.focus(); return false; }
  if (v > QB_MAX) { toast(t('qb_big'), 2500); return false; }
  c.st.lines.push({ name: (n.value || '').trim().slice(0, 60) || t('qb_item'), amount: qbRound(v) });
  a.value = ''; n.value = ''; a.focus();
  qbRenderLines(c); qbRenderTotals(c);
  return true;
}

async function qbSave(c) {
  const st = c.st; if (st.busy) return;
  const a = qq(c, 'amt');
  if (a && a.value.trim() !== '' && qbPending(c) > 0 && !qbAdd(c)) return;       // an amount typed but not yet added is included
  if (!st.lines.length) return toast(t('qb_need_amount'), 2500);
  st.busy = true; const btn = qq(c, 'save'); if (btn) btn.disabled = true;
  try {
    const items = st.lines.map((l, k) => ({ line_no: k, product_id: 'quick-bill', product_name: l.name, qty: 1, unit_name: null, unit_factor: 1, unit_price: l.amount,
      line_total: l.amount, item_discount: 0, cost_price: 0, quick: true }));
    const editing = c.isEdit ? st.edit : null;
    const sale = await saveSale({ edited_from: editing ? editing.id : null, edited_from_no: editing ? editing.invoice : null, customer_id: null, discount: 0,
      tax_rate: num(S.cfg.tax_rate), paid: null,                                  // paid null = full total
      payment_method: PAY_METHODS.includes(st.pm) ? st.pm : 'cash', pay_split: null, created_by: S.session.user_id }, items);
    st.lines = []; if (c.isEdit) st.edit = null;
    if (editing) { try { await voidSale(editing.id, t('edit_void_reason').replace('{no}', sale.invoice_no), { edited: true }); toast(t('edit_done'), 3000); } catch (e) { toast((e && e.message) || t('err_generic'), 6000); } }
    if (!c.isEdit && $('bill-quick') && $('bill-quick').firstElementChild) { const cc = { root: $('bill-quick'), st: QBI }; qbRenderLines(cc); qbRenderTotals(cc); }
    try { refreshStatus(); if (typeof exCheck === 'function') exCheck(); if (S.tab === 'home') renderHome(); } catch (e) { /* display refresh only */ }
    await showReceipt(sale.id);
  } catch (ex) { toast((ex && ex.message) || t('err_generic'), 4000); const b = qq(c, 'save'); if (b) b.disabled = false; }
  finally { st.busy = false; const b = qq(c, 'save'); if (b) b.disabled = false; }
}

document.addEventListener('click', e => {
  const el = e.target; if (!el || !el.closest) return;
  if (el.closest('#btn-qb-home')) return qbGo();
  const seg = el.closest('[data-bmode]'); if (seg) return qbSetMode(seg.dataset.bmode);
  const c = qbCtxOf(el); if (!c) return;
  if (el.closest('[data-q="add"]')) return qbAdd(c);
  if (el.closest('[data-q="save"]')) return qbSave(c);
  const pm = el.closest('[data-qbpm]');
  if (pm) { c.st.pm = pm.dataset.qbpm; c.root.querySelectorAll('[data-qbpm]').forEach(b => b.classList.toggle('on', b.dataset.qbpm === c.st.pm)); return; }
  const rm = el.closest('[data-qbrm]');
  if (rm) { c.st.lines.splice(+rm.dataset.qbrm, 1); qbRenderLines(c); qbRenderTotals(c); return; }
});
document.addEventListener('input', e => { if (e.target && e.target.dataset && e.target.dataset.q === 'amt') { const c = qbCtxOf(e.target); if (c) qbRenderTotals(c); } });
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target || !e.target.dataset || !['amt', 'name'].includes(e.target.dataset.q)) return;
  const c = qbCtxOf(e.target); if (c) { e.preventDefault(); qbAdd(c); }
});
