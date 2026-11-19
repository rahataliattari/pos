-- Universal POS — Web Push: ہر ڈیوائس کی subscription محفوظ کرتا ہے (بھیجنا Edge Function push-notify کرتا ہے).
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 15 کے بعد.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  shop_id uuid,
  p256dh text not null,
  auth text not null,
  is_admin boolean not null default false,
  ua text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subscriptions (user_id);
create index if not exists push_subs_shop on public.push_subscriptions (shop_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists sa_all on public.push_subscriptions;
create policy sa_all on public.push_subscriptions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
-- عام صارفین براہِ راست کچھ نہیں پڑھ/لکھ سکتے؛ صرف نیچے کے functions سے۔ بھیجنے والا Edge Function service-role سے پڑھتا ہے۔

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_shop uuid default null, p_ua text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if coalesce(p_endpoint, '') = '' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'bad_subscription' using errcode = '22023';
  end if;
  if p_shop is not null and not exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid()) and not public.is_platform_admin() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, shop_id, p256dh, auth, is_admin, ua)
    values (p_endpoint, auth.uid(), p_shop, p_p256dh, p_auth, public.is_platform_admin(), left(coalesce(p_ua, ''), 200))
  on conflict (endpoint) do update set user_id = auth.uid(), shop_id = p_shop, p256dh = excluded.p256dh, auth = excluded.auth,
    is_admin = public.is_platform_admin(), ua = excluded.ua, updated_at = now();
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns void
  language sql security definer set search_path = public as
$$ delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid() $$;

grant execute on function public.push_subscribe(text, text, text, uuid, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
notify pgrst, 'reload schema';
