-- Universal POS — رسید کی سیٹنگز (ہیڈر، فوٹر، فون، پتہ، NTN) سرور پر، تاکہ ہر فون پر خود آ جائیں.
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).
alter table public.shops add column if not exists settings jsonb not null default '{}'::jsonb;

-- پڑھنا: دکان کا کوئی بھی ممبر
create or replace function public.get_shop_settings(p_shop uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  perform public.sync_check_access(p_shop);
  return coalesce((select s.settings from public.shops s where s.id = p_shop), '{}'::jsonb);
end $$;

-- لکھنا: صرف مالک / مینیجر، اور صرف طے شدہ keys
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
  update public.shops set settings = coalesce(settings, '{}'::jsonb) || clean where id = p_shop;
end $$;

grant execute on function public.get_shop_settings(uuid) to authenticated;
grant execute on function public.save_shop_settings(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
