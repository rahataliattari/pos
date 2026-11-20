// Universal POS — Sign up (ڈیمو اکاؤنٹ) اور ڈیمو/پلان کی حدیں.
// Loaded BEFORE app.js (after superadmin.js). Uses globals from app.js / db.js / i18n.js at call time.
// سرور کی طرف: supabase/schema.sql (signup_info) + supabase/functions/signup. سپر ایڈمن (مزید > سیٹنگز) طے کرتا ہے کہ Sign up کھلا ہے یا نہیں،
// منظوری ضروری ہے یا نہیں، کتنے دن کا ڈیمو ہے؛ اور (بلنگ > پلانز > ڈیمو) کہ ڈیمو میں کون سے فیچرز اور کتنی حدیں ہیں.
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
  return `<div class="warn u-m-0n0n12"><b>${t('su_demo')}</b>${d !== null && d >= 0 ? ' · ' + suFill(t('su_days_left'), { n: d }) : ''}
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
    <div class="muted u-mb-6">${suFill(t('su_intro'), { days: info.days, limits: signupLimitsText(info) })}</div>
    ${info.approval ? `<div class="warn u-mb-8">${t('su_approval_note')}</div>` : ''}
    <form id="su-form" autocomplete="off">
      <label>${t('su_shop')}</label><input name="shop_name" required maxlength="80">
      <label>${t('su_owner')}</label><input name="owner_name" required maxlength="60">
      <label>${t('su_city')}</label><input name="city" maxlength="40">
      <label>${t('phone')}</label><input name="phone" type="tel" inputmode="tel" dir="ltr" required placeholder="03001234567" autocomplete="off">
      <label>${t('su_pass')}</label>${pwField('su-pass', '')}
      <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="u-pos-absolute u-left-n9999px u-w-1 u-h-1 u-op-0">
      <label class="u-mt-10 u-d-flex u-gap-8 u-ai-start"><input type="checkbox" name="terms" class="u-w-auto u-minh-0 u-mt-4"><span>${t('su_terms')}</span></label>
      <div class="errtext" id="su-err" role="alert" hidden></div>
      <div class="row u-mt-14"><button class="btn grow" id="su-go" type="submit">${t('su_submit')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div>
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
