// Universal POS — "Contact us" (Stage 8): shop users send structured messages (problem / suggestion / question) from inside the app;
// Super Admin gets a badge + notification in the new Inbox tab and replies there; the user sees the reply in the same thread.
// Loaded AFTER superadmin.js and BEFORE app.js. Live build -> Supabase (supabase/schema.sql (support_tickets)). Demo build -> localStorage.
// Messages need internet (no offline queue on purpose: a half-sent support message is worse than a clear "try again").

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
    if (typeof SAS !== 'undefined' && typeof ctAdminList === 'function' && SAS.tab === 'inbox' && !$('sa').hidden && $('ct-alist') && $('modal').hidden) ctAdminList();
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
  if (!quiet) box.innerHTML = `<h2>${t('ct_title')}</h2><div class="muted u-p-20 u-ta-center">…</div>`;
  let list; try { list = await ctApi.mine(); } catch (e) { box.innerHTML = `<h2>${t('ct_title')}</h2><div class="warn">${esc(e.message)}</div><div class="u-mt-12"><button class="btn secondary block" data-close>${t('close')}</button></div>`; return; }
  if (!$('ct-body') || CT.view !== 'list') return;
  CT.mine = list;
  const ph = await ctApi.phone(), wa = waNumber(ph);
  box.innerHTML = `<h2>${t('ct_title')}</h2><div class="muted">${t('ct_sub')}</div>
    <button class="btn block u-m-12n0" data-ct="new">${ic('send', 18)} ${t('ct_new')}</button>
    ${ph ? `<div class="row u-mb-12"><a class="btn secondary grow lnk" href="tel:${esc(ph)}">${ic('phone', 18)} ${t('ct_call')}</a>${wa ? `<a class="btn secondary grow lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 18)} ${t('ct_wa')}</a>` : ''}</div>` : ''}
    <div class="sa-sec">${t('ct_mine')}</div>
    ${list.map(x => `<div class="card custcard" data-ct="open|${x.id}"><div class="avatar sm">${ic('chat', 20)}</div>
      <div class="grow"><b>${esc(x.subject)}</b><div class="muted">${esc(fmtDate(x.updated_at))}</div><div class="u-mt-2">${ctKindChip(x.kind)} ${ctStatusChip(x.status)}</div></div>
      ${x.user_unread ? `<span class="bal owe">${t('ct_new_reply_b')}</span>` : ''}</div>`).join('') || `<div class="muted u-ta-center u-p-18">${t('ct_none')}</div>`}
    <div class="u-mt-8"><button class="btn secondary block" data-close>${t('close')}</button></div>`;
}
function ctNewForm() {
  const box = $('ct-body'); if (!box) return; CT.view = 'new'; CT.img.new = null;
  box.innerHTML = `<h2>${t('ct_new')}</h2><form id="ct-form">
    <div class="row"><div class="grow"><label>${t('ct_kind')}</label><select name="kind">${CT_KINDS.map(k => `<option value="${k}">${t('ct_k_' + k)}</option>`).join('')}</select></div>
      <div class="grow"><label>${t('ct_topic')}</label><select name="topic">${CT_TOPICS.map(k => `<option value="${k}" ${k === 'other' ? 'selected' : ''}>${t('ct_t_' + k)}</option>`).join('')}</select></div></div>
    <label>${t('ct_subject')}</label><input name="subject" maxlength="80" required>
    <label>${t('ct_body')}</label><textarea name="body" id="ct-text" rows="5" maxlength="1000" required placeholder="${esc(t('ct_ph_problem'))}"></textarea>
    <div class="muted u-ta-end" id="ct-cnt" dir="ltr">0 / 1000</div>
    <div class="muted u-fs-12">${t('ct_attach_hint')}</div>${ctPickerHtml('new')}
    <div class="row u-mt-12"><button class="btn grow" type="submit" id="ct-submit">${ic('send', 18)} ${t('ct_send')}</button><button class="btn secondary" type="button" data-ct="list">${t('cancel')}</button></div></form>`;
}
async function ctThread(id) {
  const box = $('ct-body'); if (!box) return; CT.view = 'thread'; CT.cur = id; CT.img.reply = null;
  const tk = CT.mine.find(x => x.id === id) || (await ctApi.mine()).find(x => x.id === id); if (!tk) return ctRenderList();
  box.innerHTML = `<div class="muted u-p-20 u-ta-center">…</div>`;
  let msgs; try { msgs = await ctApi.thread(id); } catch (e) { return toast(e.message, 4000); }
  if (tk.user_unread) { await ctApi.read(id); tk.user_unread = false; ctPoll(); }
  if (!$('ct-body') || CT.view !== 'thread') return;
  box.innerHTML = `<div class="row"><h2 class="grow u-m-0">${esc(tk.subject)}</h2></div>
    <div class="u-m-6n0">${ctKindChip(tk.kind)} ${ctStatusChip(tk.status)} <span class="muted">${t('ct_t_' + (tk.topic || 'other'))}</span></div>
    <div class="ct-thread" id="ct-thread">${msgs.map(m => ctMsgHtml(m, 'user')).join('')}</div>
    ${tk.status === 'closed' ? `<div class="muted u-mb-6">${t('ct_closed_note')}</div>` : ''}
    <textarea id="ct-reply" rows="3" maxlength="1000" placeholder="${esc(t('ct_reply_ph'))}"></textarea>${ctPickerHtml('reply')}
    <div class="row u-mt-10"><button class="btn grow" data-ct="usend|${id}">${ic('send', 18)} ${t('ct_reply')}</button><button class="btn secondary" data-ct="list">${t('ct_back')}</button></div>`;
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

// ───────── Wiring ─────────
const CT_ACT = {
  list: () => ctRenderList(), new: () => ctNewForm(), open: id => ctThread(id), usend: id => ctUserReply(id),
  pick: k => { const f = $('ct-file-' + k); if (f) f.click(); }, unpick: k => { CT.img[k] = null; ctPreview(k); },
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
