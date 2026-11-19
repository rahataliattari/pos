-- Universal POS — (1) صارف کی سرگرمی (کون سی اسکرین / کون سا بٹن) سپر ایڈمن ڈیش بورڈ کے لیے، (2) غیر فعال صارفین کو یاد دہانی، (3) بل کا انداز سب فونز پر یکساں.
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 16_push.sql اور 18_signup.sql کے بعد.
-- رازداری: صرف اسکرین/بٹن کے نام لکھے جاتے ہیں (مثلاً "tab:sales"، "#btn-print"). رقم، کسٹمر، پروڈکٹ یا کوئی ٹائپ کیا ہوا متن کبھی نہیں. 30 دن بعد خود مٹ جاتا ہے.

-- 1) پلیٹ فارم سیٹنگز: کتنے دن بعد یاد دہانی (0 = بند) اور اپنا میٹھا پیغام (خالی = ڈیفالٹ). {name} اور {shop} بدل جاتے ہیں.
alter table public.platform_settings
  add column if not exists inactive_days int not null default 5,
  add column if not exists inactive_message text not null default '';

alter table public.shop_members add column if not exists last_nudge_at timestamptz;

-- 2) سرگرمی کا لاگ
create table if not exists public.activity_log (
  id bigserial primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null,
  user_name text not null default '',
  kind text not null default 'c',            -- s = اسکرین، c = کلک
  name text not null,
  at timestamptz not null default now()
);
create index if not exists activity_log_user_at on public.activity_log (user_id, at desc);
create index if not exists activity_log_at on public.activity_log (at desc);
alter table public.activity_log enable row level security;
drop policy if exists sa_all on public.activity_log;
create policy sa_all on public.activity_log for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ایپ ہر کچھ دیر بعد جمع شدہ واقعات بھیجتی ہے؛ ساتھ ہی last_login تازہ ہوتا ہے (5 دن والی گنتی اسی سے)
create or replace function public.activity_push(p_shop uuid, p_events jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m record; e jsonb; n int := 0; ts timestamptz;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select sm.name as uname into m from public.shop_members sm where sm.shop_id = p_shop and sm.user_id = uid and sm.active limit 1;
  if not found then return; end if;
  update public.shop_members set last_login = now() where shop_id = p_shop and user_id = uid;
  if jsonb_typeof(p_events) <> 'array' then return; end if;
  for e in select * from jsonb_array_elements(p_events) loop
    exit when n >= 100;
    if coalesce(e->>'n', '') = '' then continue; end if;
    begin ts := least(now(), greatest(now() - interval '2 days', (e->>'at')::timestamptz)); exception when others then ts := now(); end;
    insert into public.activity_log (shop_id, user_id, user_name, kind, name, at)
      values (p_shop, uid, coalesce(m.uname, ''), case when e->>'k' = 's' then 's' else 'c' end, left(regexp_replace(e->>'n', '[^A-Za-z0-9_:#.\-]', '', 'g'), 40), ts);
    n := n + 1;
  end loop;
  delete from public.activity_log where shop_id = p_shop and at < now() - interval '30 days';
end $$;
grant execute on function public.activity_push(uuid, jsonb) to authenticated;

-- 3) بل کا انداز (premium / classic / modern) بھی دکان کی مشترکہ سیٹنگز میں
create or replace function public.save_shop_settings(p_shop uuid, p_settings jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare clean jsonb := '{}'::jsonb; k text;
begin
  perform public.sync_check_access(p_shop);
  if coalesce(public.sync_role(p_shop), '') not in ('owner', 'manager') then
    raise exception 'owner_or_manager_only' using errcode = '42501';
  end if;
  foreach k in array array['receipt_header', 'receipt_footer', 'shop_phone', 'shop_address', 'shop_tax_no'] loop
    if p_settings ? k then clean := clean || jsonb_build_object(k, left(coalesce(p_settings->>k, ''), 300)); end if;
  end loop;
  if (p_settings->>'receipt_style') in ('premium', 'classic', 'modern') then clean := clean || jsonb_build_object('receipt_style', p_settings->>'receipt_style'); end if;
  update public.shops set settings = coalesce(settings, '{}'::jsonb) || clean where id = p_shop;
end $$;
grant execute on function public.save_shop_settings(uuid, jsonb) to authenticated;

-- 4) خودکار روزانہ یاد دہانی (اختیاری). expiry_sweep کی طرح، ایک بار اس کی SQL چلائیں:
--    select cron.schedule('inactive-sweep', '0 5 * * *', $$ select net.http_post(
--      url := 'https://<PROJECT>.supabase.co/functions/v1/push-notify',
--      headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--      body := '{"action":"inactive_sweep"}'::jsonb) $$);
--    (روزانہ صبح 10 بجے پاکستان وقت). ہاتھ سے بھیجنے کے لیے سپر ایڈمن ڈیش بورڈ میں بٹن موجود ہیں.
notify pgrst, 'reload schema';
