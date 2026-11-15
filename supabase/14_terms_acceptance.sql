-- Universal POS — شرائط / معاہدے کی قبولیت کا ریکارڈ (کس نے، کب، کون سا ورژن، کس ڈیوائس سے).
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).
-- دیکھنے کیلئے:  select * from public.terms_acceptance order by accepted_at desc;
-- نیا ورژن لاگو کرنے کیلئے legal.js میں LEGAL_CFG.version بدلیں: ہر صارف سے دوبارہ قبولیت مانگی جائے گی.

create table if not exists public.terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shop_id uuid,
  version text not null,
  accepted_at timestamptz not null default now(),
  device_name text not null default '',
  unique (user_id, version)
);
alter table public.terms_acceptance enable row level security;
drop policy if exists sa_all on public.terms_acceptance;
create policy sa_all on public.terms_acceptance for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists ta_self on public.terms_acceptance;
create policy ta_self on public.terms_acceptance for select to authenticated using (user_id = auth.uid());

create or replace function public.accept_terms(p_shop uuid, p_version text, p_device text default '') returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if coalesce(p_version, '') = '' or length(p_version) > 20 then raise exception 'bad_version' using errcode = '22023'; end if;
  insert into public.terms_acceptance (user_id, shop_id, version, device_name)
    values (auth.uid(), p_shop, p_version, left(coalesce(p_device, ''), 80))
    on conflict (user_id, version) do nothing;
end $$;

grant execute on function public.accept_terms(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
