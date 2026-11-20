-- Universal POS — Super Admin schema. Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).

-- 0) پہلے سے موجود پرانے ٹیبل (الگ کالموں والے) کو نام بدل کر محفوظ کر دیتا ہے، ڈیٹا ضائع نہیں ہوتا
do $$
declare spec record; missing int;
begin
  for spec in select * from (values
    ('audit_log', array['id','at','actor','action','target','detail'], true),
    ('announcements', array['id','text','active','at'], true),
    ('sub_payments', array['id','shop_id','plan_id','amount','days','method','note','at'], true),
    ('plans', array['id','name','name_ur','price','max_users','max_products'], false),
    ('platform_settings', array['id','trial_days','default_plan','support_phone'], false)
  ) as v(tbl, cols, uuid_id)
  loop
    if to_regclass('public.' || spec.tbl) is not null then
      select count(*) into missing from unnest(spec.cols) c
        where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = spec.tbl and column_name = c);
      if missing > 0 or (spec.uuid_id and exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = spec.tbl and column_name = 'id' and data_type <> 'uuid')) then
        execute format('alter table public.%I rename to %I', spec.tbl, spec.tbl || '_old_' || to_char(clock_timestamp(), 'HH24MISSMS'));
      end if;
    end if;
  end loop;
end $$;

-- 1) ping: ایپ کا آن لائن چیک
drop function if exists public.ping();
create function public.ping() returns boolean language sql stable as $$ select true $$;
grant execute on function public.ping() to anon, authenticated;

-- 2) پلیٹ فارم ایڈمن
create table if not exists public.platform_admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.platform_admins enable row level security;
create or replace function public.is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;
grant execute on function public.is_platform_admin() to authenticated;
drop policy if exists pa_self on public.platform_admins;
create policy pa_self on public.platform_admins for select to authenticated using (user_id = auth.uid());

-- 3) پلانز
create table if not exists public.plans (
  id text primary key, name text not null, name_ur text, price numeric not null default 0,
  max_users int not null default 2, max_products int not null default 0);
insert into public.plans values
  ('basic','Basic','بنیادی',1500,2,500),
  ('standard','Standard','اسٹینڈرڈ',3000,5,3000),
  ('premium','Premium','پریمیم',5000,15,0)
on conflict (id) do nothing;

-- 4) دکانیں (پہلے سے موجود ٹیبل میں کالم بڑھتے ہیں)
create table if not exists public.shops (id uuid primary key default gen_random_uuid(), name text not null);
alter table public.shops
  add column if not exists owner_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists city text not null default '',
  add column if not exists plan_id text not null default 'standard',
  add column if not exists trial boolean not null default false,
  add column if not exists suspended boolean not null default false,
  add column if not exists suspend_reason text not null default '',
  add column if not exists archived boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz not null default now(),
  add column if not exists last_seen timestamptz,
  add column if not exists bills_30d int not null default 0,
  add column if not exists sales_30d numeric not null default 0,
  add column if not exists notes text not null default '';

-- 5) دکان کے ممبرز / صارفین
create table if not exists public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'cashier');
alter table public.shop_members
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_login timestamptz;
create unique index if not exists shop_members_id_key on public.shop_members(id);
create unique index if not exists shop_members_shop_user on public.shop_members(shop_id, user_id);

-- 6) ادائیگیاں، لاگ، اعلانات، سیٹنگز
create table if not exists public.sub_payments (
  id uuid primary key, shop_id uuid not null references public.shops(id) on delete cascade,
  plan_id text, amount numeric not null, days int not null, method text, note text default '', at timestamptz not null default now());
create table if not exists public.audit_log (
  id uuid primary key, at timestamptz not null default now(), actor text, action text, target text, detail text);
create table if not exists public.announcements (
  id uuid primary key, text text not null, active boolean not null default true, at timestamptz not null default now());
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  trial_days int not null default 14, default_plan text not null default 'standard', support_phone text not null default '');
insert into public.platform_settings (id) values (1) on conflict do nothing;

-- 7) RLS
do $$ declare t text; begin
  foreach t in array array['plans','shops','shop_members','sub_payments','audit_log','announcements','platform_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists sa_all on public.%I', t);
    execute format('create policy sa_all on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())', t);
  end loop;
end $$;

-- عام صارفین کے لیے صرف پڑھنے کی اجازت
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to authenticated using (true);
drop policy if exists settings_read on public.platform_settings;
create policy settings_read on public.platform_settings for select to authenticated using (true);
drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements for select to authenticated using (active);
drop policy if exists members_self on public.shop_members;
create policy members_self on public.shop_members for select to authenticated using (user_id = auth.uid());
drop policy if exists shops_member on public.shops;
create policy shops_member on public.shops for select to authenticated
  using (exists (select 1 from public.shop_members m where m.shop_id = shops.id and m.user_id = auth.uid()));

-- 8) پہلا Super Admin: Dashboard > Authentication > Users میں یوزر بنائیں
--    (Email = 03001234567@pos-login.app ، Auto-confirm ✔)، پھر یہ چلائیں:
-- insert into public.platform_admins (user_id) select id from auth.users where email = '03001234567@pos-login.app';
