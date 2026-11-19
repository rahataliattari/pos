-- Universal POS — Sync Engine (server side).
-- Supabase Dashboard > SQL Editor میں 01_superadmin.sql کے بعد ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).
--
-- ہر لوکل ٹیبل کے لیے ایک سرور ٹیبل pos_<نام> بنتا ہے:
--   id, shop_id, version, updated_at, deleted_at  +  data (مکمل ریکارڈ jsonb میں)  +  server_ts (سرور کا وقت، pull کا cursor)
-- لکھنا صرف sync_push() سے ہوتا ہے، پڑھنا sync_pull() یا RLS (صرف اپنی دکان کے ممبر).

-- 0) پرانے (کسی اور ورژن کے) sync فنکشنز ہٹاتا ہے، ہر سگنیچر، تاکہ نئے بن سکیں
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('sync_push', 'sync_pull', 'sync_check_access')
  loop
    execute 'drop function if exists ' || f.sig || ' cascade';
  end loop;
end $$;

-- 0b) پرانے pos_ ٹیبل جن کا ڈھانچہ مختلف ہو، نام بدل کر محفوظ کر دیے جاتے ہیں (ڈیٹا ضائع نہیں ہوتا)
do $$
declare t text; c text; missing int;
begin
  foreach t in array array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements'] loop
    if to_regclass('public.pos_' || t) is not null then
      select count(*) into missing from unnest(array['id','shop_id','version','updated_at','deleted_at','data','server_ts']) col
        where not exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'pos_' || t and column_name = col);
      if missing > 0 then
        execute format('alter table public.%I rename to %I', 'pos_' || t, 'pos_' || t || '_old_' || to_char(clock_timestamp(), 'HH24MISSMS'));
      end if;
    end if;
  end loop;
end $$;

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
    execute format('alter table public.%I enable row level security', 'pos_' || t);
    execute format('drop policy if exists member_read on public.%I', 'pos_' || t);
    execute format($p$create policy member_read on public.%I for select to authenticated
      using (exists (select 1 from public.shop_members m where m.shop_id = %I.shop_id and m.user_id = auth.uid() and m.active))$p$,
      'pos_' || t, 'pos_' || t);
    execute format('drop policy if exists sa_all on public.%I', 'pos_' || t);
    execute format('create policy sa_all on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())', 'pos_' || t);
  end loop;
end $$;

-- ممبر + دکان کی حالت (suspended / archived / expired) کی جانچ
create or replace function public.sync_check_access(p_shop uuid) returns void
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

-- کردار: owner / manager / cashier (پلیٹ فارم ایڈمن = owner)
create or replace function public.sync_role(p_shop uuid) returns text
  language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then 'owner'
              else (select m.role from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.active limit 1) end
$$;
grant execute on function public.sync_role(uuid) to authenticated;

-- push: ریکارڈز کا بیچ. ہر ریکارڈ کا نتیجہ: ok | conflict (سرور والا ورژن واپس)
create or replace function public.sync_push(p_shop uuid, p_table text, p_rows jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb; tbl text; ex record; v_ver int; v_upd timestamptz; v_id uuid; v_role text; v_denied boolean;
  out jsonb := '[]'::jsonb;
begin
  if p_table <> all (array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements']) then
    raise exception 'bad_table';
  end if;
  perform public.sync_check_access(p_shop);
  tbl := 'pos_' || p_table;
  v_role := public.sync_role(p_shop);
  -- کیشیئر صرف فروخت، اس کی آئٹمز، اسٹاک موومنٹ، ادائیگی اور کسٹمر لکھ سکتا ہے؛ باقی (پروڈکٹ، خریداری، خرچہ...) مالک/مینیجر
  v_denied := v_role = 'cashier' and p_table <> all (array['sales','sale_items','stock_movements','payments','customers']);

  for r in select * from jsonb_array_elements(p_rows) loop
    if (r->>'shop_id')::uuid is distinct from p_shop then raise exception 'shop_mismatch'; end if;
    v_id := (r->>'id')::uuid;
    if v_denied or (v_role = 'cashier' and p_table = 'sales' and (r->>'status' = 'void' or coalesce((r->>'returned_total')::numeric, 0) > 0))
       or (v_role = 'cashier' and p_table = 'sale_items' and coalesce((r->>'returned_qty')::numeric, 0) > 0) then
      out := out || jsonb_build_object('id', v_id, 'status', 'denied');
      continue;
    end if;
    v_ver := coalesce((r->>'version')::int, 1);
    v_upd := coalesce((r->>'updated_at')::timestamptz, now());

    execute format('select version, updated_at, data from public.%I where id = $1 and shop_id = $2', tbl)
      into ex using v_id, p_shop;

    if ex.version is null then
      execute format('insert into public.%I (id, shop_id, version, updated_at, deleted_at, data) values ($1,$2,$3,$4,$5,$6)', tbl)
        using v_id, p_shop, v_ver, v_upd, nullif(r->>'deleted_at','')::timestamptz, r;
      out := out || jsonb_build_object('id', v_id, 'status', 'ok');
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

grant execute on function public.sync_push(uuid, text, jsonb) to authenticated;
grant execute on function public.sync_pull(uuid, text, timestamptz, int) to authenticated;
grant execute on function public.sync_check_access(uuid) to authenticated;
-- نوٹ: پرانا sync_role بھی ہو تو create or replace اسے بدل دیتا ہے

-- Supabase API کو نئے فنکشنز کی فہرست فوراً تازہ کرواتا ہے
notify pgrst, 'reload schema';
