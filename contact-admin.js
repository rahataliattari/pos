// Universal POS — Super Admin support inbox (tickets + password-reset requests).
// Loaded ONLY for platform admins, together with superadmin.js (see lazy.js → loadAdmin). Shop users never download it.
// Needs contact.js (user side: CT, ctApi, chips, wiring) and superadmin.js (SAD, SAS, saRender, SA_ACT).
// ───────── Super Admin: Inbox tab ─────────
function ctAdminView() {
  setTimeout(async () => { const b = $('ct-pushbox'); if (b) b.innerHTML = await pushCardHtml(); }, 0);
  const chips = [['open', 'ct_f_open'], ['answered', 'ct_f_answered'], ['closed', 'ct_f_closed'], ['all', 'sa_st_all']]
    .map(([k, l]) => `<button class="sa-chip ${CT.f === k ? 'on' : ''}" data-ct="afilter|${k}">${t(l)}</button>`).join('');
  const seg = `<div class="seg"><button class="${CT.seg === 'msgs' ? 'on' : ''}" data-ct="aseg|msgs">${t('sa_t_inbox')}</button><button class="${CT.seg === 'reset' ? 'on' : ''}" data-ct="aseg|reset">${t('fp_tab')}${CT.resetN ? ` <b class="tbadge">${CT.resetN}</b>` : ''}</button></div>`;
  return `${seg}${CT.seg === 'msgs' ? `<div class="sa-chips">${chips}</div>` : ''}
    <div class="card" id="ct-pushbox"></div>
    <div id="ct-alist"><div class="muted u-ta-center u-p-24">…</div></div>`;
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
      <div class="u-mt-2">${ctKindChip(x.kind)} ${ctStatusChip(x.status)}</div></div>${x.admin_unread ? `<span class="bal owe">${t('ct_new_b')}</span>` : ''}</div>`).join('')
    || `<div class="muted u-ta-center u-p-24">${t('ct_a_none')}</div>`;
}
async function ctAdminOpen(id) {
  const tk = CT.all.find(x => x.id === id); if (!tk) return;
  openModal('<div class="muted u-p-20 u-ta-center">…</div>');
  let msgs; try { msgs = await ctApi.thread(id); } catch (e) { closeModal(); return toast(e.message, 4000); }
  if (tk.admin_unread) { await ctApi.adminRead(id); tk.admin_unread = false; ctPoll(); if ($('ct-alist')) ctAdminList(); }
  const ph = String(tk.phone || ''), wa = waNumber(ph);
  CT.cur = id; CT.view = 'admin';
  $('sheet').innerHTML = `<div class="row"><h2 class="grow u-m-0">${esc(tk.subject)}</h2>${ctStatusChip(tk.status)}</div>
    <div class="muted u-m-4n0">${esc(tk.shop_name)} · ${esc(tk.user_name)}</div>
    <div class="u-mb-6">${ctKindChip(tk.kind)} <span class="muted">${t('ct_t_' + (tk.topic || 'other'))}</span></div>
    ${ph ? `<div class="row u-mb-8"><a class="btn secondary sm lnk" href="tel:${esc(ph)}" dir="ltr">${ic('phone', 16)} ${esc(ph)}</a>${wa ? `<a class="btn secondary sm lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 16)} ${t('ct_wa')}</a>` : ''}</div>` : ''}
    <div class="ct-thread" id="ct-thread">${msgs.map(m => ctMsgHtml(m, 'admin')).join('')}</div>
    <div class="muted u-fs-12 u-mb-4">${t('ct_a_quick')}</div>
    <div class="sa-chips">${[1, 2, 3, 4].map(n => `<button type="button" class="sa-chip" data-ct="canned|${n}">${esc(t('ct_q' + n).slice(0, 22))}…</button>`).join('')}</div>
    <textarea id="ct-reply" rows="3" maxlength="1000" placeholder="${esc(t('ct_reply_ph'))}"></textarea>
    <div class="row u-mt-10"><button class="btn grow" data-ct="areply|${id}|0">${ic('send', 18)} ${t('ct_reply')}</button>
      <button class="btn secondary grow" data-ct="areply|${id}|1">${t('ct_a_send_close')}</button></div>
    <div class="row u-mt-8"><button class="btn secondary grow" data-ct="astatus|${id}|${tk.status === 'closed' ? 'open' : 'closed'}">${tk.status === 'closed' ? t('ct_a_reopen') : t('ct_a_close')}</button>
      <button class="btn secondary" data-close>${t('close')}</button></div>
    ${tk.meta ? `<details class="u-mt-10"><summary class="muted">${t('ct_a_info')}</summary><div class="muted u-fs-12 u-word-break-break-all u-user-select-text" dir="ltr">${esc(tk.meta)}</div></details>` : ''}`;
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
        <div class="row u-mt-8">${r.status === 'open' ? `${u ? `<button class="btn grow sm" data-ct="rreset|${r.id}">${ic('key', 16)} ${t('sa_reset_pw')}</button>` : ''}<button class="btn secondary sm" data-ct="rdone|${r.id}|1">${t('fp_mark')}</button>` : `<button class="btn secondary sm" data-ct="rdone|${r.id}|0">${t('ct_a_reopen')}</button>`}
        <a class="btn secondary sm lnk" href="tel:${esc(ph)}" dir="ltr">${ic('phone', 16)}</a>${wa ? `<a class="btn secondary sm lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 16)}</a>` : ''}</div></div>`; }).join('')
      || `<div class="muted u-ta-center u-p-24">${t('fp_none')}</div>`);
}

// ───────── Wiring (admin actions) ─────────
Object.assign(CT_ACT, {
  afilter: k => { CT.f = k; saRender(); }, aseg: k => { CT.seg = k; saRender(); },
  rdone: async (id, v) => { try { await ctApi.resetDone(id, v !== '0'); ctPoll(); ctResetList($('ct-alist')); } catch (e) { toast(e.message, 4000); } },
  rreset: id => { const u = ctResetUser(CT.resets.find(x => x.id === id)); if (u) SA_ACT.resetpw(u.id); }, aopen: id => ctAdminOpen(id), areply: (id, c) => ctAdminReply(id, c === '1'),
  astatus: async (id, s) => { try { await ctApi.setStatus(id, s); toast(t('saved')); closeModal(); ctAdminList(); } catch (e) { toast(e.message, 4000); } },
  canned: n => { const ta = $('ct-reply'); if (ta) { ta.value = (ta.value ? ta.value + '\n' : '') + t('ct_q' + n); ta.focus(); } },
  notif: async () => { try { await Notification.requestPermission(); } catch (e) {} saRender(); }
});
