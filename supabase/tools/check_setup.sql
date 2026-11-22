-- Universal POS — سیٹ اپ کی جانچ (صرف دیکھتی ہے، کچھ نہیں بدلتی). SQL Editor میں پوری چلائیں.
-- نتیجہ: ہر سطر ایک جانچ؛ ok = true ہونا چاہیے. false کا مطلب: اس چیز کے لیے schema.sql (یا متعلقہ حصہ) دوبارہ چلائیں.
with
t_need(name) as (values ('shops'),('shop_members'),('plans'),('platform_admins'),('platform_settings'),('sub_payments'),('audit_log'),
  ('announcements'),('user_devices'),('device_resets'),('terms_acceptance'),('push_subscriptions'),('password_reset_requests'),
  ('signup_attempts'),('activity_log'),('support_tickets'),('support_messages'),
  ('pos_categories'),('pos_products'),('pos_customers'),('pos_suppliers'),('pos_sales'),('pos_sale_items'),
  ('pos_purchases'),('pos_purchase_items'),('pos_payments'),('pos_expenses'),('pos_stock_movements')),
f_need(name) as (values ('accept_terms'),('activity_push'),('admin_allow_device'),('admin_reset_devices'),('enforce_plan_limit'),
  ('get_shop_settings'),('has_role'),('is_platform_admin'),('my_profile'),('ping'),('push_subscribe'),('push_unsubscribe'),('register_device'),
  ('rename_my_shop'),('request_device_id'),('request_password_reset'),('save_shop_settings'),('set_my_avatar'),('set_my_name'),
  ('signup_info'),('support_mark_read'),('support_reply'),('support_send'),('sync_check_access'),('sync_check_device'),
  ('sync_check_member'),('sync_pull'),('sync_push'),('sync_role'))
select 'ٹیبل موجود: ' || n.name as item, to_regclass('public.' || n.name) is not null as ok from t_need n
union all
select 'RLS چالو: ' || n.name, coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || n.name)), false) from t_need n
union all
select 'فنکشن موجود: ' || f.name, exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = f.name) from f_need f
union all
-- کاروباری ٹیبل پر ممبر صرف پڑھ سکتے ہیں: sa_all (صرف پلیٹ فارم ایڈمن) کے سوا کوئی insert/update/delete/all پالیسی نہیں ہونی چاہیے
select 'pos_* پر براہِ راست لکھنے کی پالیسی نہیں: ' || n.name,
       not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = n.name and p.cmd <> 'SELECT' and p.policyname <> 'sa_all')
from t_need n where n.name like 'pos\_%'
union all
select 'پلان کی حد کا ٹریگر: pos_products', exists (select 1 from pg_trigger where tgname = 'trg_limit_products' and not tgisinternal)
union all
select 'پلان کی حد کا ٹریگر: pos_sales', exists (select 1 from pg_trigger where tgname = 'trg_limit_sales' and not tgisinternal)
union all
select 'کم از کم ایک پلیٹ فارم ایڈمن موجود', exists (select 1 from public.platform_admins)
union all
select 'کم از کم ایک پلان موجود', exists (select 1 from public.plans)
union all
select 'platform_settings کی قطار (id=1) موجود', exists (select 1 from public.platform_settings where id = 1)
union all
select 'save_shop_settings میں business_type شامل (migration 22)',
       coalesce((select pg_get_functiondef(p.oid) like '%business_type%' from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                 where s.nspname = 'public' and p.proname = 'save_shop_settings' limit 1), false)
union all
select 'کیشیئر اسٹاک موومنٹ کا تحفظ (migration 26)',
       coalesce((select pg_get_functiondef(p.oid) like '%v_used_qty%' and pg_get_functiondef(p.oid) like '%pos_sale_items%'
                 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                 where s.nspname = 'public' and p.proname = 'sync_push' limit 1), false)
order by ok, 1;

-- اضافی معلومات (ok/false نہیں، صرف دیکھنے کے لیے):
select 'پلانز' as what, string_agg(id || ' (محصولات ' || coalesce(max_products, 0) || ', بل ' || coalesce(max_bills, 0) || ', ڈیوائسز ' || coalesce(max_devices, 1) || ')', ' | ') as info from public.plans
union all
select 'ٹرائل / ڈیمو کے دن', 'trial_days=' || trial_days || ', demo_days=' || demo_days from public.platform_settings where id = 1;
