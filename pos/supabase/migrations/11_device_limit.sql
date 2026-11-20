-- Universal POS — ایک آئی ڈی (موبائل نمبر) = پلان کے مطابق محدود ڈیوائسز (ڈیفالٹ: ایک ہی ڈیوائس).
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 01 اور 02 کے بعد.
-- سپر ایڈمن (platform admin) پر کوئی حد نہیں۔
-- ⚠ اگر کبھی 02_sync.sql دوبارہ چلائیں تو اس کے بعد یہ فائل بھی دوبارہ چلائیں (sync_check_access واپس پرانا ہو جاتا ہے).
--
-- طریقہ: لاگ اِن پر ایپ register_device بلاتی ہے۔ اگر پلان کی حد پوری ہو چکی ہو تو نئی ڈیوائس پر لاگ اِن رک جاتا ہے۔
-- ڈیوائس گم/چوری ہو جائے تو سپر ایڈمن > صارفین > صارف میں ترمیم > "ڈیوائسز ری سیٹ" دبائے:
--   پرانی ڈیوائسز بند (revoked) ہو جاتی ہیں (سپر ایڈمن بعد میں "اجازت دیں" سے کھول سکتا ہے — 12_device_unblock.sql)، اس آئی ڈی کے سب لاگ اِن سیشن ختم ہو جاتے ہیں (پاس ورڈ بھی ساتھ بدل دیں)،
--   پھر صارف نئی ڈیوائس پر لاگ اِن کر سکتا ہے۔

alter table public.plans add column if not exists max_devices int not null default 1;   -- 0 = لامحدود

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shop_id uuid not null,
  device_id text not null,
  device_name text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  revoked boolean not null default false,
  unique (user_id, shop_id, device_id)
);
create table if not exists public.device_resets (user_id uuid primary key, at timestamptz not null default now());

alter table public.user_devices enable row level security;
alter table public.device_resets enable row level security;
drop policy if exists sa_all on public.user_devices;
create policy sa_all on public.user_devices for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists dev_self on public.user_devices;
create policy dev_self on public.user_devices for select to authenticated using (user_id = auth.uid());
drop policy if exists sa_all on public.device_resets;
create policy sa_all on public.device_resets for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ایپ ہر درخواست کے X-Client-Info ہیڈر میں "dev:<device id>" بھیجتی ہے (یہ ہیڈر Supabase کی CORS میں پہلے سے جائز ہے)
create or replace function public.request_device_id() returns text
  language sql stable as $$
  select substring(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-client-info', '') from 'dev:([A-Za-z0-9-]{8,64})')
$$;

-- ممبر + دکان کی حالت کی جانچ (02_sync.sql والی پرانی sync_check_access)
create or replace function public.sync_check_member(p_shop uuid) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_platform_admin() then return; end if;
  if not exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.active) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if exists (select 1 from public.shops s where s.id = p_shop and (s.suspended or s.archived or s.expires_at < now())) then
    raise exception 'shop_blocked' using errcode = '42501';
  end if;
end $$;

-- ڈیوائس کی جانچ: پلان میں max_devices = 0 ہو تو کوئی پابندی نہیں
create or replace function public.sync_check_device(p_shop uuid) returns void
  language plpgsql stable security definer set search_path = public as $$
declare v_max int; v_dev text; v_row record;
begin
  if public.is_platform_admin() then return; end if;
  select coalesce(pl.max_devices, 1) into v_max from public.shops s left join public.plans pl on pl.id = s.plan_id where s.id = p_shop;
  if coalesce(v_max, 1) = 0 then return; end if;
  v_dev := public.request_device_id();
  if v_dev is null then raise exception 'device_unregistered' using errcode = '42501'; end if;
  select revoked into v_row from public.user_devices where user_id = auth.uid() and shop_id = p_shop and device_id = v_dev;
  if not found then raise exception 'device_unregistered' using errcode = '42501'; end if;
  if v_row.revoked then raise exception 'device_revoked' using errcode = '42501'; end if;
end $$;

-- سنک/سیٹنگز کی ہر درخواست یہی بلاتی ہے، اس لیے بند کی گئی ڈیوائس سرور سے ڈیٹا نہیں لے/دے سکتی
create or replace function public.sync_check_access(p_shop uuid) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  perform public.sync_check_member(p_shop);
  perform public.sync_check_device(p_shop);
end $$;

-- لاگ اِن پر ڈیوائس رجسٹر کرنا
create or replace function public.register_device(p_shop uuid, p_device text, p_name text default '') returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_max int; v_n int; v_row record; v_reset timestamptz; v_iat bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.is_platform_admin() then return jsonb_build_object('ok', true, 'admin', true); end if;
  if coalesce(p_device, '') !~ '^[A-Za-z0-9-]{8,64}$' then raise exception 'device_required' using errcode = '42501'; end if;
  perform public.sync_check_member(p_shop);
  select coalesce(pl.max_devices, 1) into v_max from public.shops s left join public.plans pl on pl.id = s.plan_id where s.id = p_shop;
  v_max := coalesce(v_max, 1);

  select * into v_row from public.user_devices where user_id = auth.uid() and shop_id = p_shop and device_id = p_device;
  if found then
    if v_row.revoked then raise exception 'device_revoked' using errcode = '42501'; end if;
    update public.user_devices set last_seen = now(), device_name = coalesce(nullif(left(p_name, 80), ''), device_name) where id = v_row.id;
    return jsonb_build_object('ok', true);
  end if;

  -- نئی ڈیوائس: ری سیٹ سے پہلے جاری ہوا ٹوکن (مثلاً چور کے پاس پرانا سیشن) نئی ڈیوائس رجسٹر نہیں کر سکتا — پاس ورڈ سے نیا لاگ اِن ضروری
  select at into v_reset from public.device_resets where user_id = auth.uid();
  v_iat := coalesce((auth.jwt()->>'iat')::bigint, 0);
  if v_reset is not null and v_iat < floor(extract(epoch from v_reset))::bigint then
    raise exception 'device_login_again' using errcode = '42501';
  end if;
  select count(*) into v_n from public.user_devices where user_id = auth.uid() and shop_id = p_shop and not revoked;
  if v_max > 0 and v_n >= v_max then raise exception 'device_limit' using errcode = '42501'; end if;
  insert into public.user_devices (user_id, shop_id, device_id, device_name) values (auth.uid(), p_shop, p_device, left(coalesce(p_name, ''), 80))
    on conflict (user_id, shop_id, device_id) do nothing;
  return jsonb_build_object('ok', true, 'new', true);
end $$;

-- سپر ایڈمن: کسی صارف کی ایک یا سب ڈیوائسز بند کرنا (گم/چوری) اور اس کے سب لاگ اِن سیشن ختم کرنا
create or replace function public.admin_reset_devices(p_user uuid, p_shop uuid, p_device uuid default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  update public.user_devices set revoked = true where user_id = p_user and shop_id = p_shop and (p_device is null or id = p_device);
  insert into public.device_resets (user_id, at) values (p_user, now()) on conflict (user_id) do update set at = now();
  begin delete from auth.sessions where user_id = p_user; exception when others then null; end;
end $$;

grant execute on function public.register_device(uuid, text, text) to authenticated;
grant execute on function public.admin_reset_devices(uuid, uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
