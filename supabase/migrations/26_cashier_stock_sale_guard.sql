-- Universal POS — migration 26: کیشیئر کی اسٹاک موومنٹ کو حقیقی فروخت سے باندھنا
-- پہلے migrations 23 اور 24 مکمل ہونے چاہئیں۔ Migration 25 (وسیع grants) اس کے لیے ضروری نہیں۔
-- یہ صرف sync_push کو اپ ڈیٹ کرتی ہے؛ موجودہ ڈیٹا یا ٹیبلز تبدیل/حذف نہیں ہوتے۔
-- کیشیئر کے لیے: مکمل شدہ سرور فروخت لازمی، ref_type/ref_id لازمی، Quick Bill اسٹاک نہیں بناتا،
-- اور ہر پروڈکٹ کی مجموعی اسٹاک کمی فروخت شدہ مقدار سے زیادہ نہیں ہو سکتی۔

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
end $$; then
        v_deny := true;
      else
        v_sale_id := (r->>'ref_id')::uuid;
        select data->>'status' into v_sale_status
          from public.pos_sales
         where id = v_sale_id and shop_id = p_shop
         for update;

        if coalesce(v_sale_status, '') <> 'completed' then
          v_deny := true;
        else
          select coalesce(sum(
                   coalesce(nullif(data->>'qty', '')::numeric, 0)
                   * coalesce(nullif(data->>'unit_factor', '')::numeric, 1)
                 ), 0)
            into v_sale_qty
            from public.pos_sale_items
           where shop_id = p_shop
             and data->>'sale_id' = v_sale_id::text
             and data->>'product_id' = r->>'product_id'
             and coalesce((data->>'quick')::boolean, false) = false;

          select coalesce(sum(abs(coalesce(nullif(data->>'qty_change', '')::numeric, 0))), 0)
            into v_used_qty
            from public.pos_stock_movements
           where shop_id = p_shop
             and data->>'reason' = 'sale'
             and data->>'ref_type' = 'sale'
             and data->>'ref_id' = v_sale_id::text
             and data->>'product_id' = r->>'product_id'
           and id <> v_id;

          if v_sale_qty <= 0
             or v_used_qty + abs((r->>'qty_change')::numeric) > v_sale_qty then
            v_deny := true;
          end if;
        end if;
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

notify pgrst, 'reload schema';
