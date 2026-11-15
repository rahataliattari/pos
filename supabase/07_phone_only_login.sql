-- 07 — صرف موبائل نمبر سے لاگ اِن (ای میل ختم)
-- Supabase → SQL Editor میں پورا چلائیں۔ بار بار چلانا محفوظ ہے۔
--
-- ایپ میں لاگ اِن اب صرف موبائل نمبر + پاس ورڈ ہے۔ Supabase کو اندر ایک "ٹیکنیکل آئی ڈی" چاہیے ہوتی ہے
-- (92300…@pos-login.app) — یہ خود بنتی ہے، کوئی اسے لکھتا یا دیکھتا نہیں۔
-- یہ اسکرپٹ: (A) آپ کا ایڈمن اکاؤنٹ موبائل نمبر پر لے آتی ہے، (B) باقی سب صارفین کا لاگ اِن بھی ان کے نمبر پر کر دیتی ہے۔

do $$
declare
  -- ★ یہاں اپنا موبائل نمبر لکھیں، 92 سے شروع کر کے (03007774276 ← 923007774276)
  v_phone text := '923007774276';
  v_email text;
  v_phone_uid uuid;
  v_old_admin_uid uuid;
  r record;
  n_fixed int := 0;
  d text;
begin
  v_email := v_phone || '@pos-login.app';
  select id into v_phone_uid from auth.users where email = v_email;
  select id into v_old_admin_uid from auth.users where email = 'rahataliattari@gmail.com';

  -- A) پلیٹ فارم ایڈمن اب موبائل نمبر والا اکاؤنٹ ہو
  if v_phone_uid is not null then
    insert into public.platform_admins (user_id) values (v_phone_uid) on conflict do nothing;
    raise notice 'ایڈمن: % (موجودہ اکاؤنٹ)', v_email;
  elsif v_old_admin_uid is not null then
    -- نمبر والا اکاؤنٹ نہیں تھا: پرانے gmail اکاؤنٹ کا لاگ اِن آئی ڈی بدل کر نمبر پر لے آئیں (پاس ورڈ وہی رہے گا)
    update auth.users
       set email = v_email, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
     where id = v_old_admin_uid;
    begin
      update auth.identities
         set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email)),
             provider_id = v_email, updated_at = now()
       where user_id = v_old_admin_uid and provider = 'email';
    exception when others then null;   -- پرانے Supabase ورژن میں یہ کالم نہ ہوں تو کوئی حرج نہیں
    end;
    insert into public.platform_admins (user_id) values (v_old_admin_uid) on conflict do nothing;
    raise notice 'ایڈمن: gmail اکاؤنٹ اب % پر منتقل ہو گیا', v_email;
  else
    raise exception 'نہ نمبر والا اکاؤنٹ ملا نہ gmail والا — اوپر v_phone چیک کریں';
  end if;

  -- B) ہر دکان کے ہر صارف (مالک/مینیجر/کیشیئر) کا لاگ اِن بھی اس کے فون نمبر پر ہو
  for r in
    select m.user_id, m.phone, u.email
      from public.shop_members m join auth.users u on u.id = m.user_id
     where m.phone is not null and u.email not like '%@pos-login.app'
  loop
    d := regexp_replace(r.phone, '\D', '', 'g');
    if d like '00%' then d := substr(d, 3); end if;
    if d like '0%' then d := '92' || substr(d, 2);
    elsif length(d) = 10 and d like '3%' then d := '92' || d; end if;
    if d ~ '^923\d{9}$' then
      begin
        update auth.users set email = d || '@pos-login.app', email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = r.user_id;
        begin
          update auth.identities set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(d || '@pos-login.app')),
                 provider_id = d || '@pos-login.app', updated_at = now() where user_id = r.user_id and provider = 'email';
        exception when others then null;
        end;
        n_fixed := n_fixed + 1;
      exception when others then
        raise notice 'چھوڑ دیا (نمبر پہلے سے استعمال میں؟): % → %', r.email, d;
      end;
    end if;
  end loop;
  raise notice 'نمبر پر منتقل ہونے والے صارفین: %', n_fixed;
end $$;

-- (اختیاری) اگر ایڈمن کا پاس ورڈ بھول گئے ہوں تو نیچے دو لائنوں سے '--' ہٹا کر نیا پاس ورڈ (کم از کم 8 حروف) لکھیں اور اکیلی یہی دو لائنیں چلائیں:
-- update auth.users set encrypted_password = crypt('نیا_پاس_ورڈ_یہاں', gen_salt('bf'))
--  where email = '923007774276@pos-login.app';

-- نتیجہ دیکھیں: ایڈمن کا لاگ اِن آئی ڈی (92300… والی ہونی چاہیے) اور وہ صارف جن کا لاگ اِن ابھی نمبر والا نہیں
select 'admin' as kind, u.email, u.email_confirmed_at is not null as confirmed
  from public.platform_admins p join auth.users u on u.id = p.user_id
union all
select 'ابھی ای میل والا' as kind, u.email, u.email_confirmed_at is not null
  from public.shop_members m join auth.users u on u.id = m.user_id
 where u.email not like '%@pos-login.app';
