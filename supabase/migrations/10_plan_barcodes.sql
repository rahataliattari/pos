-- Universal POS — بارکوڈ (فیلڈ، کیمرہ اسکین، بارکوڈ اسکینر) کو پلان سے جوڑنا.
-- Supabase Dashboard > SQL Editor میں ایک بار چلائیں (دوبارہ چلانا محفوظ ہے). 01_superadmin.sql کے بعد.
-- plans.barcodes = true ہو تو اس پلان کی دکانوں کو بارکوڈ کی سہولت ملتی ہے.
-- ابتدائی ترتیب: بنیادی = بند، اسٹینڈرڈ اور پریمیم = آن. سپر ایڈمن > بلنگ > پلانز سے بدل سکتے ہیں.
-- نوٹ: پہلے سے محفوظ بارکوڈ ڈیٹا کبھی نہیں مٹتا، صرف سہولت چھپتی ہے.

alter table public.plans add column if not exists barcodes boolean not null default false;
update public.plans set barcodes = true where id in ('standard', 'premium');

notify pgrst, 'reload schema';
