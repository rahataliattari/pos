-- Universal POS — سپورٹ پیغام کے ساتھ اسکرین شاٹ (چھوٹی JPEG تصویر).
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 15_support_tickets.sql کے بعد.
-- تصویر ایپ میں پہلے چھوٹی (JPEG، زیادہ سے زیادہ ~280KB) کر دی جاتی ہے، یہاں صرف جانچ کر کے محفوظ ہوتی ہے.

alter table public.support_messages add column if not exists image text;

-- پرانی support_send ہٹائیں تاکہ نئی (p_image کے ساتھ) اکیلی رہے اور کال میں ابہام نہ ہو
drop function if exists public.support_send(uuid, uuid, text, text, text, text, text);

create or replace function public.support_send(p_shop uuid, p_ticket uuid, p_kind text, p_topic text, p_subject text, p_body text, p_meta text default '', p_image text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m record;
  tid uuid := p_ticket;
  body text := btrim(coalesce(p_body, ''));
  subj text := btrim(coalesce(p_subject, ''));
  img text := nullif(p_image, '');
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if length(body) < 2 or length(body) > 1000 then raise exception 'bad_body' using errcode = '22023'; end if;
  if img is not null and (img not like 'data:image/jpeg;base64,%' or length(img) > 420000) then raise exception 'bad_image' using errcode = '22023'; end if;
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
  insert into public.support_messages (ticket_id, sender, sender_name, body, image) values (tid, 'user', coalesce(m.uname, ''), body, img);
  return tid;
end $$;

grant execute on function public.support_send(uuid, uuid, text, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
