// Universal POS — Reports (profit & loss, credit, top products, low stock). Read-only: everything is computed from local records.
const RPT = {
  rp_sales: ['کل فروخت', 'Total sales'], rp_cogs: ['مال کی لاگت', 'Cost of goods sold'], rp_gross: ['مجموعی منافع', 'Gross profit'], rp_net: ['خالص منافع', 'Net profit'],
  rp_credit_given: ['ادھار دیا گیا', 'Credit given'], rp_received: ['ادھار کی وصولی', 'Credit received'], rp_purchases: ['خریداری', 'Purchases'],
  rp_daily: ['روزانہ فروخت', 'Daily sales'], rp_top: ['زیادہ بکنے والی پروڈکٹس', 'Top products'], rp_low: ['کم اسٹاک', 'Low stock'], rp_none: ['اس مدت میں کوئی فروخت نہیں', 'No sales in this period'],
  rp_loss: ['نقصان', 'Loss'], rp_sold: ['بکا', 'sold'], rp_cash_note: ['منافع = فروخت − مال کی لاگت − اخراجات', 'Profit = sales − cost of goods − expenses']
};
for (const k in RPT) { I18N.ur[k] = RPT[k][0]; I18N.en[k] = RPT[k][1]; }

async function computeReport(shopId, p) {
  const { from, to } = periodRange(p), rng = [[shopId, from], [shopId, to]];
  const sales = (await db.sales.where('[shop_id+created_at]').between(...rng).toArray()).filter(s => s.status !== 'void');
  let revenue = 0, cogs = 0, credit = 0; const prod = {}, day = {};
  for (const s of sales) {
    revenue += s.total; credit += Math.max(0, s.total - s.paid);
    const k = new Date(s.created_at).toDateString(); day[k] = (day[k] || 0) + s.total;
    for (const i of await db.sale_items.where('[shop_id+sale_id]').equals([shopId, s.id]).toArray()) {
      cogs += i.qty * (i.cost_price || 0);
      const r = prod[i.product_name] || (prod[i.product_name] = { qty: 0, rev: 0 }); r.qty += i.qty; r.rev += i.line_total;
    }
  }
  const exps = await listExpenses(shopId, from, to);
  const purchases = (await db.purchases.where('[shop_id+created_at]').between(...rng).toArray()).filter(x => x.status !== 'void').reduce((a, x) => a + x.total, 0);
  const received = (await db.payments.where('[shop_id+created_at]').between(...rng).toArray()).filter(x => x.party_type === 'customer' && x.kind === 'receipt' && !x.voided).reduce((a, x) => a + x.amount, 0);
  const expenses = exps.reduce((a, e) => a + e.amount, 0);
  const days = [], d = new Date(from), end = new Date(to);
  for (; d < end; d.setDate(d.getDate() + 1)) days.push({ n: d.getDate(), v: day[d.toDateString()] || 0 });
  const top = Object.entries(prod).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
  return { revenue: round2(revenue), cogs: round2(cogs), gross: round2(revenue - cogs), expenses: round2(expenses), net: round2(revenue - cogs - expenses),
    credit: round2(credit), received: round2(received), purchases: round2(purchases), bills: sales.length, days, top };
}
async function lowStockList(shopId) {
  const all = await db.products.where('[shop_id+name]').between([shopId, ''], [shopId, '\uffff']).filter(p => !p.deleted_at && p.is_active !== false && p.min_stock > 0).toArray();
  const st = await getStocks(shopId, all.map(p => p.id));
  return all.filter(p => st[p.id] <= p.min_stock).map(p => ({ p, st: st[p.id] })).slice(0, 8);
}
async function renderReports() {
  S.rpPeriod = S.rpPeriod || 'today';
  const v = $('view-reports');
  if (!canReports()) { v.innerHTML = `<div class="muted" style="text-align:center;padding:24px">${t('owner_mgr_only')}</div>`; return; }
  const r = await computeReport(S.session.shop_id, S.rpPeriod), low = await lowStockList(S.session.shop_id);
  S.lastReport = { r, low };
  const row = (l, val, cls = '') => `<div class="${cls}"><span>${l}</span><span>Rs ${money(val)}</span></div>`, mx = Math.max(1, ...r.days.map(x => x.v));
  v.innerHTML = `
    <div class="seg">${['today', 'week', 'month'].map(p => `<button class="${S.rpPeriod === p ? 'on' : ''}" data-rp="per|${p}">${t('p_' + p)}</button>`).join('')}</div>
    <button class="btn secondary block" data-rp="print" style="margin-bottom:12px">${ic('print', 18)} ${t('rc_print_report')}</button>
    <div class="today"><div class="cal">${ic('chart', 24)}</div><div class="grow"><div class="muted">${t('rp_net')} · ${r.bills} ${t('bills_n')}</div>
      <div class="big" style="${r.net < 0 ? 'color:var(--err)' : ''}">${r.net < 0 ? t('rp_loss') + ' ' : ''}Rs ${money(Math.abs(r.net))}</div><div class="muted" style="font-size:12px">${t('rp_cash_note')}</div></div></div>
    <div class="card totals">${row(t('rp_sales'), r.revenue)}${row('− ' + t('rp_cogs'), r.cogs)}${row(t('rp_gross'), r.gross)}${row('− ' + t('mod_expenses'), r.expenses)}${row(t('rp_net'), r.net, r.net < 0 ? 'grand neg' : 'grand')}</div>
    <div class="card totals">${row(t('rp_credit_given'), r.credit)}${row(t('rp_received'), r.received)}${row(t('rp_purchases'), r.purchases)}</div>
    ${r.days.length > 1 ? `<div class="card"><div class="sa-sec">${t('rp_daily')}</div><div class="sa-bars">${r.days.map(d => `<div><i style="height:${Math.max(3, Math.round(d.v / mx * 80))}%"></i><span style="font-size:9px">${d.n}</span></div>`).join('')}</div></div>` : ''}
    <div class="card"><div class="sa-sec">${t('rp_top')}</div>${r.top.map(([n, x]) => `<div class="lrow"><div class="grow"><b>${esc(n)}</b><div class="muted">${x.qty} ${t('rp_sold')}</div></div><b>Rs ${money(x.rev)}</b></div>`).join('') || `<div class="muted">${t('rp_none')}</div>`}</div>
    ${low.length ? `<div class="card"><div class="sa-sec">${t('rp_low')}</div>${low.map(({ p, st }) => `<div class="lrow"><div class="grow"><b>${esc(LANG === 'ur' && p.name_ur ? p.name_ur : p.name)}</b></div><span class="bal owe">${st} / ${p.min_stock}</span></div>`).join('')}</div>` : ''}`;
}
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-rp]'); if (!el) return;
  const [a, x] = el.dataset.rp.split('|');
  if (a === 'per') { S.rpPeriod = x; renderReports(); }
  else if (a === 'print' && S.lastReport) doPrint(reportPrintHtml(S.lastReport.r, S.lastReport.low, S.rpPeriod), 'a4');
});
