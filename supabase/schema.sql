-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Universal POS — مکمل سرور اسکیما (موجودہ حالت).  نئی تنصیب کے لیے صرف یہی ایک فائل چلائیں.
-- Supabase Dashboard > SQL Editor میں پوری فائل ایک بار چلائیں. دوبارہ چلانا محفوظ ہے (کوئی ڈیٹا نہیں مٹتا).
--
-- • یہ فائل پرانی 01 تا 26 تبدیلیوں کا حتمی نتیجہ ہے (ہر فنکشن کا آخری ورژن، ہر ٹیبل کے سب کالم).
-- • پہلے سے چلتی ڈیٹا بیس کو اس سے اپ ڈیٹ نہ کریں؛ اس کے لیے migrations/ فولڈر دیکھیں (migrations/README.md).
-- • اس کے بعد نیا کام: migrations/ میں اگلے نمبر کی فائل (27_...) لکھیں، اور اسی تبدیلی کو یہاں بھی شامل کریں.
-- • پہلا Super Admin (آخر میں ہدایت دیکھیں) اور اختیاری cron (tools/cron_examples.sql) الگ ہیں.
-- ═══════════════════════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────── 1) جدول (Tables) ─────────────────────────────────

-- پلیٹ فارم ایڈمن
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade);

-- پلانز: حدیں اور فیچرز (0 = لامحدود جہاں "max" ہو)
create table if not exists public.plans (
  id text primary key,
  name text not null,
  name_ur text,
  price numeric not null default 0,
  max_users int not null default 2,
  max_products int not null default 0,
  bill_qr boolean not null default false,          -- بل پر تصدیقی QR (پریمیم)
  barcodes boolean not null default false,         -- بارکوڈ فیلڈ / اسکین
  max_devices int not null default 1,              -- 0 = لامحدود
  max_bills int not null default 0,                -- 0 = لامحدود
  f_customers boolean not null default true,       -- کسٹمرز / ادھار
  f_purchases boolean not null default true,       -- خریداری / سپلائرز
  f_expenses boolean not null default true,        -- اخراجات
  f_reports boolean not null default true);        -- رپورٹس

insert into public.plans (id, name, name_ur, price, max_users, max_products, bill_qr, barcodes, max_devices, max_bills, f_customers, f_purchases, f_expenses, f_reports) values
  ('basic',    'Basic',    'بنیادی',    1500,  2,  500, false, false, 1,  0, true, true,  true,  true),
  ('standard', 'Standard', 'اسٹینڈرڈ',  3000,  5, 3000, false, true,  1,  0, true, true,  true,  true),
  ('premium',  'Premium',  'پریمیم',    5000, 15,    0, true,  true,  1,  0, true, true,  true,  true),
  ('demo',     'Demo',     'ڈیمو',         0,  1,   30, false, false, 1, 50, true, false, false, false)
on conflict (id) do nothing;

-- دکانیں
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null default '',
  phone text not null default '',
  city text not null default '',
  plan_id text not null default 'standard',
  trial boolean not null default false,
  suspended boolean not null default false,
  suspend_reason text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now(),
  last_seen timestamptz,
  bills_30d int not null default 0,
  sales_30d numeric not null default 0,
  notes text not null default '',
  settings jsonb not null default '{}'::jsonb,     -- رسید کی سیٹنگز، کاروبار کی قسم (get/save_shop_settings)
  approval text not null default 'approved' check (approval in ('pending', 'approved', 'rejected')),
  source text not null default 'admin');           -- 'admin' یا sign up

-- دکان کے ممبرز / صارفین
create table if not exists public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'cashier',            -- owner / manager / cashier
  id uuid not null default gen_random_uuid(),
  name text not null default '',
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login timestamptz,
  avatar text,                                     -- چھوٹی JPEG data URL
  last_nudge_at timestamptz);                      -- آخری "یاد دہانی" نوٹیفکیشن
create unique index if not exists shop_members_id_key on public.shop_members(id);
create unique index if not exists shop_members_shop_user on public.shop_members(shop_id, user_id);

-- ادائیگیاں، آڈٹ لاگ، اعلانات
create table if not exists public.sub_payments (
  id uuid primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  plan_id text, amount numeric not null, days int not null, method text, note text default '',
  at timestamptz not null default now());
create table if not exists public.audit_log (
  id uuid primary key, at timestamptz not null default now(), actor text, action text, target text, detail text);
create table if not exists public.announcements (
  id uuid primary key,
  text text not null,
  active boolean not null default true,
  at timestamptz not null default now(),
  shop_id uuid references public.shops(id) on delete cascade);   -- خالی = سب دکانوں کے لیے

-- پلیٹ فارم سیٹنگز (ایک ہی قطار، id = 1)
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  trial_days int not null default 14,
  default_plan text not null default 'standard',
  support_phone text not null default '',
  signup_enabled boolean not null default false,
  signup_approval boolean not null default true,
  signup_plan text not null default 'demo',
  demo_days int not null default 7,
  signup_daily_limit int not null default 20,
  inactive_days int not null default 5,            -- 0 = یاد دہانی بند
  inactive_message text not null default '');      -- {name} اور {shop} بدل جاتے ہیں
insert into public.platform_settings (id) values (1) on conflict do nothing;

-- Sync: ہر لوکل ٹیبل کا سرور ٹیبل pos_<نام>. لکھنا صرف sync_push() سے، پڑھنا sync_pull() یا RLS سے.
do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements'] loop
    execute format($f$
      create table if not exists public.%I (
        id uuid primary key,
        shop_id uuid not null references public.shops(id) on delete cascade,
        version int not null default 1,
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        data jsonb not null,
        server_ts timestamptz not null default clock_timestamp()
      )$f$, 'pos_' || t);
    execute format('create index if not exists %I on public.%I (shop_id, server_ts)', 'pos_' || t || '_pull', 'pos_' || t);
  end loop;
end $$;

-- ڈیوائسز (ایک آئی ڈی = پلان کے مطابق محدود ڈیوائسز)
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shop_id uuid not null,
  device_id text not null,
  device_name text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  revoked boolean not null default false,
  unique (user_id, shop_id, device_id));
create table if not exists public.device_resets (user_id uuid primary key, at timestamptz not null default now());

-- شرائط / معاہدے کی قبولیت
create table if not exists public.terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shop_id uuid,
  version text not null,
  accepted_at timestamptz not null default now(),
  device_name text not null default '',
  unique (user_id, version));

-- "ہم سے رابطہ کریں" (سپورٹ ٹکٹ)
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  user_id uuid not null,
  user_name text not null default '',
  shop_name text not null default '',
  phone text not null default '',
  kind text not null default 'problem' check (kind in ('problem', 'suggestion', 'question')),
  topic text not null default 'other',
  subject text not null,
  meta text not null default '',
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_unread boolean not null default true,
  user_unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists support_tickets_user on public.support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_status on public.support_tickets (status, updated_at desc);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  sender_name text not null default '',
  body text not null,
  at timestamptz not null default now(),
  image text);                                     -- اسکرین شاٹ (چھوٹی JPEG)
create index if not exists support_messages_ticket on public.support_messages (ticket_id, at);

-- Web Push subscriptions
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  shop_id uuid,
  p256dh text not null,
  auth text not null,
  is_admin boolean not null default false,
  ua text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists push_subs_user on public.push_subscriptions (user_id);
create index if not exists push_subs_shop on public.push_subscriptions (shop_id);

-- "پاس ورڈ بھول گئے" درخواستیں
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text not null default '',
  status text not null default 'open' check (status in ('open', 'done')),
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz);
create index if not exists pwreq_status on public.password_reset_requests (status, created_at desc);

-- Sign up کی کوششیں (فی IP حد؛ صرف Edge Function لکھتی/پڑھتی ہے)
create table if not exists public.signup_attempts (
  id bigserial primary key, ip text not null, at timestamptz not null default now());
create index if not exists signup_attempts_ip_at on public.signup_attempts (ip, at);

-- صارف کی سرگرمی (صرف اسکرین/بٹن کے نام؛ 30 دن بعد خود مٹ جاتی ہے)
create table if not exists public.activity_log (
  id bigserial primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null,
  user_name text not null default '',
  kind text not null default 'c',                  -- s = اسکرین، c = کلک
  name text not null,
  at timestamptz not null default now());
create index if not exists activity_log_user_at on public.activity_log (user_id, at desc);
create index if not exists activity_log_at on public.activity_log (at desc);


-- ───────────────────────────────── 2) فنکشنز ─────────────────────────────────

-- ایپ کا آن لائن چیک
drop function if exists public.ping();
create function public.ping() returns boolean language sql stable as $$ select true $$;

create or replace function public.is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;

-- ── رسائی کی جانچ: ممبر + دکان کی حالت ، پھر ڈیوائس ──
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

-- ایپ ہر درخواست کے X-Client-Info ہیڈر میں "dev:<device id>" بھیجتی ہے
create or replace function public.request_device_id() returns text
  language sql stable as $$
  select substring(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-client-info', '') from 'dev:([A-Za-z0-9-]{8,64})')
$$;

-- پلان میں max_devices = 0 ہو تو کوئی پابندی نہیں
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

-- سنک/سیٹنگز کی ہر درخواست یہی بلاتی ہے
create or replace function public.sync_check_access(p_shop uuid) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  perform public.sync_check_member(p_shop);
  perform public.sync_check_device(p_shop);
end $$;

-- کردار: owner / manager / cashier (پلیٹ فارم ایڈمن = owner)
create or replace function public.sync_role(p_shop uuid) returns text
  language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then 'owner'
              else (select m.role from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.active limit 1) end
$$;

-- ── Sync ──
-- push: ریکارڈز کا بیچ. ہر ریکارڈ کا نتیجہ: ok | conflict (سرور والا ورژن واپس) | denied
create or replace function public.has_role(p_shop uuid, p_roles text[]) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.shop_members m
        where m.shop_id = p_shop and m.user_id = auth.uid()
          and m.active and m.role = any(coalesce(p_roles, array[]::text[]))
      )
$$;
grant execute on function public.has_role(uuid, text[]) to authenticated;

create or replace function public.sync_push(p_shop uuid, p_table text, p_rows jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb; tbl text; ex record; v_ver int; v_upd timestamptz; v_id uuid; v_role text;
  v_denied boolean; v_deny boolean; v_wins boolean;
  v_sale_id uuid; v_sale_status text; v_sale_qty numeric; v_used_qty numeric;
  out jsonb := '[]'::jsonb;
begin
  if p_table <> all (array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements']) then
    raise exception 'bad_table';
  end if;
  perform public.sync_check_access(p_shop);
  tbl := 'pos_' || p_table;
  v_role := public.sync_role(p_shop);
  -- کیشیئر صرف فروخت، اس کی آئٹمز، اسٹاک موومنٹ، ادائیگی اور کسٹمر لکھ سکتا ہے؛ باقی مالک/مینیجر
  v_denied := v_role = 'cashier' and p_table <> all (array['sales','sale_items','stock_movements','payments','customers']);

  for r in select * from jsonb_array_elements(p_rows) loop
    if (r->>'shop_id')::uuid is distinct from p_shop then raise exception 'shop_mismatch'; end if;
    v_id := (r->>'id')::uuid;
    v_ver := coalesce((r->>'version')::int, 1);
    v_upd := coalesce((r->>'updated_at')::timestamptz, now());

    execute format('select version, updated_at, data from public.%I where id = $1 and shop_id = $2', tbl)
      into ex using v_id, p_shop;
    v_wins := ex.version is not null and (v_ver > ex.version or (v_ver = ex.version and v_upd > ex.updated_at));

    -- پرانی کیشیئر پابندیاں: منسوخی / واپسی نہیں
    v_deny := v_denied
      or (v_role = 'cashier' and p_table = 'sales' and (r->>'status' = 'void' or coalesce((r->>'returned_total')::numeric, 0) > 0))
      or (v_role = 'cashier' and p_table = 'sale_items' and coalesce((r->>'returned_qty')::numeric, 0) > 0);

    -- نئی کیشیئر سخت پابندیاں: حذف نہیں؛ موجودہ فروخت/آئٹم/ادائیگی/اسٹاک قطار تبدیل نہیں؛ صرف sale اسٹاک کمی
    if v_role = 'cashier' and not v_deny then
      if nullif(r->>'deleted_at', '') is not null then
        v_deny := true;
      elsif p_table in ('sales', 'sale_items', 'stock_movements', 'payments') and v_wins then
        v_deny := true;
      elsif p_table = 'stock_movements'
            and (coalesce(r->>'reason', '') <> 'sale' or coalesce(nullif(r->>'qty_change', '')::numeric, 0) > 0) then
        v_deny := true;
      end if;
    end if;

    -- Migration 26: cashier stock movement must be backed by a real completed sale.
    -- ref_id points to the sale; product quantity is capped by non-Quick-Bill sale lines.
    if v_role = 'cashier' and p_table = 'stock_movements' and not v_deny then
      if coalesce(r->>'reason', '') <> 'sale'
         or coalesce(r->>'ref_type', '') <> 'sale'
         or coalesce(nullif(r->>'qty_change', '')::numeric, 0) >= 0
         or nullif(r->>'product_id', '') is null
         or coalesce(r->>'ref_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}      out := out || jsonb_build_object('id', v_id, 'status', 'denied');
      continue;
    end if;

    if ex.version is null then
      begin
        execute format('insert into public.%I (id, shop_id, version, updated_at, deleted_at, data) values ($1,$2,$3,$4,$5,$6)', tbl)
          using v_id, p_shop, v_ver, v_upd, nullif(r->>'deleted_at','')::timestamptz, r;
        out := out || jsonb_build_object('id', v_id, 'status', 'ok');
      exception when sqlstate '42501' then
        -- پلان کی حد صرف اسی ریکارڈ کو روکے؛ باقی سنک بیچ جاری رہے
        if sqlerrm like 'plan_limit%' then
          out := out || jsonb_build_object('id', v_id, 'status', 'plan_limit', 'detail', sqlerrm);
        else
          raise;
        end if;
      end;
    elsif v_wins then
      execute format('update public.%I set version=$3, updated_at=$4, deleted_at=$5, data=$6, server_ts=clock_timestamp() where id=$1 and shop_id=$2', tbl)
        using v_id, p_shop, v_ver, v_upd, nullif(r->>'deleted_at','')::timestamptz, r;
      out := out || jsonb_build_object('id', v_id, 'status', 'ok');
    elsif v_ver = ex.version and v_upd = ex.updated_at then
      out := out || jsonb_build_object('id', v_id, 'status', 'ok');
    else
      out := out || jsonb_build_object('id', v_id, 'status', 'conflict', 'server', ex.data);
    end if;
  end loop;

  update public.shops set last_seen = now() where id = p_shop;
  return out;
end $$;

create or replace function public.sync_pull(p_shop uuid, p_table text, p_since timestamptz, p_limit int default 500) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if p_table <> all (array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements']) then
    raise exception 'bad_table';
  end if;
  perform public.sync_check_access(p_shop);
  -- کیشیئر کو خریداری، سپلائر اور اخراجات کا ڈیٹا sync کے ذریعے نہیں ملتا
  if p_table = any (array['purchases','purchase_items','expenses','suppliers']) and public.sync_role(p_shop) = 'cashier' then
    return '[]'::jsonb;
  end if;
  execute format($q$select coalesce(jsonb_agg(jsonb_build_object('data', data, 'server_ts', server_ts) order by server_ts), '[]'::jsonb)
                    from (select data, server_ts from public.%I where shop_id = $1 and server_ts > $2 order by server_ts limit $3) x$q$, 'pos_' || p_table)
    into res using p_shop, coalesce(p_since, '-infinity'::timestamptz), least(greatest(p_limit, 1), 1000);
  return res;
end $$;

do $$ declare t text; begin
  foreach t in array array['purchases','purchase_items','expenses','suppliers'] loop
    execute format('drop policy if exists member_read on public.%I', 'pos_' || t);
    execute format($p$create policy member_read on public.%I for select to authenticated
      using (public.has_role(shop_id, array['owner','manager']))$p$, 'pos_' || t);
  end loop;
end $$;


-- پلان کی حد (enforce_plan_limit) صرف اسی ریکارڈ کو روکے، پورا بیچ ناکام نہ ہو
        if sqlerrm like 'plan_limit%' then
          out := out || jsonb_build_object('id', v_id, 'status', 'plan_limit', 'detail', sqlerrm);
        else
          raise;
        end if;
      end;
    elsif v_ver > ex.version or (v_ver = ex.version and v_upd > ex.updated_at) then
      execute format('update public.%I set version=$3, updated_at=$4, deleted_at=$5, data=$6, server_ts=clock_timestamp() where id=$1 and shop_id=$2', tbl)
        using v_id, p_shop, v_ver, v_upd, nullif(r->>'deleted_at','')::timestamptz, r;
      out := out || jsonb_build_object('id', v_id, 'status', 'ok');
    elsif v_ver = ex.version and v_upd = ex.updated_at then
      out := out || jsonb_build_object('id', v_id, 'status', 'ok');          -- دوبارہ آیا ہوا وہی ریکارڈ
    else
      out := out || jsonb_build_object('id', v_id, 'status', 'conflict', 'server', ex.data);   -- سرور نیا ہے: سرور جیتتا ہے
    end if;
  end loop;

  update public.shops set last_seen = now() where id = p_shop;
  return out;
end $$;

-- pull: p_since کے بعد بدلے ہوئے ریکارڈز (سرور کے وقت کے حساب سے، ڈیوائس کی گھڑی پر انحصار نہیں)
create or replace function public.sync_pull(p_shop uuid, p_table text, p_since timestamptz, p_limit int default 500) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if p_table <> all (array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements']) then
    raise exception 'bad_table';
  end if;
  perform public.sync_check_access(p_shop);
  execute format($q$select coalesce(jsonb_agg(jsonb_build_object('data', data, 'server_ts', server_ts) order by server_ts), '[]'::jsonb)
                    from (select data, server_ts from public.%I where shop_id = $1 and server_ts > $2 order by server_ts limit $3) x$q$, 'pos_' || p_table)
    into res using p_shop, coalesce(p_since, '-infinity'::timestamptz), least(greatest(p_limit, 1), 1000);
  return res;
end $$;

-- پلان کی حد (پروڈکٹس / بل) کی سرور کی طرف سے جانچ؛ max = 0 → کوئی حد نہیں
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

-- ── دکان کی سیٹنگز ──
-- دکان کا نام بدلنا (صرف مالک)
create or replace function public.rename_my_shop(p_shop uuid, p_name text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  p_name := btrim(coalesce(p_name, ''));
  if length(p_name) < 2 or length(p_name) > 80 then raise exception 'bad_name'; end if;
  if not exists (select 1 from public.shop_members m
                 where m.shop_id = p_shop and m.user_id = auth.uid() and m.active and m.role = 'owner') then
    raise exception 'owner_only' using errcode = '42501';
  end if;
  update public.shops set name = p_name where id = p_shop;
end $$;

-- پڑھنا: دکان کا کوئی بھی ممبر
create or replace function public.get_shop_settings(p_shop uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  perform public.sync_check_access(p_shop);
  return coalesce((select s.settings from public.shops s where s.id = p_shop), '{}'::jsonb);
end $$;

-- لکھنا: صرف مالک / مینیجر، اور صرف طے شدہ keys (رسید کا انداز: premium / classic / modern)
create or replace function public.save_shop_settings(p_shop uuid, p_settings jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare clean jsonb := '{}'::jsonb; k text;
begin
  perform public.sync_check_access(p_shop);
  if coalesce(public.sync_role(p_shop), '') not in ('owner', 'manager') then
    raise exception 'owner_or_manager_only' using errcode = '42501';
  end if;
  foreach k in array array['receipt_header', 'receipt_footer', 'shop_phone', 'shop_address', 'shop_tax_no', 'business_type'] loop
    if p_settings ? k then clean := clean || jsonb_build_object(k, left(coalesce(p_settings->>k, ''), 300)); end if;
  end loop;
  if (p_settings->>'receipt_style') in ('premium', 'classic', 'modern') then clean := clean || jsonb_build_object('receipt_style', p_settings->>'receipt_style'); end if;
  update public.shops set settings = coalesce(settings, '{}'::jsonb) || clean where id = p_shop;
end $$;

-- ── ڈیوائسز ──
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

-- سپر ایڈمن: بند کی گئی ڈیوائس کو دوبارہ اجازت (پلان کی حد دیکھی جاتی ہے)
create or replace function public.admin_allow_device(p_device uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_row record; v_max int; v_n int;
begin
  if not public.is_platform_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  select * into v_row from public.user_devices where id = p_device;
  if not found then raise exception 'device_not_found' using errcode = '42501'; end if;
  if not v_row.revoked then return; end if;
  select coalesce(pl.max_devices, 1) into v_max from public.shops s left join public.plans pl on pl.id = s.plan_id where s.id = v_row.shop_id;
  select count(*) into v_n from public.user_devices where user_id = v_row.user_id and shop_id = v_row.shop_id and not revoked;
  if coalesce(v_max, 1) > 0 and v_n >= coalesce(v_max, 1) then raise exception 'device_limit' using errcode = '42501'; end if;
  update public.user_devices set revoked = false where id = p_device;
end $$;

-- ── پروفائل ──
create or replace function public.set_my_avatar(p_shop uuid, p_avatar text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  p_avatar := coalesce(p_avatar, '');
  if length(p_avatar) > 80000 then raise exception 'avatar_too_big' using errcode = '22023'; end if;
  if p_avatar <> '' and p_avatar !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then raise exception 'bad_avatar' using errcode = '22023'; end if;
  update public.shop_members set avatar = nullif(p_avatar, '') where shop_id = p_shop and user_id = auth.uid();
end $$;

create or replace function public.set_my_name(p_shop uuid, p_name text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  p_name := btrim(regexp_replace(coalesce(p_name, ''), '[\u0000-\u001f<>]', ' ', 'g'));
  if length(p_name) < 2 or length(p_name) > 60 then raise exception 'bad_name' using errcode = '22023'; end if;
  update public.shop_members set name = p_name where shop_id = p_shop and user_id = auth.uid();
end $$;

create or replace function public.my_profile(p_shop uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare m record; d jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into m from public.shop_members where shop_id = p_shop and user_id = auth.uid();
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', device_id, 'name', device_name, 'first', first_seen, 'last', last_seen, 'revoked', revoked) order by last_seen desc), '[]'::jsonb)
    into d from public.user_devices where user_id = auth.uid() and shop_id = p_shop;
  return jsonb_build_object('name', m.name, 'role', m.role, 'created_at', m.created_at, 'last_login', m.last_login, 'devices', d);
end $$;

create or replace function public.accept_terms(p_shop uuid, p_version text, p_device text default '') returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if coalesce(p_version, '') = '' or length(p_version) > 20 then raise exception 'bad_version' using errcode = '22023'; end if;
  insert into public.terms_acceptance (user_id, shop_id, version, device_name)
    values (auth.uid(), p_shop, p_version, left(coalesce(p_device, ''), 80))
    on conflict (user_id, version) do nothing;
end $$;

-- ── سپورٹ ──
-- صارف کا نیا پیغام / جواب. p_ticket خالی = نیا پیغام. ہر صارف فی گھنٹہ زیادہ سے زیادہ 10 پیغام.
-- (پرانا بغیر p_image والا ورژن ہٹاتے ہیں تاکہ کال میں ابہام نہ ہو)
drop function if exists public.support_send(uuid, uuid, text, text, text, text, text);
create or replace function public.support_send(p_shop uuid, p_ticket uuid, p_kind text, p_topic text, p_subject text, p_body text, p_meta text default '', p_image text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m record;
  tid uuid := p_ticket;
  body text := btrim(coalesce(p_body, ''));
  subj text := btrim(coalesce(p_subject, ''));
  img text := nullif(p_image, '');
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if length(body) < 2 or length(body) > 1000 then raise exception 'bad_body' using errcode = '22023'; end if;
  if img is not null and (img not like 'data:image/jpeg;base64,%' or length(img) > 420000) then raise exception 'bad_image' using errcode = '22023'; end if;
  select sm.name as uname, sm.phone as uphone, s.name as sname into m
    from public.shop_members sm join public.shops s on s.id = sm.shop_id
    where sm.shop_id = p_shop and sm.user_id = uid and sm.active limit 1;
  if not found then raise exception 'not_member' using errcode = '42501'; end if;
  if (select count(*) from public.support_messages g join public.support_tickets t on t.id = g.ticket_id
        where t.user_id = uid and g.sender = 'user' and g.at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit' using errcode = '54000';
  end if;
  if tid is null then
    if length(subj) < 3 or length(subj) > 80 then raise exception 'bad_subject' using errcode = '22023'; end if;
    insert into public.support_tickets (shop_id, user_id, user_name, shop_name, phone, kind, topic, subject, meta)
      values (p_shop, uid, coalesce(m.uname, ''), coalesce(m.sname, ''), coalesce(m.uphone, ''),
              case when p_kind in ('problem', 'suggestion', 'question') then p_kind else 'problem' end,
              case when p_topic in ('billing', 'stock', 'sync', 'login', 'subscription', 'other') then p_topic else 'other' end,
              subj, left(coalesce(p_meta, ''), 300))
      returning id into tid;
  else
    update public.support_tickets set status = 'open', admin_unread = true, user_unread = false, updated_at = now()
      where id = tid and user_id = uid;
    if not found then raise exception 'no_ticket' using errcode = '42501'; end if;
  end if;
  insert into public.support_messages (ticket_id, sender, sender_name, body, image) values (tid, 'user', coalesce(m.uname, ''), body, img);
  return tid;
end $$;

-- صارف نے جواب پڑھ لیا
create or replace function public.support_mark_read(p_ticket uuid) returns void
  language sql security definer set search_path = public as
$$ update public.support_tickets set user_unread = false where id = p_ticket and user_id = auth.uid() $$;

-- سپر ایڈمن کا جواب (p_close = true: جواب کے ساتھ بند)
create or replace function public.support_reply(p_ticket uuid, p_body text, p_close boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare body text := btrim(coalesce(p_body, ''));
begin
  if not public.is_platform_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if length(body) < 1 or length(body) > 1000 then raise exception 'bad_body' using errcode = '22023'; end if;
  insert into public.support_messages (ticket_id, sender, sender_name, body) values (p_ticket, 'admin', 'Support', body);
  update public.support_tickets
    set status = case when p_close then 'closed' else 'answered' end, user_unread = true, admin_unread = false, updated_at = now()
    where id = p_ticket;
end $$;

-- ── Push ──
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_shop uuid default null, p_ua text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if coalesce(p_endpoint, '') = '' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'bad_subscription' using errcode = '22023';
  end if;
  if p_shop is not null and not exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid()) and not public.is_platform_admin() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, shop_id, p256dh, auth, is_admin, ua)
    values (p_endpoint, auth.uid(), p_shop, p_p256dh, p_auth, public.is_platform_admin(), left(coalesce(p_ua, ''), 200))
  on conflict (endpoint) do update set user_id = auth.uid(), shop_id = p_shop, p256dh = excluded.p256dh, auth = excluded.auth,
    is_admin = public.is_platform_admin(), ua = excluded.ua, updated_at = now();
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns void
  language sql security definer set search_path = public as
$$ delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid() $$;

-- ── پاس ورڈ ری سیٹ کی درخواست (لاگ اِن سے پہلے، anon) ──
-- خود بخود پاس ورڈ نہیں بدلتا: درخواست سپر ایڈمن کو جاتی ہے. جواب ہمیشہ ایک جیسا، تاکہ باہر والا نہ جان سکے کہ نمبر ہمارا صارف ہے یا نہیں.
create or replace function public.request_password_reset(p_phone text, p_name text default '') returns uuid
  language plpgsql security definer set search_path = public as $$
declare d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); rid uuid;
begin
  if d like '00%' then d := substr(d, 3); end if;
  if d like '0%' then d := '92' || substr(d, 2);
  elsif length(d) = 10 and d like '3%' then d := '92' || d; end if;
  if d !~ '^923[0-9]{9}$' then raise exception 'bad_phone' using errcode = '22023'; end if;
  select id into rid from public.password_reset_requests where phone = d and status = 'open' order by created_at desc limit 1;
  if rid is not null then return rid; end if;                                                        -- پہلے سے کھلی درخواست
  if (select count(*) from public.password_reset_requests where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'busy' using errcode = '54000';
  end if;
  insert into public.password_reset_requests (phone, name) values (d, left(btrim(coalesce(p_name, '')), 60)) returning id into rid;
  return rid;
end $$;

-- ── Sign up: عوامی (بغیر لاگ اِن) معلومات، صرف یہی چند فیلڈز ──
create or replace function public.signup_info() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', s.signup_enabled, 'approval', s.signup_approval, 'days', s.demo_days,
    'max_products', p.max_products, 'max_bills', p.max_bills, 'max_users', p.max_users,
    'plan_name', p.name, 'plan_name_ur', coalesce(p.name_ur, p.name))
  from public.platform_settings s left join public.plans p on p.id = s.signup_plan where s.id = 1
$$;

-- ── سرگرمی: ایپ جمع شدہ واقعات بھیجتی ہے؛ ساتھ ہی last_login تازہ ہوتا ہے ──
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


-- ───────────────────────────────── 3) RLS (قطار کی سطح کی حفاظت) ─────────────────────────────────
-- ایپ کی ساری حفاظت یہیں پر ہے: config.js کی publishable key عوامی ہے، اس لیے ہر ٹیبل پر RLS لازمی.

-- سپر ایڈمن: ہر ٹیبل پر سب کچھ
do $$ declare t text; begin
  foreach t in array array[
    'plans','shops','shop_members','sub_payments','audit_log','announcements','platform_settings',
    'pos_categories','pos_products','pos_customers','pos_suppliers','pos_sales','pos_sale_items',
    'pos_purchases','pos_purchase_items','pos_payments','pos_expenses','pos_stock_movements',
    'user_devices','device_resets','terms_acceptance','support_tickets','support_messages',
    'push_subscriptions','password_reset_requests','signup_attempts','activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists sa_all on public.%I', t);
    execute format('create policy sa_all on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())', t);
  end loop;
end $$;

-- عام صارف: صرف پڑھنا (لکھنا صرف اوپر کے security definer فنکشنز سے)
alter table public.platform_admins enable row level security;
drop policy if exists pa_self on public.platform_admins;
create policy pa_self on public.platform_admins for select to authenticated using (user_id = auth.uid());

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to authenticated using (true);
drop policy if exists settings_read on public.platform_settings;
create policy settings_read on public.platform_settings for select to authenticated using (true);
drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements for select to authenticated
  using (active and (shop_id is null or exists (select 1 from public.shop_members m where m.shop_id = announcements.shop_id and m.user_id = auth.uid())));
drop policy if exists members_self on public.shop_members;
create policy members_self on public.shop_members for select to authenticated using (user_id = auth.uid());
drop policy if exists shops_member on public.shops;
create policy shops_member on public.shops for select to authenticated
  using (exists (select 1 from public.shop_members m where m.shop_id = shops.id and m.user_id = auth.uid()));

do $$ declare t text; begin
  foreach t in array array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements'] loop
    execute format('drop policy if exists member_read on public.%I', 'pos_' || t);
    execute format($p$create policy member_read on public.%I for select to authenticated
      using (exists (select 1 from public.shop_members m where m.shop_id = %I.shop_id and m.user_id = auth.uid() and m.active))$p$,
      'pos_' || t, 'pos_' || t);
  end loop;
end $$;

drop policy if exists dev_self on public.user_devices;
create policy dev_self on public.user_devices for select to authenticated using (user_id = auth.uid());
drop policy if exists ta_self on public.terms_acceptance;
create policy ta_self on public.terms_acceptance for select to authenticated using (user_id = auth.uid());
drop policy if exists st_self on public.support_tickets;
create policy st_self on public.support_tickets for select to authenticated using (user_id = auth.uid());
drop policy if exists sm_self on public.support_messages;
create policy sm_self on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = support_messages.ticket_id and t.user_id = auth.uid()));
-- push_subscriptions, password_reset_requests, signup_attempts, activity_log, device_resets: عام صارف کو براہِ راست کچھ نہیں


-- ───────────────────────────────── 4) اجازتیں (Grants) ─────────────────────────────────

grant execute on function public.ping() to anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.sync_check_access(uuid) to authenticated;
grant execute on function public.sync_role(uuid) to authenticated;
grant execute on function public.sync_push(uuid, text, jsonb) to authenticated;
grant execute on function public.sync_pull(uuid, text, timestamptz, int) to authenticated;
grant execute on function public.rename_my_shop(uuid, text) to authenticated;
grant execute on function public.get_shop_settings(uuid) to authenticated;
grant execute on function public.save_shop_settings(uuid, jsonb) to authenticated;
grant execute on function public.register_device(uuid, text, text) to authenticated;
grant execute on function public.admin_reset_devices(uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_allow_device(uuid) to authenticated;
grant execute on function public.set_my_avatar(uuid, text) to authenticated;
grant execute on function public.set_my_name(uuid, text) to authenticated;
grant execute on function public.my_profile(uuid) to authenticated;
grant execute on function public.accept_terms(uuid, text, text) to authenticated;
grant execute on function public.support_send(uuid, uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.support_mark_read(uuid) to authenticated;
grant execute on function public.support_reply(uuid, text, boolean) to authenticated;
grant execute on function public.push_subscribe(text, text, text, uuid, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
grant execute on function public.request_password_reset(text, text) to anon, authenticated;
grant execute on function public.signup_info() to anon, authenticated;
grant execute on function public.activity_push(uuid, jsonb) to authenticated;


-- ───────────────────────────────── 5) Realtime + API ریفریش ─────────────────────────────────
-- نیا سپورٹ پیغام آتے ہی سپر ایڈمن کی ایپ میں فوری اطلاع (نہ چلے تو ایپ ہر 40 سیکنڈ میں خود چیک کرتی ہے)
do $$ begin
  alter publication supabase_realtime add table public.support_tickets;
exception when duplicate_object then null; when undefined_object then null; when others then null;
end $$;

notify pgrst, 'reload schema';


-- ───────────────────────────────── 6) پہلا Super Admin ─────────────────────────────────
-- Dashboard > Authentication > Users میں یوزر بنائیں (Email = 923001234567@pos-login.app ، Auto-confirm ✔)، پھر یہ چلائیں:
-- insert into public.platform_admins (user_id) select id from auth.users where email = '923001234567@pos-login.app';
