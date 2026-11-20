-- Universal POS — بل پر تصدیقی QR کوڈ کو پلان سے جوڑنا (پریمیم فیچر).
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 01_superadmin.sql کے بعد.
-- پلان میں bill_qr = true ہو تو اس پلان کی دکانوں کے بل پر QR چھپتا ہے؛ باقی پلانز پر QR بند رہتا ہے.
-- سپر ایڈمن > بلنگ > پلانز > پلان میں ترمیم سے کسی بھی پلان کے لئے آن/آف کیا جا سکتا ہے.

alter table public.plans add column if not exists bill_qr boolean not null default false;
update public.plans set bill_qr = true where id = 'premium';

notify pgrst, 'reload schema';
