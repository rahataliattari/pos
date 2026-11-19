-- صرف دیکھنے کے لیے (کچھ بدلتی نہیں): ہر دکان، اس کے صارف، اور ان کا لاگ اِن اکاؤنٹ
select s.name as shop, m.name as member, m.phone, m.role, m.active,
       u.email, (u.email_confirmed_at is not null) as confirmed, u.banned_until, u.created_at as auth_created
from public.shops s
left join public.shop_members m on m.shop_id = s.id
left join auth.users u on u.id = m.user_id
order by s.created_at desc;
