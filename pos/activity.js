// Universal POS — صارف کی سرگرمی (کون سی اسکرین دیکھی / کون سا بٹن دبایا) سپر ایڈمن ڈیش بورڈ کے لیے.
// Loaded BEFORE app.js. صرف اسکرین/بٹن کے نام (مثلاً "tab:sales"، "#btn-print") بھیجے جاتے ہیں — رقم، کسٹمر، پروڈکٹ یا ٹائپ کیا متن کبھی نہیں.
// سرور: supabase/schema.sql (activity_push). ایپ آف لائن ہو تو واقعات فون میں جمع رہتے ہیں اور بعد میں چلے جاتے ہیں.
const ACT_KEY = 'pos_act_q_v1', ACT_MAX = 300, ACT_BATCH = 25, ACT_EVERY = 45000;
const ACT = { q: [], last: '', lastAt: 0, off: false, busy: false };
try { ACT.q = JSON.parse(localStorage.getItem(ACT_KEY) || '[]').slice(-ACT_MAX); } catch (e) {}
const actOn = () => !window.POS_DEMO && typeof S !== 'undefined' && S.session && !S.session.admin && S.session.shop_id;
const actSave = () => { try { localStorage.setItem(ACT_KEY, JSON.stringify(ACT.q.slice(-ACT_MAX))); } catch (e) {} };

function actLog(kind, name) {                     // kind: 's' screen | 'c' click
  if (!actOn() || !name) return;
  const now = Date.now(), key = kind + name;
  if (key === ACT.last && now - ACT.lastAt < 3000) return;          // double tap / re-render
  ACT.last = key; ACT.lastAt = now;
  ACT.q.push({ k: kind, n: String(name).slice(0, 40), at: new Date(now).toISOString() });
  if (ACT.q.length > ACT_MAX) ACT.q.splice(0, ACT.q.length - ACT_MAX);
  actSave();
  if (ACT.q.length >= ACT_BATCH) actFlush();
}
async function actFlush() {
  if (!actOn() || ACT.off || ACT.busy || !ACT.q.length || !navigator.onLine) return;
  ACT.busy = true;
  const batch = ACT.q.slice(0, 100);
  try {
    const { error } = await getSb().rpc('activity_push', { p_shop: S.session.shop_id, p_events: batch });
    if (error) { if (/activity_push|schema cache|does not exist/i.test(error.message || '')) ACT.off = true; }    // SQL 20 not run yet: stay quiet
    else { ACT.q.splice(0, batch.length); actSave(); }
  } catch (e) { /* offline: try again later */ }
  ACT.busy = false;
}
// Which control was tapped — a fixed token only, never its text or any data inside it.
function actLabel(target) {
  const e = target.closest && target.closest('button, a[role="button"], [data-tab], [data-setrow], [data-ct], [data-sa], [data-add], [data-edit], [data-sale], [data-purseg], [data-opensup], [data-cat], [data-rp]');
  if (!e) return null;
  if (e.id) return '#' + e.id;
  const d = e.dataset || {};
  if (d.tab) return 'tab:' + d.tab; if (d.setrow) return 'row:' + d.setrow; if (d.purseg) return 'seg:' + d.purseg;
  if (d.ct) return 'ct:' + String(d.ct).split('|')[0]; if (d.sa) return 'sa:' + String(d.sa).split('|')[0];
  for (const k of ['add', 'edit', 'sale', 'opensup', 'cat', 'rp']) if (k in d) return 'tap:' + k;
  return null;
}
document.addEventListener('click', ev => { const l = actLabel(ev.target); if (l && !/^tab:/.test(l)) actLog('c', l); }, true);
setInterval(actFlush, ACT_EVERY);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') actFlush(); });
window.addEventListener('online', actFlush);
