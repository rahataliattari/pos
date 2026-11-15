// Universal POS — "Check a bill": does a bill (QR code or bill number + code) really come from THIS shop's records?
// Free for every plan and every role. Works offline: it compares against the sales stored on this phone.
// The QR on a printed bill is made by print.js (billQrText / billCode). This file only reads it back.
const VFS = {
  vf_btn: ['بل چیک کریں', 'Check a bill'], vf_title: ['بل کی تصدیق', 'Verify a bill'],
  vf_scan: ['QR سکین کریں', 'Scan QR'], vf_or: ['یا ہاتھ سے لکھیں', 'or type it'],
  vf_inv: ['بل نمبر', 'Bill number'], vf_code: ['تصدیقی کوڈ (QR کے نیچے)', 'Verification code (under the QR)'], vf_go: ['چیک کریں', 'Check'],
  vf_paste: ['QR کا پورا متن یہاں چپکائیں (اختیاری)', 'Paste the full QR text here (optional)'],
  vf_ok: ['✓ یہ بل ہماری دکان کا اصلی بل ہے', '✓ This is a genuine bill of our shop'],
  vf_ok_sub: ['بل نمبر، تاریخ، رقم اور کوڈ ہمارے ریکارڈ سے مل گئے۔', 'Bill number, date, amount and code match our records.'],
  vf_nocode: ['بل ہمارے ریکارڈ میں ملا، مگر کوڈ نہیں ملایا گیا', 'Bill found in our records, but the code was not checked'],
  vf_nocode_sub: ['مکمل تصدیق کے لیے بل پر چھپا کوڈ بھی لکھیں یا QR سکین کریں۔', 'For full verification also enter the printed code or scan the QR.'],
  vf_bad: ['✗ کوڈ یا رقم ہمارے ریکارڈ سے نہیں ملتی', '✗ Code or amount does not match our records'],
  vf_bad_sub: ['بل نمبر موجود ہے مگر تفصیل مختلف ہے۔ بل تبدیل شدہ یا جعلی ہو سکتا ہے۔', 'The bill number exists but the details differ. The bill may be altered or fake.'],
  vf_none: ['✗ یہ بل ہمارے ریکارڈ میں نہیں ملا', '✗ This bill is not in our records'],
  vf_none_sub: ['ہو سکتا ہے یہ کسی اور دکان کا ہو، یا اس فون پر ابھی سنک نہ ہوا ہو (سنک کر کے دوبارہ دیکھیں)۔', 'It may belong to another shop, or this phone has not synced it yet (sync and try again).'],
  vf_other: ['✗ یہ بل ہماری دکان کا نہیں', '✗ This bill is not from our shop'],
  vf_other_sub: ['QR پر کسی اور دکان کا نام ہے۔', 'The QR names a different shop.'],
  vf_unread: ['QR کا متن سمجھ نہیں آیا', 'Could not read this QR'],
  vf_unread_sub: ['یہ ہماری ایپ کا تصدیقی QR نہیں لگتا۔', 'This does not look like a verification QR from this app.'],
  vf_void: ['⚠ یہ بل منسوخ (void) ہو چکا ہے', '⚠ This bill has been voided'],
  vf_open: ['بل کھولیں', 'Open bill'], vf_again: ['دوبارہ چیک کریں', 'Check another'],
  vf_note: ['صرف تصدیق کے لیے — اس سے کوئی ادائیگی یا وصولی نہیں ہوتی۔', 'For verification only — no payment or receipt happens here.'],
  vf_need: ['بل نمبر لکھیں یا QR سکین کریں', 'Enter a bill number or scan the QR'],
  vf_date: ['تاریخ', 'Date'], vf_total: ['کل رقم', 'Total']
};
for (const k in VFS) { I18N.ur[k] = VFS[k][0]; I18N.en[k] = VFS[k][1]; }

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
    ${s ? `<div class="card" style="margin-top:8px"><div class="row"><b dir="ltr">${esc(s.invoice_no)}</b><span class="grow"></span><span class="price">${money(s.total)}</span></div>
      <div class="muted">${t('vf_date')}: ${esc(fmtDate(s.created_at))}</div>${s.status === 'void' ? `<div class="warn" style="margin-top:6px">${t('vf_void')}</div>` : ''}</div>
      <button class="btn secondary block" id="vf-open" data-sale-id="${s.id}" style="margin-top:8px">${t('vf_open')}</button>` : ''}
    <button class="btn block" id="vf-again" style="margin-top:8px">${t('vf_again')}</button>
    <div class="muted" style="margin-top:8px;text-align:center">${t('vf_note')}</div>`;
}
function openVerify() {
  openModal(`<h2>${t('vf_title')}</h2><div id="vf-body">
    ${navigator.mediaDevices ? `<button class="btn block" id="vf-scan">${ic('scan', 20)} ${t('vf_scan')}</button><div class="muted" style="text-align:center;margin:8px 0">${t('vf_or')}</div>` : ''}
    <label>${t('vf_inv')}</label><input id="vf-inv" dir="ltr" autocomplete="off" placeholder="INV-000123">
    <label>${t('vf_code')}</label><input id="vf-code" dir="ltr" autocomplete="off" placeholder="XXXX-XXXX" style="text-transform:uppercase">
    <label>${t('vf_paste')}</label><textarea id="vf-paste" dir="ltr" rows="3"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn secondary" data-close>${t('close')}</button><button class="btn grow" id="vf-go">${t('vf_go')}</button></div>
    <div class="muted" style="margin-top:8px;text-align:center">${t('vf_note')}</div></div>`);
  const show = async q => { $('vf-body').innerHTML = vfResultHtml(q ? await verifyBill(q) : { state: 'unread' });
    $('vf-again').onclick = () => openVerify();
    if ($('vf-open')) $('vf-open').onclick = () => { const id = $('vf-open').dataset.saleId; closeModal(); showReceipt(id); }; };
  if ($('vf-scan')) $('vf-scan').onclick = async () => {
    closeModal();
    openModal(`<h2>${t('vf_scan')}</h2><div class="scanwrap"><video id="scanvideo" playsinline muted></video><div class="scanframe"><i class="scanline"></i></div></div>
      <div style="margin-top:10px"><button class="btn secondary block" data-close>${t('cancel')}</button></div>`);
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
