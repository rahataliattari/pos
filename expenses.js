// Universal POS — Expenses. Loaded before reports.js and app.js. Uses the existing `expenses` table (no schema change).
const EXP_CATS = ['rent', 'electricity', 'salary', 'transport', 'food', 'repair', 'other'];
const EXT = {
  ex_rent: ['کرایہ', 'Rent'], ex_electricity: ['بجلی/گیس/پانی', 'Utilities'], ex_salary: ['تنخواہ', 'Salary'], ex_transport: ['کرایہ بار/ٹرانسپورٹ', 'Transport'],
  ex_food: ['چائے/کھانا', 'Tea & food'], ex_repair: ['مرمت', 'Repairs'], ex_other: ['متفرق', 'Other'],
  ex_add: ['نیا خرچہ', 'New expense'], ex_edit: ['خرچے میں ترمیم', 'Edit expense'], ex_cat: ['قسم', 'Category'], ex_date: ['تاریخ', 'Date'], ex_none: ['اس مدت میں کوئی خرچہ نہیں', 'No expenses in this period'],
  ex_total: ['کل اخراجات', 'Total expenses'], ex_confirm_del: ['یہ خرچہ حذف کریں؟', 'Delete this expense?'],
  p_today: ['آج', 'Today'], p_week: ['7 دن', '7 days'], p_month: ['اس ماہ', 'This month']
};
for (const k in EXT) { I18N.ur[k] = EXT[k][0]; I18N.en[k] = EXT[k][1]; }

const canReports = () => S.session && ['owner', 'manager'].includes(S.session.role);

// today | week (last 7 days) | month (since the 1st) -> ISO range [from, to)
function periodRange(p) {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  if (p === 'week') s.setDate(s.getDate() - 6); else if (p === 'month') s.setDate(1);
  const e = new Date(); e.setHours(0, 0, 0, 0); e.setDate(e.getDate() + 1);
  return { from: s.toISOString(), to: e.toISOString() };
}
async function listExpenses(shopId, from, to) {
  const rows = await db.expenses.where('[shop_id+created_at]').between([shopId, from], [shopId, to]).reverse().toArray();
  return rows.filter(e => !e.deleted_at);
}
async function saveExpense(data) {
  const amount = round2(Number(data.amount));
  if (!(amount > 0)) throw new Error(t('bad_amount'));
  if (!EXP_CATS.includes(data.category)) throw new Error('Invalid category');
  const fields = { category: data.category, amount, note: (data.note || '').trim() || null };
  return db.transaction('rw', db.expenses, db.sync_queue, db.app_settings, async () => {
    let rec;
    if (data.id) {
      const old = await db.expenses.get(data.id);
      if (!old) throw new Error('Not found');
      rec = { ...old, ...fields, version: old.version + 1, updated_at: new Date().toISOString(), sync_status: 'pending' };
      await db.expenses.put(rec); await enqueue('expenses', rec, 'update');
    } else {
      rec = await newRecord({ ...fields, deleted_at: null, ...(data.created_at ? { created_at: data.created_at } : {}), created_by: data.created_by || null });
      await db.expenses.add(rec); await enqueue('expenses', rec, 'insert');
    }
    return rec;
  });
}
async function softDeleteExpense(id) {
  return db.transaction('rw', db.expenses, db.sync_queue, async () => {
    const old = await db.expenses.get(id); if (!old) return;
    const rec = { ...old, deleted_at: new Date().toISOString(), version: old.version + 1, updated_at: new Date().toISOString(), sync_status: 'pending' };
    await db.expenses.put(rec); await enqueue('expenses', rec, 'update');
  });
}

async function renderExpenses() {
  S.exPeriod = S.exPeriod || 'today';
  const { from, to } = periodRange(S.exPeriod), list = await listExpenses(S.session.shop_id, from, to);
  const total = round2(list.reduce((a, e) => a + e.amount, 0)), by = {};
  list.forEach(e => { by[e.category] = (by[e.category] || 0) + e.amount; });
  $('view-expenses').innerHTML = `
    <div class="seg">${['today', 'week', 'month'].map(p => `<button class="${S.exPeriod === p ? 'on' : ''}" data-ex="per|${p}">${t('p_' + p)}</button>`).join('')}</div>
    <div class="udcard pay"><div class="udic">${ic('wallet', 26)}</div><div class="grow"><div class="muted">${t('ex_total')}</div><div class="big">Rs ${money(total)}</div>
      <div class="muted">${Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 3).map(k => `${t('ex_' + k)} ${money(by[k])}`).join(' · ')}</div></div></div>
    <button class="btn block" data-ex="add" style="margin-bottom:12px">${ic('plus', 18)} ${t('ex_add')}</button>
    ${list.map(e => `<div class="card custcard" data-ex="edit|${e.id}"><div class="avatar sm">${ic('wallet', 20)}</div>
      <div class="grow"><b>${t('ex_' + e.category)}</b><div class="muted">${esc(e.note || '')}${e.note ? ' · ' : ''}${esc(fmtDate(e.created_at))}</div></div><span class="bal owe">Rs ${money(e.amount)}</span></div>`).join('')
      || `<div class="muted" style="text-align:center;padding:24px">${t('ex_none')}</div>`}`;
}
async function openExpenseForm(id) {
  const e = id ? await db.expenses.get(id) : { category: 'other' };
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  openModal(`<h2>${id ? t('ex_edit') : t('ex_add')}</h2><form id="ex-form">
    <label>${t('ex_cat')}</label><select name="category">${EXP_CATS.map(c => `<option value="${c}" ${c === e.category ? 'selected' : ''}>${t('ex_' + c)}</option>`).join('')}</select>
    <label>${t('amount')}</label><input name="amount" type="number" inputmode="decimal" step="any" min="0" required value="${e.amount ?? ''}">
    <label>${t('note')}</label><input name="note" value="${esc(e.note)}">
    ${id ? '' : `<label>${t('ex_date')}</label><input name="date" type="date" max="${today}" value="${today}">`}
    <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button>
      ${id ? `<button class="btn danger" type="button" data-ex="del|${id}">${ic('trash', 18)}</button>` : ''}</div></form>`);
  $('ex-form').onsubmit = async ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    try {
      const created_at = !id && f.date && f.date !== today ? new Date(f.date + 'T' + new Date().toTimeString().slice(0, 5)).toISOString() : undefined;
      await saveExpense({ ...(id ? { id } : { created_at, created_by: S.session.user_id }), category: f.category, amount: f.amount, note: f.note });
      closeModal(); toast(t('saved')); renderExpenses(); refreshStatus();
    } catch (ex) { toast(ex.message || t('err_generic'), 3500); }
  };
}
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-ex]'); if (!el) return;
  const [a, x] = el.dataset.ex.split('|');
  if (a === 'per') { S.exPeriod = x; renderExpenses(); }
  else if (a === 'add') openExpenseForm(null);
  else if (a === 'edit') openExpenseForm(x);
  else if (a === 'del') { if (!confirm(t('ex_confirm_del'))) return; await softDeleteExpense(x); closeModal(); renderExpenses(); refreshStatus(); }
});
