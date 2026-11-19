// Universal POS — account holder's profile picture.
// Stored on this phone (works offline) and, when online, on the server (shop_members.avatar) so Super Admin can see it.
const avKey = () => 'avatar_' + ((S.session && S.session.user_id) || 'demo');
async function avatarLoad() { S.avatar = S.session ? await getSetting(avKey(), '') : ''; }
const avatarHtml = (size = 24, fallback = 'store') => (S.avatar ? `<img src="${S.avatar}" alt="">` : ic(fallback, size));
function avatarRefreshUi() {
  const h = $('hdr-avatar'); if (h) h.innerHTML = avatarHtml(24);
  const a = $('set-avatar'); if (a) a.innerHTML = avatarHtml(30, 'user');
  document.querySelectorAll('.pphead .avatar').forEach(e => { e.innerHTML = avatarHtml(38, 'user'); });
  document.querySelectorAll('#btn-avatar-del').forEach(d => { d.hidden = !S.avatar; });
}

// Centre-crop to a square, 192px, JPEG. Keeps the result small (≈8–20 KB).
function avatarResize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        const n = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - n) / 2, sy = (img.naturalHeight - n) / 2;
        const c = document.createElement('canvas'); c.width = c.height = 192;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 192, 192); x.drawImage(img, sx, sy, n, n, 0, 0, 192, 192);
        let q = 0.8, out = c.toDataURL('image/jpeg', q);
        while (out.length > 60000 && q > 0.35) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}
async function avatarSet(dataUrl) {
  S.avatar = dataUrl || '';
  await setSetting(avKey(), S.avatar); await setSetting(avKey() + '_dirty', true);
  avatarRefreshUi();
  const ok = await avatarPush();
  if (!window.POS_DEMO && !ok) toast(t('pf_offline'), 3500);
}
async function avatarPush() {
  if (window.POS_DEMO) return true;
  if (!(await getSetting(avKey() + '_dirty', false))) return true;
  if (!navigator.onLine || !S.session) return false;
  try {
    const { error } = await getSb().rpc('set_my_avatar', { p_shop: S.session.shop_id, p_avatar: S.avatar || '' });
    if (error) return false;
    await delSetting(avKey() + '_dirty'); return true;
  } catch (e) { return false; }
}
// Called from the sync routine: send a pending change, otherwise take the server's picture (e.g. after changing phone).
async function avatarPull(sb, shop) {
  if (window.POS_DEMO || !S.session) return;
  if (await getSetting(avKey() + '_dirty', false)) { await avatarPush(); return; }
  const { data, error } = await sb.from('shop_members').select('avatar').eq('shop_id', shop).eq('user_id', S.session.user_id).maybeSingle();
  if (error || !data) return;                           // column not created yet: keep the local picture
  const srv = data.avatar || '';
  if (srv !== (S.avatar || '')) { S.avatar = srv; await setSetting(avKey(), srv); avatarRefreshUi(); }
}

// ───────── Full profile page (opens from the profile card in Settings) ─────────
const ppRow = (label, val, extra = '') => `<div class="pprow"><span>${label}</span><b ${extra}>${val || `<em>${t('pp_none')}</em>`}</b></div>`;
function ppHtml() {
  const s = S.session, c = S.cfg, live = !window.POS_DEMO, own = s.role === 'owner';
  const btO = c.business_type && typeof BUSINESS_TYPES !== 'undefined' ? BUSINESS_TYPES.find(x => x.id === c.business_type) : null, bt = c.business_type ? esc(btO ? btO[LANG === 'ur' ? 'ur' : 'en'] : c.business_type) : '';
  const dl = typeof syncDaysLeft === 'function' ? syncDaysLeft() : null;
  const exp = s.expires_at ? fmtDate(s.expires_at) : '';
  const st = s.trial ? t('pp_trial') : t('pp_active');
  const dis = !live ? 'disabled' : '';
  return `<div class="ppwrap">
    <div class="pphead"><label class="avatar u-w-84 u-h-84 u-cur-pointer" for="avatar-file"  aria-label="${t('pf_change')}">${avatarHtml(38, 'user')}</label>
      <div class="pname">${esc(s.user_name || s.shop_name)}</div><div class="pshop">${esc(s.shop_name)}</div>
      <div class="pchips"><span class="pchip">${t(s.role)}</span><span class="pchip">${st}</span></div>
      <div class="u-mt-6"><label class="plink" for="avatar-file">${t('pf_change')}</label> <button class="plink" type="button" id="btn-avatar-del" ${S.avatar ? '' : 'hidden'}>${t('pf_remove')}</button></div></div>

    <div class="ppsec"><div class="ppt">${t('pp_personal')}</div>
      <label>${t('pp_name')}</label><input id="pp-name" value="${esc(s.user_name || '')}" maxlength="60" autocomplete="name" ${dis}>
      <button class="btn secondary block u-m-8n0" type="button" id="pp-save-name"  ${dis}>${t('pp_save')}</button>
      ${ppRow(t('pp_mobile'), esc(typeof displayLogin === 'function' ? displayLogin(s.email) : s.email), 'dir="ltr"')}
      ${ppRow(t('pp_role'), t(s.role))}
      ${ppRow(t('pp_lang'), c.lang === 'ur' ? 'اردو' : 'English')}</div>

    <div class="ppsec"><div class="ppt">${t('pp_business')}</div>
      ${ppRow(t('pp_shop'), esc(s.shop_name))}${ppRow(t('pp_btype'), bt)}${ppRow(t('pp_bphone'), esc(c.shop_phone), 'dir="ltr"')}${ppRow(t('pp_addr'), esc(c.shop_address))}${ppRow(t('pp_tax'), esc(c.shop_tax_no), 'dir="ltr"')}
      ${own ? `<button class="btn secondary block u-mt-8" type="button" data-ppgo="shop">${t('pp_edit_shop')}</button>` : ''}</div>

    <div class="ppsec"><div class="ppt">${t('pp_account')}</div>
      ${ppRow(t('pp_plan'), esc(s.plan_name || ''))}${ppRow(t('pp_status'), st)}${exp ? ppRow(t('pp_expires'), esc(exp) + (dl !== null && dl >= 0 ? ` (${t('sg_days_left').replace('{n}', dl)})` : '')) : ''}
      <div class="pprow"><span>${t('pp_since')}</span><b id="pp-since">—</b></div>
      <div class="pprow"><span>${t('pp_last')}</span><b id="pp-last">—</b></div>
      <div class="pprow"><span>${t('pp_uid')}</span><b dir="ltr"><button type="button" class="ppcopy" id="pp-uid" data-uid="${esc(s.user_id || '')}">${esc(String(s.user_id || '').slice(0, 8).toUpperCase())}</button></b></div>
      ${ppRow(t('pp_ver'), esc(typeof CT_APP_VERSION !== 'undefined' ? CT_APP_VERSION : ''), 'dir="ltr"')}</div>

    <div class="ppsec"><div class="ppt">${t('pp_security')}</div>
      ${live ? `<button class="btn secondary block" type="button" data-ppgo="account">${ic('key', 18)} ${t('pp_pw')}</button>` : ''}
      <div class="ppt2">${t('pp_devices')}</div><div id="pp-devs" class="muted">${live ? '…' : t('pp_nodev')}</div></div>

    <div class="ppsec"><div class="ppt">${t('pp_privacy')}</div>
      <button class="btn secondary block" type="button" id="pp-export">${ic('download', 18)} ${t('pp_export')}</button>
      <button class="btn secondary block u-mt-8" type="button" data-ppgo="legal">${ic('shield', 18)} ${t('pp_terms')}</button>
      ${live ? `<button class="btn danger block u-mt-8" type="button" id="pp-delete">${ic('trash', 18)} ${t('pp_delete')}</button><div class="muted u-mt-4">${t('pp_delete_note')}</div>` : ''}</div>

    <button class="btn secondary block logoutbtn" type="button" id="btn-logout">${ic('logout', 18)} ${t('pp_signout')}</button>
    <button class="btn secondary block u-mt-8" type="button" data-close>${t('close')}</button></div>`;
}
async function ppOpen() {
  if (!S.session) return;
  S.setSheet = null;
  openModal(ppHtml());
  if (window.POS_DEMO || !navigator.onLine) { const a = $('pp-devs'); if (a && !window.POS_DEMO) a.textContent = t('pp_nodev'); return; }
  try {
    const { data, error } = await getSb().rpc('my_profile', { p_shop: S.session.shop_id });
    if (error || !data) { const a = $('pp-devs'); if (a) a.textContent = t('pp_nodev'); return; }
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('pp-since', data.created_at ? fmtDate(data.created_at) : '—'); set('pp-last', data.last_login ? fmtDate(data.last_login) : '—');
    const box = $('pp-devs'); if (box) box.innerHTML = (data.devices || []).length ? data.devices.map(d => `<div class="ppdev"><span class="sri">${ic('phone', 18)}</span><span class="srt"><b>${esc(d.name || 'Device')}${d.id === S.deviceId ? ` <em class="pchip plan u-c-g900">${t('pp_this')}</em>` : ''}${d.revoked ? ` <em class="pchip u-bg-fdecea u-c-err u-bc-f1c5c1">${t('pp_blocked')}</em>` : ''}</b><small>${t('pp_seen')}: ${esc(fmtDate(d.last))}</small></span></div>`).join('') : t('pp_nodev');
  } catch (e) { const a = $('pp-devs'); if (a) a.textContent = t('pp_nodev'); }
}
document.addEventListener('click', async ev => {
  const el = ev.target;
  if (el.closest('#pcard-open') && !el.closest('label, button, input')) return ppOpen();
  const go = el.closest('[data-ppgo]'); if (go) { closeModal(); if (typeof renderSettings === 'function') await renderSettings(); const map = { shop: 'receipt', account: 'account', legal: 'legal' }; if (typeof openSettingSheet === 'function') openSettingSheet(map[go.dataset.ppgo]); return; }
  if (el.closest('#pp-uid')) { const u = el.closest('#pp-uid').dataset.uid; try { await navigator.clipboard.writeText(u); toast(t('pp_copied')); } catch (e) { toast(u, 5000); } return; }
  if (el.closest('#pp-export')) { closeModal(); const b = $('btn-export'); if (b) b.click(); return; }
  if (el.closest('#pp-delete')) { closeModal(); if (typeof ctOpen === 'function') { await ctOpen(); const ta = $('ct-text'); if (ta) ta.value = t('pp_delmsg'); } return; }
  if (el.closest('#pp-save-name')) {
    const n = $('pp-name').value.trim(); if (n.length < 2) return toast(t('pp_name_bad'), 3000);
    if (!(await pingServer())) return toast(t('pp_need_online'), 3500);
    try {
      const { error } = await getSb().rpc('set_my_name', { p_shop: S.session.shop_id, p_name: n });
      if (error) throw error;
      S.session.user_name = n; await setSetting('session', S.session); toast(t('saved'));
      const h = $('hdr-hello'); if (h) h.textContent = n; ppOpen();
    } catch (e) { toast(t('err_generic') + ': ' + (e.message || ''), 4000); }
  }
});
