-- Universal POS — اصلاح: save_shop_settings میں 'business_type' واپس شامل.
-- وجہ: 08 نے 'business_type' شامل کیا تھا، مگر 20_activity_reminders.sql نے فنکشن دوبارہ لکھ کر اسے ہٹا دیا
--       (اور 'receipt_style' شامل کیا). نتیجہ: 20 چلنے کے بعد کاروبار کی قسم سرور پر محفوظ نہیں ہوتی تھی
--       اور دوسرے فون پر کیٹلاگ کی قسم نہیں پہنچتی تھی.
-- یہ فائل دونوں کو ملا دیتی ہے (schema.sql والا حتمی ورژن). دوبارہ چلانا محفوظ ہے.

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

grant execute on function public.save_shop_settings(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
