# migrations — پہلے سے چلتی ڈیٹا بیس کی تبدیلیوں کی تاریخ

> **نئی تنصیب پر انہیں نہ چلائیں** — وہاں صرف `../schema.sql` ایک بار چلائیں (وہ حتمی اسکیما ہے، اور دوبارہ چلانا محفوظ ہے)۔
> **سچ کا ماخذ `schema.sql` ہے۔** یہ فولڈر صرف اس لیے ہے کہ پرانی ڈیٹا بیس کو ایک ایک قدم آگے بڑھایا جا سکے۔

## قاعدے
1. نئی تبدیلی = اگلے نمبر کی فائل (`27_...sql`)، چھوٹی، دوبارہ چلانے کے قابل (`if not exists`, `create or replace`)۔
2. **وہی تبدیلی `schema.sql` میں بھی کریں۔**
3. کوئی فنکشن دوبارہ لکھنا ہو تو اس کا *موجودہ* متن `schema.sql` سے لیں، پرانی migration سے نہیں۔ 08 اور 20 کی غلطی اسی طرح ہوئی (20 نے `save_shop_settings` سے `business_type` ہٹا دیا، 22 نے واپس لگایا)۔
4. فائل کے شروع میں لکھیں: کیا کرتی ہے، کس کے بعد چلے، اور کون سا فنکشن بدلتی ہے۔
5. چلانے کی جگہ: Supabase Dashboard › SQL Editor۔

## فہرست
| # | فائل | کیا کرتی ہے |
|---|---|---|
| 01 | `01_superadmin.sql` | سپر ایڈمن کی بنیاد: `platform_admins`، پلانز، دکانیں، ممبر، ادائیگیاں، آڈٹ لاگ |
| 02 | `02_sync.sql` | سنک انجن: `pos_*` ٹیبل، `sync_push` / `sync_pull`، رسائی کی جانچ |
| 03 | `03_shop_rename.sql` | مالک دکان کا نام بدل سکے (`rename_my_shop`) |
| 04 | `04_shop_settings.sql` | رسید کی سیٹنگز سرور پر (`shops.settings`، `get/save_shop_settings`) |
| 05 | `05_fix_old_columns.sql` | پرانے اضافی NOT NULL کالم کی وجہ سے نئی دکان بننے کی رکاوٹ دور |
| 08 | `08_business_type.sql` | `business_type` کو دکان کی سیٹنگز میں شامل |
| 09 | `09_plan_bill_qr.sql` | بل پر تصدیقی QR کو پلان سے جوڑنا |
| 10 | `10_plan_barcodes.sql` | بارکوڈ کو پلان سے جوڑنا |
| 11 | `11_device_limit.sql` | ایک آئی ڈی = پلان کے مطابق محدود ڈیوائسز |
| 12 | `12_device_unblock.sql` | بند ڈیوائس کو دوبارہ اجازت |
| 13 | `13_profile_avatar.sql` | پروفائل تصویر |
| 14 | `14_terms_acceptance.sql` | شرائط کی قبولیت کا ریکارڈ |
| 15 | `15_support_tickets.sql` | "ہم سے رابطہ کریں" / سپورٹ ٹکٹ |
| 16 | `16_push.sql` | Web Push subscriptions |
| 17 | `17_reset_requests_announce.sql` | "پاس ورڈ بھول گئے" درخواستیں، دکان کے لیے مخصوص اعلان |
| 18 | `18_signup.sql` | سائن اپ (ڈیمو اکاؤنٹ) اور سپر ایڈمن کنٹرولز |
| 19 | `19_support_attachments.sql` | سپورٹ پیغام کے ساتھ اسکرین شاٹ |
| 20 | `20_activity_reminders.sql` | صارف کی سرگرمی، غیر فعال صارف کی یاد دہانی |
| 21 | `21_profile.sql` | پروفائل: نام بدلنا، اکاؤنٹ کی معلومات |
| 22 | `22_save_shop_settings_all_keys.sql` | اصلاح: `business_type` کی واپسی |
| 23 | `23_sync_push_plan_limit.sql` | اصلاح: پلان کی حد پر صرف وہی ریکارڈ `plan_limit` بنے، پورا سنک بیچ ناکام نہ ہو (ایپ کی `sync.js` کے ساتھ) |
| 24 | `24_cashier_hardening.sql` | کیشیئر کی sync پابندیاں، حذف/ترمیم کی روک تھام، حساس خریداری/اخراجات/سپلائر ڈیٹا کی حفاظت |
| 25 | `25_data_api_grants.sql` | public schema کی تمام tables/sequences پر وسیع grants؛ RLS audit کے بغیر اسے نہ چلائیں |
| 26 | `26_cashier_stock_sale_guard.sql` | کیشیئر کی stock movement کو completed sale، اصل product اور فروخت شدہ مقدار سے validate کرتا ہے |

**نمبر 06 اور 07 اس فولڈر میں نہیں ہیں۔** ان کی کوئی فائل ریپو میں نہیں۔ اگر آپ کی لائیو ڈیٹا بیس پر وہ کبھی چلائی گئی ہوں تو ان کا اثر `schema.sql` میں شامل ہے یا نہیں، یہ مجھے معلوم نہیں؛ شک ہو تو `schema.sql` دوبارہ چلانا محفوظ ہے۔

## ⚠ Migration 25 پر حفاظتی نوٹ
`25_data_api_grants.sql` تمام public tables پر authenticated کو SELECT/INSERT/UPDATE/DELETE دیتا ہے۔ RLS پالیسی ہر ٹیبل پر درست ہونے کی تصدیق کے بغیر اسے نہ چلائیں۔ اس کی `25_rollback.sql` blanket REVOKE استعمال نہیں کرتی؛ موجودہ rollback فائل اب محفوظ no-op ہے۔

## ⚠ پرانی migrations دوبارہ نہ چلائیں
- 02 یا 11 دوبارہ چلانے سے `sync_check_access` / `sync_check_member` پرانے ہو جاتے ہیں (18 بھی ان پر منحصر ہے)۔
- 20 دوبارہ چلانے سے `business_type` غائب ہو جاتا ہے۔
- غلطی سے چل جائے تو `schema.sql` دوبارہ چلا دیں؛ وہ فنکشنز کو حتمی ورژن پر لے آتی ہے۔

## کون سی چلائی جا چکی ہے، یہ کیسے دیکھیں
کوئی migrations ٹیبل نہیں ہے۔ نشانی سے جانچیں، مثلاً:
```sql
select to_regclass('public.support_tickets');                         -- 15
select to_regclass('public.push_subscriptions');                      -- 16
select to_regclass('public.signup_attempts');                         -- 18
select to_regclass('public.activity_log');                            -- 20
select pg_get_functiondef('public.save_shop_settings(uuid,jsonb)'::regprocedure) like '%business_type%';  -- 22
```


## Migration 26 — لازمی ٹیسٹ
23 اور 24 کے بعد چلائیں۔ پہلے test shop پر عام product bill، Quick Bill (کوئی stock movement نہیں)، duplicate sync retry، مختلف devices اور sold quantity سے زیادہ movement کی کوشش ٹیسٹ کریں۔ Live database پر چلانے سے پہلے backup رکھیں۔
