// Universal POS — Settings screen: the rows, the sheets they open, and every settings handler.
// (Config helpers loadCfg/saveCfg/applyTheme stay in app.js because boot needs them.)
// The install button, About sheet and notification block (formerly extras.js) are at the end of this file.

async function renderSettings() {
  const c = S.cfg, own = isOwner(), dis = own ? '' : 'disabled', live = !window.POS_DEMO;
  const rdis = (window.POS_DEMO || canPurchase()) ? '' : 'disabled';   // receipt text: owner/manager (it is shared by all phones)
  // remember which sections are open so a re-render (after saving something) doesn't collapse them
  S.setOpen = S.setOpen || new Set();
  const cur = document.querySelectorAll('#view-settings details[data-sec]');
  if (cur.length) { S.setOpen = new Set([...cur].filter(d => d.open).map(d => d.dataset.sec)); }
  const sec = (id, icon, title, body) => `<details class="sset" data-sec="${id}" ${S.setOpen.has(id) ? 'open' : ''}><summary>${ic(icon, 20)} <span class="grow">${title}</span></summary><div class="sbody">${body}</div></details>`;
  const nConf = live ? await db.conflicts.filter(x => !x.resolved_at).count() : 0, nFail = live ? await failedCount() : 0, nPend = live ? await pendingCount() : 0;

  const account = (live ? `<label>${t('change_pw')}</label>${pwField('set-oldpw', t('cur_password'))}${pwField('set-newpw', t('new_password'), 'margin-top:8px')}<button class="btn block u-m-8n0" id="btn-pw">${t('save')}</button>` : '')
    + (own && live ? `<label>${t('my_phone')}</label><input id="set-newphone" inputmode="tel" dir="ltr" placeholder="03xx xxxxxxx">${pwField('set-phonepw', t('cur_password'), 'margin-top:8px')}<button class="btn block u-m-8n0" id="btn-phone">${t('save')}</button>` : '')
    + (own && live ? `<label>${t('shop_name')}</label><input id="set-shopname" value="${esc(S.session.shop_name)}" maxlength="80"><button class="btn block u-m-8n0" id="btn-shopname">${t('save')}</button>` : '');

  const look = `<label>${t('language')}</label>
      <select id="set-lang"><option value="ur" ${c.lang === 'ur' ? 'selected' : ''}>اردو</option><option value="en" ${c.lang === 'en' ? 'selected' : ''}>English</option></select>
      <label>${t('theme')}</label>
      <div class="thpick">${Object.keys(THEMES).map(k => `<button type="button" class="thopt ${(THEMES[c.theme] ? c.theme : 'green') === k ? 'on' : ''}" data-theme-pick="${k}" aria-pressed="${(THEMES[c.theme] ? c.theme : 'green') === k}"><i class="thsw" style="background:linear-gradient(135deg,${THEMES[k][0]} 55%,${THEMES[k][1]} 55%)"></i><span>${themeName(k)}</span></button>`).join('')}</div>`;

  const billing = (own ? '' : `<div class="muted">${t('owner_only')}</div>`) + `
      <label>${t('tax_rate')}</label><input id="set-tax" type="number" inputmode="decimal" step="any" min="0" value="${c.tax_rate}" ${dis}>
      <label><input type="checkbox" id="set-cdisc" class="u-w-auto u-minh-0" ${c.cashier_discount ? 'checked' : ''} ${dis}> ${t('cashier_discount')}</label>
      <label><input type="checkbox" id="set-oversell" class="u-w-auto u-minh-0" ${c.allow_oversell ? 'checked' : ''} ${dis}> ${t('set_oversell')}</label>
      <label><input type="checkbox" id="set-cprice" class="u-w-auto u-minh-0" ${c.cashier_price ? 'checked' : ''} ${dis}> ${t('cashier_price')}</label>`;

  // Business type: a shop setting (shared by all phones). Owner/manager change it; others only see it.
  const bizCur = typeof BUSINESS_TYPES !== 'undefined' ? BUSINESS_TYPES.find(x => x.id === c.business_type) : null;
  const bizSub = bizCur ? esc(catLabel(bizCur)) : t('biz_not_set');
  const bizBody = typeof BUSINESS_TYPES === 'undefined' ? '' : `<div class="muted u-mb-10">${t('biz_hint')}</div>`
    + BUSINESS_TYPES.map(b => `<button type="button" class="btn ${c.business_type === b.id ? '' : 'secondary '}block u-mb-8" data-biz-type="${b.id}" aria-pressed="${c.business_type === b.id}" ${rdis}>${esc(catLabel(b))}</button>`).join('')
    + (rdis ? `<div class="muted">${t('owner_only')}</div>` : '');

  const rstyle = c.receipt_style || 'premium';
  const receipt = `<label>${t('rs_title')}</label>
      <div class="rspick">${['premium', 'classic', 'modern'].map(k => `<button type="button" class="rsopt ${rstyle === k ? 'on' : ''}" data-rstyle="${k}" ${rdis}><i class="rsprev rs-${k}"><b></b><b></b><b></b><u></u></i><span>${t('rs_' + k)}</span></button>`).join('')}</div>
      <label class="pcbox"><input type="checkbox" id="set-pcolor" ${c.print_color ? 'checked' : ''}> ${t('pc_label')}</label><div class="muted">${t('pc_hint')}</div>
      <label>${t('receipt_header')}</label><input id="set-rh" value="${esc(c.receipt_header)}" ${rdis}>
      <label>${t('receipt_footer')}</label><input id="set-rf" value="${esc(c.receipt_footer)}" ${rdis}>
      <label>${t('set_phone')}</label><input id="set-sp" inputmode="tel" dir="ltr" value="${esc(c.shop_phone)}" ${rdis}>
      <label>${t('set_addr')}</label><input id="set-sa" value="${esc(c.shop_address)}" ${rdis}>
      <label>${t('set_ntn')}</label><input id="set-sn" dir="ltr" value="${esc(c.shop_tax_no)}" ${rdis}>
      <label>${t('paper_width')}</label>
      <select id="set-paper"><option value="58" ${c.paper == 58 ? 'selected' : ''}>58 mm</option><option value="80" ${c.paper == 80 ? 'selected' : ''}>80 mm</option><option value="a4" ${c.paper === 'a4' ? 'selected' : ''}>A4</option></select>
      <label class="u-mt-10">${t('rc_pw')}</label>
      <select id="set-pw">${[[0, t('rc_pw_auto')], [48, '48 mm'], [52, '52 mm'], [72, '72 mm']].map(([v, l]) => `<option value="${v}" ${(+c.print_w || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select><div class="muted">${t('rc_pw_hint')}</div>
      ${planHasQr()
        ? `<label class="u-mt-10"><input type="checkbox" id="set-rqr" class="u-w-auto u-minh-0" ${c.receipt_qr !== false ? 'checked' : ''}> ${t('rc_qr_show')}</label>`
        : `<div class="muted u-mt-10">${ic('shield', 16)} ${t('rc_qr_locked')}</div>`}`;

  const data = (live ? `<div class="muted" id="sync-state"></div>
      <div class="muted">${t('pending')}: ${nPend} · ${t('sync_failed_n')}: ${nFail} · ${t('sync_conflicts')}: ${nConf}</div>
      ${syncDaysLeft() !== null ? `<div class="${syncDaysLeft() <= 7 ? 'warn' : 'muted'}">${syncExpiryText()}</div>` : ''}
      <button class="btn block u-mt-8" id="btn-sync-now">${t('sync_now')}</button>
      ${nConf ? `<button class="btn secondary block u-mt-8" id="btn-conflicts">${t('cf_review')}</button>` : ''}
      ${nFail ? `<button class="btn secondary block u-mt-8" id="btn-sync-retry">${t('sync_retry')}</button>` : ''}
      <button class="btn secondary block u-mt-8" id="btn-import">${ic('download', 18)} ${t('import_data')}</button><input type="file" id="import-file" accept=".json,application/json" hidden>` : '')
    + `<button class="btn secondary block u-mt-8" id="btn-export">${ic('download', 18)} ${t('export_data')}</button>`;

  const warnDot = (live && (nFail || nConf || (syncDaysLeft() !== null && syncDaysLeft() <= 7))) ? ' <span class="bal owe">!</span>' : '';
  // Settings = a profile card + grouped list rows. A row opens its own sheet (same fields and ids as before, so every handler still works).
  S.setBodies = {};
  const row = (id, icon, title, sub, body) => { S.setBodies[id] = { title: title.replace(/<[^>]*>/g, ''), body };
    return `<button class="srow" type="button" data-setrow="${id}"><span class="sri">${ic(icon, 20)}</span><span class="srt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="chev">${ic('chev', 18)}</span></button>`; };
  const act = (id, icon, title, sub) => `<button class="srow" type="button" id="${id}"><span class="sri">${ic(icon, 20)}</span><span class="srt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="chev">${ic('chev', 18)}</span></button>`;
  const grp = (title, rows) => rows.filter(Boolean).length ? `<div class="sgrp"><div class="sgt">${title}</div><div class="slist">${rows.filter(Boolean).join('')}</div></div>` : '';
  const sess = S.session, dl = syncDaysLeft(), planTxt = live && !sess.admin && sess.plan_name ? esc(sess.plan_name) + (sess.trial && dl !== null && dl >= 0 ? ' · ' + t('sg_days_left').replace('{n}', dl) : '') : '';
  const planBody = live && !sess.admin ? `<div class="balbox"><span>${t('sg_plan')}</span><b>${esc(sess.plan_name || '—')}</b></div>
      ${dl !== null ? `<div class="${dl <= 7 ? 'warn' : 'muted'}" class="u-m-8n0">${syncExpiryText()}</div>` : ''}
      ${sess.max_products > 0 ? `<div class="muted">${t('tab_products')}: ${sess.max_products}</div>` : ''}${sess.max_bills > 0 ? `<div class="muted">${t('tab_sales')}: ${sess.max_bills}</div>` : ''}
      <div class="muted u-m-10n0">${t('sg_upgrade_note')}</div>
      <button class="btn block" type="button" data-setact="contact">${ic('chat', 18)} ${t('ct_btn')}</button>` : '';
  const installRow = (typeof exInstallBtn === 'function' && exInstallBtn()) ? `<button class="installcard" type="button" id="btn-install"><span class="sri">${ic('download', 22)}</span><span class="srt"><b>${t('in_btn')}</b><small>${t('sg_install_sub')}</small></span></button>` : '';
  $('view-settings').innerHTML = `
    <div class="pcard" id="pcard-open" role="button" tabindex="0" aria-label="${t('pp_view')}">
      <div><label class="avatar u-w-68 u-h-68 u-cur-pointer" id="set-avatar" for="avatar-file"  title="${t('pf_change')}" aria-label="${t('pf_change')}">${avatarHtml(32, 'user')}</label><input type="file" id="avatar-file" accept="image/*" hidden></div>
      <div class="grow">
        <div class="pname">${esc(sess.user_name || sess.shop_name)}</div>
        <div class="pshop">${esc(sess.shop_name)}</div>
        <div class="pchips"><span class="pchip">${t(sess.role)}</span>${planTxt ? `<span class="pchip plan">${planTxt}</span>` : ''}<span class="pchip ph" dir="ltr">${esc(displayLogin(sess.email))}</span></div>
        <div class="u-mt-6"><label class="plink" for="avatar-file">${t('pf_change')}</label> <button class="plink" type="button" id="btn-avatar-del" ${S.avatar ? '' : 'hidden'}>${t('pf_remove')}</button></div>
      </div>
      <span class="pgo">${ic('chev', 20)}</span>
    </div>
    ${installRow}
    ${(window.POS_DEMO || sess.admin) ? `<div class="sgrp"><div class="slist"><button class="srow" type="button" id="btn-sa-open"><span class="sri">${ic('shield', 20)}</span><span class="srt"><b>${t('sa_open')}</b></span><span class="chev">${ic('chev', 18)}</span></button></div></div>` : ''}
    ${grp(t('sg_shop'), [bizBody ? row('biz', 'box', t('set_sec_biz'), bizSub, bizBody) : '', row('billing', 'receipt', t('set_sec_billing'), `${t('tax')} ${num(c.tax_rate)}%`, billing), row('receipt', 'print', t('set_sec_receipt'), `<bdi dir="ltr">${c.paper === 'a4' ? 'A4' : c.paper + ' mm'}</bdi>`, receipt)])}
    ${grp(t('sg_app'), [row('look', 'settings', t('set_sec_look'), `${c.lang === 'ur' ? 'اردو' : 'English'} · ${themeName(c.theme)}`, look), row('notif', 'bell', t('ex_notif_sec'), '', await exNotifBodyHtml())])}
    ${grp(t('sg_data'), [row('data', 'download', t('set_sec_data') + warnDot, live ? `${t('pending')}: ${nPend}` : '', data), account ? row('account', 'user', t('set_sec_account'), '', account) : ''])}
    ${planBody ? grp(t('sg_sub'), [row('plan', 'wallet', t('sg_plan'), planTxt, planBody)]) : ''}
    ${grp(t('sg_help'), [act('btn-contact', 'chat', t('ct_btn'), ''), act('btn-help', 'help', t('help_btn'), ''), act('btn-about', 'help', t('ab_btn'), ''), row('legal', 'shield', t('lg_sec'), `v${LEGAL_CFG.version}`, legalListHtml(await getSetting(termsKey(), null)))])}
    <button class="btn secondary block logoutbtn" id="btn-logout">${ic('logout', 18)} ${t('logout')}</button>
    <div class="appver">${t('app_name')}${typeof CT_APP_VERSION !== 'undefined' ? ' · v' + esc(CT_APP_VERSION) : ''}</div>`;
  if (S.setSheet && !$('modal').hidden && S.setBodies[S.setSheet]) openSettingSheet(S.setSheet);   // a re-render (language, save...) refreshes the open sheet
  if (typeof syncUi === 'function') syncUi();
  if (typeof ctPaint === 'function') ctPaint();
}

// ───────── Settings: row -> sheet ─────────
function openSettingSheet(id) {
  const b = S.setBodies && S.setBodies[id]; if (!b) return;
  S.setSheet = id;
  openModal(`<h2 class="u-mt-0">${esc(b.title)}</h2><div class="sbody">${b.body}</div><div class="u-mt-12"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
  if (typeof syncUi === 'function') syncUi();
}
document.addEventListener('click', ev => {
  const r = ev.target.closest('[data-setrow]'); if (r) return openSettingSheet(r.dataset.setrow);
  if (ev.target.closest('[data-setact="contact"]')) { closeModal(); if (typeof ctOpen === 'function') ctOpen(); }
});

// Business type picked in Settings (the catalog's own picker uses data-cat-type; this one only saves the type, it does not open the catalog)
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-biz-type]'); if (!b || b.disabled || typeof catalogSetType !== 'function') return;
  const shop = S.session.shop_id;
  await catalogSetType(shop, b.dataset.bizType); await setSetting('catalog_prompted_' + shop, true);
  toast(t('biz_saved'), 2000); renderSettings(); if (S.tab === 'products') renderProducts();
});

// Bill style (premium / classic / modern): shared by every phone of the shop (owner / manager choose it)
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-rstyle]'); if (!b || b.disabled) return;
  await saveCfg('receipt_style', b.dataset.rstyle); if (typeof shopCfgChanged === 'function') shopCfgChanged(); renderSettings();
});

// Theme picker (swatches)
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-theme-pick]'); if (!b) return;
  await saveCfg('theme', b.dataset.themePick); applyTheme(); renderSettings();
});

onUI('click', 70, async ev => {
  const el = ev.target;
  if (el.closest('#btn-verify')) { openVerify(); return true; }
  if (el.closest('#btn-avatar-del')) { avatarSet(''); return true; }
  if (el.closest('#btn-pw')) {
    const oldp = $('set-oldpw').value, newp = $('set-newpw').value;
    if (!oldp) { toast(t('cur_password'), 3000); return true; }
    if (newp.length < 6) { toast(t('pw_short'), 3500); return true; }
    if (!(await pingServer())) { toast(t('login_need_online'), 3500); return true; }
    try {
      const sb = getSb();
      const { error: e1 } = await sb.auth.signInWithPassword({ email: S.session.email, password: oldp });
      if (e1) throw new Error(t('login_failed'));
      const { error: e2 } = await sb.auth.updateUser({ password: newp });
      if (e2) throw new Error(e2.message);
      $('set-oldpw').value = ''; $('set-newpw').value = ''; toast(t('saved'));
    } catch (e) { toast(e.message || t('err_generic'), 4500); }
    return true;
  }
  if (el.closest('#btn-phone')) {
    let email; try { email = loginIdToEmail($('set-newphone').value); } catch (e) { toast(e.message, 3500); return true; }
    const pw = $('set-phonepw').value; if (!pw) { toast(t('cur_password'), 3000); return true; }
    if (!(await pingServer())) { toast(t('login_need_online'), 3500); return true; }
    if (!await askConfirm(t('phone_confirm') + '\n' + displayLogin(email))) { return true; }
    try {
      const { data, error } = await getSb().functions.invoke('admin-users', { body: { action: 'my_phone', phone: $('set-newphone').value, password: pw } });
      if (error || (data && data.error)) throw new Error((data && data.error) || error.message);
      S.session.email = data.email; await setSetting('session', S.session);
      toast(t('saved')); renderSettings();
    } catch (e) { toast(/bad_password/.test(e.message) ? t('login_failed') : t('err_generic') + ': ' + e.message, 4500); }
    return true;
  }
  if (el.closest('#btn-shopname')) {
    const name = $('set-shopname').value.trim();
    if (name.length < 2) { toast(t('err_generic')); return true; }
    if (!(await pingServer())) { toast(t('login_need_online'), 3500); return true; }
    try {
      const { error } = await getSb().rpc('rename_my_shop', { p_shop: S.session.shop_id, p_name: name });
      if (error) throw error;
      S.session.shop_name = name; await setSetting('session', S.session);
      $('hdr-shop').textContent = name; toast(t('saved'));
    } catch (e) { toast(t('err_generic') + ': ' + (e.message || ''), 4000); }
    return true;
  }
  if (el.closest('#btn-sync-now')) { toast(t('sync_running')); const r = await syncRun(); syncUi(); if (r && r.offline) toast(t('offline')); renderSettings(); return true; }
  if (el.closest('#btn-conflicts')) { syncShowConflicts(); return true; }
  if (el.closest('#btn-close-modal')) { closeModal(); renderSettings(); return true; }
  { const b = el.closest('[data-cf-ok],[data-cf-local]'); if (b) { syncResolveChoice(b.dataset.cfOk || b.dataset.cfLocal, !!b.dataset.cfLocal); return true; } }
  if (el.closest('#btn-import')) { $('import-file').click(); return true; }
  if (el.closest('#btn-sync-retry')) { await syncRetryFailed(); renderSettings(); return true; }
  if (el.closest('#btn-export')) {
    try {
      const blob = await exportAllData();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pos-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { toast(t('err_generic')); }
    return true;
  }
});

onUI('change', 70, async ev => {
  const id = ev.target.id;
  if (id === 'set-lang') { await saveCfg('lang', ev.target.value); setLang(ev.target.value); applyStaticText(); renderBillShell(); switchTab('settings'); return true; }
  if (id === 'import-file') {
    const f = ev.target.files[0]; if (!f) return;
    try { const n = await syncImportFile(f); toast(t('import_done').replace('{n}', n), 4000); renderSettings(); }
    catch (e) { toast(e.message || t('import_bad'), 4500); }
    ev.target.value = ''; return true; }
  if (id === 'set-theme') { await saveCfg('theme', ev.target.value); applyTheme(); return true; }
  if (isOwner() && id === 'set-tax') { await saveCfg('tax_rate', Math.max(0, num(ev.target.value))); return true; }
  if (isOwner() && id === 'set-cdisc') { await saveCfg('cashier_discount', ev.target.checked); return true; }
  if (isOwner() && id === 'set-oversell') { await saveCfg('allow_oversell', ev.target.checked); return true; }
  if (isOwner() && id === 'set-cprice') { await saveCfg('cashier_price', ev.target.checked); return true; }
  if (id === 'set-rh') { await saveCfg('receipt_header', ev.target.value); shopCfgChanged(); return true; }
  if (id === 'set-rf') { await saveCfg('receipt_footer', ev.target.value); shopCfgChanged(); return true; }
  if (id === 'set-sp') { await saveCfg('shop_phone', ev.target.value.trim()); shopCfgChanged(); return true; }
  if (id === 'set-sa') { await saveCfg('shop_address', ev.target.value.trim()); shopCfgChanged(); return true; }
  if (id === 'set-sn') { await saveCfg('shop_tax_no', ev.target.value.trim()); shopCfgChanged(); return true; }
  if (id === 'avatar-file') {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try { await avatarSet(await avatarResize(f)); } catch (e) { toast(t('pf_bad'), 3500); } return true; }
  if (id === 'set-pcolor' || id === 'rc-color') { await saveCfg('print_color', ev.target.checked); const o = $(id === 'rc-color' ? 'set-pcolor' : 'rc-color'); if (o) o.checked = ev.target.checked; return true; }
  if (id === 'set-rqr') { await saveCfg('receipt_qr', ev.target.checked); return true; }
  if (id === 'set-pw') { await saveCfg('print_w', +ev.target.value || 0); return true; }
  if (id === 'set-paper') { await saveCfg('paper', ev.target.value === 'a4' ? 'a4' : +ev.target.value); return true; }
});


// ═════════ App rows of the Settings screen: install button, About, notification block (moved here from extras.js) ═════════
const APP_INFO = { version: '1.9.0', build: 'Stage 9' };
const INSTALL = { prompt: null };
const exStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const exIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');

// ───────── Install button ─────────
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL.prompt = e; if (S.session && S.tab === 'settings') renderSettings(); });
window.addEventListener('appinstalled', () => { INSTALL.prompt = null; toast(t('in_done')); if (S.session && S.tab === 'settings') renderSettings(); });
async function exInstall() {
  if (INSTALL.prompt) { INSTALL.prompt.prompt(); try { await INSTALL.prompt.userChoice; } catch (e) {} INSTALL.prompt = null; return; }
  openModal(`<h2>${t('in_btn')}</h2><p>${exIOS() ? t('in_ios') : t('in_other')}</p><button class="btn secondary block" data-close>${t('close')}</button>`);
}
const exInstallBtn = () => (window.POS_DEMO && location.protocol === 'file:') || exStandalone() ? '' : `<button class="btn secondary block u-mb-10" id="btn-install">${ic('download', 18)} ${t('in_btn')}</button>`;

// ───────── About ─────────
async function exAbout() {
  const s = S.session, ph = await ctApi.phone(), wa = waNumber(ph), pend = (await pendingCount()) + (await failedCount());
  const row = (l, v) => `<div class="kv"><span>${l}</span><b class="u-user-select-text">${v}</b></div>`;
  const exp = s.expires_at ? new Date(s.expires_at).toLocaleDateString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'medium' }) : '—';
  openModal(`<h2>${t('ab_title')}</h2>
    <div class="u-ta-center u-m-6n0n10"><img src="icon-192.png" alt="" width="72" height="72" class="u-br-18"><div><b>${t('app_name')}</b></div></div>
    <div class="card totals">
      ${row(t('ab_version'), `${APP_INFO.version} (${APP_INFO.build})`)}
      ${row(t('shop'), esc(s.shop_name || '—'))}
      ${row(t('role'), `${esc(s.user_name || '')} · ${t(s.role)}`)}
      ${window.POS_DEMO ? row(t('ab_plan'), t('ab_demo')) : `${row(t('ab_plan'), esc(s.plan_name || '—'))}${row(t('ab_expiry'), esc(exp))}`}
      ${row(t('ab_status'), `${S.online ? t('online') : t('offline')} · ${t('ab_pending')}: ${pend}`)}
      ${row(t('ab_mode'), exStandalone() ? t('yes') : t('ab_browser'))}
      ${row(t('ab_device'), `<span dir="ltr">${esc(String(S.deviceId || '').slice(0, 8))}</span>`)}
    </div>
    ${ph ? `<div class="sa-sec">${t('ab_support')}</div><div class="row u-mb-10"><a class="btn secondary grow lnk" href="tel:${esc(ph)}" dir="ltr">${ic('phone', 18)} ${esc(ph)}</a>${wa ? `<a class="btn secondary lnk" target="_blank" rel="noopener" href="https://wa.me/${wa}">${ic('chat', 18)}</a>` : ''}</div>` : ''}
    <button class="btn secondary block" data-close>${t('close')}</button>`);
}

// ───────── Sync conflicts: review screen (opened from Settings > Sync & data; the resolving itself is syncResolveChoice() in sync.js) ─────────
const conflictLabel = r => r ? (r.name || r.invoice_no || r.product_name || (r.id || '').slice(0, 8)) : '—';
async function syncShowConflicts() {
  const list = await db.conflicts.filter(c => !c.resolved_at).toArray();
  openModal(`<h3>${t('sync_conflicts')}</h3>` + (list.length ? list.map(c => `
    <div class="card u-mb-8"><b>${esc(c.table_name)}</b> · ${esc(conflictLabel(c.server || c.local))}
      <div class="muted">${t('cf_local')}: ${esc(fmtDate(c.local && c.local.updated_at))} · ${t('cf_server')}: ${esc(fmtDate(c.server && c.server.updated_at))}</div>
      <div class="u-d-flex u-gap-8 u-mt-8">
        <button class="btn secondary grow" data-cf-ok="${c.id}">${t('cf_keep_server')}</button>
        <button class="btn grow" data-cf-local="${c.id}">${t('cf_keep_local')}</button>
      </div></div>`).join('') : `<div class="muted">${t('cf_none')}</div>`) +
    `<button class="btn secondary block" id="btn-close-modal">${t('cancel')}</button>`);
}
// ───────── Settings: notification block ─────────
async function exNotifBodyHtml() {
  const off = await getSetting('ex_alerts_off', false);
  return `${typeof pushCardHtml === 'function' ? await pushCardHtml() : ''}
    <label class="u-mt-12"><input type="checkbox" id="set-exalerts" class="u-w-auto u-minh-0" ${off ? '' : 'checked'}> ${t('ex_alerts')}</label>
    <div class="muted">${t('ex_alerts_note')}</div>`;
}

document.addEventListener('click', ev => {
  const el = ev.target;
  if (el.closest('#btn-install')) return exInstall();
  if (el.closest('#btn-about')) return exAbout();
});
document.addEventListener('change', async ev => { if (ev.target.id === 'set-exalerts') { await setSetting('ex_alerts_off', !ev.target.checked); if (ev.target.checked) exCheck(); } });
