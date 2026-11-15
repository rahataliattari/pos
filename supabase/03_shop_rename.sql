-- Universal POS — دکان کا نام بدلنے کی اجازت (صرف مالک). SQL Editor میں ایک بار چلائیں.
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
grant execute on function public.rename_my_shop(uuid, text) to authenticated;
