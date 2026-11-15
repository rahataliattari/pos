// Universal POS — Quick Bill (فوری بل): a fast bill for an amount typed by hand, with no product picking.
// - Always fully paid, walk-in customer (no udhaar), no discount. Tax follows the shop's tax rate like every other bill.
// - Saved through the normal saveSale(), so numbering, sync, receipt/print, reports, cancel and return all work as usual.
// - Its lines are marked quick:true and carry the fixed product_id 'quick-bill' (no real product): stock is NEVER touched.
// Loaded before app.js; uses app.js globals only when called.
const QB_I18N = {
  qb_title: ['فوری بل', 'Quick Bill'],
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

const QB = { lines: [], pm: 'cash', busy: false, edit: null };     // edit = { id, invoice } while a saved Quick Bill is being corrected
const qbRound = n => Math.round((n + Number.EPSILON) * 100) / 100;
const QB_MAX = 1e9;

function qbPending() { const a = $('qb-amt'); const v = a ? parseFloat(a.value) : 0; return isFinite(v) && v > 0 ? v : 0; }
function qbSums() {      // same arithmetic as saveSale(): subtotal -> tax -> total, each rounded to 2 decimals
  const pend = qbPending();
  const sub = qbRound(QB.lines.reduce((s, l) => s + l.amount, 0) + (pend && pend <= QB_MAX ? pend : 0));
  const rate = num(S.cfg.tax_rate), tax = qbRound(sub * rate / 100);
  return { sub, rate, tax, total: qbRound(sub + tax) };
}

function qbHtml() {
  return `<h2>${ic('bolt', 22)} ${t('qb_title')}</h2>
    ${QB.edit ? `<div class="warn" style="margin-bottom:10px">${t('edit_banner').replace('{no}', esc(QB.edit.invoice))}</div>` : `<div class="muted" style="margin-bottom:10px">${t('qb_sub')}</div>`}
    <div id="qb-lines"></div>
    <label for="qb-amt">${t('qb_amount')}</label>
    <input id="qb-amt" class="qbamt" type="number" inputmode="decimal" step="any" min="0" placeholder="0" autocomplete="off">
    <label for="qb-name" style="margin-top:8px">${t('qb_name')}</label>
    <input id="qb-name" type="text" maxlength="60" autocomplete="off" placeholder="${esc(t('qb_item'))}">
    <button type="button" class="btn secondary block" id="qb-add" style="margin-top:8px">${ic('plus', 18)} ${t('qb_add')}</button>
    <div class="totals" id="qb-totals" style="margin-top:10px"></div>
    <div class="muted" style="margin:6px 0">${t('pm_label')}</div>
    <div class="sa-chips" id="qb-pm">${PAY_METHODS.map(k => `<button type="button" class="sa-chip ${QB.pm === k ? 'on' : ''}" data-qbpm="${k}">${t('pm_' + k)}</button>`).join('')}</div>
    <div class="muted" style="font-size:13px;margin-bottom:8px">${t('qb_hint')}</div>
    <div class="row"><button type="button" class="btn grow" id="qb-save">${t('complete_sale')}</button>
      <button type="button" class="btn secondary grow" data-close>${t('cancel')}</button></div>`;
}

function qbRenderLines() {
  const box = $('qb-lines'); if (!box) return;
  box.innerHTML = QB.lines.map((l, i) => `<div class="qbline"><div class="grow">${esc(l.name)}</div><b class="num">${money(l.amount)}</b>
    <button type="button" class="iconbtn" style="width:40px;height:40px;color:var(--err)" data-qbrm="${i}" aria-label="${t('delete')}">${ic('x', 18)}</button></div>`).join('');
}
function qbRenderTotals() {
  const box = $('qb-totals'); if (!box) return;
  const s = qbSums();
  box.innerHTML = (QB.lines.length > 1 || s.rate ? `<div><span>${t('subtotal')}</span><span>${money(s.sub)}</span></div>` : '')
    + (s.rate ? `<div><span>${t('tax')} (${esc(S.cfg.tax_rate)}%)</span><span>${money(s.tax)}</span></div>` : '')
    + `<div class="grand"><span>${t('total')}</span><span>Rs ${money(s.total)}</span></div>`;
}

function qbOpen() {
  if (!S.session) return;
  if (S.editing) return toast(t('qb_busy'), 3500);
  QB.lines = []; QB.pm = 'cash'; QB.busy = false; QB.edit = null;
  openModal(qbHtml()); qbRenderLines(); qbRenderTotals();
  setTimeout(() => { const a = $('qb-amt'); if (a) a.focus(); }, 80);
}

// Correct a saved Quick Bill: the old bill is cancelled (no stock involved) and a corrected copy is saved that points back to it,
// exactly like editing a normal bill. Called from startEditSale() in app.js.
async function qbEdit(saleId) {
  if (S.editing) return toast(t('qb_busy'), 3500);
  const r = await getSaleWithItems(saleId); if (!r || r.sale.status === 'void') return;
  if (r.sale.returned_total > 0) return toast(t('edit_has_return'), 4000);
  QB.lines = r.items.filter(i => i.qty > 0).map(i => ({ name: i.product_name, amount: qbRound(i.line_total) }));
  if (!QB.lines.length) return;
  QB.pm = PAY_METHODS.includes(r.sale.payment_method) ? r.sale.payment_method : 'cash'; QB.busy = false;
  QB.edit = { id: saleId, invoice: r.sale.invoice_no };
  openModal(qbHtml()); qbRenderLines(); qbRenderTotals();
  setTimeout(() => { const a = $('qb-amt'); if (a) a.focus(); }, 80);
}

function qbAdd() {
  const a = $('qb-amt'), n = $('qb-name'); if (!a) return false;
  const v = parseFloat(a.value);
  if (!(isFinite(v) && v > 0)) { toast(t('qb_need_amount'), 2500); a.focus(); return false; }
  if (v > QB_MAX) { toast(t('qb_big'), 2500); return false; }
  QB.lines.push({ name: (n.value || '').trim().slice(0, 60) || t('qb_item'), amount: qbRound(v) });
  a.value = ''; n.value = ''; a.focus();
  qbRenderLines(); qbRenderTotals();
  return true;
}

async function qbSave() {
  if (QB.busy) return;
  const a = $('qb-amt');
  if (a && a.value.trim() !== '' && qbPending() > 0 && !qbAdd()) return;       // an amount typed but not yet added is included
  if (!QB.lines.length) return toast(t('qb_need_amount'), 2500);
  QB.busy = true; const btn = $('qb-save'); if (btn) btn.disabled = true;
  try {
    const items = QB.lines.map((l, k) => ({ line_no: k, product_id: 'quick-bill', product_name: l.name, qty: 1, unit_name: null, unit_factor: 1, unit_price: l.amount,
      line_total: l.amount, item_discount: 0, cost_price: 0, quick: true }));
    const editing = QB.edit;
    const sale = await saveSale({ edited_from: editing ? editing.id : null, edited_from_no: editing ? editing.invoice : null, customer_id: null, discount: 0, tax_rate: num(S.cfg.tax_rate), paid: null,      // paid null = full total
      payment_method: PAY_METHODS.includes(QB.pm) ? QB.pm : 'cash', pay_split: null, created_by: S.session.user_id }, items);
    QB.lines = []; QB.edit = null;
    if (editing) { try { await voidSale(editing.id, t('edit_void_reason').replace('{no}', sale.invoice_no), { edited: true }); toast(t('edit_done'), 3000); } catch (e) { toast((e && e.message) || t('err_generic'), 6000); } }
    try { refreshStatus(); if (typeof exCheck === 'function') exCheck(); if (S.tab === 'home') renderHome(); } catch (e) { /* display refresh only */ }
    await showReceipt(sale.id);
  } catch (ex) { toast((ex && ex.message) || t('err_generic'), 4000); const b = $('qb-save'); if (b) b.disabled = false; }
  finally { QB.busy = false; }
}

document.addEventListener('click', e => {
  const el = e.target; if (!el || !el.closest) return;
  if (el.closest('#btn-qb-home') || el.closest('#btn-quickbill')) return qbOpen();
  if (!el.closest('#sheet')) return;
  if (el.closest('#qb-add')) return qbAdd();
  if (el.closest('#qb-save')) return qbSave();
  const pm = el.closest('[data-qbpm]');
  if (pm) { QB.pm = pm.dataset.qbpm; document.querySelectorAll('[data-qbpm]').forEach(b => b.classList.toggle('on', b.dataset.qbpm === QB.pm)); return; }
  const rm = el.closest('[data-qbrm]');
  if (rm) { QB.lines.splice(+rm.dataset.qbrm, 1); qbRenderLines(); qbRenderTotals(); return; }
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'qb-amt') qbRenderTotals(); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && (e.target.id === 'qb-amt' || e.target.id === 'qb-name')) { e.preventDefault(); qbAdd(); } });
