-- Universal POS — "ہم سے رابطہ کریں": صارف ایپ کے اندر سے مسئلہ / تجویز / سوال بھیجتا ہے، سپر ایڈمن کو نوٹیفکیشن آتا ہے اور وہ جواب دیتا ہے.
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 14 کے بعد چلائیں.
-- جب تک یہ فائل نہ چلے، ایپ میں "ہم سے رابطہ کریں" کھولنے پر "سرور پر آن نہیں" کا پیغام آئے گا؛ باقی ایپ پر کوئی اثر نہیں.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  user_id uuid not null,
  user_name text not null default '',
  shop_name text not null default '',
  phone text not null default '',
  kind text not null default 'problem' check (kind in ('problem', 'suggestion', 'question')),
  topic text not null default 'other',
  subject text not null,
  meta text not null default '',
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_unread boolean not null default true,
  user_unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user on public.support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_status on public.support_tickets (status, updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  sender_name text not null default '',
  body text not null,
  at timestamptz not null default now()
);
create index if not exists support_messages_ticket on public.support_messages (ticket_id, at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- سپر ایڈمن: سب کچھ
drop policy if exists sa_all on public.support_tickets;
create policy sa_all on public.support_tickets for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists sa_all on public.support_messages;
create policy sa_all on public.support_messages for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- صارف: صرف اپنے پیغامات پڑھ سکتا ہے (لکھنا صرف نیچے کے functions سے، تاکہ حدیں اور جانچ لاگو رہیں)
drop policy if exists st_self on public.support_tickets;
create policy st_self on public.support_tickets for select to authenticated using (user_id = auth.uid());
drop policy if exists sm_self on public.support_messages;
create policy sm_self on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = support_messages.ticket_id and t.user_id = auth.uid()));

-- صارف کا نیا پیغام / جواب. p_ticket خالی = نیا پیغام. ہر صارف فی گھنٹہ زیادہ سے زیادہ 10 پیغام.
create or replace function public.support_send(p_shop uuid, p_ticket uuid, p_kind text, p_topic text, p_subject text, p_body text, p_meta text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m record;
  tid uuid := p_ticket;
  body text := btrim(coalesce(p_body, ''));
  subj text := btrim(coalesce(p_subject, ''));
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if length(body) < 2 or length(body) > 1000 then raise exception 'bad_body' using errcode = '22023'; end if;
  select sm.name as uname, sm.phone as uphone, s.name as sname into m
    from public.shop_members sm join public.shops s on s.id = sm.shop_id
    where sm.shop_id = p_shop and sm.user_id = uid and sm.active limit 1;
  if not found then raise exception 'not_member' using errcode = '42501'; end if;
  if (select count(*) from public.support_messages g join public.support_tickets t on t.id = g.ticket_id
        where t.user_id = uid and g.sender = 'user' and g.at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit' using errcode = '54000';
  end if;
  if tid is null then
    if length(subj) < 3 or length(subj) > 80 then raise exception 'bad_subject' using errcode = '22023'; end if;
    insert into public.support_tickets (shop_id, user_id, user_name, shop_name, phone, kind, topic, subject, meta)
      values (p_shop, uid, coalesce(m.uname, ''), coalesce(m.sname, ''), coalesce(m.uphone, ''),
              case when p_kind in ('problem', 'suggestion', 'question') then p_kind else 'problem' end,
              case when p_topic in ('billing', 'stock', 'sync', 'login', 'subscription', 'other') then p_topic else 'other' end,
              subj, left(coalesce(p_meta, ''), 300))
      returning id into tid;
  else
    update public.support_tickets set status = 'open', admin_unread = true, user_unread = false, updated_at = now()
      where id = tid and user_id = uid;
    if not found then raise exception 'no_ticket' using errcode = '42501'; end if;
  end if;
  insert into public.support_messages (ticket_id, sender, sender_name, body) values (tid, 'user', coalesce(m.uname, ''), body);
  return tid;
end $$;

-- صارف نے جواب پڑھ لیا
create or replace function public.support_mark_read(p_ticket uuid) returns void
  language sql security definer set search_path = public as
$$ update public.support_tickets set user_unread = false where id = p_ticket and user_id = auth.uid() $$;

-- سپر ایڈمن کا جواب (p_close = true: جواب کے ساتھ بند)
create or replace function public.support_reply(p_ticket uuid, p_body text, p_close boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare body text := btrim(coalesce(p_body, ''));
begin
  if not public.is_platform_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  if length(body) < 1 or length(body) > 1000 then raise exception 'bad_body' using errcode = '22023'; end if;
  insert into public.support_messages (ticket_id, sender, sender_name, body) values (p_ticket, 'admin', 'Support', body);
  update public.support_tickets
    set status = case when p_close then 'closed' else 'answered' end, user_unread = true, admin_unread = false, updated_at = now()
    where id = p_ticket;
end $$;

grant execute on function public.support_send(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.support_mark_read(uuid) to authenticated;
grant execute on function public.support_reply(uuid, text, boolean) to authenticated;

-- فوری (realtime) اطلاع: نیا پیغام آتے ہی سپر ایڈمن کی ایپ میں بیج / نوٹیفکیشن. (نہ چلے تو ایپ ہر 40 سیکنڈ میں خود چیک کرتی ہے)
do $$ begin
  alter publication supabase_realtime add table public.support_tickets;
exception when duplicate_object then null; when undefined_object then null; when others then null;
end $$;

notify pgrst, 'reload schema';
