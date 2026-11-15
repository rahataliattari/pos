-- Universal POS — (1) "پاس ورڈ بھول گئے" درخواستیں  (2) کسی ایک دکان کیلئے مخصوص اعلان.
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 16 کے بعد.

-- ───── 1) پاس ورڈ ری سیٹ کی درخواست (لاگ اِن سے پہلے، anon) ─────
-- خود بخود پاس ورڈ نہیں بدلتا: درخواست سپر ایڈمن کو جاتی ہے، وہ فون/واٹس ایپ پر شناخت کر کے نیا عارضی پاس ورڈ دیتا ہے.
-- جواب ہمیشہ ایک جیسا ہوتا ہے، اس لیے باہر والا نہیں جان سکتا کہ یہ نمبر ہمارے صارفین میں ہے یا نہیں.
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text not null default '',
  status text not null default 'open' check (status in ('open', 'done')),
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists pwreq_status on public.password_reset_requests (status, created_at desc);
alter table public.password_reset_requests enable row level security;
drop policy if exists sa_all on public.password_reset_requests;
create policy sa_all on public.password_reset_requests for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.request_password_reset(p_phone text, p_name text default '') returns uuid
  language plpgsql security definer set search_path = public as $$
declare d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'); rid uuid;
begin
  if d like '00%' then d := substr(d, 3); end if;
  if d like '0%' then d := '92' || substr(d, 2);
  elsif length(d) = 10 and d like '3%' then d := '92' || d; end if;
  if d !~ '^923[0-9]{9}$' then raise exception 'bad_phone' using errcode = '22023'; end if;
  select id into rid from public.password_reset_requests where phone = d and status = 'open' order by created_at desc limit 1;
  if rid is not null then return rid; end if;                                                        -- پہلے سے کھلی درخواست
  if (select count(*) from public.password_reset_requests where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'busy' using errcode = '54000';
  end if;
  insert into public.password_reset_requests (phone, name) values (d, left(btrim(coalesce(p_name, '')), 60)) returning id into rid;
  return rid;
end $$;
grant execute on function public.request_password_reset(text, text) to anon, authenticated;

-- ───── 2) مخصوص دکان کا اعلان (shop_id خالی = سب دکانوں کیلئے) ─────
alter table public.announcements add column if not exists shop_id uuid references public.shops(id) on delete cascade;
drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements for select to authenticated
  using (active and (shop_id is null or exists (select 1 from public.shop_members m where m.shop_id = announcements.shop_id and m.user_id = auth.uid())));

notify pgrst, 'reload schema';
