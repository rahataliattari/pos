// Universal POS — Sign up (ڈیمو اکاؤنٹ) اور ڈیمو/پلان کی حدیں.
// Loaded BEFORE app.js (after superadmin.js). Uses globals from app.js / db.js / i18n.js at call time.
// سرور کی طرف: supabase/18_signup.sql + supabase/functions/signup. سپر ایڈمن (مزید > سیٹنگز) طے کرتا ہے کہ Sign up کھلا ہے یا نہیں،
// منظوری ضروری ہے یا نہیں، کتنے دن کا ڈیمو ہے؛ اور (بلنگ > پلانز > ڈیمو) کہ ڈیمو میں کون سے فیچرز اور کتنی حدیں ہیں.
const SUT = {
  su_link: ['نیا اکاؤنٹ بنائیں (مفت ڈیمو)', 'Create account (free demo)'],
  su_title: ['مفت ڈیمو اکاؤنٹ', 'Free demo account'],
  su_intro: ['{days} دن کا ڈیمو، محدود سہولیات کے ساتھ: {limits}', '{days}-day demo with limited features: {limits}'],
  su_lim_products: ['{n} پروڈکٹس', '{n} products'], su_lim_bills: ['{n} بل', '{n} bills'], su_lim_users: ['{n} صارف', '{n} user(s)'],
  su_approval_note: ['آپ کی درخواست سپر ایڈمن کی منظوری کے بعد فعال ہوگی۔', 'Your request becomes active after the Super Admin approves it.'],
  su_shop: ['دکان کا نام', 'Shop name'], su_owner: ['آپ کا نام', 'Your name'], su_city: ['شہر (اختیاری)', 'City (optional)'],
  su_pass: ['پاس ورڈ (کم از کم 6 حروف)', 'Password (at least 6 characters)'],
  su_terms: ['میں <a role="button" tabindex="0" class="lnkbtn" data-lgov="terms">شرائط اور پرائیویسی پالیسی</a> سے متفق ہوں', 'I agree to the <a role="button" tabindex="0" class="lnkbtn" data-lgov="terms">terms and privacy policy</a>'],
  su_submit: ['اکاؤنٹ بنائیں', 'Create account'], su_need_terms: ['آگے بڑھنے کے لیے شرائط سے اتفاق ضروری ہے', 'You must agree to the terms to continue'],
  su_need_online: ['نیا اکاؤنٹ بنانے کے لیے انٹرنیٹ ضروری ہے', 'Internet is required to create an account'],
  su_pw_short: ['پاس ورڈ کم از کم 6 حروف کا ہو', 'Password must be at least 6 characters'],
  su_done_title: ['اکاؤنٹ بن گیا', 'Account created'],
  su_done_pending: ['شکریہ! آپ کی درخواست مل گئی۔ سپر ایڈمن کی منظوری کے بعد اسی نمبر اور پاس ورڈ سے لاگ اِن کر سکیں گے۔', 'Thank you! Your request was received. After the Super Admin approves it you can log in with the same number and password.'],
  su_done_ok: ['آپ کا ڈیمو اکاؤنٹ تیار ہے، لاگ اِن ہو رہا ہے…', 'Your demo account is ready, logging in…'],
  su_err_signup_closed: ['نئے اکاؤنٹ بنانا فی الحال بند ہے', 'New sign-ups are closed right now'],
  su_err_phone_exists: ['یہ نمبر پہلے سے رجسٹر ہے، لاگ اِن کریں', 'This number is already registered, please log in'],
  su_err_too_many: ['بہت زیادہ کوششیں۔ کچھ دیر بعد دوبارہ کوشش کریں', 'Too many attempts. Please try again later'],
  su_err_signup_busy: ['آج کی نئی درخواستوں کی حد پوری ہو گئی، کل کوشش کریں', 'Today\'s sign-up limit is reached, please try tomorrow'],
  su_err_bad_input: ['دکان اور اپنا نام لکھیں', 'Please enter the shop and your name'],
  su_err_bad_phone: ['درست موبائل نمبر لکھیں (مثلاً 03001234567)', 'Enter a valid mobile number (e.g. 03001234567)'],
  su_pending_login: ['آپ کی درخواست ابھی منظوری کے انتظار میں ہے', 'Your request is still waiting for approval'],
  su_rejected_login: ['آپ کی درخواست منظور نہیں ہوئی۔ سپورٹ سے رابطہ کریں', 'Your request was not approved. Please contact support'],
  su_demo: ['ڈیمو', 'Demo'], su_days_left: ['{n} دن باقی', '{n} days left'],
  su_usage: ['پروڈکٹس {p} · بل {b}', 'Products {p} · Bills {b}'],
  su_upgrade: ['مکمل ورژن کے لیے سپورٹ سے رابطہ کریں', 'Contact support for the full version'],
  lim_products: ['ڈیمو پلان میں پروڈکٹس کی حد ({n}) پوری ہو گئی۔ مزید کے لیے پلان اپ گریڈ کروائیں', 'Product limit ({n}) of your plan is reached. Upgrade the plan for more'],
  lim_bills: ['ڈیمو پلان میں بلوں کی حد ({n}) پوری ہو گئی۔ مزید کے لیے پلان اپ گریڈ کروائیں', 'Bill limit ({n}) of your plan is reached. Upgrade the plan for more'],
  feat_off: ['یہ سہولت آپ کے پلان میں شامل نہیں۔ اپ گریڈ کے لیے سپورٹ سے رابطہ کریں', 'This feature is not in your plan. Contact support to upgrade']
};
for (const k in SUT) { I18N.ur[k] = SUT[k][0]; I18N.en[k] = SUT[k][1]; }

const suFill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));

// ───────── Plan limits and features (live shops only; the standalone demo file has everything) ─────────
const planOn = () => !window.POS_DEMO && S.session && !S.session.admin;
function planAllows(feat) {                     // feat: customers | purchases | expenses | reports
  if (!planOn()) return true;
  return S.session['f_' + feat] !== false;      // old sessions / plans without the column = allowed
}
async function planLimitCheck(kind) {           // kind: products | bills. Throws a readable Error when the plan's limit is reached.
  if (!planOn()) return;
  const max = Number(S.session['max_' + kind]) || 0; if (max <= 0) return;
  const shop = S.session.shop_id, tbl = kind === 'products' ? db.products : db.sales;
  const n = await tbl.offset(0).filter(r => r.shop_id === shop && !r.deleted_at).count();
  if (n >= max) throw new Error(suFill(t('lim_' + kind), { n: max }));
}
async function planRoom(kind) {                 // how many more records the plan allows (Infinity = no limit)
  if (!planOn()) return Infinity;
  const max = Number(S.session['max_' + kind]) || 0; if (max <= 0) return Infinity;
  const shop = S.session.shop_id, tbl = kind === 'products' ? db.products : db.sales;
  return Math.max(0, max - await tbl.offset(0).filter(r => r.shop_id === shop && !r.deleted_at).count());
}
async function planUsage() {
  const shop = S.session.shop_id, live = r => r.shop_id === shop && !r.deleted_at;
  return { products: await db.products.offset(0).filter(live).count(), bills: await db.sales.offset(0).filter(live).count() };
}
async function demoBannerHtml() {               // home-screen card for demo (trial) shops
  if (!planOn() || !S.session.trial) return '';
  let usage = '';
  try {
    const u = await planUsage(), P = Number(S.session.max_products) || 0, B = Number(S.session.max_bills) || 0;
    usage = suFill(t('su_usage'), { p: P ? `${u.products}/${P}` : u.products, b: B ? `${u.bills}/${B}` : u.bills });
  } catch (e) {}
  const d = typeof syncDaysLeft === 'function' ? syncDaysLeft() : null;
  return `<div class="warn" style="margin:0 0 12px"><b>${t('su_demo')}</b>${d !== null && d >= 0 ? ' · ' + suFill(t('su_days_left'), { n: d }) : ''}
    ${usage ? `<div class="muted">${usage}</div>` : ''}<div class="muted">${t('su_upgrade')}</div></div>`;
}

// ───────── Login page: link + form ─────────
let SU_INFO = null;
async function signupLoadInfo() {
  if (window.POS_DEMO || !navigator.onLine) return null;
  if (SU_INFO) return SU_INFO;
  try {
    const r = await fetch(`${POS_CONFIG.SUPABASE_URL}/rest/v1/rpc/signup_info`, { method: 'POST', cache: 'no-store',
      headers: { apikey: POS_CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}' });
    if (r.ok) SU_INFO = await r.json();
  } catch (e) {}
  return SU_INFO;
}
async function signupLoginHook() {              // called from showLogin / applyStaticText
  const a = $('lnk-signup'); if (!a) return;
  a.textContent = t('su_link');
  const info = await signupLoadInfo();
  a.hidden = !(info && info.enabled);
}
function signupLimitsText(i) {
  const L = [];
  if (i.max_products > 0) L.push(suFill(t('su_lim_products'), { n: i.max_products }));
  if (i.max_bills > 0) L.push(suFill(t('su_lim_bills'), { n: i.max_bills }));
  if (i.max_users > 0) L.push(suFill(t('su_lim_users'), { n: i.max_users }));
  return L.join(' · ');
}
async function signupOpen() {
  const info = await signupLoadInfo();
  if (!info || !info.enabled) return toast(t('su_err_signup_closed'), 3500);
  openModal(`<h2>${t('su_title')}</h2>
    <div class="muted" style="margin-bottom:6px">${suFill(t('su_intro'), { days: info.days, limits: signupLimitsText(info) })}</div>
    ${info.approval ? `<div class="warn" style="margin-bottom:8px">${t('su_approval_note')}</div>` : ''}
    <form id="su-form" autocomplete="off">
      <label>${t('su_shop')}</label><input name="shop_name" required maxlength="80">
      <label>${t('su_owner')}</label><input name="owner_name" required maxlength="60">
      <label>${t('su_city')}</label><input name="city" maxlength="40">
      <label>${t('phone')}</label><input name="phone" type="tel" inputmode="tel" dir="ltr" required placeholder="03001234567" autocomplete="off">
      <label>${t('su_pass')}</label>${pwField('su-pass', '')}
      <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
      <label style="margin-top:10px;display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="terms" style="width:auto;min-height:0;margin-top:4px"><span>${t('su_terms')}</span></label>
      <div class="errtext" id="su-err" role="alert" hidden></div>
      <div class="row" style="margin-top:14px"><button class="btn grow" id="su-go" type="submit">${t('su_submit')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div>
    </form>`);
  if (typeof initEyes === 'function') initEyes();
  $('su-form').onsubmit = signupSubmit;
}
async function signupSubmit(ev) {
  ev.preventDefault();
  const f = Object.fromEntries(new FormData(ev.target).entries()), err = $('su-err'), btn = $('su-go');
  const show = m => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  const pw = $('su-pass').value;
  if (!f.terms) return show(t('su_need_terms'));
  if (pw.length < 6) return show(t('su_pw_short'));
  try { loginIdToEmail(f.phone); } catch (e) { return show(e.message); }
  if (!(await pingServer())) return show(t('su_need_online'));
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch(`${POS_CONFIG.SUPABASE_URL}/functions/v1/signup`, { method: 'POST',
      headers: { apikey: POS_CONFIG.SUPABASE_KEY, Authorization: 'Bearer ' + POS_CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_name: f.shop_name, owner_name: f.owner_name, city: f.city, phone: f.phone, password: pw, website: f.website || '' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      const code = String(j.error || '').split(':')[0], k = 'su_err_' + code;
      return show(I18N.en[k] ? t(k) : t('err_generic') + (j.error ? ' (' + j.error + ')' : ''));
    }
    SU_INFO = null;
    if (j.pending) {
      openModal(`<h2>${t('su_done_title')}</h2><p>${t('su_done_pending')}</p><button class="btn block" data-close>${t('close')}</button>`);
      $('in-email').value = f.phone; return;
    }
    closeModal(); toast(t('su_done_ok'), 3000);
    $('in-email').value = f.phone; $('in-pass').value = pw;
    $('login-form').requestSubmit ? $('login-form').requestSubmit() : $('btn-login').click();
  } catch (e) { show(t('err_generic') + ': ' + (e.message || e)); }
  finally { btn.disabled = false; btn.textContent = t('su_submit'); }
}
document.addEventListener('click', ev => { if (ev.target.closest('#lnk-signup')) { ev.preventDefault(); signupOpen(); } });
