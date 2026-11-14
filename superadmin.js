// Universal POS — Super Admin panel (platform owner: shops, users, subscriptions, announcements, audit log).
// Loaded BEFORE app.js. Uses globals from app.js / db.js / i18n.js at call time.
// DATA LAYER: for now everything lives in the demo store below (localStorage). The Supabase connection comes later.
const DAY = 864e5, SAK = 'pos_sa_demo_v1';

const SAT = {
  sa_open: ['سپر ایڈمن پینل کھولیں', 'Open Super Admin panel'], sa_title: ['سپر ایڈمن', 'Super Admin'], sa_sub: ['پلیٹ فارم کنٹرول', 'Platform control'],
  sa_t_dash: ['ڈیش بورڈ', 'Dashboard'], sa_t_shops: ['دکانیں', 'Shops'], sa_t_users: ['صارفین', 'Users'], sa_t_bill: ['بلنگ', 'Billing'], sa_t_more: ['مزید', 'More'],
  sa_exit: ['دکان', 'Shop'], sa_mrr: ['ماہانہ آمدن (فعال دکانیں)', 'Monthly revenue (active shops)'],
  sa_st_active: ['فعال', 'Active'], sa_st_trial: ['ٹرائل', 'Trial'], sa_st_expired: ['میعاد ختم', 'Expired'], sa_st_suspended: ['معطل', 'Suspended'], sa_st_archived: ['آرکائیو', 'Archived'], sa_st_all: ['سب', 'All'],
  sa_expiring: ['7 دن میں ختم ہونے والی', 'Expiring within 7 days'], sa_none: ['کوئی نہیں', 'None'], sa_days_left: ['دن باقی', 'days left'], sa_days_ago: ['دن پہلے ختم', 'days ago'],
  sa_rev6: ['پچھلے 6 ماہ کی وصولی', 'Collections, last 6 months'], sa_recent: ['حالیہ سرگرمی', 'Recent activity'],
  sa_search_shop: ['دکان، مالک، شہر یا نمبر', 'Shop, owner, city or number'], sa_add_shop: ['نئی دکان', 'New shop'], sa_no_shops: ['کوئی دکان نہیں ملی', 'No shops found'],
  sa_edit_shop: ['دکان میں ترمیم', 'Edit shop'], sa_owner: ['مالک کا نام', 'Owner name'], sa_city: ['شہر', 'City'], sa_plan: ['پلان', 'Plan'],
  sa_start_trial: ['{n} دن کا مفت ٹرائل شروع کریں', 'Start a {n}-day free trial'],
  sa_users_n: ['صارفین', 'Users'], sa_bills30: ['بل (30 دن)', 'Bills (30d)'], sa_sales30: ['فروخت (30 دن)', 'Sales (30d)'],
  sa_renew: ['تجدید / ادائیگی', 'Renew / payment'], sa_suspend: ['معطل کریں', 'Suspend'], sa_activate: ['فعال کریں', 'Activate'], sa_archive: ['آرکائیو', 'Archive'], sa_restore: ['بحال کریں', 'Restore'],
  sa_remind: ['یاد دہانی', 'Remind'], sa_reason: ['معطل کرنے کی وجہ؟', 'Reason for suspending?'], sa_confirm_activate: ['یہ دکان دوبارہ فعال کریں؟', 'Activate this shop again?'],
  sa_confirm_archive: ['دکان آرکائیو کریں؟ لاگ اِن بند ہو جائے گا، ڈیٹا محفوظ رہے گا۔', 'Archive this shop? Logins stop, data is kept.'],
  sa_no_payments: ['ابھی کوئی ادائیگی نہیں', 'No payments yet'], sa_add_user: ['نیا صارف', 'New user'], sa_edit_user: ['صارف میں ترمیم', 'Edit user'],
  sa_user_search: ['نام، نمبر یا دکان', 'Name, number or shop'], sa_no_users: ['کوئی صارف نہیں ملا', 'No users found'], sa_active_acc: ['اکاؤنٹ فعال ہے', 'Account is active'],
  sa_reset_pw: ['پاس ورڈ ری سیٹ', 'Reset password'], sa_confirm_reset: ['نیا عارضی پاس ورڈ بنائیں؟', 'Generate a new temporary password?'],
  sa_confirm_deluser: ['یہ صارف حذف کریں؟', 'Delete this user?'], sa_last_owner: ['دکان کا واحد مالک ہٹایا یا بدلا نہیں جا سکتا', 'The only owner of a shop cannot be removed or changed'],
  sa_limit_users: ['اس پلان میں صارفین کی حد پوری ہو چکی', 'User limit of this plan reached'], sa_phone_used: ['یہ نمبر پہلے سے کسی صارف کا ہے', 'This number already belongs to a user'],
  sa_creds_title: ['لاگ اِن تفصیل', 'Login details'], sa_login_no: ['لاگ اِن نمبر', 'Login number'], sa_temp_pw: ['عارضی پاس ورڈ', 'Temporary password'],
  sa_copy: ['کاپی', 'Copy'], sa_copied: ['کاپی ہو گیا', 'Copied'], sa_send_wa: ['واٹس ایپ پر بھیجیں', 'Send on WhatsApp'],
  sa_wa_creds_msg: ['السلام علیکم {name}، آپ کا لاگ اِن: {phone}  عارضی پاس ورڈ: {pw}  (پہلی بار لاگ اِن کے بعد بدل لیں)', 'Hello {name}, your login: {phone}  temporary password: {pw}  (please change it after first login)'],
  sa_period: ['مدت', 'Period'], sa_month: ['ماہ', 'month(s)'], sa_method: ['ادائیگی کا طریقہ', 'Payment method'], sa_bank: ['بینک', 'Bank'], sa_jazz: ['جاز کیش', 'JazzCash'], sa_easy: ['ایزی پیسہ', 'Easypaisa'],
  sa_renew_title: ['سبسکرپشن تجدید', 'Renew subscription'], sa_pick_shop: ['دکان', 'Shop'], sa_new_expiry: ['نئی میعاد', 'New expiry'],
  sa_pay_tab: ['ادائیگیاں', 'Payments'], sa_plans_tab: ['پلانز', 'Plans'], sa_col_month: ['اس ماہ کی وصولی', 'Collected this month'], sa_col_total: ['کل وصولی', 'Total collected'],
  sa_add_payment: ['ادائیگی درج کریں', 'Record payment'], sa_plan_edit: ['پلان میں ترمیم', 'Edit plan'], sa_name_en: ['انگریزی نام', 'English name'], sa_name_ur2: ['اردو نام', 'Urdu name'],
  sa_price: ['ماہانہ قیمت (Rs)', 'Monthly price (Rs)'], sa_max_users: ['زیادہ سے زیادہ صارفین', 'Max users'], sa_max_products: ['زیادہ سے زیادہ پروڈکٹس (0 = لامحدود)', 'Max products (0 = unlimited)'],
  sa_unlimited: ['لامحدود', 'Unlimited'], sa_per_month: ['ماہانہ', '/ month'], sa_shops_on_plan: ['دکانیں', 'shops'], sa_products: ['پروڈکٹس', 'products'],
  sa_ann: ['اعلانات', 'Announcements'], sa_log: ['لاگ', 'Log'], sa_settings: ['سیٹنگز', 'Settings'], sa_ann_text: ['اعلان کا متن (تمام دکانوں کو نظر آئے گا)', 'Announcement text (shown to all shops)'],
  sa_ann_add: ['نیا اعلان', 'New announcement'], sa_ann_none: ['کوئی اعلان نہیں', 'No announcements'], sa_ann_on: ['چل رہا ہے', 'Showing'], sa_ann_off: ['بند', 'Off'],
  sa_set_trial: ['ٹرائل کے دن', 'Trial days'], sa_set_plan: ['نئی دکان کا ڈیفالٹ پلان', 'Default plan for new shops'], sa_set_phone: ['سپورٹ / تجدید کا نمبر', 'Support / renewal number'],
  sa_export: ['پلیٹ فارم ڈیٹا ایکسپورٹ (JSON)', 'Export platform data (JSON)'], sa_reset_demo: ['سپر ایڈمن ڈیمو ڈیٹا ری سیٹ', 'Reset Super Admin demo data'],
  sa_reset_demo_confirm: ['سپر ایڈمن کا ڈیمو ڈیٹا نمونے کے ڈیٹا سے بدل دیں؟', 'Replace Super Admin demo data with the sample data?'], sa_no_log: ['ابھی کوئی سرگرمی نہیں', 'No activity yet'],
  sa_remind_msg: ['السلام علیکم {name}، آپ کی دکان "{shop}" کی سبسکرپشن کی آخری تاریخ {date} ہے۔ تجدید کے لیے رابطہ کریں: {phone}', 'Hello {name}, the subscription of your shop "{shop}" ends on {date}. To renew, contact: {phone}'],
  sa_a_shop_new: ['نئی دکان', 'Shop added'], sa_a_shop_edit: ['دکان میں ترمیم', 'Shop edited'], sa_a_shop_suspend: ['دکان معطل', 'Shop suspended'], sa_a_shop_activate: ['دکان فعال', 'Shop activated'],
  sa_a_shop_archive: ['دکان آرکائیو', 'Shop archived'], sa_a_shop_restore: ['دکان بحال', 'Shop restored'], sa_a_renew: ['تجدید / ادائیگی', 'Renewal / payment'],
  sa_a_user_new: ['نیا صارف', 'User added'], sa_a_user_edit: ['صارف میں ترمیم', 'User edited'], sa_a_user_del: ['صارف حذف', 'User deleted'], sa_a_pw_reset: ['پاس ورڈ ری سیٹ', 'Password reset'],
  sa_a_plan_edit: ['پلان میں ترمیم', 'Plan edited'], sa_a_ann_new: ['نیا اعلان', 'Announcement added'], sa_a_settings: ['سیٹنگز تبدیل', 'Settings changed']
};
for (const k in SAT) { I18N.ur[k] = SAT[k][0]; I18N.en[k] = SAT[k][1]; }
Object.assign(ICONS, {
  shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4z"/><path d="M10 21h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>'
});

// ───────── Demo data store ─────────
let SAD = null;
const SAS = { tab: 'dash', q: '', filter: 'all', uq: '', bseg: 'pay', mseg: 'ann', logN: 30 };
const saNow = () => Date.now();
const saIso = (off = 0) => new Date(saNow() + off * DAY).toISOString();
const saDays = iso => Math.ceil((new Date(iso).getTime() - saNow()) / DAY);
const saPass = () => [...crypto.getRandomValues(new Uint8Array(6))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
const saPhone = v => String(v || '').replace(/[^\d+]/g, '');
const saPlan = id => (SAD.plans.find(p => p.id === id) || SAD.plans[0]);
const saPlanName = p => (LANG === 'ur' ? p.name_ur : p.name) || p.name;
const saShopName = id => { const s = SAD.shops.find(x => x.id === id); return s ? s.name : '—'; };
const saFill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
function shopState(s) { if (s.archived) return 'archived'; if (s.suspended) return 'suspended'; if (saDays(s.expires_at) < 0) return 'expired'; return s.trial ? 'trial' : 'active'; }
const stChip = s => { const k = shopState(s); return `<span class="st ${k}">${t('sa_st_' + k)}</span>`; };
const saExpTxt = s => { const d = saDays(s.expires_at); return d >= 0 ? `${d} ${t('sa_days_left')}` : `${-d} ${t('sa_days_ago')}`; };

function saSeed() {
  const plans = [
    { id: 'basic', name: 'Basic', name_ur: 'بنیادی', price: 1500, max_users: 2, max_products: 500 },
    { id: 'standard', name: 'Standard', name_ur: 'اسٹینڈرڈ', price: 3000, max_users: 5, max_products: 3000 },
    { id: 'premium', name: 'Premium', name_ur: 'پریمیم', price: 5000, max_users: 15, max_products: 0 }
  ];
  const R = [ // name, owner, phone, city, plan, expiresInDays, flag, bills30, sales30, ageDays
    ['الفلاح جنرل اسٹور', 'محمد الفلاح', '03001112233', 'لاہور', 'standard', 48, '', 412, 1840000, 300],
    ['کراچی میڈیکل ہال', 'ڈاکٹر عمران', '03211112233', 'کراچی', 'premium', 200, '', 690, 3120000, 420],
    ['رحمان کریانہ ہول سیل', 'عبدالرحمان', '03331112233', 'فیصل آباد', 'basic', 5, '', 210, 760000, 150],
    ['ستارہ گارمنٹس', 'ستارہ بی بی', '03451112233', 'ملتان', 'standard', 9, 'trial', 64, 310000, 5],
    ['نیو شان موبائل شاپ', 'شان علی', '03121112233', 'راولپنڈی', 'basic', -12, '', 120, 540000, 200],
    ['بسم اللہ بیکرز', 'محمد یوسف', '03011112233', 'پشاور', 'standard', 20, 'suspended', 0, 0, 260],
    ['حاجی اکرم ٹریڈرز', 'حاجی اکرم', '03221112233', 'گوجرانوالہ', 'premium', 90, '', 340, 2210000, 380],
    ['گرین لیف فارمیسی', 'سمیرا خان', '03461112233', 'اسلام آباد', 'standard', 2, 'trial', 48, 260000, 12],
    ['سمیر الیکٹرانکس', 'سمیر احمد', '03131112233', 'سیالکوٹ', 'basic', -80, 'archived', 0, 0, 500]
  ];
  const staff = ['اسلم', 'نعیم', 'کامران', 'ثناء', 'بلال', 'عائشہ', 'رضوان'];
  const shops = [], users = [], payments = [];
  R.forEach(([name, owner, phone, city, plan, exp, flag, b, sv, age], i) => {
    const s = { id: uuid(), name, owner_name: owner, phone, city, plan_id: plan, trial: flag === 'trial', suspended: flag === 'suspended',
      suspend_reason: flag === 'suspended' ? 'ادائیگی میں تاخیر' : '', archived: flag === 'archived', created_at: saIso(-age), expires_at: saIso(exp),
      last_seen: saIso(-(i % 4) - (flag ? 6 : 0)), bills_30d: b, sales_30d: sv, notes: '' };
    shops.push(s);
    const mk = (nm, ph, role, k) => users.push({ id: uuid(), shop_id: s.id, name: nm, phone: ph, role, active: true, created_at: saIso(-age + 1), last_login: saIso(-k) });
    mk(owner, phone, 'owner', i % 3);
    if (plan !== 'basic') mk(staff[i % 7], '0300' + (7000000 + i * 111), 'manager', 1 + (i % 4));
    mk(staff[(i + 3) % 7], '0310' + (6000000 + i * 137), 'cashier', i % 2);
    if (flag === 'trial' || flag === 'archived') return;
    const n = Math.min(6, Math.floor(age / 30));
    for (let m = exp < 0 ? 2 : 0; m < n + (exp < 0 ? 2 : 0); m++)
      payments.push({ id: uuid(), shop_id: s.id, plan_id: plan, amount: plans.find(p => p.id === plan).price, days: 30, method: ['cash', 'bank', 'jazz', 'easy'][(i + m) % 4], note: '', at: saIso(-(m * 30 + (i % 9))) });
  });
  payments.sort((a, b) => (a.at < b.at ? 1 : -1));
  return {
    plans, shops, users, payments,
    audit: [
      { id: uuid(), at: saIso(-1), actor: 'Super Admin', action: 'renew', target: shops[0].name, detail: 'Rs 3,000' },
      { id: uuid(), at: saIso(-3), actor: 'Super Admin', action: 'shop_suspend', target: shops[5].name, detail: 'ادائیگی میں تاخیر' },
      { id: uuid(), at: saIso(-5), actor: 'Super Admin', action: 'shop_new', target: shops[3].name, detail: '' }
    ],
    announcements: [{ id: uuid(), text: 'اتوار رات 2 بجے سسٹم کی دیکھ بھال ہوگی، ایپ چند منٹ سست رہ سکتی ہے۔', active: true, at: saIso(-2) }],
    settings: { trial_days: 14, default_plan: 'standard', support_phone: '03001234567' }
  };
}
function saLoad() {
  if (SAD) return SAD;
  try { const r = localStorage.getItem(SAK); if (r) SAD = JSON.parse(r); } catch (e) {}
  if (!SAD) { SAD = saSeed(); saSave(); }
  return SAD;
}
function saSave() { try { localStorage.setItem(SAK, JSON.stringify(SAD)); } catch (e) {} }
function saLog(action, target, detail) {
  SAD.audit = [{ id: uuid(), at: saIso(0), actor: 'Super Admin', action, target: target || '', detail: detail || '' }, ...SAD.audit].slice(0, 300);
  saSave();
}
function saAnnouncement() {
  if (!window.POS_DEMO) return '';
  try { const a = saLoad().announcements.find(x => x.active); return a ? a.text : ''; } catch (e) { return ''; }
}

// ───────── Shell ─────────
function showSuperAdmin() {
  saLoad();
  $('app').hidden = true; $('login').hidden = true; $('sa').hidden = false;
  document.documentElement.dataset.theme = 'admin';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = '#1c2541';
  saRender();
}
function exitSuperAdmin() {
  $('sa').hidden = true; $('app').hidden = false;
  applyTheme(); applyStaticText(); renderBillShell(); switchTab(S.tab);
}
function saRender() {
  const tabs = [['dash', 'sa_t_dash', 'chart'], ['shops', 'sa_t_shops', 'store'], ['users', 'sa_t_users', 'users'], ['bill', 'sa_t_bill', 'wallet'], ['more', 'sa_t_more', 'settings']];
  $('sa').innerHTML = `
    <header class="top"><div class="hrow">
      <div class="avatar">${ic('shield', 24)}</div>
      <div class="hinfo"><div class="hello">${t('sa_title')}</div><div class="shop">${t('sa_sub')}</div></div>
      <button class="langbtn" data-sa="lang" type="button">${LANG === 'ur' ? 'EN' : 'اردو'}</button>
      <button class="langbtn" data-sa="exit" type="button">${ic('home', 16)} ${t('sa_exit')}</button>
    </div></header>
    <main id="sa-main">${saView()}</main>
    <nav class="bottom">${tabs.map(([k, l, i]) => `<button data-sa="tab|${k}" class="${SAS.tab === k ? 'active' : ''}"><span class="ico">${ic(i, 22)}</span><span>${t(l)}</span></button>`).join('')}</nav>`;
  if (SAS.tab === 'shops') saShopsList();
  if (SAS.tab === 'users') saUsersList();
}
function saView() { return ({ dash: saDash, shops: saShopsView, users: saUsersView, bill: saBillView, more: saMoreView })[SAS.tab](); }
const saActRow = a => `<div class="lrow"><span class="lic">${ic('list', 16)}</span><div class="grow"><b>${t('sa_a_' + a.action)}</b><div class="muted">${esc(a.target)}${a.detail ? ' · ' + esc(a.detail) : ''}</div></div><div class="muted" style="font-size:12px">${esc(fmtDate(a.at))}</div></div>`;

// ───────── Dashboard ─────────
function saMonths() {
  const out = [], now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1), key = d.getFullYear() * 12 + d.getMonth();
    out.push({ key, label: d.toLocaleDateString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short' }), total: 0 });
  }
  SAD.payments.forEach(p => { const d = new Date(p.at), k = d.getFullYear() * 12 + d.getMonth(), m = out.find(x => x.key === k); if (m) m.total += p.amount; });
  return out;
}
function saDash() {
  const d = SAD, live = d.shops.filter(s => !s.archived), st = { active: 0, trial: 0, expired: 0, suspended: 0 };
  live.forEach(s => st[shopState(s)]++);
  const mrr = live.filter(s => shopState(s) === 'active').reduce((a, s) => a + saPlan(s.plan_id).price, 0);
  const soon = live.filter(s => ['active', 'trial'].includes(shopState(s)) && saDays(s.expires_at) <= 7).sort((a, b) => (a.expires_at < b.expires_at ? -1 : 1));
  const mo = saMonths(), mx = Math.max(1, ...mo.map(m => m.total)), ann = saAnnouncement();
  return `
    <div class="today"><div class="cal">${ic('chart', 24)}</div><div class="grow"><div class="muted">${t('sa_mrr')}</div>
      <div class="big">Rs ${money(mrr)}</div><div class="muted">${live.length} ${t('sa_t_shops')} · ${d.users.length} ${t('sa_t_users')}</div></div></div>
    ${ann ? `<div class="warn" style="margin:0 0 12px;padding:6px 12px">${ic('bell', 16)} ${esc(ann)}</div>` : ''}
    <div class="sa-stats">${['active', 'trial', 'expired', 'suspended'].map(k => `<button class="mod" data-sa="stat|${k}"><span class="mi" style="font-size:24px;font-weight:800">${st[k]}</span>${t('sa_st_' + k)}</button>`).join('')}</div>
    <div class="card"><div class="sa-sec">${t('sa_expiring')}</div>
      ${soon.map(s => `<div class="lrow" style="cursor:pointer" data-sa="shop|${s.id}"><span class="lic">${ic('clock', 16)}</span><div class="grow"><b>${esc(s.name)}</b><div class="muted">${esc(saPlanName(saPlan(s.plan_id)))}</div></div>${stChip(s)}<span class="muted">${saExpTxt(s)}</span></div>`).join('') || `<div class="muted">${t('sa_none')}</div>`}</div>
    <div class="card"><div class="sa-sec">${t('sa_rev6')}</div>
      <div class="sa-bars">${mo.map(m => `<div><span>${m.total ? Math.round(m.total / 1000) + 'k' : ''}</span><i style="height:${Math.max(3, Math.round(m.total / mx * 78))}%"></i><span>${m.label}</span></div>`).join('')}</div></div>
    <div class="card"><div class="sa-sec">${t('sa_recent')}</div>${d.audit.slice(0, 5).map(saActRow).join('') || `<div class="muted">${t('sa_no_log')}</div>`}</div>`;
}

// ───────── Shops ─────────
function saShopsView() {
  return `<div class="row" style="margin-bottom:10px"><input id="sa-q" class="grow" type="search" placeholder="${t('sa_search_shop')}" autocomplete="off" value="${esc(SAS.q)}">
      <button class="btn" data-sa="shopnew" type="button">${ic('plus', 18)} ${t('sa_add_shop')}</button></div>
    <div class="sa-chips">${['all', 'active', 'trial', 'expired', 'suspended', 'archived'].map(k => `<button class="sa-chip ${SAS.filter === k ? 'on' : ''}" data-sa="filter|${k}">${t('sa_st_' + k)}</button>`).join('')}</div>
    <div id="sa-list"></div>`;
}
function saShopsList() {
  const q = SAS.q.trim().toLowerCase(), box = $('sa-list'); if (!box) return;
  const list = SAD.shops.filter(s => {
    const k = shopState(s);
    if (SAS.filter === 'all' ? k === 'archived' : k !== SAS.filter) return false;
    return !q || [s.name, s.owner_name, s.phone, s.city].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => (a.name < b.name ? -1 : 1));
  box.innerHTML = list.map(s => `<div class="card custcard" data-sa="shop|${s.id}"><div class="avatar sm">${ic('store', 20)}</div>
    <div class="grow"><b>${esc(s.name)}</b><div class="muted">${esc(s.city)} · ${esc(s.owner_name)}</div><div class="muted">${esc(saPlanName(saPlan(s.plan_id)))} · ${saExpTxt(s)}</div></div>${stChip(s)}</div>`).join('')
    || `<div class="muted" style="text-align:center;padding:24px">${t('sa_no_shops')}</div>`;
}
function saShopDetail(id) {
  const d = SAD, s = d.shops.find(x => x.id === id); if (!s) return;
  const us = d.users.filter(u => u.shop_id === id), pay = d.payments.filter(p => p.shop_id === id).slice(0, 3), p = saPlan(s.plan_id);
  const wa = waNumber(s.phone), msg = saFill(t('sa_remind_msg'), { name: s.owner_name, shop: s.name, date: s.expires_at.slice(0, 10), phone: d.settings.support_phone });
  openModal(`<div class="row"><h2 class="grow">${esc(s.name)}</h2>${stChip(s)}</div>
    <div class="muted">${esc(s.city)} · ${esc(s.owner_name)}${s.phone ? ` · <a href="tel:${esc(s.phone)}" dir="ltr">${esc(s.phone)}</a>` : ''}</div>
    ${s.suspended && s.suspend_reason ? `<div class="warn">${esc(s.suspend_reason)}</div>` : ''}
    <div class="balbox"><span>${esc(saPlanName(p))} · ${money(p.price)} ${t('sa_per_month')}</span><b style="font-size:16px">${s.expires_at.slice(0, 10)}<br><small class="muted">${saExpTxt(s)}</small></b></div>
    <div class="sa-kpis"><div><b>${us.length}</b><span>${t('sa_users_n')}</span></div><div><b>${s.bills_30d}</b><span>${t('sa_bills30')}</span></div><div><b>${money(s.sales_30d)}</b><span>${t('sa_sales30')}</span></div></div>
    <div class="row" style="margin-bottom:8px"><button class="btn grow" data-sa="renew|${id}">${ic('wallet', 18)} ${t('sa_renew')}</button><button class="btn secondary" data-sa="shopedit|${id}" aria-label="${t('edit_product')}">${ic('edit', 18)}</button></div>
    <div class="row" style="margin-bottom:8px">
      <button class="btn ${s.suspended ? 'secondary' : 'danger'} grow" data-sa="toggle|${id}">${s.suspended ? t('sa_activate') : t('sa_suspend')}</button>
      <button class="btn secondary grow" data-sa="archive|${id}">${s.archived ? t('sa_restore') : t('sa_archive')}</button>
      ${wa ? `<a class="btn secondary lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">${ic('chat', 18)}</a>` : ''}</div>
    <div class="row" style="margin-top:10px"><div class="sa-sec grow">${t('sa_t_users')}</div><button class="btn secondary sm" data-sa="useradd|${id}">${ic('plus', 14)} ${t('sa_add_user')}</button></div>
    ${us.map(u => `<div class="lrow" style="cursor:pointer" data-sa="useredit|${u.id}"><span class="lic">${ic('user', 16)}</span><div class="grow"><b>${esc(u.name)}</b><div class="muted" dir="ltr" style="text-align:start">${esc(u.phone)}</div></div><span class="bal ${u.active ? 'adv' : 'zero'}">${t(u.role)}</span></div>`).join('')}
    <div class="sa-sec" style="margin-top:10px">${t('sa_pay_tab')}</div>
    ${pay.map(saPayRow).join('') || `<div class="muted">${t('sa_no_payments')}</div>`}
    <div style="margin-top:12px"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}
function saShopForm(id) {
  const d = SAD, s = id ? d.shops.find(x => x.id === id) : { plan_id: d.settings.default_plan };
  openModal(`<h2>${id ? t('sa_edit_shop') : t('sa_add_shop')}</h2><form id="sa-form">
    <label>${t('name')}</label><input name="name" required value="${esc(s.name)}">
    <label>${t('sa_owner')}</label><input name="owner_name" required value="${esc(s.owner_name)}">
    <div class="row"><div class="grow"><label>${t('phone')}</label><input name="phone" inputmode="tel" dir="ltr" required value="${esc(s.phone)}"></div>
      <div class="grow"><label>${t('sa_city')}</label><input name="city" value="${esc(s.city)}"></div></div>
    <label>${t('sa_plan')}</label><select name="plan_id">${d.plans.map(p => `<option value="${p.id}" ${p.id === s.plan_id ? 'selected' : ''}>${esc(saPlanName(p))} — ${money(p.price)}</option>`).join('')}</select>
    ${id ? '' : `<label><input type="checkbox" name="trial" checked style="width:auto;min-height:0"> ${saFill(t('sa_start_trial'), { n: d.settings.trial_days })}</label>`}
    <label>${t('note')}</label><input name="notes" value="${esc(s.notes)}">
    <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div></form>`);
  $('sa-form').onsubmit = ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    const phone = saPhone(f.phone);
    if (!id && d.users.some(u => saPhone(u.phone) === phone)) return toast(t('sa_phone_used'), 3500);
    if (id) {
      Object.assign(s, { name: f.name.trim(), owner_name: f.owner_name.trim(), phone, city: f.city.trim(), plan_id: f.plan_id, notes: f.notes.trim() });
      saLog('shop_edit', s.name); saSave(); closeModal(); toast(t('saved')); saRender(); return;
    }
    const trial = !!f.trial, ns = { id: uuid(), name: f.name.trim(), owner_name: f.owner_name.trim(), phone, city: f.city.trim(), plan_id: f.plan_id, trial,
      suspended: false, suspend_reason: '', archived: false, created_at: saIso(0), expires_at: saIso(trial ? d.settings.trial_days : 0), last_seen: saIso(0), bills_30d: 0, sales_30d: 0, notes: f.notes.trim() };
    const pw = saPass();
    d.shops.push(ns); d.users.push({ id: uuid(), shop_id: ns.id, name: ns.owner_name, phone, role: 'owner', active: true, created_at: saIso(0), last_login: null, temp_pw: true });
    saLog('shop_new', ns.name); saSave(); saRender(); saShowCreds(ns.owner_name, phone, pw);
  };
}
function saShowCreds(name, phone, pw) {
  const wa = waNumber(phone), msg = saFill(t('sa_wa_creds_msg'), { name, phone, pw });
  openModal(`<h2>${t('sa_creds_title')}</h2><div class="muted">${esc(name)}</div>
    <div class="balbox" dir="ltr"><span>${t('sa_login_no')}</span><b style="font-size:18px">${esc(phone)}</b></div>
    <div class="balbox" dir="ltr"><span>${t('sa_temp_pw')}</span><b style="font-size:20px;letter-spacing:1px">${esc(pw)}</b></div>
    <div class="row"><button class="btn secondary grow" data-sa="copy|${esc(pw)}">${t('sa_copy')}</button>
      ${wa ? `<a class="btn grow lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">${ic('chat', 18)} ${t('sa_send_wa')}</a>` : ''}</div>
    <div style="margin-top:10px"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}

// ───────── Renew / payment ─────────
const saPayRow = p => `<div class="lrow payment"><span class="lic">${ic('wallet', 16)}</span><div class="grow"><b>${esc(saShopName(p.shop_id))}</b>
  <div class="muted">${esc(saPlanName(saPlan(p.plan_id)))} · ${Math.round(p.days / 30)} ${t('sa_month')} · ${esc(fmtDate(p.at))}</div></div><div class="lamt"><b>Rs ${money(p.amount)}</b></div></div>`;
function saRenewForm(id) {
  const d = SAD, live = d.shops.filter(s => !s.archived), s = id ? d.shops.find(x => x.id === id) : live[0];
  const opt = (v, l, sel) => `<option value="${v}" ${sel ? 'selected' : ''}>${l}</option>`;
  openModal(`<h2>${t('sa_renew_title')}</h2><form id="sa-form">
    <label>${t('sa_pick_shop')}</label><select name="shop_id" ${id ? 'disabled' : ''}>${live.map(x => opt(x.id, esc(x.name), x.id === s.id)).join('')}</select>
    <div class="row"><div class="grow"><label>${t('sa_plan')}</label><select name="plan_id">${d.plans.map(p => opt(p.id, esc(saPlanName(p)), p.id === s.plan_id)).join('')}</select></div>
      <div class="grow"><label>${t('sa_period')}</label><select name="months">${[1, 3, 6, 12].map(m => opt(m, `${m} ${t('sa_month')}`, m === 1)).join('')}</select></div></div>
    <label>${t('amount')} (Rs)</label><input name="amount" type="number" inputmode="decimal" step="any" min="1" required>
    <label>${t('sa_method')}</label><select name="method">${opt('cash', t('cash'))}${opt('bank', t('sa_bank'))}${opt('jazz', t('sa_jazz'))}${opt('easy', t('sa_easy'))}</select>
    <label>${t('note')}</label><input name="note">
    <div class="muted" id="sa-newexp" style="margin-top:8px"></div>
    <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div></form>`);
  const f = $('sa-form'), calc = (priceChanged) => {
    const shop = d.shops.find(x => x.id === f.shop_id.value), m = +f.months.value, pl = saPlan(f.plan_id.value);
    if (priceChanged !== false) f.amount.value = pl.price * m;
    const base = Math.max(saNow(), new Date(shop.expires_at).getTime());
    $('sa-newexp').textContent = `${t('sa_new_expiry')}: ${new Date(base + m * 30 * DAY).toISOString().slice(0, 10)}`;
  };
  ['shop_id', 'plan_id', 'months'].forEach(n => { f[n].onchange = () => { if (n === 'shop_id') f.plan_id.value = d.shops.find(x => x.id === f.shop_id.value).plan_id; calc(); }; });
  calc();
  f.onsubmit = ev => {
    ev.preventDefault();
    const shop = d.shops.find(x => x.id === f.shop_id.value), m = +f.months.value, amount = round2(num(f.amount.value));
    if (!(amount > 0)) return toast(t('bad_amount'));
    const base = Math.max(saNow(), new Date(shop.expires_at).getTime());
    shop.expires_at = new Date(base + m * 30 * DAY).toISOString(); shop.plan_id = f.plan_id.value; shop.trial = false;
    d.payments.unshift({ id: uuid(), shop_id: shop.id, plan_id: shop.plan_id, amount, days: m * 30, method: f.method.value, note: f.note.value.trim(), at: saIso(0) });
    saLog('renew', shop.name, 'Rs ' + money(amount)); saSave(); closeModal(); toast(t('saved')); saRender();
  };
}

// ───────── Users ─────────
function saUsersView() {
  return `<div class="row" style="margin-bottom:10px"><input id="sa-uq" class="grow" type="search" placeholder="${t('sa_user_search')}" autocomplete="off" value="${esc(SAS.uq)}">
    <button class="btn" data-sa="useradd|" type="button">${ic('plus', 18)} ${t('sa_add_user')}</button></div><div id="sa-ulist"></div>`;
}
function saUsersList() {
  const q = SAS.uq.trim().toLowerCase(), box = $('sa-ulist'); if (!box) return;
  const list = SAD.users.filter(u => !q || [u.name, u.phone, saShopName(u.shop_id)].join(' ').toLowerCase().includes(q)).sort((a, b) => (a.name < b.name ? -1 : 1)).slice(0, 80);
  box.innerHTML = list.map(u => `<div class="card custcard" data-sa="useredit|${u.id}"><div class="avatar sm">${ic('user', 20)}</div>
    <div class="grow"><b>${esc(u.name)}</b><div class="muted">${esc(saShopName(u.shop_id))}</div><div class="muted" dir="ltr" style="text-align:start">${esc(u.phone)}</div></div>
    <span class="bal ${u.active ? 'adv' : 'zero'}">${t(u.role)}</span></div>`).join('') || `<div class="muted" style="text-align:center;padding:24px">${t('sa_no_users')}</div>`;
}
const saOnlyOwner = u => u.role === 'owner' && !SAD.users.some(x => x.id !== u.id && x.shop_id === u.shop_id && x.role === 'owner');
function saUserForm(id, shopId) {
  const d = SAD, live = d.shops.filter(s => !s.archived);
  const u = id ? d.users.find(x => x.id === id) : { shop_id: shopId || (live[0] || {}).id, role: 'cashier', active: true };
  openModal(`<h2>${id ? t('sa_edit_user') : t('sa_add_user')}</h2><form id="sa-form">
    <label>${t('name')}</label><input name="name" required value="${esc(u.name)}">
    <label>${t('phone')}</label><input name="phone" inputmode="tel" dir="ltr" required value="${esc(u.phone)}">
    <label>${t('sa_pick_shop')}</label><select name="shop_id">${live.map(s => `<option value="${s.id}" ${s.id === u.shop_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    <label>${t('role')}</label><select name="role">${['owner', 'manager', 'cashier'].map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${t(r)}</option>`).join('')}</select>
    <label><input type="checkbox" name="active" ${u.active ? 'checked' : ''} style="width:auto;min-height:0"> ${t('sa_active_acc')}</label>
    <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div>
    ${id ? `<div class="row" style="margin-top:8px"><button class="btn secondary grow" type="button" data-sa="resetpw|${id}">${ic('key', 18)} ${t('sa_reset_pw')}</button><button class="btn danger" type="button" data-sa="userdel|${id}">${ic('trash', 18)}</button></div>` : ''}</form>`);
  $('sa-form').onsubmit = ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries()), phone = saPhone(f.phone), active = !!f.active;
    if (d.users.some(x => x.id !== id && saPhone(x.phone) === phone)) return toast(t('sa_phone_used'), 3500);
    if (id && saOnlyOwner(u) && (f.role !== 'owner' || f.shop_id !== u.shop_id || !active)) return toast(t('sa_last_owner'), 4000);
    if ((!id || f.shop_id !== u.shop_id) && d.users.filter(x => x.shop_id === f.shop_id).length >= saPlan(d.shops.find(s => s.id === f.shop_id).plan_id).max_users) return toast(t('sa_limit_users'), 4000);
    if (id) { Object.assign(u, { name: f.name.trim(), phone, shop_id: f.shop_id, role: f.role, active }); saLog('user_edit', u.name, saShopName(u.shop_id)); saSave(); closeModal(); toast(t('saved')); saRender(); return; }
    const nu = { id: uuid(), shop_id: f.shop_id, name: f.name.trim(), phone, role: f.role, active, created_at: saIso(0), last_login: null };
    d.users.push(nu); saLog('user_new', nu.name, saShopName(nu.shop_id)); saSave(); saRender(); saShowCreds(nu.name, phone, saPass());
  };
}

// ───────── Billing ─────────
function saBillView() {
  const d = SAD, now = new Date(), mk = now.getFullYear() * 12 + now.getMonth();
  const tot = d.payments.reduce((a, p) => a + p.amount, 0), mon = d.payments.filter(p => { const x = new Date(p.at); return x.getFullYear() * 12 + x.getMonth() === mk; }).reduce((a, p) => a + p.amount, 0);
  const seg = `<div class="seg"><button class="${SAS.bseg === 'pay' ? 'on' : ''}" data-sa="bseg|pay">${t('sa_pay_tab')}</button><button class="${SAS.bseg === 'plans' ? 'on' : ''}" data-sa="bseg|plans">${t('sa_plans_tab')}</button></div>`;
  if (SAS.bseg === 'plans') return seg + d.plans.map(p => {
    const n = d.shops.filter(s => !s.archived && s.plan_id === p.id).length;
    return `<div class="card custcard" data-sa="planedit|${p.id}"><div class="avatar sm">${ic('wallet', 20)}</div><div class="grow"><b>${esc(saPlanName(p))}</b>
      <div class="muted">${p.max_users} ${t('sa_t_users')} · ${p.max_products ? p.max_products + ' ' + t('sa_products') : t('sa_unlimited')}</div><div class="muted">${n} ${t('sa_shops_on_plan')}</div></div>
      <span class="bal adv">Rs ${money(p.price)}</span></div>`; }).join('');
  return seg + `<div class="sa-kpis" style="grid-template-columns:repeat(2,1fr)"><div><b>Rs ${money(mon)}</b><span>${t('sa_col_month')}</span></div><div><b>Rs ${money(tot)}</b><span>${t('sa_col_total')}</span></div></div>
    <button class="btn block" data-sa="payadd" style="margin-bottom:12px">${ic('plus', 18)} ${t('sa_add_payment')}</button>
    <div class="card">${d.payments.slice(0, 40).map(saPayRow).join('') || `<div class="muted">${t('sa_no_payments')}</div>`}</div>`;
}
function saPlanForm(id) {
  const p = SAD.plans.find(x => x.id === id);
  openModal(`<h2>${t('sa_plan_edit')}</h2><form id="sa-form">
    <div class="row"><div class="grow"><label>${t('sa_name_ur2')}</label><input name="name_ur" required value="${esc(p.name_ur)}"></div><div class="grow"><label>${t('sa_name_en')}</label><input name="name" required value="${esc(p.name)}"></div></div>
    <label>${t('sa_price')}</label><input name="price" type="number" inputmode="decimal" min="0" required value="${p.price}">
    <div class="row"><div class="grow"><label>${t('sa_max_users')}</label><input name="max_users" type="number" min="1" required value="${p.max_users}"></div>
      <div class="grow"><label>${t('sa_max_products')}</label><input name="max_products" type="number" min="0" required value="${p.max_products}"></div></div>
    <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div></form>`);
  $('sa-form').onsubmit = ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    Object.assign(p, { name: f.name.trim(), name_ur: f.name_ur.trim(), price: Math.max(0, num(f.price)), max_users: Math.max(1, Math.round(num(f.max_users))), max_products: Math.max(0, Math.round(num(f.max_products))) });
    saLog('plan_edit', p.name); saSave(); closeModal(); toast(t('saved')); saRender();
  };
}

// ───────── More: announcements / log / settings ─────────
function saMoreView() {
  const d = SAD, seg = `<div class="seg">${[['ann', 'sa_ann'], ['log', 'sa_log'], ['set', 'sa_settings']].map(([k, l]) => `<button class="${SAS.mseg === k ? 'on' : ''}" data-sa="mseg|${k}">${t(l)}</button>`).join('')}</div>`;
  if (SAS.mseg === 'ann') return seg + `<button class="btn block" data-sa="annadd" style="margin-bottom:12px">${ic('plus', 18)} ${t('sa_ann_add')}</button>` +
    (d.announcements.map(a => `<div class="card"><div>${esc(a.text)}</div><div class="row" style="margin-top:8px"><span class="muted grow">${esc(fmtDate(a.at))}</span>
      <button class="btn ${a.active ? '' : 'secondary'} sm" data-sa="anntoggle|${a.id}">${a.active ? t('sa_ann_on') : t('sa_ann_off')}</button><button class="btn danger sm" data-sa="anndel|${a.id}" aria-label="${t('delete')}">${ic('trash', 14)}</button></div></div>`).join('') || `<div class="muted" style="text-align:center;padding:24px">${t('sa_ann_none')}</div>`);
  if (SAS.mseg === 'log') return seg + `<div class="card">${d.audit.slice(0, SAS.logN).map(saActRow).join('') || `<div class="muted">${t('sa_no_log')}</div>`}</div>` +
    (d.audit.length > SAS.logN ? `<button class="btn secondary block" data-sa="morelog">${t('more')}</button>` : '');
  return seg + `<div class="card"><label>${t('language')}</label><select id="sa-set-lang"><option value="ur" ${LANG === 'ur' ? 'selected' : ''}>اردو</option><option value="en" ${LANG === 'en' ? 'selected' : ''}>English</option></select>
      <label>${t('sa_set_trial')}</label><input id="sa-set-trial" type="number" min="0" inputmode="numeric" value="${d.settings.trial_days}">
      <label>${t('sa_set_plan')}</label><select id="sa-set-plan">${d.plans.map(p => `<option value="${p.id}" ${p.id === d.settings.default_plan ? 'selected' : ''}>${esc(saPlanName(p))}</option>`).join('')}</select>
      <label>${t('sa_set_phone')}</label><input id="sa-set-phone" inputmode="tel" dir="ltr" value="${esc(d.settings.support_phone)}"></div>
    <button class="btn secondary block" data-sa="export" style="margin-bottom:10px">${ic('download', 18)} ${t('sa_export')}</button>
    <button class="btn danger block" data-sa="resetsa">${t('sa_reset_demo')}</button>`;
}
function saAnnForm() {
  openModal(`<h2>${t('sa_ann_add')}</h2><form id="sa-form"><label>${t('sa_ann_text')}</label><input name="text" required maxlength="160">
    <div class="row" style="margin-top:14px"><button class="btn grow" type="submit">${t('save')}</button><button class="btn secondary" type="button" data-close>${t('cancel')}</button></div></form>`);
  $('sa-form').onsubmit = ev => {
    ev.preventDefault();
    const txt = new FormData(ev.target).get('text').trim(); if (!txt) return;
    SAD.announcements.forEach(a => { a.active = false; });   // one live announcement at a time
    SAD.announcements.unshift({ id: uuid(), text: txt, active: true, at: saIso(0) });
    saLog('ann_new', txt.slice(0, 40)); saSave(); closeModal(); toast(t('saved')); saRender();
  };
}

// ───────── Actions (data-sa="name|arg") ─────────
const SA_ACT = {
  tab: k => { SAS.tab = k; saRender(); },
  lang: async () => { await saveCfg('lang', LANG === 'ur' ? 'en' : 'ur'); setLang(S.cfg.lang); applyStaticText(); saRender(); },
  exit: () => exitSuperAdmin(),
  stat: k => { SAS.tab = 'shops'; SAS.filter = k; SAS.q = ''; saRender(); },
  filter: k => { SAS.filter = k; saRender(); },
  shop: id => saShopDetail(id), shopnew: () => saShopForm(null), shopedit: id => saShopForm(id), renew: id => saRenewForm(id), payadd: () => saRenewForm(null),
  toggle: id => {
    const s = SAD.shops.find(x => x.id === id);
    if (s.suspended) { if (!confirm(t('sa_confirm_activate'))) return; s.suspended = false; s.suspend_reason = ''; saLog('shop_activate', s.name); }
    else { const r = prompt(t('sa_reason'), ''); if (r === null) return; s.suspended = true; s.suspend_reason = r.trim(); saLog('shop_suspend', s.name, s.suspend_reason); }
    saSave(); closeModal(); toast(t('saved')); saRender();
  },
  archive: id => {
    const s = SAD.shops.find(x => x.id === id);
    if (!s.archived && !confirm(t('sa_confirm_archive'))) return;
    s.archived = !s.archived; saLog(s.archived ? 'shop_archive' : 'shop_restore', s.name); saSave(); closeModal(); toast(t('saved')); saRender();
  },
  useradd: sid => saUserForm(null, sid), useredit: id => saUserForm(id),
  userdel: id => {
    const u = SAD.users.find(x => x.id === id);
    if (saOnlyOwner(u)) return toast(t('sa_last_owner'), 4000);
    if (!confirm(t('sa_confirm_deluser'))) return;
    SAD.users = SAD.users.filter(x => x.id !== id); saLog('user_del', u.name, saShopName(u.shop_id)); saSave(); closeModal(); toast(t('saved')); saRender();
  },
  resetpw: id => {
    const u = SAD.users.find(x => x.id === id);
    if (!confirm(t('sa_confirm_reset'))) return;
    saLog('pw_reset', u.name, saShopName(u.shop_id)); saSave(); saShowCreds(u.name, u.phone, saPass());
  },
  copy: pw => { try { navigator.clipboard.writeText(pw); toast(t('sa_copied')); } catch (e) { toast(pw, 5000); } },
  bseg: k => { SAS.bseg = k; saRender(); }, planedit: id => saPlanForm(id),
  mseg: k => { SAS.mseg = k; saRender(); }, morelog: () => { SAS.logN += 30; saRender(); },
  annadd: () => saAnnForm(),
  anntoggle: id => { const a = SAD.announcements.find(x => x.id === id); if (!a.active) SAD.announcements.forEach(x => { x.active = false; }); a.active = !a.active; saSave(); saRender(); },
  anndel: id => { SAD.announcements = SAD.announcements.filter(x => x.id !== id); saSave(); saRender(); },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(SAD, null, 1)], { type: 'application/json' }));
    a.download = `platform-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  resetsa: () => { if (!confirm(t('sa_reset_demo_confirm'))) return; SAD = saSeed(); saSave(); toast(t('saved')); saRender(); }
};
document.addEventListener('click', ev => {
  if (ev.target.closest('#btn-sa-open')) return showSuperAdmin();
  const el = ev.target.closest('[data-sa]'); if (!el) return;
  const [a, x, y] = el.dataset.sa.split('|');
  if (SA_ACT[a]) { saLoad(); SA_ACT[a](x, y, el); }
});
let saTimer;
document.addEventListener('input', ev => {
  const id = ev.target.id;
  if (id === 'sa-q') { clearTimeout(saTimer); saTimer = setTimeout(() => { SAS.q = ev.target.value; saShopsList(); }, 150); }
  else if (id === 'sa-uq') { clearTimeout(saTimer); saTimer = setTimeout(() => { SAS.uq = ev.target.value; saUsersList(); }, 150); }
});
document.addEventListener('change', async ev => {
  const id = ev.target.id; if (!id || !id.startsWith('sa-set-')) return;
  const v = ev.target.value;
  if (id === 'sa-set-lang') { await saveCfg('lang', v); setLang(v); applyStaticText(); return saRender(); }
  if (id === 'sa-set-trial') SAD.settings.trial_days = Math.max(0, Math.round(num(v)));
  if (id === 'sa-set-plan') SAD.settings.default_plan = v;
  if (id === 'sa-set-phone') SAD.settings.support_phone = saPhone(v);
  saLog('settings', id.replace('sa-set-', '')); saSave(); toast(t('saved'));
});
if (window.POS_DEMO_RESET) { const r0 = window.POS_DEMO_RESET; window.POS_DEMO_RESET = () => { try { localStorage.removeItem(SAK); } catch (e) {} r0(); }; }
