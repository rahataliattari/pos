// Universal POS — account holder's profile picture.
// Stored on this phone (works offline) and, when online, on the server (shop_members.avatar) so Super Admin can see it.
const PFS = {
  pf_title: ['پروفائل تصویر', 'Profile picture'], pf_change: ['تصویر بدلیں', 'Change photo'], pf_remove: ['تصویر ہٹائیں', 'Remove photo'],
  pf_bad: ['تصویر نہیں کھل سکی', 'Could not read the image'], pf_offline: ['تصویر فون میں محفوظ ہو گئی، انٹرنیٹ آنے پر سرور پر جائے گی', 'Saved on this phone; it will upload when online']
};
for (const k in PFS) { I18N.ur[k] = PFS[k][0]; I18N.en[k] = PFS[k][1]; }

const avKey = () => 'avatar_' + ((S.session && S.session.user_id) || 'demo');
async function avatarLoad() { S.avatar = S.session ? await getSetting(avKey(), '') : ''; }
const avatarHtml = (size = 24, fallback = 'store') => (S.avatar ? `<img src="${S.avatar}" alt="">` : ic(fallback, size));
function avatarRefreshUi() {
  const h = $('hdr-avatar'); if (h) h.innerHTML = avatarHtml(24);
  const a = $('set-avatar'); if (a) a.innerHTML = avatarHtml(30, 'user');
  const d = $('btn-avatar-del'); if (d) d.hidden = !S.avatar;
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
