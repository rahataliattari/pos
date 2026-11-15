-- Universal POS — دکان کی "کاروبار کی قسم" (business_type) سرور پر، تاکہ ہر فون پر وہی کیٹلاگ کھلے.
-- Supabase Dashboard > SQL Editor میں 04_shop_settings.sql کے بعد ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).
-- صرف save_shop_settings کی اجازت شدہ keys کی فہرست میں 'business_type' بڑھایا گیا ہے، باقی سب 04 جیسا ہے.

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
  update public.shops set settings = coalesce(settings, '{}'::jsonb) || clean where id = p_shop;
end $$;

grant execute on function public.save_shop_settings(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
