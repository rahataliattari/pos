-- Universal POS — ایک دکان کا سارا ڈیٹا مٹانا (حذف کی درخواست پر، یا میعاد کے بہت بعد).
-- Supabase Dashboard > SQL Editor. اسکیما کا حصہ نہیں؛ ہاتھ سے، ایک دکان کے لیے، چار قدموں میں چلائیں.
--
-- ⚠ مٹایا ہوا ڈیٹا واپس نہیں آتا. Supabase کا مفت پلان بیک اپ نہیں دیتا.
--   اس لیے: قدم 2 (ایکسپورٹ) کی فائل محفوظ کیے بغیر قدم 3 کی حقیقی مٹائی نہ چلائیں.
--
-- کیا مٹتا ہے: دکان، اس کے ممبرز، تمام کاروباری ریکارڈ (pos_*), ادائیگیاں، سپورٹ ٹکٹ، اعلانات، سرگرمی،
--   ڈیوائسز، شرائط کی قبولیت، پش subscriptions، اور وہ لاگ اِن اکاؤنٹ جو صرف اسی دکان کے ہیں.
-- کیا نہیں مٹتا: وہ لاگ اِن جو کسی دوسری دکان کے بھی ممبر ہیں، پلیٹ فارم ایڈمن، اور audit_log کی
--   پرانی لائنیں (ان میں دکان کا نام آ سکتا ہے). مٹانے کی اپنی لائن audit_log میں لکھی جاتی ہے.
-- کیا فون میں رہتا ہے: دکاندار کے فون کا مقامی ڈیٹا اس اسکرپٹ سے نہیں مٹتا (وہ اس کے براؤزر میں ہے).

-- ═══════════ قدم 1: فہرست — کون سی دکانیں مٹانے کے قابل ہیں ═══════════
-- 90 دن سے زیادہ پہلے میعاد ختم ہوئی (یہ نمبر legal.js کے `retain` کے برابر رکھیں)، یا آرکائیو ہیں.
select s.id, s.name, s.owner_name, s.phone, s.plan_id, s.expires_at::date as expired_on,
       (now()::date - s.expires_at::date) as days_since_expiry, s.archived, s.suspended,
       (select count(*) from public.pos_sales x where x.shop_id = s.id and x.deleted_at is null) as bills,
       (select count(*) from public.pos_products x where x.shop_id = s.id and x.deleted_at is null) as products
from public.shops s
where s.expires_at < now() - interval '90 days' or s.archived
order by s.expires_at;

-- ═══════════ قدم 2: ایکسپورٹ — دکان کا سارا ڈیٹا ایک JSON میں ═══════════
-- نیچے '<SHOP_ID>' کی جگہ قدم 1 والی id ڈالیں. نتیجے کے ایک خانے کی قدر کاپی کر کے .json فائل میں محفوظ کریں
-- (چاہیں تو مالک کو بھیج دیں). بڑا ڈیٹا ہو تو Dashboard کی "Download as JSON/CSV" استعمال کریں.
select jsonb_build_object(
  'exported_at', now(),
  'shop', to_jsonb(s),
  'members', (select coalesce(jsonb_agg(to_jsonb(m) - 'avatar'), '[]') from public.shop_members m where m.shop_id = s.id),
  'payments', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.sub_payments p where p.shop_id = s.id),
  'categories',      (select coalesce(jsonb_agg(data), '[]') from public.pos_categories      where shop_id = s.id),
  'products',        (select coalesce(jsonb_agg(data), '[]') from public.pos_products        where shop_id = s.id),
  'customers',       (select coalesce(jsonb_agg(data), '[]') from public.pos_customers       where shop_id = s.id),
  'suppliers',       (select coalesce(jsonb_agg(data), '[]') from public.pos_suppliers       where shop_id = s.id),
  'sales',           (select coalesce(jsonb_agg(data), '[]') from public.pos_sales           where shop_id = s.id),
  'sale_items',      (select coalesce(jsonb_agg(data), '[]') from public.pos_sale_items      where shop_id = s.id),
  'purchases',       (select coalesce(jsonb_agg(data), '[]') from public.pos_purchases       where shop_id = s.id),
  'purchase_items',  (select coalesce(jsonb_agg(data), '[]') from public.pos_purchase_items  where shop_id = s.id),
  'payments_ledger', (select coalesce(jsonb_agg(data), '[]') from public.pos_payments        where shop_id = s.id),
  'expenses',        (select coalesce(jsonb_agg(data), '[]') from public.pos_expenses        where shop_id = s.id),
  'stock_movements', (select coalesce(jsonb_agg(data), '[]') from public.pos_stock_movements where shop_id = s.id)
) as shop_export
from public.shops s where s.id = '<SHOP_ID>';

-- ═══════════ قدم 3: مٹانا ═══════════
-- پہلے v_do_delete := false رکھ کر چلائیں (ریہرسل): یہ کچھ نہیں مٹاتا، بلکہ "DRY RUN ..." کی غلطی میں بتاتا ہے
-- کہ کیا کیا مٹتا. سب ٹھیک لگے تو v_do_delete := true کر کے دوبارہ چلائیں.
-- حفاظت: دکان کا نام ہو بہو لکھنا ضروری ہے؛ فعال دکان (میعاد باقی، آرکائیو نہیں) کو یہ اسکرپٹ نہیں مٹاتا.
do $$
declare
  v_shop        uuid    := '<SHOP_ID>';
  v_name        text    := '<دکان کا نام ہو بہو>';
  v_do_delete   boolean := false;
  s             record;
  v_users       uuid[];
  n_members int; n_rows bigint := 0; n_t bigint; t text; n_users int;
begin
  select * into s from public.shops where id = v_shop;
  if not found then raise exception 'ایسی دکان نہیں ملی'; end if;
  if s.name is distinct from v_name then raise exception 'نام میل نہیں کھاتا (دکان کا نام: %)', s.name; end if;
  if not (s.archived or s.suspended or s.expires_at < now()) then
    raise exception 'یہ دکان ابھی فعال ہے (میعاد %). پہلے آرکائیو کریں یا میعاد ختم ہونے دیں', s.expires_at::date;
  end if;

  -- وہ لاگ اِن جو صرف اسی دکان کے ہیں (اور پلیٹ فارم ایڈمن نہیں)
  select coalesce(array_agg(m.user_id), '{}') into v_users
  from public.shop_members m
  where m.shop_id = v_shop
    and not exists (select 1 from public.shop_members o where o.user_id = m.user_id and o.shop_id <> v_shop)
    and not exists (select 1 from public.platform_admins a where a.user_id = m.user_id);
  select count(*) into n_members from public.shop_members where shop_id = v_shop;
  n_users := coalesce(array_length(v_users, 1), 0);

  foreach t in array array['categories','products','customers','suppliers','sales','sale_items',
                           'purchases','purchase_items','payments','expenses','stock_movements'] loop
    execute format('select count(*) from public.%I where shop_id = $1', 'pos_' || t) into n_t using v_shop;
    n_rows := n_rows + n_t;
  end loop;

  if not v_do_delete then
    raise exception 'DRY RUN (کچھ نہیں مٹا): دکان "%" ، ممبرز %، ان میں سے صرف اسی دکان کے لاگ اِن اکاؤنٹ %، کاروباری ریکارڈ %', s.name, n_members, n_users, n_rows;
  end if;

  -- جن ٹیبلز میں shops سے cascade نہیں
  delete from public.user_devices      where shop_id = v_shop or user_id = any(v_users);
  delete from public.terms_acceptance  where shop_id = v_shop or user_id = any(v_users);
  delete from public.push_subscriptions where shop_id = v_shop or user_id = any(v_users);
  delete from public.device_resets     where user_id = any(v_users);
  delete from public.activity_log      where user_id = any(v_users);
  -- دکان: ممبرز، pos_*، ادائیگیاں، ٹکٹ، اعلانات، سرگرمی cascade سے جاتے ہیں
  delete from public.shops where id = v_shop;
  -- صرف اسی دکان کے لاگ اِن اکاؤنٹ
  if n_users > 0 then delete from auth.users where id = any(v_users); end if;

  insert into public.audit_log (id, at, actor, action, target, detail)
  values (gen_random_uuid(), now(), 'sql-editor', 'shop_data_deleted', s.name || ' (' || v_shop || ')',
          'members=' || n_members || ', logins_removed=' || n_users || ', records=' || n_rows);
end $$;

-- ═══════════ قدم 4: تصدیق — سب 0 آنا چاہیے ═══════════
select
  (select count(*) from public.shops where id = '<SHOP_ID>')            as shops_left,
  (select count(*) from public.shop_members where shop_id = '<SHOP_ID>') as members_left,
  (select count(*) from public.pos_sales where shop_id = '<SHOP_ID>')    as sales_left,
  (select count(*) from public.pos_products where shop_id = '<SHOP_ID>') as products_left;
