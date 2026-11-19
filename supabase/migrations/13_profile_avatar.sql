-- Universal POS — اکاؤنٹ ہولڈر کی پروفائل تصویر (چھوٹی JPEG، ایپ خود 192px میں سکیڑ کر بھیجتی ہے).
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).
-- ہر صارف صرف اپنی تصویر بدل سکتا ہے؛ سپر ایڈمن سب کی تصویر صارفین کی فہرست میں دیکھتا ہے.

alter table public.shop_members add column if not exists avatar text;

create or replace function public.set_my_avatar(p_shop uuid, p_avatar text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  p_avatar := coalesce(p_avatar, '');
  if length(p_avatar) > 80000 then raise exception 'avatar_too_big' using errcode = '22023'; end if;
  if p_avatar <> '' and p_avatar !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' then raise exception 'bad_avatar' using errcode = '22023'; end if;
  update public.shop_members set avatar = nullif(p_avatar, '') where shop_id = p_shop and user_id = auth.uid();
end $$;

grant execute on function public.set_my_avatar(uuid, text) to authenticated;
notify pgrst, 'reload schema';
