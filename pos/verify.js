// Universal POS — "Check a bill": does a bill (QR code or bill number + code) really come from THIS shop's records?
// Free for every plan and every role. Works offline: it compares against the sales stored on this phone.
// The QR on a printed bill is made by print.js (billQrText / billCode). This file only reads it back.
// QR text -> { shop, invoice, date, total, code } or null when it is not our format.
function billQrParse(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || !/BILL VERIFICATION/i.test(lines[0])) return null;
  const f = {}; for (const l of lines.slice(1)) { const i = l.indexOf(':'); if (i > 0) f[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); }
  if (!f.bill) return null;
  return { shop: f.shop || '', invoice: f.bill, date: f.date || '', total: (f.total || '').replace(/^Rs\s*/i, ''), code: (f.code || '').toUpperCase() };
}
const vfNorm = s => String(s || '').toLowerCase().replace(/\s+/g, '');

// Core check. `q` = { invoice, code?, total?, date?, shop? }. Returns { state, sale? }.
//   ok | nocode | bad | none | other
async function verifyBill(q) {
  const inv = String(q.invoice || '').trim();
  const sale = inv ? await db.sales.where('[shop_id+invoice_no]').equals([S.session.shop_id, inv]).filter(s => !s.deleted_at).first() : null;
  if (!sale) {
    const sameShop = !q.shop || vfNorm(q.shop) === vfNorm(String(S.session.shop_name || '').slice(0, 40));
    return { state: sameShop ? 'none' : 'other' };
  }
  const code = String(q.code || '').trim().toUpperCase();
  if (!code) return { state: 'nocode', sale };
  let good = code === billCode(sale);
  if (good && q.total !== undefined && q.total !== '' && Number(String(q.total).replace(/,/g, '')) !== round2(sale.total)) good = false;
  if (good && q.date) { const mine = billQrText(sale).split('\n').find(l => l.startsWith('Date: ')); if (mine && mine.slice(6) !== q.date) good = false; }
  return { state: good ? 'ok' : 'bad', sale };
}

function vfResultHtml(r) {
  const k = { ok: ['ok', 'vf_ok', 'vf_ok_sub'], nocode: ['warn', 'vf_nocode', 'vf_nocode_sub'], bad: ['bad', 'vf_bad', 'vf_bad_sub'],
    none: ['bad', 'vf_none', 'vf_none_sub'], other: ['bad', 'vf_other', 'vf_other_sub'], unread: ['bad', 'vf_unread', 'vf_unread_sub'] }[r.state];
  const s = r.sale;
  return `<div class="vres ${k[0]}"><b>${t(k[1])}</b><div>${t(k[2])}</div></div>
    ${s ? `<div class="card u-mt-8"><div class="row"><b dir="ltr">${esc(s.invoice_no)}</b><span class="grow"></span><span class="price">${money(s.total)}</span></div>
      <div class="muted">${t('vf_date')}: ${esc(fmtDate(s.created_at))}</div>${s.status === 'void' ? `<div class="warn u-mt-6">${t('vf_void')}</div>` : ''}</div>
      <button class="btn secondary block u-mt-8" id="vf-open" data-sale-id="${s.id}">${t('vf_open')}</button>` : ''}
    <button class="btn block u-mt-8" id="vf-again">${t('vf_again')}</button>
    <div class="muted u-mt-8 u-ta-center">${t('vf_note')}</div>`;
}
function openVerify() {
  openModal(`<h2>${t('vf_title')}</h2><div id="vf-body">
    ${navigator.mediaDevices ? `<button class="btn block" id="vf-scan">${ic('scan', 20)} ${t('vf_scan')}</button><div class="muted u-ta-center u-m-8n0">${t('vf_or')}</div>` : ''}
    <label>${t('vf_inv')}</label><input id="vf-inv" dir="ltr" autocomplete="off" placeholder="INV-000123">
    <label>${t('vf_code')}</label><input id="vf-code" dir="ltr" autocomplete="off" placeholder="XXXX-XXXX" class="u-text-transform-uppercase">
    <label>${t('vf_paste')}</label><textarea id="vf-paste" dir="ltr" rows="3"></textarea>
    <div class="row u-mt-12"><button class="btn secondary" data-close>${t('close')}</button><button class="btn grow" id="vf-go">${t('vf_go')}</button></div>
    <div class="muted u-mt-8 u-ta-center">${t('vf_note')}</div></div>`);
  const show = async q => { $('vf-body').innerHTML = vfResultHtml(q ? await verifyBill(q) : { state: 'unread' });
    $('vf-again').onclick = () => openVerify();
    if ($('vf-open')) $('vf-open').onclick = () => { const id = $('vf-open').dataset.saleId; closeModal(); showReceipt(id); }; };
  if ($('vf-scan')) $('vf-scan').onclick = async () => {
    closeModal();
    openModal(`<h2>${t('vf_scan')}</h2><div class="scanwrap"><video id="scanvideo" playsinline muted></video><div class="scanframe"><i class="scanline"></i></div></div>
      <div class="u-mt-10"><button class="btn secondary block" data-close>${t('cancel')}</button></div>`);
    try {
      await posScanStart($('scanvideo'), async raw => {
        stopScan(); closeModal();
        openVerify(); const p = billQrParse(raw); $('vf-body').innerHTML = ''; await show(p);
      }, true);
    } catch (e) { closeModal(); toast(scanErrorMsg(e), 4500); }
  };
  $('vf-go').onclick = async () => {
    const pasted = billQrParse($('vf-paste').value);
    const q = pasted || { invoice: $('vf-inv').value, code: $('vf-code').value };
    if (!String(q.invoice || '').trim()) return toast(t('vf_need'), 2500);
    await show(q);
  };
}
