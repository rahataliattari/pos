// Universal POS — Home screen: today / udhaar / payable cards, alerts banner (low stock, subscription) and the module grid.

async function renderHome() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const sum = await salesSummary(S.session.shop_id, start.toISOString(), end.toISOString());
  const cs = await creditSummary(S.session.shop_id);
  const ps = canPurchase() ? await payableSummary(S.session.shop_id) : { suppliers: 0 };
  // Only screens that are NOT in the bottom bar (Home, Products, Bill, Sales, Settings are already there).
  const allMods = [
    { tab: 'customers', ic: 'users', l: 'mod_customers' }, { tab: 'purchases', ic: 'truck', l: 'mod_purchases' },
    { tab: 'expenses', ic: 'wallet', l: 'mod_expenses' }, { tab: 'reports', ic: 'chart', l: 'mod_reports' }
  ];
  const dateStr = new Date().toLocaleDateString(LANG === 'ur' ? 'ur-PK' : 'en-GB', { dateStyle: 'full' });
  const demoBanner = typeof demoBannerHtml === 'function' ? await demoBannerHtml() : '';
  const mods = allMods.filter(m => typeof planAllows !== 'function' || planAllows(m.tab));
  $('view-home').innerHTML = `${demoBanner}
    <div class="today"><div class="cal">${ic('calendar', 24)}</div>
      <div class="grow"><div class="muted">${esc(dateStr)}</div>
        <div class="big">Rs ${money(sum.total)}</div>
        <div class="muted">${t('today_sales')} · ${sum.count} ${t('bills_n')}</div></div></div>
    ${cs.customers ? `<div class="udcard u-cur-pointer" data-tab="customers"><div class="udic">${ic('wallet', 24)}</div>
      <div class="grow"><div class="muted">${t('total_udhaar')}</div><div class="big">Rs ${money(cs.total)}</div>
        <div class="muted">${cs.count} ${t('owes_n')}</div></div></div>` : ''}
    ${ps.suppliers ? `<div class="udcard pay u-cur-pointer" data-tab="purchases"><div class="udic">${ic('truck', 24)}</div>
      <div class="grow"><div class="muted">${t('total_payable')}</div><div class="big">Rs ${money(ps.total)}</div>
        <div class="muted">${ps.count} ${t('owed_n')}</div></div></div>` : ''}
    ${typeof exBannerHtml === 'function' ? exBannerHtml() : ''}
    ${mods.length ? `<div class="mods">${mods.map(m => `<button class="mod" data-tab="${m.tab}"><span class="mi">${ic(m.ic, 28)}</span>${t(m.l)}</button>`).join('')}</div>` : ''}`;
}


// ═════════ Home alerts: low stock / subscription expiry banner + daily phone notification (moved here from extras.js) ═════════
const EX = { alerts: { low: 0, names: [], days: null } };

// ───────── Low-stock / subscription alerts ─────────
async function exLowStock() {
  const sid = S.session.shop_id;
  const all = await db.products.where('[shop_id+name]').between([sid, ''], [sid, '￿']).filter(p => !p.deleted_at && p.is_active !== false && p.min_stock > 0).toArray();
  const st = await getStocks(sid, all.map(p => p.id));
  return all.filter(p => st[p.id] <= p.min_stock);
}
async function exLocalNotify(title, body, tag) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, icon: 'icon-192.png', badge: 'icon-192.png', tag, lang: 'ur', dir: 'auto', data: { kind: 'local' } };
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg && reg.showNotification) await reg.showNotification(title, opts); else new Notification(title, opts);
  } catch (e) {}
}
async function exCheck() {
  if (!S.session) return;
  try {
    const low = await exLowStock(), d = window.POS_DEMO ? null : syncDaysLeft();
    EX.alerts = { low: low.length, names: low.slice(0, 3).map(p => (LANG === 'ur' && p.name_ur ? p.name_ur : p.name)), days: d !== null && d <= 7 ? d : null };
    if (S.tab === 'home') renderHome();
    if (await getSetting('ex_alerts_off', false)) return;
    const today = new Date().toISOString().slice(0, 10);
    if (EX.alerts.low && (await getSetting('ex_n_low', '')) !== today) {
      await setSetting('ex_n_low', today);
      exLocalNotify(t('ex_low_title'), t('ex_low_body').replace('{n}', EX.alerts.low).replace('{names}', EX.alerts.names.join('، ')), 'low-stock');
    }
    if (EX.alerts.days !== null && (await getSetting('ex_n_exp', '')) !== today) {
      await setSetting('ex_n_exp', today);
      exLocalNotify(t('ex_exp_title'), EX.alerts.days <= 0 ? t('ex_exp_today') : t('ex_exp_body').replace('{n}', EX.alerts.days), 'sub-expiry');
    }
  } catch (e) {}
}
function exBannerHtml() {
  const a = EX.alerts, out = [];
  if (a.low) out.push(`<div class="warn u-m-0n0n10 u-p-8n12 u-d-flex u-gap-8 u-ai-center"  data-tab="${canReports() ? 'reports' : 'products'}" role="button">${ic('box', 18)}<span class="grow">${t('ex_low_body').replace('{n}', a.low).replace('{names}', esc(a.names.join('، ')))}</span><b>${t('ex_see')}</b></div>`);
  if (a.days !== null) out.push(`<div class="warn u-m-0n0n10 u-p-8n12 u-d-flex u-gap-8 u-ai-center" id="ex-exp" role="button">${ic('clock', 18)}<span class="grow">${a.days <= 0 ? t('ex_exp_today') : t('ex_exp_body').replace('{n}', a.days)}</span><b>${t('ex_contact')}</b></div>`);
  return out.join('');
}
function exStartup() {
  exCheck();
  if (!exStartup._t) exStartup._t = setInterval(exCheck, 3 * 3600e3);
  const q = new URLSearchParams(location.search);              // opened from a push notification while the app was closed
  if (q.get('push') && !exStartup._q) { exStartup._q = true; setTimeout(() => { if (S.session) ctOpen(); }, 800); history.replaceState(null, '', location.pathname); }
}

document.addEventListener('click', ev => { if (ev.target.closest('#ex-exp')) return ctOpen(); });
