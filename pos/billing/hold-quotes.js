// Universal POS — billing/hold-quotes.js: hold / resume bills and quotations (part of the billing/ module, with cart.js and quick.js).
// Loaded BEFORE app.js. Uses app.js globals (S, $, t, money, toast, openModal...) at call time only.
// Held bills and quotations live on THIS phone only (settings table); they are not sales: no stock moves, nothing syncs.

const BP = { seg: 'held' };
const bpEff = l => Math.round(l.unit_price * (1 - Math.min(100, Math.max(0, num(l.disc))) / 100) * 100) / 100;
const bpTotals = (lines, disc, mode, pct) => {      // same maths as cartTotals() (and saveSale), for a stored cart
  const sub = round2(lines.reduce((a, l) => a + lineTotal(l), 0));
  const d = round2(Math.min(Math.max(mode === 'pct' ? sub * Math.min(100, Math.max(0, num(pct))) / 100 : num(disc), 0), sub));
  const tax = round2((sub - d) * num(S.cfg.tax_rate) / 100);
  return { subtotal: sub, discount: d, tax, total: round2(sub - d + tax) };
};
async function bpLoad() {
  S.held = await getSetting('held_bills', []); S.quotes = await getSetting('quotes', []);
  S.heldN = (S.held || []).length;
}
const bpSave = async () => { S.heldN = S.held.length; await setSetting('held_bills', S.held); await setSetting('quotes', S.quotes); };
const bpSnap = () => ({ lines: JSON.parse(JSON.stringify(S.cart)), cust: S.saleCust ? { id: S.saleCust.id, name: S.saleCust.name, phone: S.saleCust.phone || '' } : null,
  discount: S.discount || 0, discPct: S.discPct || 0, discMode: S.discMode || 'rs' });

// ───────── Hold / resume ─────────
async function bpHold() {
  if (!S.cart.length) return;
  const sn = bpSnap(), tt = cartTotals();
  S.held = S.held || [];
  S.held.unshift({ id: uuid(), at: new Date().toISOString(), total: tt.total, ...sn });
  S.held = S.held.slice(0, 30);
  await bpSave(); billResetState(); await setSetting('cart_draft', []);
  closeModal(); refreshBill(); renderBillShell(); loadTiles(); toast(t('hold_done'));
}
async function bpResume(id) {
  const h = (S.held || []).find(x => x.id === id); if (!h) return;
  if (S.cart.length) { const cur = bpSnap(); S.held.unshift({ id: uuid(), at: new Date().toISOString(), total: cartTotals().total, ...cur }); }
  S.held = S.held.filter(x => x.id !== id);
  billResetState();
  S.cart = h.lines; S.saleCust = h.cust; S.discount = h.discount; S.discPct = h.discPct; S.discMode = h.discMode;
  await bpSave(); persistCart(); closeModal(); renderBillShell(); loadTiles(); refreshBill(); toast(S.cart.length ? t('hold_resume') : '');
  openCheckout();
}

// ───────── Quotations ─────────
async function bpQuote() {
  if (!S.cart.length) return;
  const days = 7, tt = cartTotals(), n = (await getSetting('quote_counter', 0)) + 1;
  await setSetting('quote_counter', n);
  const q = { id: uuid(), no: 'Q-' + String(n).padStart(5, '0'), at: new Date().toISOString(), valid_days: days, total: tt.total, ...bpSnap() };
  S.quotes = [q, ...(S.quotes || [])].slice(0, 50); await bpSave();
  toast(t('qt_saved')); bpShowQuote(q.id);
}
function bpItems(q) {
  return q.lines.map(l => ({ product_name: l.product_name, name_ur: l.name_ur || '', qty: l.qty, unit_name: l.unit_name && l.unit_name !== l.unit ? l.unit_name : (l.unit_name || ''), unit_price: bpEff(l), line_total: lineTotal(l) }));
}
function quoteHtml(q) {
  const a4 = S.cfg.paper === 'a4', items = bpItems(q), tt = bpTotals(q.lines, q.discount, q.discMode, q.discPct);
  const until = new Date(new Date(q.at).getTime() + q.valid_days * 864e5).toISOString();
  const meta = kv(t('qt_no'), esc(q.no)) + kv(t('ex_date'), esc(fmtDate(q.at)), '', true) + kv(t('qt_valid'), esc(fmtDate(until).split(',')[0]), '', true)
    + (q.cust ? `<div class="kv"><span>${t('customer')}</span><b>${esc(q.cust.name)}</b></div>` : '');
  const lines = a4
    ? `<table class="rt"><thead><tr><th>#</th><th>${t('rc_item')}</th><th>${t('rc_qty')}</th><th>${t('rc_price')}</th><th>${t('rc_amount')}</th></tr></thead><tbody>${items.map((i, k) =>
        `<tr><td class="num">${k + 1}</td><td>${esc(iname(i))}</td><td class="num">${i.qty}${i.unit_name ? ' ' + esc(i.unit_name) : ''}</td><td class="num">${money(i.unit_price)}</td><td class="num"><b>${money(i.line_total)}</b></td></tr>`).join('')}</tbody></table>`
    : items.map(i => `<div class="it"><div class="n">${esc(iname(i))}</div><b class="num">${money(i.line_total)}</b></div><div class="q num">${i.qty}${i.unit_name ? ' ' + esc(i.unit_name) : ''} × ${money(i.unit_price)}</div>`).join('');
  const sums = kv(t('subtotal'), money(tt.subtotal)) + (tt.discount ? kv(t('discount'), '−' + money(tt.discount)) : '') + (tt.tax ? kv(t('tax'), money(tt.tax)) : '');
  return `<div class="rc ${a4 ? 'a4' : ''}">${rcHead(t('qt_title'))}<hr class="sep"><div class="meta">${meta}</div><hr class="sep">${lines}${a4 ? '' : '<hr class="sep">'}
    <div class="sumbox">${sums}<div class="grand"><span>${t('total')}</span><span class="num">Rs ${money(tt.total)}</span></div></div>
    <hr class="sep"><div class="sub c">${t('qt_note')}</div><div class="sub c pw">${t('rc_powered')}</div></div>`;
}
function quoteText(q) {
  const tt = bpTotals(q.lines, q.discount, q.discMode, q.discPct);
  return [`*${S.session.shop_name}* — ${t('qt_title')} ${q.no}`, fmtDate(q.at), '',
    ...bpItems(q).map(i => `${iname(i)}  ${i.qty}${i.unit_name ? ' ' + i.unit_name : ''} × ${money(i.unit_price)} = ${money(i.line_total)}`), '',
    ...(tt.discount ? [`${t('discount')}: −${money(tt.discount)}`] : []), `*${t('total')}: Rs ${money(tt.total)}*`, '', t('qt_note')].join('\n');
}
function bpShowQuote(id) {
  const q = (S.quotes || []).find(x => x.id === id); if (!q) return;
  const wa = q.cust && waNumber(q.cust.phone);
  openModal(`<h2>${t('qt_title')}</h2><div class="rcwrap">${quoteHtml(q)}</div>
    <div class="row u-mt-12"><button class="btn grow" data-bp="qprint|${id}">${ic('print', 18)} ${t('print')}</button>
      <a class="btn secondary lnk" target="_blank" rel="noopener" href="https://wa.me/${wa || ''}?text=${encodeURIComponent(quoteText(q))}">${ic('chat', 18)} ${t('rc_wa')}</a></div>
    <div class="row u-mt-8"><button class="btn secondary grow" data-bp="qload|${id}">${t('qt_to_bill')}</button><button class="btn secondary" data-close>${t('close')}</button></div>`);
}
async function bpQuoteLoad(id) {
  const q = (S.quotes || []).find(x => x.id === id); if (!q) return;
  if (S.cart.length) { S.held = S.held || []; S.held.unshift({ id: uuid(), at: new Date().toISOString(), total: cartTotals().total, ...bpSnap() }); }
  billResetState(); S.cart = JSON.parse(JSON.stringify(q.lines)); S.saleCust = q.cust; S.discount = q.discount; S.discPct = q.discPct; S.discMode = q.discMode;
  await bpSave(); persistCart(); closeModal(); if (S.tab !== 'bill') switchTab('bill'); renderBillShell(); loadTiles(); refreshBill(); openCheckout();
}

// ───────── List modal ─────────
function bpListOpen(seg) {
  if (seg) BP.seg = seg;
  const held = S.held || [], quotes = S.quotes || [];
  const tabs = `<div class="seg"><button class="${BP.seg === 'held' ? 'on' : ''}" data-bp="seg|held">${t('hold_tab')} (${held.length})</button><button class="${BP.seg === 'quotes' ? 'on' : ''}" data-bp="seg|quotes">${t('quote_tab')} (${quotes.length})</button></div>`;
  const row = (x, kind) => `<div class="card"><div class="row"><div class="grow"><b>${kind === 'q' ? esc(x.no) : fmtDate(x.at)}</b>
      <div class="muted">${x.lines.length} ${t('items_n')}${x.cust ? ' · ' + esc(x.cust.name) : ''}${kind === 'q' ? ' · ' + esc(fmtDate(x.at)) : ''}</div></div><div class="price">Rs ${money(x.total)}</div></div>
      <div class="row u-mt-8">${kind === 'q'
        ? `<button class="btn grow sm" data-bp="qshow|${x.id}">${t('qt_title')}</button><button class="btn secondary sm" data-bp="qload|${x.id}">${t('qt_to_bill')}</button><button class="btn danger sm" data-bp="qdel|${x.id}" aria-label="${t('delete')}">${ic('trash', 14)}</button>`
        : `<button class="btn grow sm" data-bp="resume|${x.id}">${t('hold_resume')}</button><button class="btn danger sm" data-bp="hdel|${x.id}" aria-label="${t('delete')}">${ic('trash', 14)}</button>`}</div></div>`;
  openModal(`<h2>${t('hold_list')}</h2>${tabs}${BP.seg === 'held'
    ? (held.map(h => row(h, 'h')).join('') || `<div class="muted u-ta-center u-p-18">${t('hold_none')}</div>`)
    : (quotes.map(q => row(q, 'q')).join('') || `<div class="muted u-ta-center u-p-18">${t('quote_none')}</div>`)}
    <div class="u-mt-8"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}
const BP_ACT = {
  seg: k => bpListOpen(k), resume: id => bpResume(id), qshow: id => bpShowQuote(id), qload: id => bpQuoteLoad(id),
  qprint: id => { const q = (S.quotes || []).find(x => x.id === id); if (q) doPrint(quoteHtml(q), S.cfg.paper); },
  hdel: async id => { if (!await askConfirm(t('hold_del'))) return; S.held = S.held.filter(x => x.id !== id); await bpSave(); renderBillShell(); bpListOpen(); },
  qdel: async id => { if (!await askConfirm(t('hold_del'))) return; S.quotes = S.quotes.filter(x => x.id !== id); await bpSave(); bpListOpen(); }
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-bp]'); if (!el) return;
  const [a, x] = el.dataset.bp.split('|'); if (BP_ACT[a]) BP_ACT[a](x);
});
