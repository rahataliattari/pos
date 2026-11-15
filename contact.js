// Universal POS — "Contact us" (Stage 8): shop users send structured messages (problem / suggestion / question) from inside the app;
// Super Admin gets a badge + notification in the new Inbox tab and replies there; the user sees the reply in the same thread.
// Loaded AFTER superadmin.js and BEFORE app.js. Live build -> Supabase (supabase/15_support_tickets.sql). Demo build -> localStorage.
// Messages need internet (no offline queue on purpose: a half-sent support message is worse than a clear "try again").

const CTT = {
  ct_btn: ['ہم سے رابطہ کریں', 'Contact us'], ct_title: ['ہم سے رابطہ', 'Contact us'],
  ct_sub: ['اپنا مسئلہ، تجویز یا سوال لکھیں۔ سپورٹ ٹیم کا جواب یہیں نظر آئے گا۔', 'Write your problem, suggestion or question. The support reply appears right here.'],
  ct_new: ['نیا پیغام', 'New message'], ct_mine: ['میرے پیغامات', 'My messages'], ct_none: ['ابھی کوئی پیغام نہیں', 'No messages yet'],
  ct_kind: ['پیغام کی قسم', 'Type'], ct_topic: ['موضوع', 'Topic'], ct_subject: ['عنوان (مختصر)', 'Subject (short)'], ct_body: ['پیغام', 'Message'],
  ct_k_problem: ['مسئلہ', 'Problem'], ct_k_suggestion: ['تجویز', 'Suggestion'], ct_k_question: ['سوال', 'Question'],
  ct_t_billing: ['بلنگ / رسید', 'Billing / receipt'], ct_t_stock: ['پروڈکٹس / اسٹاک', 'Products / stock'], ct_t_sync: ['سنک / ڈیٹا', 'Sync / data'],
  ct_t_login: ['لاگ اِن / پاس ورڈ', 'Login / password'], ct_t_subscription: ['سبسکرپشن / پلان', 'Subscription / plan'], ct_t_other: ['دیگر', 'Other'],
  ct_ph_problem: ['کیا مسئلہ ہوا؟ کون سی اسکرین پر؟ کب سے؟ (جتنی تفصیل ہو اتنا جلد حل ہوگا)', 'What went wrong? On which screen? Since when? (More detail = faster fix)'],
  ct_ph_suggestion: ['آپ ایپ میں کیا نیا چاہتے ہیں اور اس سے آپ کو کیا فائدہ ہوگا؟', 'What would you like added, and how would it help you?'],
  ct_ph_question: ['اپنا سوال لکھیں', 'Write your question'],
  ct_send: ['بھیجیں', 'Send'], ct_sent: ['پیغام بھیج دیا گیا', 'Message sent'], ct_back: ['واپس', 'Back'],
  ct_reply_ph: ['جواب لکھیں…', 'Write a reply…'], ct_reply: ['جواب بھیجیں', 'Send reply'],
  ct_s_open: ['زیرِ غور', 'Open'], ct_s_answered: ['جواب آ گیا', 'Answered'], ct_s_closed: ['بند', 'Closed'],
  ct_f_open: ['نئے / کھلے', 'New / open'], ct_f_answered: ['جواب دیے گئے', 'Answered'], ct_f_closed: ['بند', 'Closed'],
  ct_new_reply_b: ['نیا جواب', 'New reply'], ct_new_b: ['نیا', 'New'], ct_support: ['سپورٹ ٹیم', 'Support team'], ct_you: ['آپ', 'You'],
  ct_need_online: ['پیغام بھیجنے اور دیکھنے کے لیے انٹرنیٹ ضروری ہے', 'Internet is needed to send and read messages'],
  ct_not_ready: ['یہ سہولت ابھی سرور پر آن نہیں۔ ایڈمن 15_support_tickets.sql چلائے۔', 'This feature is not set up on the server yet. The admin must run 15_support_tickets.sql.'],
  ct_rate: ['بہت زیادہ پیغام بھیجے گئے، ایک گھنٹے بعد دوبارہ کوشش کریں', 'Too many messages, please try again in an hour'],
  ct_short: ['عنوان اور پیغام مکمل لکھیں', 'Please fill in the subject and the message'],
  ct_new_reply: ['سپورٹ کی طرف سے نیا جواب آیا ہے', 'You have a new reply from support'],
  ct_direct: ['براہِ راست رابطہ', 'Direct contact'], ct_call: ['کال', 'Call'], ct_wa: ['واٹس ایپ', 'WhatsApp'],
  ct_closed_note: ['یہ پیغام بند ہے۔ جواب لکھیں گے تو دوبارہ کھل جائے گا۔', 'This message is closed. Replying reopens it.'],
  ct_sent_to: ['آپ کا پیغام سپورٹ ٹیم کو مل گیا ہے', 'Your message reached the support team'],
  // Super Admin
  sa_t_inbox: ['پیغامات', 'Inbox'], ct_a_none: ['کوئی پیغام نہیں', 'No messages'], ct_a_from: ['بھیجنے والا', 'From'],
  ct_a_send_close: ['جواب دے کر بند کریں', 'Reply and close'], ct_a_close: ['بند کریں', 'Close'], ct_a_reopen: ['دوبارہ کھولیں', 'Reopen'],
  ct_a_info: ['ڈیوائس / ایپ کی معلومات', 'Device / app info'], ct_a_quick: ['فوری جوابات', 'Quick replies'],
  ct_q1: ['آپ کا پیغام مل گیا ہے، ہم جلد دیکھ کر جواب دیتے ہیں۔', 'We received your message and will get back to you shortly.'],
  ct_q2: ['براہِ کرم ایپ بند کر کے دوبارہ کھولیں، انٹرنیٹ آن کر کے "ابھی سنک کریں" دبائیں اور بتائیں مسئلہ ختم ہوا یا نہیں۔', 'Please close and reopen the app, go online, tap "Sync now" and tell us whether the problem is gone.'],
  ct_q3: ['تجویز کا شکریہ! ہم اسے اپنی فہرست میں شامل کر رہے ہیں۔', 'Thanks for the suggestion! We are adding it to our list.'],
  ct_q4: ['مسئلے کی اسکرین کی تصویر پیغام کے ساتھ لگا دیں ("اسکرین شاٹ لگائیں" بٹن) یا واٹس ایپ پر بھیج دیں تاکہ ہم جلد حل کر سکیں۔', 'Please send a screenshot of the problem on WhatsApp so we can fix it quickly.'],
  fp_tab: ['پاس ورڈ درخواستیں', 'Password requests'], fp_done: ['مکمل', 'Done'], fp_mark: ['مکمل کریں', 'Mark done'], fp_none: ['کوئی درخواست نہیں', 'No requests'],
  fp_nouser: ['یہ نمبر کسی صارف کا نہیں ملا', 'No user has this number'],
  ct_notif_on: ['نوٹیفکیشن آن کریں', 'Enable notifications'],
  ct_notif_note: ['نوٹیفکیشن تب آتا ہے جب ایپ کھلی ہو (یا فون کے پس منظر میں چل رہی ہو)۔ ایپ مکمل بند ہو تو اگلی بار کھولنے پر بیج نظر آئے گا۔', 'Notifications arrive while the app is open (or running in the background). If the app is fully closed, the badge shows next time you open it.'],
  ct_notif_title: ['نیا صارف پیغام', 'New user message'], ct_notif_n: ['{n} نئے پیغام', '{n} new message(s)'],
  ct_a_note_help: ['صارف کا فون / واٹس ایپ', 'User phone / WhatsApp']
};
for (const k in CTT) { I18N.ur[k] = CTT[k][0]; I18N.en[k] = CTT[k][1]; }
Object.assign(ICONS, {
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'
});

const CT_KINDS = ['problem', 'suggestion', 'question'];
const CT_TOPICS = ['billing', 'stock', 'sync', 'login', 'subscription', 'other'];
const CT_APP_VERSION = 'stage9';
const CT_DK = 'pos_ct_demo_v1';
const CT = { phone: null, userN: 0, adminN: null, resetN: 0, seg: 'msgs', resets: [], mine: [], all: [], f: 'open', view: '', cur: null, ch: null, timer: null };
const ctLive = () => !window.POS_DEMO;
const ctIsAdmin = () => !!(window.POS_DEMO || S.isAdmin || (S.session && S.session.admin));
const ctFill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));

// ───────── Demo store (localStorage) ─────────
function ctSeed() {
  const now = Date.now(), iso = h => new Date(now - h * 36e5).toISOString();
  const t1 = uuid(), t2 = uuid();
  return {
    tickets: [
      { id: t1, shop_id: 'demo-shop', user_id: 'demo-user', user_name: 'ڈیمو مالک', shop_name: 'ڈیمو جنرل اسٹور', phone: '03001112233', kind: 'suggestion', topic: 'billing', subject: 'رسید پر دکان کا لوگو', meta: 'demo', status: 'answered', admin_unread: false, user_unread: true, created_at: iso(30), updated_at: iso(2) },
      { id: t2, shop_id: 'seed-shop-2', user_id: 'seed-user-2', user_name: 'عبدالرحمان', shop_name: 'رحمان کریانہ ہول سیل', phone: '03331112233', kind: 'problem', topic: 'sync', subject: 'بل سنک نہیں ہو رہے', meta: 'demo', status: 'open', admin_unread: true, user_unread: false, created_at: iso(5), updated_at: iso(5) }
    ],
    resets: [{ id: uuid(), phone: '923451112233', name: 'ستارہ بی بی', status: 'open', created_at: iso(1) }],
    messages: [
      { id: uuid(), ticket_id: t1, sender: 'user', sender_name: 'ڈیمو مالک', body: 'رسید کے اوپر ہماری دکان کا لوگو بھی چھپنا چاہیے۔', at: iso(30) },
      { id: uuid(), ticket_id: t1, sender: 'admin', sender_name: 'Support', body: 'تجویز کا شکریہ! ہم اسے اپنی فہرست میں شامل کر رہے ہیں۔', at: iso(2) },
      { id: uuid(), ticket_id: t2, sender: 'user', sender_name: 'عبدالرحمان', body: 'کل کے پانچ بل "زیرِ انتظار" میں پھنسے ہیں، انٹرنیٹ ہے مگر سنک نہیں ہو رہے۔', at: iso(5) }
    ]
  };
}
function ctDemo() { let d = null; try { d = JSON.parse(localStorage.getItem(CT_DK)); } catch (e) {} if (!d) { d = ctSeed(); ctDemoSave(d); } if (!d.resets) d.resets = []; return d; }
function ctDemoSave(d) { try { localStorage.setItem(CT_DK, JSON.stringify(d)); } catch (e) {} }
const ctByNew = (a, b) => (a.updated_at < b.updated_at ? 1 : -1);

// ───────── Data API (live = Supabase RPC/tables, demo = localStorage) ─────────
function ctErr(e) {
  const m = String((e && e.message) || e || '');
  if (/rate_limit/.test(m)) return new Error(t('ct_rate'));
  if (/support_tickets|support_send|support_reply|support_mark_read|schema cache|does not exist/i.test(m)) return new Error(t('ct_not_ready'));
  return new Error(m || t('err_generic'));
}
const ctApi = {
  async mine() {
    if (!ctLive()) return ctDemo().tickets.filter(x => x.shop_id === S.session.shop_id).sort(ctByNew);
    const { data, error } = await getSb().from('support_tickets').select('*').eq('user_id', S.session.user_id).order('updated_at', { ascending: false }).limit(50);
    if (error) throw ctErr(error); return data || [];
  },
  async thread(id) {
    if (!ctLive()) return ctDemo().messages.filter(m => m.ticket_id === id).sort((a, b) => (a.at < b.at ? -1 : 1));
    const { data, error } = await getSb().from('support_messages').select('*').eq('ticket_id', id).order('at', { ascending: true });
    if (error) throw ctErr(error); return data || [];
  },
  async send(o) {            // o: { ticket|null, kind, topic, subject, body }
    const body = o.body.trim();
    if (!ctLive()) {
      const d = ctDemo(), now = new Date().toISOString(), s = S.session;
      let tk = o.ticket && d.tickets.find(x => x.id === o.ticket);
      if (!tk) { tk = { id: uuid(), shop_id: s.shop_id, user_id: s.user_id, user_name: s.user_name || 'Demo', shop_name: s.shop_name, phone: '', kind: o.kind, topic: o.topic, subject: o.subject.trim(), meta: ctMeta(), status: 'open', admin_unread: true, user_unread: false, created_at: now, updated_at: now }; d.tickets.push(tk); }
      Object.assign(tk, { status: 'open', admin_unread: true, user_unread: false, updated_at: now });
      d.messages.push({ id: uuid(), ticket_id: tk.id, sender: 'user', sender_name: s.user_name || '', body, at: now, image: o.image || null });
      ctDemoSave(d); return tk.id;
    }
    const { data, error } = await getSb().rpc('support_send', { p_shop: S.session.shop_id, p_ticket: o.ticket || null, p_kind: o.kind || 'problem', p_topic: o.topic || 'other', p_subject: o.subject || '', p_body: body, p_meta: ctMeta(), ...(o.image ? { p_image: o.image } : {}) });
    if (error) throw ctErr(error); return data;
  },
  async read(id) {
    if (!ctLive()) { const d = ctDemo(), tk = d.tickets.find(x => x.id === id); if (tk) { tk.user_unread = false; ctDemoSave(d); } return; }
    await getSb().rpc('support_mark_read', { p_ticket: id });
  },
  async all() {
    if (!ctLive()) return ctDemo().tickets.slice().sort(ctByNew);
    const { data, error } = await getSb().from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(200);
    if (error) throw ctErr(error); return data || [];
  },
  async reply(id, body, close) {
    if (!ctLive()) {
      const d = ctDemo(), tk = d.tickets.find(x => x.id === id), now = new Date().toISOString(); if (!tk) return;
      d.messages.push({ id: uuid(), ticket_id: id, sender: 'admin', sender_name: 'Support', body: body.trim(), at: now });
      Object.assign(tk, { status: close ? 'closed' : 'answered', user_unread: true, admin_unread: false, updated_at: now }); ctDemoSave(d); return;
    }
    const { error } = await getSb().rpc('support_reply', { p_ticket: id, p_body: body.trim(), p_close: !!close });
    if (error) throw ctErr(error);
  },
  async setStatus(id, status) {
    if (!ctLive()) { const d = ctDemo(), tk = d.tickets.find(x => x.id === id); if (tk) { tk.status = status; ctDemoSave(d); } return; }
    const { error } = await getSb().from('support_tickets').update({ status }).eq('id', id); if (error) throw ctErr(error);
  },
  async adminRead(id) {
    if (!ctLive()) { const d = ctDemo(), tk = d.tickets.find(x => x.id === id); if (tk) { tk.admin_unread = false; ctDemoSave(d); } return; }
    await getSb().from('support_tickets').update({ admin_unread: false }).eq('id', id);
  },
  async resets() {
    if (!ctLive()) return ctDemo().resets.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const { data, error } = await getSb().from('password_reset_requests').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw ctErr(error); return data || [];
  },
  async resetDone(id, done) {
    if (!ctLive()) { const d = ctDemo(), r = d.resets.find(x => x.id === id); if (r) r.status = done ? 'done' : 'open'; ctDemoSave(d); return; }
    const { error } = await getSb().from('password_reset_requests').update({ status: done ? 'done' : 'open', done_at: done ? new Date().toISOString() : null }).eq('id', id); if (error) throw ctErr(error);
  },
  async counts() {
    const out = { user: 0, admin: 0, reset: 0 };
    if (!ctLive()) { const d = ctDemo(); out.user = d.tickets.filter(x => x.user_unread && x.shop_id === S.session.shop_id).length; out.admin = d.tickets.filter(x => x.admin_unread).length; out.reset = d.resets.filter(x => x.status === 'open').length; return out; }
    const sb = getSb();
    if (S.session) { const r = await sb.from('support_tickets').select('id', { count: 'exact', head: true }).eq('user_id', S.session.user_id).eq('user_unread', true); if (!r.error) out.user = r.count || 0; }
    if (ctIsAdmin()) { const r = await sb.from('support_tickets').select('id', { count: 'exact', head: true }).eq('admin_unread', true); if (!r.error) out.admin = r.count || 0; const q = await sb.from('password_reset_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'); if (!q.error) out.reset = q.count || 0; }
    return out;
  },
  async phone() {
    if (CT.phone != null) return CT.phone;
    if (!ctLive()) return (CT.phone = (typeof SAD !== 'undefined' && SAD && SAD.settings && SAD.settings.support_phone) || '03001234567');
    try { const { data } = await getSb().from('platform_settings').select('support_phone').eq('id', 1).maybeSingle(); CT.phone = (data && data.support_phone) || ''; } catch (e) { CT.phone = ''; }
    return CT.phone;
  }
};
function ctMeta() {   // helps support reproduce the problem; never contains passwords or business data
  return ['v:' + CT_APP_VERSION, 'role:' + ((S.session && S.session.role) || ''), 'dev:' + String(S.deviceId || '').slice(0, 8), navigator.onLine ? 'online' : 'offline', LANG, (navigator.userAgent || '').slice(0, 110)].join(' | ');
}

// ───────── Badges, polling, notification ─────────
function ctBadge(el, n, abs) {
  if (!el) return;
  let b = el.querySelector(':scope > b.tbadge');
  if (!n) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('b'); b.className = 'tbadge' + (abs ? ' abs' : ''); el.appendChild(b); }
  b.textContent = n > 99 ? '99+' : n;
}
function ctPaint() {
  const u = CT.userN || 0, a = CT.adminN || 0;
  ctBadge(document.querySelector('#nav button[data-tab="settings"]'), u, true);
  ctBadge($('btn-contact'), u, false);
  ctBadge(document.querySelector('#sa nav button[data-sa="tab|inbox"]'), a, true);
  ctBadge($('btn-sa-open'), a, false);
  try { if (navigator.setAppBadge) { (u + a) ? navigator.setAppBadge(u + a) : navigator.clearAppBadge(); } } catch (e) {}
}
async function ctNotifyAdmin(n) {
  let l = []; try { l = (await ctApi.all()).filter(x => x.admin_unread); } catch (e) {}
  const top = l[0], body = top ? `${top.shop_name}: ${top.subject}` : ctFill(t('ct_notif_n'), { n });
  toast(`${t('ct_notif_title')} — ${body}`, 6000);
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const opts = { body, icon: 'icon-192.png', tag: 'pos-support', renotify: true };
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg && reg.showNotification) reg.showNotification(t('ct_notif_title'), opts); else new Notification(t('ct_notif_title'), opts);
    }
  } catch (e) {}
}
async function ctPoll() {
  if (typeof S === 'undefined' || (!S.session && !S.isAdmin)) return;
  if (ctLive() && !navigator.onLine) return;
  try {
    const c = await ctApi.counts(), pu = CT.userN, pa = CT.adminN;
    CT.userN = c.user; CT.resetN = c.reset || 0; CT.adminN = c.admin + CT.resetN; ctPaint();
    if (ctIsAdmin() && pa !== null && c.admin > pa) ctNotifyAdmin(c.admin - pa);
    if (pu !== undefined && c.user > pu && CT.view !== 'thread') toast(t('ct_new_reply'), 5000);
    if (SAS.tab === 'inbox' && !$('sa').hidden && $('ct-alist') && $('modal').hidden) ctAdminList();
    if ($('ct-body') && CT.view === 'list') ctRenderList(true);
  } catch (e) {}
}
function ctStart() {
  if (CT.timer) return;
  CT.timer = setInterval(ctPoll, 40000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ctPoll(); });
  setTimeout(ctPoll, 2500);
  if (ctLive()) setInterval(() => {                                // realtime push (instant); polling above is the fallback
    if (CT.ch || !(S.session || S.isAdmin)) return;
    try { CT.ch = getSb().channel('pos-support').on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => ctPoll()).subscribe(); } catch (e) {}
  }, 5000);
}

// ───────── Shop user: list / new / thread ─────────
const ctKindChip = k => `<span class="st ${k === 'problem' ? 'suspended' : k === 'suggestion' ? '' : 'trial'}">${t('ct_k_' + k)}</span>`;
const ctStatusChip = s => `<span class="st ${s === 'open' ? 'trial' : s === 'closed' ? 'archived' : ''}">${t('ct_s_' + s)}</span>`;
const ctMsgHtml = (m, me) => `<div class="ct-msg ${m.sender === me ? 'me' : 'them'}"><small>${esc(m.sender === 'admin' ? (me === 'admin' ? t('ct_you') : t('ct_support')) : (m.sender_name || ''))} · ${esc(fmtDate(m.at))}</small>${esc(m.body)}${/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(m.image || '') ? `<img class="ct-img" src="${m.image}" alt="${esc(t('ct_shot'))}">` : ''}</div>`;

// ───────── Screenshot attach (shrunk to a small JPEG in the browser; the server re-checks type and size) ─────────
Object.assign(I18N.ur, { ct_attach: 'اسکرین شاٹ لگائیں', ct_shot: 'اسکرین شاٹ', ct_img_remove: 'تصویر ہٹائیں', ct_img_bad: 'یہ تصویر نہیں کھل سکی، کوئی اور تصویر چنیں', ct_img_big: 'تصویر بہت بڑی ہے، کوئی اور چنیں', ct_attach_hint: 'مسئلے کی اسکرین کی تصویر ساتھ لگا دیں تاکہ جلد حل ہو' });
Object.assign(I18N.en, { ct_attach: 'Attach screenshot', ct_shot: 'Screenshot', ct_img_remove: 'Remove picture', ct_img_bad: 'That picture could not be opened, choose another', ct_img_big: 'The picture is too large, choose another', ct_attach_hint: 'Attach a screenshot of the problem so we can fix it sooner' });
if (typeof ICONS !== 'undefined') ICONS.image = '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>';
const CT_IMG_MAX = 380000;               // characters of the data URL (about 280 KB of picture)
CT.img = { new: null, reply: null };
function ctCompress(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error(t('ct_img_bad'))); };
    im.onload = () => {
      URL.revokeObjectURL(url);
      let max = 1280, q = 0.72;
      for (let i = 0; i < 6; i++) {
        const sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        const d = c.toDataURL('image/jpeg', q);
        if (d.length <= CT_IMG_MAX) return res(d);
        max *= 0.8; q = Math.max(0.5, q - 0.06);
      }
      rej(new Error(t('ct_img_big')));
    };
    im.src = url;
  });
}
const ctPickerHtml = k => `<div class="ct-attach"><input type="file" id="ct-file-${k}" accept="image/*" hidden>
  <button type="button" class="btn secondary sm" data-ct="pick|${k}">${ic('image', 16)} ${t('ct_attach')}</button><div id="ct-prev-${k}" class="ct-prev"></div></div>`;
function ctPreview(k) {
  const box = $('ct-prev-' + k); if (!box) return;
  box.innerHTML = CT.img[k] ? `<img src="${CT.img[k]}" alt=""><button type="button" class="btn secondary sm" data-ct="unpick|${k}" aria-label="${t('ct_img_remove')}">${ic('x', 14)}</button>` : '';
}
document.addEventListener('change', async ev => {
  const m = /^ct-file-(new|reply)$/.exec(ev.target.id || ''); if (!m) return;
  const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try { CT.img[m[1]] = await ctCompress(f); ctPreview(m[1]); } catch (e) { toast(e.message, 4000); }
});
document.addEventListener('click', ev => {
  const im = ev.target.closest('img.ct-img'); if (!im) return;                      // tap a picture: full-screen view inside the app
  const v = document.createElement('div'); v.className = 'ct-zoom'; v.innerHTML = `<img src="${im.src}" alt="">`; v.onclick = () => v.remove(); document.body.appendChild(v);
});

async function ctOpen() {
  if (ctLive() && !(await pingServer())) return toast(t('ct_need_online'), 3500);
  openModal('<div id="ct-body"></div>'); await ctRenderList();
}
async function ctRenderList(quiet) {
  const box = $('ct-body'); if (!box) return;
  CT.view = 'list';
  if (!quiet) box.innerHTML = `<h2>${t('ct_title')}</h2><div class="muted" style="padding:20px;text-align:center">…</div>`;
  let list; try { list = await ctApi.mine(); } catch (e) { box.innerHTML = `<h2>${t('ct_title')}</h2><div class="warn">${esc(e.message)}</div><div style="margin-top:12px"><button class="btn secondary block" data-close>${t('close')}</button></div>`; return; }
  if (!$('ct-body') || CT.view !== 'list') return;
  CT.mine = list;
  const ph = await ctApi.phone(), wa = waNumber(ph);
  box.innerHTML = `<h2>${t('ct_title')}</h2><div class="muted">${t('ct_sub')}</div>
    <button class="btn block" data-ct="new" style="margin:12px 0">${ic('send', 18)} ${t('ct_new')}</button>
    ${ph ? `<div class="row" style="margin-bottom:12px"><a class="btn secondary grow lnk" href="tel:${esc(ph)}">${ic('phone', 18)} ${t('ct_call')}</a>${wa ? `<a class="btn secondary grow lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 18)} ${t('ct_wa')}</a>` : ''}</div>` : ''}
    <div class="sa-sec">${t('ct_mine')}</div>
    ${list.map(x => `<div class="card custcard" data-ct="open|${x.id}"><div class="avatar sm">${ic('chat', 20)}</div>
      <div class="grow"><b>${esc(x.subject)}</b><div class="muted">${esc(fmtDate(x.updated_at))}</div><div style="margin-top:2px">${ctKindChip(x.kind)} ${ctStatusChip(x.status)}</div></div>
      ${x.user_unread ? `<span class="bal owe">${t('ct_new_reply_b')}</span>` : ''}</div>`).join('') || `<div class="muted" style="text-align:center;padding:18px">${t('ct_none')}</div>`}
    <div style="margin-top:8px"><button class="btn secondary block" data-close>${t('close')}</button></div>`;
}
function ctNewForm() {
  const box = $('ct-body'); if (!box) return; CT.view = 'new'; CT.img.new = null;
  box.innerHTML = `<h2>${t('ct_new')}</h2><form id="ct-form">
    <div class="row"><div class="grow"><label>${t('ct_kind')}</label><select name="kind">${CT_KINDS.map(k => `<option value="${k}">${t('ct_k_' + k)}</option>`).join('')}</select></div>
      <div class="grow"><label>${t('ct_topic')}</label><select name="topic">${CT_TOPICS.map(k => `<option value="${k}" ${k === 'other' ? 'selected' : ''}>${t('ct_t_' + k)}</option>`).join('')}</select></div></div>
    <label>${t('ct_subject')}</label><input name="subject" maxlength="80" required>
    <label>${t('ct_body')}</label><textarea name="body" id="ct-text" rows="5" maxlength="1000" required placeholder="${esc(t('ct_ph_problem'))}"></textarea>
    <div class="muted" id="ct-cnt" dir="ltr" style="text-align:end">0 / 1000</div>
    <div class="muted" style="font-size:12px">${t('ct_attach_hint')}</div>${ctPickerHtml('new')}
    <div class="row" style="margin-top:12px"><button class="btn grow" type="submit" id="ct-submit">${ic('send', 18)} ${t('ct_send')}</button><button class="btn secondary" type="button" data-ct="list">${t('cancel')}</button></div></form>`;
}
async function ctThread(id) {
  const box = $('ct-body'); if (!box) return; CT.view = 'thread'; CT.cur = id; CT.img.reply = null;
  const tk = CT.mine.find(x => x.id === id) || (await ctApi.mine()).find(x => x.id === id); if (!tk) return ctRenderList();
  box.innerHTML = `<div class="muted" style="padding:20px;text-align:center">…</div>`;
  let msgs; try { msgs = await ctApi.thread(id); } catch (e) { return toast(e.message, 4000); }
  if (tk.user_unread) { await ctApi.read(id); tk.user_unread = false; ctPoll(); }
  if (!$('ct-body') || CT.view !== 'thread') return;
  box.innerHTML = `<div class="row"><h2 class="grow" style="margin:0">${esc(tk.subject)}</h2></div>
    <div style="margin:6px 0">${ctKindChip(tk.kind)} ${ctStatusChip(tk.status)} <span class="muted">${t('ct_t_' + (tk.topic || 'other'))}</span></div>
    <div class="ct-thread" id="ct-thread">${msgs.map(m => ctMsgHtml(m, 'user')).join('')}</div>
    ${tk.status === 'closed' ? `<div class="muted" style="margin-bottom:6px">${t('ct_closed_note')}</div>` : ''}
    <textarea id="ct-reply" rows="3" maxlength="1000" placeholder="${esc(t('ct_reply_ph'))}"></textarea>${ctPickerHtml('reply')}
    <div class="row" style="margin-top:10px"><button class="btn grow" data-ct="usend|${id}">${ic('send', 18)} ${t('ct_reply')}</button><button class="btn secondary" data-ct="list">${t('ct_back')}</button></div>`;
  const th = $('ct-thread'); if (th) th.scrollTop = th.scrollHeight;
}
async function ctUserReply(id) {
  const ta = $('ct-reply'), body = ta ? ta.value.trim() : ''; if (body.length < 2) return;
  if (ctLive() && !(await pingServer())) return toast(t('ct_need_online'), 3500);
  try { await ctApi.send({ ticket: id, body, image: CT.img.reply }); CT.img.reply = null; toast(t('ct_sent')); ctPoll(); pushNotify('ticket_new', { ticket_id: id }); await ctThread(id); } catch (e) { toast(e.message, 4500); }
}
async function ctSubmitNew(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  if (String(f.subject).trim().length < 3 || String(f.body).trim().length < 5) return toast(t('ct_short'), 3500);
  if (ctLive() && !(await pingServer())) return toast(t('ct_need_online'), 3500);    // form stays open so the text is not lost
  const btn = $('ct-submit'); btn.disabled = true;
  try { const id = await ctApi.send({ ticket: null, kind: f.kind, topic: f.topic, subject: f.subject.trim(), body: f.body, image: CT.img.new }); CT.img.new = null; toast(t('ct_sent_to'), 3500); CT.mine = []; ctPoll(); pushNotify('ticket_new', { ticket_id: id }); await ctThread(id); }
  catch (e) { toast(e.message, 5000); btn.disabled = false; }
}

// ───────── Super Admin: Inbox tab ─────────
function ctAdminView() {
  setTimeout(async () => { const b = $('ct-pushbox'); if (b) b.innerHTML = await pushCardHtml(); }, 0);
  const chips = [['open', 'ct_f_open'], ['answered', 'ct_f_answered'], ['closed', 'ct_f_closed'], ['all', 'sa_st_all']]
    .map(([k, l]) => `<button class="sa-chip ${CT.f === k ? 'on' : ''}" data-ct="afilter|${k}">${t(l)}</button>`).join('');
  const seg = `<div class="seg"><button class="${CT.seg === 'msgs' ? 'on' : ''}" data-ct="aseg|msgs">${t('sa_t_inbox')}</button><button class="${CT.seg === 'reset' ? 'on' : ''}" data-ct="aseg|reset">${t('fp_tab')}${CT.resetN ? ` <b class="tbadge">${CT.resetN}</b>` : ''}</button></div>`;
  return `${seg}${CT.seg === 'msgs' ? `<div class="sa-chips">${chips}</div>` : ''}
    <div class="card" id="ct-pushbox"></div>
    <div id="ct-alist"><div class="muted" style="text-align:center;padding:24px">…</div></div>`;
}
async function ctAdminList() {
  const box = $('ct-alist'); if (!box) return;
  if (CT.seg === 'reset') return ctResetList(box);
  let all; try { all = await ctApi.all(); } catch (e) { box.innerHTML = `<div class="warn">${esc(e.message)}</div>`; return; }
  if (!$('ct-alist')) return;
  CT.all = all;
  const list = all.filter(x => CT.f === 'all' || (CT.f === 'open' ? x.status === 'open' : x.status === CT.f))
    .sort((a, b) => (b.admin_unread - a.admin_unread) || (a.updated_at < b.updated_at ? 1 : -1));
  box.innerHTML = list.map(x => `<div class="card custcard" data-ct="aopen|${x.id}"><div class="avatar sm">${ic('chat', 20)}</div>
    <div class="grow"><b>${esc(x.subject)}</b><div class="muted">${esc(x.shop_name)} · ${esc(x.user_name)}</div><div class="muted">${esc(fmtDate(x.updated_at))}</div>
      <div style="margin-top:2px">${ctKindChip(x.kind)} ${ctStatusChip(x.status)}</div></div>${x.admin_unread ? `<span class="bal owe">${t('ct_new_b')}</span>` : ''}</div>`).join('')
    || `<div class="muted" style="text-align:center;padding:24px">${t('ct_a_none')}</div>`;
}
async function ctAdminOpen(id) {
  const tk = CT.all.find(x => x.id === id); if (!tk) return;
  openModal('<div class="muted" style="padding:20px;text-align:center">…</div>');
  let msgs; try { msgs = await ctApi.thread(id); } catch (e) { closeModal(); return toast(e.message, 4000); }
  if (tk.admin_unread) { await ctApi.adminRead(id); tk.admin_unread = false; ctPoll(); if ($('ct-alist')) ctAdminList(); }
  const ph = String(tk.phone || ''), wa = waNumber(ph);
  CT.cur = id; CT.view = 'admin';
  $('sheet').innerHTML = `<div class="row"><h2 class="grow" style="margin:0">${esc(tk.subject)}</h2>${ctStatusChip(tk.status)}</div>
    <div class="muted" style="margin:4px 0">${esc(tk.shop_name)} · ${esc(tk.user_name)}</div>
    <div style="margin-bottom:6px">${ctKindChip(tk.kind)} <span class="muted">${t('ct_t_' + (tk.topic || 'other'))}</span></div>
    ${ph ? `<div class="row" style="margin-bottom:8px"><a class="btn secondary sm lnk" href="tel:${esc(ph)}" dir="ltr">${ic('phone', 16)} ${esc(ph)}</a>${wa ? `<a class="btn secondary sm lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 16)} ${t('ct_wa')}</a>` : ''}</div>` : ''}
    <div class="ct-thread" id="ct-thread">${msgs.map(m => ctMsgHtml(m, 'admin')).join('')}</div>
    <div class="muted" style="font-size:12px;margin-bottom:4px">${t('ct_a_quick')}</div>
    <div class="sa-chips">${[1, 2, 3, 4].map(n => `<button type="button" class="sa-chip" data-ct="canned|${n}">${esc(t('ct_q' + n).slice(0, 22))}…</button>`).join('')}</div>
    <textarea id="ct-reply" rows="3" maxlength="1000" placeholder="${esc(t('ct_reply_ph'))}"></textarea>
    <div class="row" style="margin-top:10px"><button class="btn grow" data-ct="areply|${id}|0">${ic('send', 18)} ${t('ct_reply')}</button>
      <button class="btn secondary grow" data-ct="areply|${id}|1">${t('ct_a_send_close')}</button></div>
    <div class="row" style="margin-top:8px"><button class="btn secondary grow" data-ct="astatus|${id}|${tk.status === 'closed' ? 'open' : 'closed'}">${tk.status === 'closed' ? t('ct_a_reopen') : t('ct_a_close')}</button>
      <button class="btn secondary" data-close>${t('close')}</button></div>
    ${tk.meta ? `<details style="margin-top:10px"><summary class="muted">${t('ct_a_info')}</summary><div class="muted" dir="ltr" style="font-size:12px;word-break:break-all;user-select:text">${esc(tk.meta)}</div></details>` : ''}`;
  const th = $('ct-thread'); if (th) th.scrollTop = th.scrollHeight;
}
async function ctAdminReply(id, close) {
  const ta = $('ct-reply'), body = ta ? ta.value.trim() : '';
  if (body.length < 2) { if (!close) return toast(t('ct_short'), 2500); await ctApi.setStatus(id, 'closed'); toast(t('saved')); closeModal(); return ctAdminList(); }
  try { await ctApi.reply(id, body, close); pushNotify('ticket_reply', { ticket_id: id }); toast(t('saved')); closeModal(); ctPoll(); ctAdminList(); } catch (e) { toast(e.message, 5000); }
}

// password-reset requests (from the login screen's "forgot password")
const ctDigits = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '92' + d.slice(1); else if (d.length === 10 && d.startsWith('3')) d = '92' + d; return d; };
const ctResetUser = r => r && SAD && SAD.users.find(u => ctDigits(u.phone) === ctDigits(r.phone));
async function ctResetList(box) {
  if (!box) return;
  let list; try { list = await ctApi.resets(); } catch (e) { box.innerHTML = `<div class="warn">${esc(e.message)}</div>`; return; }
  CT.resets = list;
  const shown = list.filter(r => CT.f === 'closed' ? r.status === 'done' : r.status === 'open');
  box.innerHTML = `<div class="sa-chips"><button class="sa-chip ${CT.f !== 'closed' ? 'on' : ''}" data-ct="afilter|open">${t('ct_f_open')}</button><button class="sa-chip ${CT.f === 'closed' ? 'on' : ''}" data-ct="afilter|closed">${t('fp_done')}</button></div>`
    + (shown.map(r => { const u = ctResetUser(r), ph = '0' + ctDigits(r.phone).slice(2), wa = waNumber(r.phone);
      return `<div class="card"><div class="row"><div class="grow"><b dir="ltr">${esc(ph)}</b>${r.name ? ` · ${esc(r.name)}` : ''}<div class="muted">${esc(fmtDate(r.created_at))}</div>
        <div class="muted">${u ? `${esc(u.name)} — ${esc(saShopName(u.shop_id))}` : `<span class="owe-t">${t('fp_nouser')}</span>`}</div></div></div>
        <div class="row" style="margin-top:8px">${r.status === 'open' ? `${u ? `<button class="btn grow sm" data-ct="rreset|${r.id}">${ic('key', 16)} ${t('sa_reset_pw')}</button>` : ''}<button class="btn secondary sm" data-ct="rdone|${r.id}|1">${t('fp_mark')}</button>` : `<button class="btn secondary sm" data-ct="rdone|${r.id}|0">${t('ct_a_reopen')}</button>`}
        <a class="btn secondary sm lnk" href="tel:${esc(ph)}" dir="ltr">${ic('phone', 16)}</a>${wa ? `<a class="btn secondary sm lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 16)}</a>` : ''}</div></div>`; }).join('')
      || `<div class="muted" style="text-align:center;padding:24px">${t('fp_none')}</div>`);
}

// ───────── Wiring ─────────
const CT_ACT = {
  list: () => ctRenderList(), new: () => ctNewForm(), open: id => ctThread(id), usend: id => ctUserReply(id),
  afilter: k => { CT.f = k; saRender(); }, aseg: k => { CT.seg = k; saRender(); },
  rdone: async (id, v) => { try { await ctApi.resetDone(id, v !== '0'); ctPoll(); ctResetList($('ct-alist')); } catch (e) { toast(e.message, 4000); } },
  rreset: id => { const u = ctResetUser(CT.resets.find(x => x.id === id)); if (u) SA_ACT.resetpw(u.id); }, aopen: id => ctAdminOpen(id), areply: (id, c) => ctAdminReply(id, c === '1'),
  astatus: async (id, s) => { try { await ctApi.setStatus(id, s); toast(t('saved')); closeModal(); ctAdminList(); } catch (e) { toast(e.message, 4000); } },
  pick: k => { const f = $('ct-file-' + k); if (f) f.click(); }, unpick: k => { CT.img[k] = null; ctPreview(k); },
  canned: n => { const ta = $('ct-reply'); if (ta) { ta.value = (ta.value ? ta.value + '\n' : '') + t('ct_q' + n); ta.focus(); } },
  notif: async () => { try { await Notification.requestPermission(); } catch (e) {} saRender(); }
};
document.addEventListener('click', ev => {
  if (ev.target.closest('#btn-contact')) return ctOpen();
  const el = ev.target.closest('[data-ct]'); if (!el) return;
  const [a, x, y] = el.dataset.ct.split('|'); if (CT_ACT[a]) CT_ACT[a](x, y, el);
});
document.addEventListener('submit', ev => { if (ev.target.id === 'ct-form') { ev.preventDefault(); ctSubmitNew(ev.target); } });
document.addEventListener('input', ev => {
  if (ev.target.id === 'ct-text') { const c = $('ct-cnt'); if (c) c.textContent = ev.target.value.length + ' / 1000'; }
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.form || el.form.id !== 'ct-form' || el.name !== 'kind') return;
  const ta = $('ct-text'); if (ta) ta.placeholder = t('ct_ph_' + el.value);
});
ctStart();
