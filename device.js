// Universal POS — device limit: one login ID works on the number of devices its plan allows (default 1).
// Enforced on the SERVER (see supabase/schema.sql: register_device / sync_check_device). This file only registers the device and shows the messages.
// Super Admin is never limited.
function deviceName() {
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  const model = (ua.match(/Android[^;]*;\s*([^;)]+)/) || [])[1];
  return [os, model && !/^Build/.test(model) ? model.trim() : '', br].filter(Boolean).join(' · ').slice(0, 80);
}

// Throws an Error (with .deviceBlocked = true) when the server refuses this device. Returns true otherwise.
async function deviceRegister(sb, session) {
  if (window.POS_DEMO || !session || session.admin) return true;
  const id = S.deviceId || (S.deviceId = await getDeviceId());
  const { error } = await sb.rpc('register_device', { p_shop: session.shop_id, p_device: id, p_name: deviceName() });
  if (!error) return true;
  const m = String(error.message || '') + ' ' + (error.code || '');
  if (/PGRST202|Could not find the function|schema cache/i.test(m)) return true;     // server not updated yet: don't lock anyone out
  const key = /device_limit/.test(m) ? 'dev_limit' : /device_revoked/.test(m) ? 'dev_revoked' : /device_login_again/.test(m) ? 'dev_login_again' : null;
  if (key) { const e = new Error(t(key)); e.deviceBlocked = true; throw e; }
  throw error;
}
function deviceErrText(m) { return /device_revoked/.test(m) ? t('dev_revoked') : t('dev_limit'); }

// Used when the server stops this device while the app is running (reset by Super Admin, or limit reached).
async function deviceKick(msg) {
  try { if (S.sb) await S.sb.auth.signOut(); } catch (e) {}
  await delSetting('session'); await delSetting('shop_id');
  S.session = null; S.cart = []; S.saleCust = null; S.pur = null;
  showLogin();
  const el = $('login-err'); if (el) { el.textContent = msg; el.hidden = false; }
  return { error: 'device_blocked' };
}
