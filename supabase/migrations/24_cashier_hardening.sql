-- Universal POS — migration 24: کیشیئر کی سرور حفاظت + sync plan_limit کا مشترکہ ورژن
-- Migration 23 = sync_push plan_limit؛ اس migration میں دونوں اصلاحات یکجا ہیں۔
-- موجودہ ڈیٹا/ٹیبلز نہیں بدلتے؛ صرف functions اور RLS policies اپ ڈیٹ ہوتی ہیں۔
-- پہلے migration 23_sync_push_plan_limit.sql چلائیں، پھر یہ فائل ایک بار چلائیں۔

-- has_role: حساس جدولوں کی RLS پالیسی کے لیے فعال ممبر کا کردار چیک کرتا ہے۔
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

    if v_deny then
      out := out || jsonb_build_object('id', v_id, 'status', 'denied');
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

notify pgrst, 'reload schema';
