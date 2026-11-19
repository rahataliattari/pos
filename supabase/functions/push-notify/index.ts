// Edge Function: push-notify — Web Push بھیجتا ہے (سپورٹ پیغام، جواب، اعلان، پاس ورڈ درخواست، میعاد کی یاد دہانی).
// Deploy:  supabase functions deploy push-notify --no-verify-jwt
//   (--no-verify-jwt اس لیے کہ نئی sb_publishable key JWT نہیں ہوتی؛ نیچے ہر action اپنی تصدیق خود کرتا ہے)
// Secrets:  supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<لمبا خفیہ لفظ>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

type Sub = { endpoint: string; p256dh: string; auth: string };
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

async function send(subs: Sub[], payload: Record<string, unknown>) {
  let sent = 0;
  const body = JSON.stringify(payload);
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);   // phone removed / permission revoked
    }
  }));
  return sent;
}
const adminSubs = async () => (await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('is_admin', true)).data as Sub[];
const userSubs = async (userId: string) => (await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', userId)).data as Sub[];
const shopSubs = async (shopId: string | null) => {
  if (!shopId) return (await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('is_admin', false)).data as Sub[];
  const { data: m } = await admin.from('shop_members').select('user_id').eq('shop_id', shopId).eq('active', true);
  const ids = (m ?? []).map((x: { user_id: string }) => x.user_id);
  if (!ids.length) return [];
  return (await admin.from('push_subscriptions').select('endpoint,p256dh,auth').in('user_id', ids)).data as Sub[];
};


// میٹھی یاد دہانی کا ڈیفالٹ متن؛ سپر ایڈمن platform_settings.inactive_message سے بدل سکتا ہے. {name} اور {shop} بدل دیے جاتے ہیں.
const SWEET = 'السلام علیکم {name}! کچھ دنوں سے آپ کی دکان "{shop}" ایپ میں نظر نہیں آئی، ہمیں آپ کی کمی محسوس ہوئی۔ آج کا ایک بل بنا کر دیکھیں، آپ کا سارا حساب محفوظ اور تیار ہے۔ ہم ہمیشہ آپ کے ساتھ ہیں۔';
const sweet = (tpl: string, name: string, shop: string) => (tpl || SWEET).replaceAll('{name}', name || '').replaceAll('{shop}', shop || '').replace(/\s+/g, ' ').trim();
async function nudge(rows: { user_id: string; name: string; shop_name: string }[], tpl: string) {
  let sent = 0; const noPush: string[] = [];
  for (const r of rows) {
    const n = await send(await userSubs(r.user_id), { title: 'آپ کی دکان آپ کو یاد کر رہی ہے', body: clip(sweet(tpl, r.name, r.shop_name), 220), tag: 'nudge', kind: 'nudge' });
    if (n > 0) sent++; else noPush.push(r.user_id);
    await admin.from('shop_members').update({ last_nudge_at: new Date().toISOString() }).eq('user_id', r.user_id);
  }
  return { sent, noPush };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const b = await req.json();

    // 1) cron: دکانوں کی میعاد 3 دن یا کم میں ختم ہو رہی ہو (روزانہ ایک بار چلائیں)
    if (b.action === 'expiry_sweep') {
      if (!Deno.env.get('CRON_SECRET') || req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'forbidden' }, 403);
      const now = new Date(), soon = new Date(now.getTime() + 3 * 864e5);
      const { data: shops } = await admin.from('shops').select('id,name,expires_at').eq('suspended', false).eq('archived', false)
        .gte('expires_at', now.toISOString()).lte('expires_at', soon.toISOString());
      let n = 0;
      for (const s of shops ?? []) {
        const d = Math.max(0, Math.ceil((new Date(s.expires_at).getTime() - now.getTime()) / 864e5));
        n += await send(await shopSubs(s.id), { title: 'سبسکرپشن کی یاد دہانی', body: `"${s.name}" کی سبسکرپشن ${d} دن میں ختم ہو رہی ہے۔ تجدید کیلئے رابطہ کریں۔`, tag: 'expiry-' + s.id, kind: 'expiry' });
      }
      return json({ ok: true, shops: shops?.length ?? 0, sent: n });
    }

    // 1b) cron: جو صارف inactive_days (ڈیفالٹ 5) دن سے ایپ میں نہیں آیا اسے میٹھی یاد دہانی؛ ہر صارف کو ہر inactive_days دن میں زیادہ سے زیادہ ایک بار
    if (b.action === 'inactive_sweep') {
      if (!Deno.env.get('CRON_SECRET') || req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'forbidden' }, 403);
      const { data: st } = await admin.from('platform_settings').select('inactive_days,inactive_message').eq('id', 1).maybeSingle();
      const days = Number(st?.inactive_days ?? 5); if (!days) return json({ ok: true, off: true });
      const cut = new Date(Date.now() - days * 864e5).toISOString();
      const { data: ms } = await admin.from('shop_members').select('user_id,name,last_login,created_at,last_nudge_at,shops!inner(name,suspended,archived,expires_at,approval)')
        .eq('active', true).eq('shops.suspended', false).eq('shops.archived', false).eq('shops.approval', 'approved').gte('shops.expires_at', new Date().toISOString());
      const due = (ms ?? []).filter((m: any) => (m.last_login ?? m.created_at) < cut && (!m.last_nudge_at || m.last_nudge_at < cut))
        .map((m: any) => ({ user_id: m.user_id, name: m.name, shop_name: m.shops?.name ?? '' }));
      const r = await nudge(due, st?.inactive_message ?? '');
      return json({ ok: true, users: due.length, sent: r.sent });
    }

    // 2) پاس ورڈ بھول گئے: لاگ اِن سے پہلے صارف (anon) — صرف تازہ، نہ بھیجی گئی درخواست پر، ایک بار
    if (b.action === 'reset_request') {
      const { data: r } = await admin.from('password_reset_requests').select('id,phone,name,notified,created_at').eq('id', b.request_id).maybeSingle();
      if (!r || r.notified || Date.now() - new Date(r.created_at).getTime() > 10 * 60e3) return json({ ok: true, sent: 0 });
      await admin.from('password_reset_requests').update({ notified: true }).eq('id', r.id);
      return json({ ok: true, sent: await send(await adminSubs(), { title: 'پاس ورڈ ری سیٹ کی درخواست', body: `${r.name || ''} ${r.phone}`.trim(), tag: 'reset', kind: 'reset' }) });
    }

    // باقی سب کیلئے لاگ اِن ضروری
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: u } = await caller.auth.getUser();
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const { data: isAdmin } = await caller.rpc('is_platform_admin');

    // 3) صارف نے نیا پیغام بھیجا → سپر ایڈمنز کو
    if (b.action === 'ticket_new') {
      const { data: t } = await admin.from('support_tickets').select('id,user_id,subject,shop_name,user_name,kind').eq('id', b.ticket_id).maybeSingle();
      if (!t || t.user_id !== u.user.id) return json({ error: 'forbidden' }, 403);
      return json({ ok: true, sent: await send(await adminSubs(), { title: 'نیا صارف پیغام', body: `${t.shop_name}: ${t.subject}`, tag: 'ticket-' + t.id, kind: 'ticket', ticket_id: t.id }) });
    }

    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    // 4) سپر ایڈمن کا جواب → اسی صارف کو
    if (b.action === 'ticket_reply') {
      const { data: t } = await admin.from('support_tickets').select('id,user_id,subject').eq('id', b.ticket_id).maybeSingle();
      if (!t) return json({ error: 'not_found' }, 404);
      return json({ ok: true, sent: await send(await userSubs(t.user_id), { title: 'سپورٹ کی طرف سے جواب', body: t.subject, tag: 'ticket-' + t.id, kind: 'ticket', ticket_id: t.id }) });
    }
    // 5) اعلان (shop_id خالی = سب دکانیں) / کسی ایک دکان کو براہِ راست پیغام
    if (b.action === 'announce' || b.action === 'shop_push') {
      const title = b.action === 'announce' ? 'اعلان' : clip(b.title, 60) || 'Universal POS';
      const text = clip(b.action === 'announce' ? b.text : b.body, 200);
      if (!text) return json({ error: 'empty' }, 400);
      return json({ ok: true, sent: await send(await shopSubs(b.shop_id || null), { title, body: text, tag: 'ann', kind: 'announce' }) });
    }
    // 6) سپر ایڈمن: چنے ہوئے صارفین کو میٹھی یاد دہانی (جن کا پش بند ہے وہ no_push میں واپس آتے ہیں، تاکہ واٹس ایپ سے بھیجا جا سکے)
    if (b.action === 'user_nudge') {
      const ids = (Array.isArray(b.user_ids) ? b.user_ids : []).slice(0, 100).map(String);
      if (!ids.length) return json({ error: 'empty' }, 400);
      const { data: st } = await admin.from('platform_settings').select('inactive_message').eq('id', 1).maybeSingle();
      const { data: ms } = await admin.from('shop_members').select('user_id,name,shops(name)').in('user_id', ids).eq('active', true);
      const r = await nudge((ms ?? []).map((m: any) => ({ user_id: m.user_id, name: m.name, shop_name: m.shops?.name ?? '' })), st?.inactive_message ?? '');
      return json({ ok: true, sent: r.sent, no_push: r.noPush });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 400); }
});
