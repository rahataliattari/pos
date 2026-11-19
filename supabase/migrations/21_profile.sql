-- Universal POS — پروفائل صفحہ: اپنا نام بدلنا + اکاؤنٹ کی معلومات (ممبر بننے کی تاریخ، آخری لاگ اِن، ڈیوائسز).
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).

-- 1) ہر صارف صرف اپنا نام بدل سکتا ہے
create or replace function public.set_my_name(p_shop uuid, p_name text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  p_name := btrim(regexp_replace(coalesce(p_name, ''), '[\u0000-\u001f<>]', ' ', 'g'));
  if length(p_name) < 2 or length(p_name) > 60 then raise exception 'bad_name' using errcode = '22023'; end if;
  update public.shop_members set name = p_name where shop_id = p_shop and user_id = auth.uid();
end $$;
grant execute on function public.set_my_name(uuid, text) to authenticated;

-- 2) اپنے اکاؤنٹ کی معلومات (صرف اپنی)
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
grant execute on function public.my_profile(uuid) to authenticated;

notify pgrst, 'reload schema';
