// Universal POS — the announcement shown in the sync bar. Small, so it lives in the main bundle for every user;
// the Super Admin editor for announcements is in superadmin.js (loaded only for platform admins).
function saAnnouncement() {
  if (!window.POS_DEMO) return window.SA_ANN || '';
  try { const L = saLoad().announcements.filter(x => x.active), me = S.session && S.session.shop_id, a = L.find(x => x.shop_id && x.shop_id === me) || L.find(x => !x.shop_id); return a ? a.text : ''; } catch (e) { return ''; }
}

async function saLoadAnnouncement() {   // shop users see the active announcement in the sync bar
  if (window.POS_DEMO) return;
  let { data, error } = await getSb().from('announcements').select('text, shop_id').eq('active', true).order('at', { ascending: false }).limit(10);
  if (error) ({ data } = await getSb().from('announcements').select('text').eq('active', true).order('at', { ascending: false }).limit(1));   // old database without announcements.shop_id (before migration 17)
  const me = S.session && S.session.shop_id, a = (data || []).find(x => x.shop_id && x.shop_id === me) || (data || []).find(x => !x.shop_id);
  window.SA_ANN = a ? a.text : '';
  $('syncnote').textContent = window.SA_ANN || t('sync_note');
}
