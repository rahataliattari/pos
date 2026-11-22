# Supabase (سرور کی طرف)

| فولڈر / فائل | کام |
|---|---|
| `schema.sql` | **نئی تنصیب**: پورا موجودہ اسکیما (ٹیبل، فنکشنز، RLS، اجازتیں). SQL Editor میں ایک بار چلائیں؛ دوبارہ چلانا محفوظ. |
| `migrations/` | **پہلے سے چلتی ڈیٹا بیس** کے لیے تبدیلیوں کی تاریخ (01 تا 26). نئی تنصیب پر انہیں نہ چلائیں. |
| `tools/` | ایک بار کے ایڈمن اسکرپٹ اور اختیاری cron (اسکیما کا حصہ نہیں). `delete_shop_data.sql` = ایک دکان کا ڈیٹا ایکسپورٹ اور حذف (حذف کی درخواست پر؛ ریہرسل کے ساتھ). |
| `functions/` | Edge Functions: `signup`, `admin-users`, `push-notify`. |

## نئی تنصیب
1. `schema.sql` پوری چلائیں.
2. Authentication > Users میں پہلا ایڈمن یوزر بنائیں اور `schema.sql` کے آخر والی `insert into platform_admins` ہدایت چلائیں.
3. Edge Functions deploy کریں؛ ضرورت ہو تو `tools/cron_examples.sql`.

## پہلے سے چلتی ڈیٹا بیس (جس پر 01 تا 22 چل چکی ہیں)
صرف وہ migration چلائیں جو آپ نے ابھی تک نہیں چلائی۔ پہلے 23، پھر 24، پھر 26 چلائیں۔ `25_data_api_grants.sql` کو فی الحال نہ چلائیں؛ اس میں تمام public tables پر وسیع grants ہیں۔ Migration 26 (`26_cashier_stock_sale_guard.sql`) کیشیئر کی stock movement کو موجودہ completed sale، اصل product اور فروخت شدہ quantity سے باندھتی ہے۔
(20 نے `save_shop_settings` سے `business_type` ہٹا دیا تھا؛ 22 اسے واپس لاتی ہے).

## نئی تبدیلی کیسے کریں
1. `migrations/` میں اگلے نمبر کی فائل لکھیں (`27_...sql`): چھوٹی، دوبارہ چلانے کے قابل (`if not exists`, `create or replace`).
2. **وہی تبدیلی `schema.sql` میں بھی کریں**، تاکہ نئی تنصیب اور پرانی ڈیٹا بیس ایک جیسی رہیں.
3. جس فنکشن کو دوبارہ لکھ رہے ہوں، پہلے `schema.sql` سے اس کا *موجودہ* ورژن لیں (پرانی migration سے نہیں): 08 اور 20 کی غلطی اسی طرح ہوئی تھی.

## ⚠ پرانی migrations کو بار بار نہ چلائیں
02 اور 11 دوبارہ چلانے سے `sync_check_access` / `sync_check_member` پرانے ہو جاتے ہیں؛ 20 دوبارہ چلانے سے `business_type` غائب ہو جاتا ہے.
اگر ایسا ہو جائے تو `schema.sql` دوبارہ چلا دیں، وہ فنکشنز کو حتمی ورژن پر لے آتی ہے.
