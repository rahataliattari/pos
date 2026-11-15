// Edge Function: admin-users — auth یوزر بنانا / پاس ورڈ ری سیٹ / نمبر بدلنا / حذف کرنا۔
// صرف platform_admins کال کر سکتے ہیں۔ Service-role key صرف یہیں (سرور پر) رہتی ہے۔
// Deploy: supabase functions deploy admin-users
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const DOMAIN = Deno.env.get('LOGIN_DOMAIN') ?? 'pos-login.app';
const toEmail = (p: string) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d;
  if (!/^923\d{9}$/.test(d)) throw new Error('bad phone');
  return `${d}@${DOMAIN}`;
};
// the app sends the exact email its login screen will use, so a different LOGIN_DOMAIN secret here can never cause a mismatch
const pickEmail = (b: any) => { const e = String(b.email || '').trim().toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : toEmail(b.phone); };
const genPw = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; return [...crypto.getRandomValues(new Uint8Array(8))].map(b => c[b % c.length]).join(''); };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: u } = await caller.auth.getUser();
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const b = await req.json();
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (b.action === 'my_phone') {                     // {phone, password} — دکان کا مالک اپنا لاگ اِن نمبر خود بدلے (پاس ورڈ سے تصدیق)
      const { data: own } = await admin.from('shop_members').select('id').eq('user_id', u.user.id).eq('role', 'owner').eq('active', true).limit(1);
      if (!own?.length) return json({ error: 'owner_only' }, 403);
      const email = pickEmail(b);
      const probe = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
      const { error: pe } = await probe.auth.signInWithPassword({ email: u.user.email!, password: String(b.password || '') });
      if (pe) return json({ error: 'bad_password' }, 400);
      const { error } = await admin.auth.admin.updateUserById(u.user.id, { email, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      await admin.from('shop_members').update({ phone: b.phone }).eq('user_id', u.user.id);
      return json({ ok: true, email });
    }

    const { data: isAdmin } = await caller.rpc('is_platform_admin');
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    if (b.action === 'create') {                       // {member_id, shop_id, name, phone, role, active, password?}
      const email = pickEmail(b), password = b.password || genPw();
      const { data: ex } = await admin.from('shop_members').select('user_id').eq('phone', b.phone).maybeSingle();
      let user_id = ex?.user_id as string | undefined;
      if (!user_id) {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) return json({ error: error.message }, 400);
        user_id = data.user.id;
      } else {
        const { error } = await admin.auth.admin.updateUserById(user_id, { password, email, email_confirm: true });
        if (error) return json({ error: error.message }, 400);
      }
      // prove the account really works before the app shows the login details
      const probe2 = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
      const { error: pe2 } = await probe2.auth.signInWithPassword({ email, password });
      if (pe2) { if (!ex?.user_id) await admin.auth.admin.deleteUser(user_id); return json({ error: 'login_check_failed: ' + pe2.message + ' (' + email + ')' }, 400); }
      const { error: e2 } = await admin.from('shop_members').insert({ id: b.member_id, shop_id: b.shop_id, user_id, name: b.name, phone: b.phone, role: b.role, active: b.active !== false });
      if (e2) return json({ error: e2.message }, 400);
      return json({ user_id, password });
    }
    if (b.action === 'reset') {                        // {user_id, password?}
      const password = b.password || genPw();
      const upd: Record<string, unknown> = { password };
      if (b.email) { upd.email = pickEmail(b); upd.email_confirm = true; }      // also repairs accounts created with a wrong email
      const { error } = await admin.auth.admin.updateUserById(b.user_id, upd);
      if (error) return json({ error: error.message }, 400);
      return json({ password });
    }
    if (b.action === 'phone') {                        // {user_id, phone}
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { email: pickEmail(b), email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      await admin.from('shop_members').update({ phone: b.phone }).eq('user_id', b.user_id);
      return json({ ok: true });
    }
    if (b.action === 'ban') {                          // {user_id, banned} — غیر فعال اکاؤنٹ لاگ اِن نہ کر سکے
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { ban_duration: b.banned ? '876000h' : 'none' });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (b.action === 'delete') {                       // {member_id}
      const { data: m } = await admin.from('shop_members').select('user_id').eq('id', b.member_id).maybeSingle();
      await admin.from('shop_members').delete().eq('id', b.member_id);
      if (m?.user_id) {
        const { count } = await admin.from('shop_members').select('id', { count: 'exact', head: true }).eq('user_id', m.user_id);
        if (!count) await admin.auth.admin.deleteUser(m.user_id);
      }
      return json({ ok: true });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 400); }
});
