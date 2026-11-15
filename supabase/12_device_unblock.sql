-- Universal POS — بند کی گئی ڈیوائس کو دوبارہ اجازت دینا (بندش عارضی/واپس ہو سکتی ہے).
-- Supabase Dashboard > SQL Editor میں 11_device_limit.sql کے بعد ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).
-- اجازت دیتے وقت پلان کی ڈیوائس حد دیکھی جاتی ہے: حد پوری ہو تو پہلے کوئی اور ڈیوائس بند کریں یا پلان کی حد بڑھائیں.

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

grant execute on function public.admin_allow_device(uuid) to authenticated;
notify pgrst, 'reload schema';
