-- Universal POS — پرانے ٹیبل کے اضافی NOT NULL کالم (مثلاً shops.created_by) کی وجہ سے نئی دکان نہیں بن رہی تھی.
-- SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے).

-- 1) created_by: خالی ہو سکتا ہے، اور نہ بھیجا جائے تو موجودہ لاگ اِن یوزر خود بھر جائے
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='shops' and column_name='created_by') then
    alter table public.shops alter column created_by drop not null;
    alter table public.shops alter column created_by set default auth.uid();
  end if;
end $$;

-- 2) shops / shop_members میں باقی کوئی بھی پرانا NOT NULL کالم (بغیر ڈیفالٹ) جو ایپ نہیں بھرتی، اسے بھی نرم کر دیں
do $$
declare r record;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.is_nullable = 'NO' and c.column_default is null and c.is_identity = 'NO'
      and ((c.table_name = 'shops'        and c.column_name not in ('id', 'name'))
        or (c.table_name = 'shop_members' and c.column_name not in ('id', 'shop_id', 'user_id', 'role')))
  loop
    execute format('alter table public.%I alter column %I drop not null', r.table_name, r.column_name);
    raise notice 'relaxed NOT NULL on %.%', r.table_name, r.column_name;
  end loop;
end $$;

notify pgrst, 'reload schema';
