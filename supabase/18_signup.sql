-- Universal POS — Sign up (ڈیمو اکاؤنٹ) + سپر ایڈمن کے کنٹرولز.
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 01، 02 اور 11 کے بعد.
-- ⚠ اگر کبھی 02_sync.sql یا 11_device_limit.sql دوبارہ چلائیں تو اس کے بعد یہ فائل بھی دوبارہ چلائیں (sync_check_member واپس پرانا ہو جاتا ہے).
--
-- خلاصہ:
--  • Sign up ڈیفالٹ میں بند ہے؛ سپر ایڈمن > مزید > سیٹنگز سے آن ہوتا ہے.
--  • نیا اکاؤنٹ "ڈیمو" پلان پر بنتا ہے (محدود پروڈکٹس/بل/صارف/ڈیوائس، اور سپر ایڈمن کے منتخب کردہ فیچرز).
--  • approval = pending ہو تو دکان اس وقت تک لاگ اِن/سنک نہیں کر سکتی جب تک سپر ایڈمن منظور نہ کرے.

-- 1) پلیٹ فارم سیٹنگز
alter table public.platform_settings
  add column if not exists signup_enabled boolean not null default false,
  add column if not exists signup_approval boolean not null default true,
  add column if not exists signup_plan text not null default 'demo',
  add column if not exists demo_days int not null default 7,
  add column if not exists signup_daily_limit int not null default 20;

-- 2) پلان کی نئی حدیں / فیچرز (موجودہ پلانز پر سب کچھ آن، بل کی حد نہیں)
alter table public.plans
  add column if not exists max_bills int not null default 0,          -- 0 = لامحدود
  add column if not exists f_customers boolean not null default true,  -- کسٹمرز / ادھار
  add column if not exists f_purchases boolean not null default true,  -- خریداری / سپلائرز
  add column if not exists f_expenses boolean not null default true,   -- اخراجات
  add column if not exists f_reports boolean not null default true;    -- رپورٹس

insert into public.plans (id, name, name_ur, price, max_users, max_products, max_devices, bill_qr, barcodes, max_bills, f_customers, f_purchases, f_expenses, f_reports)
values ('demo', 'Demo', 'ڈیمو', 0, 1, 30, 1, false, false, 50, true, false, false, false)
on conflict (id) do nothing;

-- 3) دکان: منظوری اور ذریعہ
alter table public.shops
  add column if not exists approval text not null default 'approved' check (approval in ('pending', 'approved', 'rejected')),
  add column if not exists source text not null default 'admin';

-- 4) سپر ایڈمن کے بغیر کوئی دکان منظور شدہ نہ ہو تو سنک رک جائے (11_device_limit.sql والی sync_check_member کی جگہ)
create or replace function public.sync_check_member(p_shop uuid) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_platform_admin() then return; end if;
  if not exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.active) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if exists (select 1 from public.shops s where s.id = p_shop and (s.suspended or s.archived or s.expires_at < now() or s.approval <> 'approved')) then
    raise exception 'shop_blocked' using errcode = '42501';
  end if;
end $$;

-- 5) عوامی (بغیر لاگ اِن) معلومات: Sign up کھلا ہے یا نہیں، اور ڈیمو کی حدیں (صرف یہی چند فیلڈز)
create or replace function public.signup_info() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', s.signup_enabled, 'approval', s.signup_approval, 'days', s.demo_days,
    'max_products', p.max_products, 'max_bills', p.max_bills, 'max_users', p.max_users,
    'plan_name', p.name, 'plan_name_ur', coalesce(p.name_ur, p.name))
  from public.platform_settings s left join public.plans p on p.id = s.signup_plan where s.id = 1
$$;
grant execute on function public.signup_info() to anon, authenticated;

-- 6) Sign up کی کوششوں کا ریکارڈ (فی IP حد کے لیے؛ صرف Edge Function لکھتی/پڑھتی ہے)
create table if not exists public.signup_attempts (
  id bigserial primary key, ip text not null, at timestamptz not null default now());
create index if not exists signup_attempts_ip_at on public.signup_attempts (ip, at);
alter table public.signup_attempts enable row level security;
drop policy if exists sa_all on public.signup_attempts;
create policy sa_all on public.signup_attempts for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 7) سرور کی طرف سے حد کی جانچ (ایپ پہلے ہی روکتی ہے؛ یہ چھیڑ چھاڑ کے خلاف پچھلا دروازہ ہے). max = 0 → کوئی حد نہیں؛ سپر ایڈمن پر حد نہیں.
create or replace function public.enforce_plan_limit() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_max int; v_n int;
begin
  if new.deleted_at is not null then return new; end if;
  if tg_table_name = 'pos_products' then
    select coalesce(pl.max_products, 0) into v_max from public.shops s left join public.plans pl on pl.id = s.plan_id where s.id = new.shop_id;
    if coalesce(v_max, 0) > 0 then
      select count(*) into v_n from public.pos_products where shop_id = new.shop_id and deleted_at is null;
      if v_n >= v_max then raise exception 'plan_limit_products' using errcode = '42501'; end if;
    end if;
  elsif tg_table_name = 'pos_sales' then
    select coalesce(pl.max_bills, 0) into v_max from public.shops s left join public.plans pl on pl.id = s.plan_id where s.id = new.shop_id;
    if coalesce(v_max, 0) > 0 then
      select count(*) into v_n from public.pos_sales where shop_id = new.shop_id and deleted_at is null;
      if v_n >= v_max then raise exception 'plan_limit_bills' using errcode = '42501'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_products on public.pos_products;
create trigger trg_limit_products before insert on public.pos_products for each row execute function public.enforce_plan_limit();
drop trigger if exists trg_limit_sales on public.pos_sales;
create trigger trg_limit_sales before insert on public.pos_sales for each row execute function public.enforce_plan_limit();

notify pgrst, 'reload schema';
