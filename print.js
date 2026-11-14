// Universal POS — premium printing: sale receipt (58/80 mm thermal or A4 invoice), WhatsApp text, report print.
// Loaded before app.js. Urdu text uses the Nastaliq fallback in the page font stack; Latin text and digits stay in the clean UI face.
const PRT = {
  rc_sale_invoice: ['سیل انوائس', 'SALES INVOICE'], rc_report: ['کاروباری رپورٹ', 'BUSINESS REPORT'], rc_item: ['آئٹم', 'Item'], rc_qty: ['مقدار', 'Qty'], rc_price: ['قیمت', 'Price'], rc_amount: ['رقم', 'Amount'],
  rc_paid: ['ادا شدہ', 'PAID'], rc_due: ['ادھار باقی', 'BALANCE DUE'], rc_items: ['آئٹمز', 'Items'], rc_saved: ['آپ کی بچت', 'You saved'], rc_wa: ['واٹس ایپ', 'WhatsApp'],
  rc_powered: ['یونیورسل پی او ایس سے تیار', 'Powered by Universal POS'], rc_period: ['مدت', 'Period'], rc_printed: ['پرنٹ کی تاریخ', 'Printed on'],
  set_phone: ['دکان کا فون', 'Shop phone'], set_addr: ['دکان کا پتہ', 'Shop address'], set_ntn: ['NTN / ٹیکس نمبر', 'NTN / tax number'], rc_print_report: ['رپورٹ پرنٹ', 'Print report']
};
for (const k in PRT) { I18N.ur[k] = PRT[k][0]; I18N.en[k] = PRT[k][1]; }

const iname = i => (LANG === 'ur' && i.name_ur ? i.name_ur : i.product_name);
const kv = (l, v, cls = '', plain = false) => `<div class="kv ${cls}"><span>${l}</span><b${plain ? '' : ' class="num"'}>${v}</b></div>`;
function rcHead(title) {
  const c = S.cfg;
  return `<div class="hd"><div class="hi"><div class="shopname">${esc(S.session.shop_name)}</div>
    ${c.receipt_header ? `<div class="sub">${esc(c.receipt_header)}</div>` : ''}${c.shop_address ? `<div class="sub">${esc(c.shop_address)}</div>` : ''}
    ${c.shop_phone ? `<div class="sub num">${esc(c.shop_phone)}</div>` : ''}${c.shop_tax_no ? `<div class="sub">${t('set_ntn')}: <span class="num">${esc(c.shop_tax_no)}</span></div>` : ''}</div>
    <div class="doc">${title}</div></div>`;
}

function receiptHtml(sale, items, cust) {
  const a4 = S.cfg.paper === 'a4', due = Math.max(0, round2(sale.total - sale.paid)), qtySum = round3(items.reduce((a, i) => a + i.qty, 0));
  const meta = kv(t('invoice'), esc(sale.invoice_no)) + kv(t('ex_date'), esc(fmtDate(sale.created_at)), '', true) + (cust ? `<div class="kv"><span>${t('customer')}</span><b>${esc(cust.name)}</b></div>` : '');
  const lines = a4
    ? `<table class="rt"><thead><tr><th>#</th><th>${t('rc_item')}</th><th>${t('rc_qty')}</th><th>${t('rc_price')}</th><th>${t('rc_amount')}</th></tr></thead><tbody>${items.map((i, k) =>
        `<tr><td class="num">${k + 1}</td><td>${esc(iname(i))}</td><td class="num">${i.qty}</td><td class="num">${money(i.unit_price)}</td><td class="num"><b>${money(i.line_total)}</b></td></tr>`).join('')}</tbody></table>`
    : items.map(i => `<div class="it"><div class="n">${esc(iname(i))}</div><b class="num">${money(i.line_total)}</b></div><div class="q num">${i.qty} × ${money(i.unit_price)}</div>`).join('');
  const sums = kv(t('subtotal'), money(sale.subtotal)) + (sale.discount ? kv(t('discount'), '−' + money(sale.discount)) : '') + (sale.tax ? kv(t('tax'), money(sale.tax)) : '');
  const pay = kv(t('paid'), money(sale.paid)) + (due > 0 ? kv(t('balance'), money(due), 'dueline') : sale.paid > sale.total ? kv(t('change'), money(sale.paid - sale.total)) : '')
    + (cust && cust.balance > 0 ? kv(t('cust_balance_now'), money(cust.balance), 'dueline') : '');
  return `<div class="rc ${a4 ? 'a4' : ''}">${rcHead(t('rc_sale_invoice'))}
    <hr class="sep"><div class="meta">${meta}</div><hr class="sep">${lines}${a4 ? '' : '<hr class="sep">'}
    <div class="sumbox">${sums}<div class="grand"><span>${t('total')}</span><span class="num">Rs ${money(sale.total)}</span></div>${pay}
      <div class="stampwrap"><span class="stamp ${due > 0 ? 'owe' : 'paid'}">${due > 0 ? t('rc_due') : t('rc_paid')}</span></div></div>
    <hr class="sep"><div class="sub c">${t('rc_items')}: <span class="num">${items.length}</span> · ${t('rc_qty')}: <span class="num">${qtySum}</span>${sale.discount ? ` · ${t('rc_saved')}: <span class="num">Rs ${money(sale.discount)}</span>` : ''}</div>
    <div class="thanks">${esc(S.cfg.receipt_footer || t('thanks'))}</div><div class="sub c pw">${t('rc_powered')}</div></div>`;
}
function receiptText(sale, items, cust) {
  return [`*${S.session.shop_name}*`, `${t('invoice')}: ${sale.invoice_no}`, fmtDate(sale.created_at), '',
    ...items.map(i => `${iname(i)}  ${i.qty} × ${money(i.unit_price)} = ${money(i.line_total)}`), '',
    `*${t('total')}: Rs ${money(sale.total)}*`, `${t('paid')}: Rs ${money(sale.paid)}`,
    ...(sale.paid < sale.total ? [`${t('balance')}: Rs ${money(sale.total - sale.paid)}`] : []), '', S.cfg.receipt_footer || t('thanks')].join('\n');
}

function reportPrintHtml(r, low, period) {
  const { from, to } = periodRange(period), dfmt = d => new Date(d).toLocaleDateString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'medium' });
  const last = new Date(new Date(to) - 864e5), row = (l, v, b) => `<tr class="${b || ''}"><td>${l}</td><td class="num">Rs ${money(v)}</td></tr>`;
  return `<div class="rc a4">${rcHead(t('rc_report'))}<hr class="sep">
    <div class="meta">${kv(t('rc_period'), dfmt(from) + ' – ' + dfmt(last), '', true)}${kv(t('rc_printed'), fmtDate(new Date().toISOString()), '', true)}${kv(t('bills_n'), r.bills)}</div>
    <table class="rt">${row(t('rp_sales'), r.revenue)}${row('− ' + t('rp_cogs'), r.cogs)}${row(t('rp_gross'), r.gross, 'strong')}${row('− ' + t('mod_expenses'), r.expenses)}${row(t('rp_net'), r.net, 'strong grandrow')}</table>
    <table class="rt">${row(t('rp_credit_given'), r.credit)}${row(t('rp_received'), r.received)}${row(t('rp_purchases'), r.purchases)}</table>
    ${r.top.length ? `<div class="sec">${t('rp_top')}</div><table class="rt"><thead><tr><th>${t('rc_item')}</th><th>${t('rc_qty')}</th><th>${t('rc_amount')}</th></tr></thead><tbody>${r.top.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${x.qty}</td><td class="num">${money(x.rev)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${low.length ? `<div class="sec">${t('rp_low')}</div><table class="rt"><tbody>${low.map(({ p, st }) => `<tr><td>${esc(LANG === 'ur' && p.name_ur ? p.name_ur : p.name)}</td><td class="num">${st} / ${p.min_stock}</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="sub c pw">${t('rc_powered')}</div></div>`;
}

function doPrint(html, paper) {
  $('receipt-print').innerHTML = html;
  let st = $('print-page'); if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
  st.textContent = paper === 'a4' ? '@page{size:A4;margin:12mm}' : `@page{size:${paper || 58}mm auto;margin:2mm}`;
  document.documentElement.style.setProperty('--paper', paper === 'a4' ? '100%' : (paper || 58) + 'mm');
  document.body.classList.add('printing'); window.print();
  setTimeout(() => document.body.classList.remove('printing'), 500);
}
