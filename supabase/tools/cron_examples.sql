-- Universal POS — اختیاری خودکار کام (pg_cron + pg_net). اسکیما کا حصہ نہیں؛ <PROJECT> اور <CRON_SECRET> بدل کر ایک بار چلائیں.
-- غیر فعال صارفین کو روزانہ صبح 10 بجے (پاکستان وقت = 05:00 UTC) یاد دہانی. ہاتھ سے بھیجنے کے بٹن سپر ایڈمن ڈیش بورڈ میں ہیں.
select cron.schedule('inactive-sweep', '0 5 * * *', $$ select net.http_post(
  url := 'https://<PROJECT>.supabase.co/functions/v1/push-notify',
  headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
  body := '{"action":"inactive_sweep"}'::jsonb) $$);
