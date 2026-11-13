// Urdu-first translations. Urdu = default (RTL); English = LTR.
const I18N = {
  ur: {
    app_name: 'یونیورسل پی او ایس',
    email: 'ای میل', phone: 'موبائل نمبر', bad_phone: 'درست موبائل نمبر لکھیں (مثلاً 03001234567)', password: 'پاس ورڈ', login: 'لاگ اِن',
    login_need_online: 'پہلی بار لاگ اِن کے لیے انٹرنیٹ ضروری ہے',
    login_failed: 'لاگ اِن ناکام: ای میل یا پاس ورڈ چیک کریں',
    no_shop: 'اس اکاؤنٹ کے ساتھ کوئی دکان منسلک نہیں',
    choose_shop: 'دکان منتخب کریں',
    lib_missing: 'ضروری لائبریری لوڈ نہیں ہوئی۔ ایک بار انٹرنیٹ کے ساتھ ایپ کھولیں',
    logout: 'لاگ آؤٹ',
    logout_confirm: 'لاگ آؤٹ کریں؟ فون میں محفوظ ریکارڈ ختم نہیں ہوں گے۔',
    tab_bill: 'بلنگ', tab_products: 'پروڈکٹس', tab_sales: 'فروخت', tab_settings: 'سیٹنگز',
    online: 'آن لائن', offline: 'آف لائن', pending: 'زیرِ انتظار',
    sync_note: 'سنک انجن اگلے مرحلے میں آئے گا۔ تمام ریکارڈ فون میں محفوظ ہیں۔',
    search_ph: 'نام یا بارکوڈ لکھیں', scan: 'اسکین', scan_unsupported: 'اس فون پر کیمرا اسکین دستیاب نہیں',
    no_results: 'کوئی پروڈکٹ نہیں ملی', cart_empty: 'بل خالی ہے',
    subtotal: 'ذیلی کل', discount: 'رعایت', tax: 'ٹیکس', total: 'کل رقم',
    paid: 'وصول رقم', balance: 'باقی', change: 'واپسی',
    complete_sale: 'بل مکمل کریں', new_sale: 'نیا بل', print: 'پرنٹ', close: 'بند کریں',
    qty: 'مقدار', price: 'قیمت', stock: 'اسٹاک', stock_warn: 'اسٹاک کم یا ختم ہے (بل پھر بھی بن سکتا ہے)',
    add_product: 'نئی پروڈکٹ', edit_product: 'پروڈکٹ میں ترمیم',
    name: 'نام', name_ur: 'اردو نام', barcode: 'بارکوڈ', unit: 'اکائی',
    cost: 'خرید قیمت', sale_price: 'فروخت قیمت', min_stock: 'کم از کم اسٹاک',
    opening_stock: 'ابتدائی اسٹاک', stock_adjust: 'اسٹاک میں کمی/اضافہ (+/-)', adjust_note: 'وجہ',
    save: 'محفوظ کریں', cancel: 'منسوخ', delete: 'حذف', confirm_delete: 'یہ پروڈکٹ حذف کریں؟ پرانی فروخت کا ریکارڈ محفوظ رہے گا۔',
    saved: 'محفوظ ہو گیا', more: 'مزید', no_products: 'ابھی کوئی پروڈکٹ نہیں', read_only: 'پروڈکٹ صرف مالک یا مینیجر بدل سکتا ہے',
    sales_hist: 'فروخت کی تاریخ', invoice: 'بل نمبر', no_sales: 'ابھی کوئی فروخت نہیں',
    receipt: 'رسید', thanks: 'شکریہ', items: 'آئٹمز',
    language: 'زبان', tax_rate: 'ٹیکس فیصد', cashier_discount: 'کیشیئر رعایت دے سکتا ہے',
    cashier_price: 'کیشیئر قیمت بدل سکتا ہے', receipt_header: 'رسید کا اوپر کا متن',
    receipt_footer: 'رسید کا نیچے کا متن', paper_width: 'کاغذ کی چوڑائی',
    export_data: 'ڈیٹا ایکسپورٹ (JSON)', device_id: 'ڈیوائس ID', shop: 'دکان', role: 'کردار',
    owner: 'مالک', manager: 'مینیجر', cashier: 'کیشیئر', owner_only: 'یہ سیٹنگ صرف مالک بدل سکتا ہے',
    err_generic: 'کچھ غلط ہو گیا', yes: 'ہاں', cash: 'نقد'
  },
  en: {
    app_name: 'Universal POS',
    email: 'Email', phone: 'Mobile number', bad_phone: 'Enter a valid mobile number (e.g. 03001234567)', password: 'Password', login: 'Log in',
    login_need_online: 'Internet is required for the first login',
    login_failed: 'Login failed: check email or password',
    no_shop: 'No shop is linked to this account',
    choose_shop: 'Choose a shop',
    lib_missing: 'A required library did not load. Open the app once with internet',
    logout: 'Log out',
    logout_confirm: 'Log out? Records saved on this phone are not deleted.',
    tab_bill: 'Billing', tab_products: 'Products', tab_sales: 'Sales', tab_settings: 'Settings',
    online: 'Online', offline: 'Offline', pending: 'Pending',
    sync_note: 'The sync engine arrives in the next stage. All records are saved on this phone.',
    search_ph: 'Type name or barcode', scan: 'Scan', scan_unsupported: 'Camera scanning is not available on this phone',
    no_results: 'No product found', cart_empty: 'Bill is empty',
    subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax', total: 'Total',
    paid: 'Received', balance: 'Balance', change: 'Change',
    complete_sale: 'Complete sale', new_sale: 'New sale', print: 'Print', close: 'Close',
    qty: 'Qty', price: 'Price', stock: 'Stock', stock_warn: 'Stock is low or zero (the sale is still allowed)',
    add_product: 'New product', edit_product: 'Edit product',
    name: 'Name', name_ur: 'Urdu name', barcode: 'Barcode', unit: 'Unit',
    cost: 'Cost price', sale_price: 'Sale price', min_stock: 'Minimum stock',
    opening_stock: 'Opening stock', stock_adjust: 'Stock change (+/-)', adjust_note: 'Reason',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', confirm_delete: 'Delete this product? Past sales stay on record.',
    saved: 'Saved', more: 'More', no_products: 'No products yet', read_only: 'Only the owner or a manager can change products',
    sales_hist: 'Sales history', invoice: 'Invoice', no_sales: 'No sales yet',
    receipt: 'Receipt', thanks: 'Thank you', items: 'Items',
    language: 'Language', tax_rate: 'Tax %', cashier_discount: 'Cashier can give discounts',
    cashier_price: 'Cashier can change prices', receipt_header: 'Receipt header text',
    receipt_footer: 'Receipt footer text', paper_width: 'Paper width',
    export_data: 'Export data (JSON)', device_id: 'Device ID', shop: 'Shop', role: 'Role',
    owner: 'Owner', manager: 'Manager', cashier: 'Cashier', owner_only: 'Only the owner can change this setting',
    err_generic: 'Something went wrong', yes: 'Yes', cash: 'Cash'
  }
};

let LANG = 'ur';
function t(key) { return (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key; }
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'ur';
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ur' ? 'rtl' : 'ltr';
}
