// Edge Function: signup — نیا ڈیمو اکاؤنٹ (دکان + مالک). لاگ اِن کے بغیر کال ہوتی ہے.
// Deploy:  supabase functions deploy signup --no-verify-jwt
// Service-role key صرف یہیں (سرور پر) رہتی ہے. سپر ایڈمن کی سیٹنگز (signup_enabled، منظوری، ڈیمو پلان/دن، روزانہ حد) یہاں نافذ ہوتی ہیں.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, s = 400) => json({ error: code }, s);
const DOMAIN = Deno.env.get('LOGIN_DOMAIN') ?? 'pos-login.app';
const IP_PER_HOUR = 5;
const toEmail = (p: string) => {
  let d = String(p || '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6F0)).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  else if (d.length === 10 && d.startsWith('3')) d = '92' + d;
  if (!/^923\d{9}$/.test(d)) throw new Error('bad_phone');
  return { email: `${d}@${DOMAIN}`, phone: '0' + d.slice(2) };
};
const clean = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('method', 405);
  let created: string | null = null;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const b = await req.json();
    if (b.website) return json({ ok: true, pending: true });                 // honeypot: بوٹس یہ خانہ بھر دیتے ہیں، انہیں جھوٹی کامیابی دکھائیں

    const { data: st } = await admin.from('platform_settings').select('*').eq('id', 1).maybeSingle();
    if (!st || !st.signup_enabled) return fail('signup_closed', 403);

    const name = clean(b.shop_name, 80), owner = clean(b.owner_name, 60), city = clean(b.city, 40), password = String(b.password ?? '');
    if (name.length < 2 || owner.length < 2) return fail('bad_input');
    if (password.length < 6 || password.length > 72) return fail('bad_password');
    let id; try { id = toEmail(b.phone); } catch { return fail('bad_phone'); }

    // فی IP: ایک گھنٹے میں زیادہ سے زیادہ IP_PER_HOUR کوششیں
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim().slice(0, 64);
    const since = new Date(Date.now() - 3600e3).toISOString();
    const { count: tries } = await admin.from('signup_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('at', since);
    if ((tries ?? 0) >= IP_PER_HOUR) return fail('too_many', 429);
    await admin.from('signup_attempts').insert({ ip });

    // پلیٹ فارم کی روزانہ حد
    const day = new Date(Date.now() - 864e5).toISOString();
    const { count: today } = await admin.from('shops').select('id', { count: 'exact', head: true }).eq('source', 'signup').gte('created_at', day);
    if (st.signup_daily_limit > 0 && (today ?? 0) >= st.signup_daily_limit) return fail('signup_busy', 429);

    const { data: plan } = await admin.from('plans').select('id').eq('id', st.signup_plan).maybeSingle();
    if (!plan) return fail('no_demo_plan', 500);

    const pending = st.signup_approval !== false;
    const { data: u, error: ue } = await admin.auth.admin.createUser({ email: id.email, password, email_confirm: true });
    if (ue || !u?.user) return fail(/already|registered|exists/i.test(ue?.message || '') ? 'phone_exists' : 'create_failed');
    created = u.user.id;

    const shopId = crypto.randomUUID();
    const days = Math.max(0, Number(st.demo_days) || 0);
    const { error: se } = await admin.from('shops').insert({
      id: shopId, name, owner_name: owner, phone: id.phone, city, plan_id: plan.id, trial: true, source: 'signup',
      approval: pending ? 'pending' : 'approved', expires_at: new Date(Date.now() + days * 864e5).toISOString()
    });
    if (se) throw new Error(se.message);
    const { error: me } = await admin.from('shop_members').insert({ shop_id: shopId, user_id: created, name: owner, phone: id.phone, role: 'owner', active: true });
    if (me) { await admin.from('shops').delete().eq('id', shopId); throw new Error(me.message); }
    await admin.from('audit_log').insert({ id: crypto.randomUUID(), actor: 'signup', action: 'signup_new', target: name, detail: id.phone });
    created = null;                                                            // کامیاب: rollback نہیں چاہیے
    return json({ ok: true, pending, days });
  } catch (e) {
    if (created) { try { await admin.auth.admin.deleteUser(created); } catch (_) { /* best effort */ } }
    return fail('server: ' + String((e as Error).message || e), 500);
  }
});
