// Universal POS — premium printing: sale receipt (58/80 mm thermal or A4 invoice), WhatsApp text, report print.
// Loaded before app.js. Urdu text uses the Nastaliq fallback in the page font stack; Latin text and digits stay in the clean UI face.
const PRT = {
  rc_sale_invoice: ['سیل انوائس', 'SALES INVOICE'], rc_report: ['کاروباری رپورٹ', 'BUSINESS REPORT'], rc_item: ['آئٹم', 'Item'], rc_qty: ['مقدار', 'Qty'], rc_price: ['قیمت', 'Price'], rc_amount: ['رقم', 'Amount'],
  rc_paid: ['ادا شدہ', 'PAID'], rc_due: ['ادھار باقی', 'BALANCE DUE'], rc_items: ['آئٹمز', 'Items'], rc_saved: ['آپ کی بچت', 'You saved'], rc_wa: ['واٹس ایپ', 'WhatsApp'],
  rc_powered: ['یونیورسل پی او ایس سے تیار', 'Powered by Universal POS'], rc_period: ['مدت', 'Period'], rc_printed: ['پرنٹ کی تاریخ', 'Printed on'],
  set_phone: ['دکان کا فون', 'Shop phone'], set_addr: ['دکان کا پتہ', 'Shop address'], set_ntn: ['NTN / ٹیکس نمبر', 'NTN / tax number'], rc_print_report: ['رپورٹ پرنٹ', 'Print report'],
  rc_verify: ['بل کی تصدیق کیلئے اسکین کریں', 'Scan to verify this bill'], rc_verify_note: ['صرف تصدیق کیلئے — ادائیگی کیلئے نہیں', 'For verification only — not for payment'], rc_qr_show: ['بل پر تصدیقی QR کوڈ', 'Verification QR code on bill'], rc_code: ['کوڈ', 'Code'], rc_qr_locked: ['بل پر تصدیقی QR کوڈ پریمیم پلان میں دستیاب ہے۔ تجدید / اپ گریڈ کیلئے رابطہ کریں۔', 'Verification QR on bills is available on the Premium plan. Contact us to upgrade.']
};
for (const k in PRT) { I18N.ur[k] = PRT[k][0]; I18N.en[k] = PRT[k][1]; }

const iname = i => (LANG === 'ur' && i.name_ur ? i.name_ur : i.product_name);
const kv = (l, v, cls = '', plain = false) => `<div class="kv ${cls}"><span>${l}</span><b${plain ? '' : ' class="num"'}>${v}</b></div>`;

// ───────── Bill verification QR (verification only — it carries NO payment / receiving information) ─────────
// 53-bit string hash (cyrb53): a short tamper-check code printed under the QR so a bill can be matched against the shop's records.
function billHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function billCode(sale) {
  const s = [S.session.shop_id, sale.id, sale.invoice_no, sale.created_at, round2(sale.total)].join('|');
  const c = billHash(s).toString(36).toUpperCase().padStart(10, '0').slice(-8);
  return c.slice(0, 4) + '-' + c.slice(4);
}
function billQrText(sale) {      // kept SHORT on purpose: fewer bytes = a smaller, coarser QR that scans reliably when printed small
  const d = new Date(sale.created_at), p2 = n => String(n).padStart(2, '0');
  const when = isNaN(d) ? '' : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  return ['BILL VERIFICATION', 'Bill: ' + sale.invoice_no, 'Date: ' + when, 'Total: ' + round2(sale.total), 'Code: ' + billCode(sale)].join('\n');
}
// The bill QR is a plan feature: the demo always has it; live shops get it only when their plan has bill_qr = true.
const planHasQr = () => !!window.POS_DEMO || !!(S.session && S.session.bill_qr === true);
function billQrHtml(sale) {
  if (!planHasQr() || S.cfg.receipt_qr === false) return '';
  try {
    return `<div class="qrbox">${qrSvg(billQrText(sale), { size: 120 })}<div class="qrcap">${t('rc_verify')}</div>
      <div class="qrcode num">${t('rc_code')}: ${billCode(sale)}</div><div class="qrnote">${t('rc_verify_note')}</div></div>`;
  } catch (e) { return ''; }   // never block printing a bill because of the QR
}

function rcHead(title, qr = '') {
  const c = S.cfg;
  const top = S.cfg.paper === 'a4' ? '' : qr, side = S.cfg.paper === 'a4' ? qr : '';
  return `<div class="hd">${top}<div class="hi"><div class="shopname">${esc(S.session.shop_name)}</div>
    ${c.receipt_header ? `<div class="sub">${esc(c.receipt_header)}</div>` : ''}${c.shop_address ? `<div class="sub">${esc(c.shop_address)}</div>` : ''}
    ${c.shop_phone ? `<div class="sub num">${esc(c.shop_phone)}</div>` : ''}${c.shop_tax_no ? `<div class="sub">${t('set_ntn')}: <span class="num">${esc(c.shop_tax_no)}</span></div>` : ''}</div>
    <div class="doc">${title}</div>${side}</div>`;
}

function receiptHtml(sale, items, cust) {
  const a4 = S.cfg.paper === 'a4', due = Math.max(0, round2(sale.total - sale.paid)), qtySum = round3(items.reduce((a, i) => a + i.qty, 0));
  const meta = kv(t('invoice'), esc(sale.invoice_no)) + (sale.edited_from_no ? kv(t('edit_of'), esc(sale.edited_from_no), '', true) : '') + kv(t('ex_date'), esc(fmtDate(sale.created_at)), '', true) + (cust ? `<div class="kv"><span>${t('customer')}</span><b>${esc(cust.name)}</b></div>` : '');
  const lines = a4
    ? `<table class="rt"><thead><tr><th>#</th><th>${t('rc_item')}</th><th>${t('rc_qty')}</th><th>${t('rc_price')}</th><th>${t('rc_amount')}</th></tr></thead><tbody>${items.map((i, k) =>
        `<tr><td class="num">${k + 1}</td><td>${esc(iname(i))}</td><td class="num">${i.qty}${i.unit_name ? ' ' + esc(i.unit_name) : ''}</td><td class="num">${money(i.unit_price)}</td><td class="num"><b>${money(i.line_total)}</b></td></tr>`).join('')}</tbody></table>`
    : items.map(i => `<div class="it"><div class="n">${esc(iname(i))}</div><b class="num">${money(i.line_total)}</b></div><div class="q num">${i.qty}${i.unit_name ? ' ' + esc(i.unit_name) : ''} × ${money(i.unit_price)}</div>`).join('');
  const sums = kv(t('subtotal'), money(sale.subtotal)) + (sale.discount ? kv(t('discount'), '−' + money(sale.discount)) : '') + (sale.tax ? kv(t('tax'), money(sale.tax)) : '');
  const pmLines = sale.pay_split ? Object.entries(sale.pay_split).map(([k, v]) => kv(t('pm_' + k), money(v))).join('') : (sale.payment_method && sale.payment_method !== 'cash' ? kv(t('rc_pay_by'), t('pm_' + sale.payment_method), '', true) : '');
  const pay = kv(t('paid'), money(sale.paid)) + pmLines + (due > 0 ? kv(t('balance'), money(due), 'dueline') : sale.paid > sale.total ? kv(t('change'), money(sale.paid - sale.total)) : '')
    + (cust && cust.balance > 0 ? kv(t('cust_balance_now'), money(cust.balance), 'dueline') : '');
  return `<div class="rc ${a4 ? 'a4' : ''}">${rcHead(t('rc_sale_invoice'), billQrHtml(sale))}
    <hr class="sep"><div class="meta">${meta}</div><hr class="sep">${lines}${a4 ? '' : '<hr class="sep">'}
    <div class="sumbox">${sums}<div class="grand"><span>${t('total')}</span><span class="num">Rs ${money(sale.total)}</span></div>${pay}
      <div class="stampwrap"><span class="stamp ${due > 0 ? 'owe' : 'paid'}">${due > 0 ? t('rc_due') : t('rc_paid')}</span></div></div>
    <hr class="sep"><div class="sub c">${t('rc_items')}: <span class="num">${items.length}</span> · ${t('rc_qty')}: <span class="num">${qtySum}</span>${sale.discount ? ` · ${t('rc_saved')}: <span class="num">Rs ${money(sale.discount)}</span>` : ''}</div>
    <div class="thanks">${esc(S.cfg.receipt_footer || t('thanks'))}</div><div class="sub c pw">${t('rc_powered')}</div></div>`;
}
function receiptText(sale, items, cust) {
  return [`*${S.session.shop_name}*`, `${t('invoice')}: ${sale.invoice_no}`, fmtDate(sale.created_at), '',
    ...items.map(i => `${iname(i)}  ${i.qty}${i.unit_name ? ' ' + i.unit_name : ''} × ${money(i.unit_price)} = ${money(i.line_total)}`), '',
    `*${t('total')}: Rs ${money(sale.total)}*`, `${t('paid')}: Rs ${money(sale.paid)}${sale.payment_method && sale.payment_method !== 'cash' ? ' (' + t('pm_' + sale.payment_method) + ')' : ''}`,
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
  const host = $('receipt-print');
  host.innerHTML = html;
  let st = $('print-page'); if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }

  const isA4 = paper === 'a4';
  const width = Number.parseFloat(paper) || 58;
  document.documentElement.style.setProperty('--paper', isA4 ? '100%' : width + 'mm');

  if (isA4) {
    st.textContent = '@page{size:A4;margin:12mm}';
  } else {
    // Android/Chrome may paginate a thermal receipt when the roll height is left as "auto".
    // Measure the rendered receipt and give the print page an explicit matching height.
    const receipt = host.querySelector('.rc');
    const oldHostStyle = host.getAttribute('style');
    const oldReceiptStyle = receipt ? receipt.getAttribute('style') : null;
    host.style.cssText = 'display:block;position:absolute;left:-10000px;top:0;width:' + width + 'mm;';
    if (receipt) {
      receipt.style.width = width + 'mm';
      receipt.style.maxWidth = 'none';
      receipt.style.margin = '0 auto';
      receipt.style.padding = '0 1mm';
      receipt.style.boxShadow = 'none';
    }
    const pxHeight = receipt ? Math.ceil(receipt.getBoundingClientRect().height) : 240;
    const pageHeight = Math.max(60, Math.ceil(pxHeight * 25.4 / 96) + 4);
    if (oldHostStyle === null) host.removeAttribute('style'); else host.setAttribute('style', oldHostStyle);
    if (receipt) {
      if (oldReceiptStyle === null) receipt.removeAttribute('style');
      else receipt.setAttribute('style', oldReceiptStyle);
    }
    st.textContent = '@page{size:' + width + 'mm ' + pageHeight + 'mm;margin:0}';
  }

  document.body.classList.add('printing');
  window.print();
  setTimeout(() => document.body.classList.remove('printing'), 500);
}
