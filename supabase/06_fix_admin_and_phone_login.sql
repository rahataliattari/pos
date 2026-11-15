-- 1) آپ کے اپنے فون نمبر والے اکاؤنٹ کا پاس ورڈ سیٹ کریں (نیچے 'Rahat1234' کی جگہ اپنا چاہا پاس ورڈ لکھیں، کم از کم 8 حروف)
update auth.users
set encrypted_password = crypt('Rahat1234', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = '923007774276@pos-login.app';

-- 2) آپ کا gmail اکاؤنٹ پلیٹ فارم ایڈمن ہو (پہلے سے ہو تو کچھ نہیں بدلتا)
insert into public.platform_admins (user_id)
select id from auth.users where email = 'rahataliattari@gmail.com'
on conflict do nothing;

-- 3) دیکھیں: اس وقت کون کون ایڈمن ہے
select u.email, u.email_confirmed_at is not null as confirmed
from public.platform_admins p join auth.users u on u.id = p.user_id;
