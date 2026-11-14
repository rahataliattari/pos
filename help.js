// Universal POS — in-app guides, one per role. Each section: [title_ur, title_en, [[line_ur, line_en], ...]].
// Shown from Settings -> "ہدایات / Help" (shop roles) and Super Admin -> More -> Help. Loaded BEFORE superadmin.js and app.js.

const HELP_ROLE_LABEL = { superadmin: ['سپر ایڈمن', 'Super Admin'], owner: ['مالک', 'Owner'], manager: ['مینیجر', 'Manager'], cashier: ['کیشیئر', 'Cashier'] };

const HELP_SHARED_LOGIN = ['لاگ اِن اور آف لائن کام', 'Login and working offline', [
  ['لاگ اِن اپنے موبائل نمبر (مثلاً 03001234567) اور پاس ورڈ سے ہوتا ہے۔ نمبر اور عارضی پاس ورڈ آپ کو سپر ایڈمن / سپورٹ دیتا ہے۔', 'Log in with your mobile number (e.g. 03001234567) and password. Your number and temporary password come from Super Admin / support.'],
  ['پہلی بار لاگ اِن کے لیے انٹرنیٹ ضروری ہے۔ اس کے بعد انٹرنیٹ نہ بھی ہو تو بل بنتے رہتے ہیں؛ اوپر "آف لائن" لکھا آئے گا اور بل "زیرِ انتظار" میں گنے جائیں گے۔', 'The first login needs internet. After that you can keep billing without it; the header shows "Offline" and bills count as "Pending".'],
  ['لاگ آؤٹ کرنے سے فون میں محفوظ ریکارڈ ختم نہیں ہوتا۔', 'Logging out does not delete the records saved on the phone.'],
  ['اگر آپ کی دکان معطل یا میعاد ختم ہو تو اگلے لاگ اِن پر داخلہ بند ہوگا۔ تجدید کے لیے سپورٹ سے رابطہ کریں۔', 'If your shop is suspended or expired, login is blocked next time. Contact support to renew.']
]];

const HELP_BILLING = ['بل بنانا (بلنگ)', 'Making a bill', [
  ['نیچے بیچ والے سبز "بل" بٹن سے بلنگ کھولیں۔ اوپر نام یا بارکوڈ لکھ کر پروڈکٹ ڈھونڈیں، یا اسکین بٹن سے کیمرا استعمال کریں۔', 'Open Billing with the green "Bill" button at the bottom. Search a product by name or barcode, or use Scan for the camera.'],
  ['پروڈکٹ پر ٹیپ کرنے سے وہ بل میں شامل ہو جاتی ہے؛ + / − سے مقدار بدلیں۔', 'Tap a product to add it; change quantity with + / −.'],
  ['"وصول رقم" میں گاہک سے لی گئی رقم لکھیں۔ باقی بچے تو وہ ادھار بنتا ہے اور اس کے لیے کسٹمر منتخب کرنا ضروری ہے۔', 'Enter the money received under "Paid". Any remainder becomes credit (udhaar) and needs a customer selected.'],
  ['اسٹاک کم یا ختم ہو تو وارننگ آتی ہے مگر بل پھر بھی بن سکتا ہے۔', 'Low or zero stock shows a warning, but the bill can still be made.'],
  ['"بل مکمل کریں" کے بعد رسید پرنٹ کریں یا واٹس ایپ پر بھیجیں۔ پرانی رسید "فروخت" ٹیب میں دوبارہ کھل جاتی ہے۔', 'After "Complete sale", print the receipt or send it on WhatsApp. Old receipts reopen from the "Sales" tab.']
]];

const HELP_CUSTOMERS = ['کسٹمرز اور ادھار', 'Customers and credit', [
  ['کسٹمرز میں نام اور نمبر کے ساتھ نیا کسٹمر بنائیں؛ پرانا ادھار "پرانا ادھار (شروع کا)" میں لکھ سکتے ہیں۔', 'Add a customer with name and number; enter any old balance under "Opening balance".'],
  ['کسٹمر کھول کر "وصولی" سے رقم وصول کریں، یا "ادھار درج کریں" سے ادھار بڑھائیں۔ کھاتہ میں ہر لین دین اور باقی رقم نظر آتی ہے۔', 'Open a customer: "Receive payment" collects money, "Add udhaar" adds credit. The ledger shows every entry and the running balance.'],
  ['"یاد دہانی" واٹس ایپ پر ادھار کا پیغام تیار کرتی ہے؛ "کال" سے براہِ راست فون ملائیں۔', '"Remind" prepares a WhatsApp message about the balance; "Call" dials directly.'],
  ['جب تک ادھار باقی ہو کسٹمر حذف نہیں ہو سکتا۔', 'A customer with an outstanding balance cannot be deleted.']
]];

const HELP_PRODUCTS = ['پروڈکٹس اور اسٹاک', 'Products and stock', [
  ['انوینٹری ٹیب میں "نئی پروڈکٹ": نام، بارکوڈ، خرید قیمت، فروخت قیمت، کم از کم اسٹاک اور ابتدائی اسٹاک لکھیں۔', 'Inventory tab -> "New product": enter name, barcode, cost, sale price, minimum stock and opening stock.'],
  ['پروڈکٹ پر ٹیپ کر کے ترمیم کریں۔ اسٹاک میں کمی/اضافہ (+/−) وجہ کے ساتھ لکھیں تاکہ بعد میں حساب ملے۔', 'Tap a product to edit. Adjust stock with +/− and a reason so the count can be traced later.'],
  ['پروڈکٹ حذف کرنے سے پرانی فروخت کا ریکارڈ ختم نہیں ہوتا۔', 'Deleting a product does not remove old sales records.'],
  ['رپورٹس میں "کم اسٹاک" فہرست دیکھ کر وقت پر مال منگوائیں۔', 'Use the "Low stock" list in Reports to reorder in time.']
]];

const HELP_PURCHASES = ['خریداری اور سپلائرز', 'Purchases and suppliers', [
  ['خریداری میں پہلے سپلائر بنائیں، پھر "نئی خریداری": پروڈکٹ تلاش کر کے مقدار اور خرید قیمت لکھیں۔ محفوظ کرنے پر اسٹاک خود بڑھ جاتا ہے۔', 'In Purchases add a supplier, then "New purchase": search products and enter quantity and cost. Saving increases stock automatically.'],
  ['"پروڈکٹ کی خرید قیمت اپڈیٹ کریں" ٹک ہو تو پروڈکٹ کی لاگت بھی نئی ہو جاتی ہے، جس سے منافع درست آتا ہے۔', 'Tick "Update product cost" to refresh the product cost so profit stays accurate.'],
  ['ادا کی گئی رقم سے کم دیں تو باقی سپلائر کا ادھار بنتا ہے؛ بعد میں "ادائیگی" سے ادا کریں۔ اس کے لیے سپلائر منتخب ہونا ضروری ہے۔', 'If you pay less than the total, the rest is owed to the supplier; settle later with "Payment". A supplier must be selected.']
]];

const HELP_REPORTS = ['اخراجات اور رپورٹس', 'Expenses and reports', [
  ['اخراجات میں کرایہ، بجلی، تنخواہ وغیرہ کی قسم چن کر رقم اور تاریخ درج کریں۔', 'In Expenses pick a type (rent, electricity, salary...) and enter amount and date.'],
  ['رپورٹس میں آج / 7 دن / اس ماہ چنیں۔ خالص منافع = فروخت − مال کی لاگت − اخراجات۔', 'In Reports choose Today / 7 days / This month. Net profit = sales − cost of goods − expenses.'],
  ['روزانہ فروخت، زیادہ بکنے والی پروڈکٹس اور ادھار کی وصولی بھی یہیں نظر آتی ہے۔ "رپورٹ پرنٹ" سے A4 کاپی نکالیں۔', 'Daily sales, top products and credit collected are shown too. "Print report" gives an A4 copy.']
]];

const HELP_BACKUP = ['ڈیٹا کی حفاظت', 'Keeping your data safe', [
  ['فی الحال دکان کا ڈیٹا اسی فون میں محفوظ رہتا ہے (سنک اگلے مرحلے میں آئے گا)۔', 'For now the shop data lives on this phone (sync comes in a later stage).'],
  ['سیٹنگز ← "ڈیٹا ایکسپورٹ (JSON)" سے باقاعدگی سے بیک اپ لیں، خاص طور پر فون بدلنے یا براؤزر کا ڈیٹا صاف کرنے سے پہلے۔', 'Take regular backups from Settings -> "Export data (JSON)", especially before changing phone or clearing browser data.'],
  ['اپنا پاس ورڈ کسی کو نہ بتائیں۔', 'Never share your password.']
]];

const HELP = {
  superadmin: [
    ['شروعات', 'Getting started', [
      ['اپنے Super Admin نمبر اور پاس ورڈ سے لاگ اِن کریں۔ اگر آپ کی کوئی دکان نہیں تو پینل خود کھل جاتا ہے؛ ورنہ سیٹنگز میں "سپر ایڈمن پینل کھولیں" دبائیں۔', 'Log in with your Super Admin number and password. With no shop of your own the panel opens by itself; otherwise tap "Open Super Admin panel" in Settings.'],
      ['نیچے پانچ ٹیبز ہیں: ڈیش بورڈ، دکانیں، صارفین، بلنگ، مزید۔ اوپر "دکان" (یا لاگ آؤٹ) سے باہر نکلیں۔', 'Five tabs at the bottom: Dashboard, Shops, Users, Billing, More. The top button leaves the panel (or logs out).'],
      ['پینل کھلتے وقت ڈیٹا سرور سے تازہ آتا ہے اور ہر تبدیلی فوراً سرور پر محفوظ ہوتی ہے۔ انٹرنیٹ ضروری ہے۔', 'Data is loaded fresh from the server when the panel opens and every change is saved to the server at once. Internet is required.']
    ]],
    ['ڈیش بورڈ', 'Dashboard', [
      ['ماہانہ آمدن فعال دکانوں کے پلان کی قیمت سے بنتی ہے۔ فعال، ٹرائل، میعاد ختم اور معطل کے کارڈ پر ٹیپ کرنے سے اسی حالت کی دکانوں کی فہرست کھلتی ہے۔', 'Monthly revenue is the plan price of active shops. Tapping the Active / Trial / Expired / Suspended cards opens that list of shops.'],
      ['"7 دن میں ختم ہونے والی" دکانوں کو یاد دہانی بھیج کر وقت پر تجدید کروائیں۔', 'Send a reminder to the "Expiring within 7 days" shops so they renew on time.'],
      ['پچھلے 6 ماہ کی وصولی اور حالیہ سرگرمی بھی یہیں نظر آتی ہے۔', 'Collections of the last 6 months and recent activity are shown here.']
    ]],
    ['نئی دکان بنانا', 'Adding a shop', [
      ['دکانیں ← "نئی دکان": دکان کا نام، مالک کا نام، موبائل نمبر، شہر اور پلان لکھیں۔ "ٹرائل" ٹک ہو تو مفت ٹرائل شروع ہوتا ہے (دن سیٹنگز میں)۔', 'Shops -> "New shop": enter shop name, owner name, mobile, city and plan. With "Trial" ticked a free trial starts (days are set under Settings).'],
      ['محفوظ کرنے پر مالک کا لاگ اِن نمبر اور عارضی پاس ورڈ کی اسکرین آتی ہے۔ "واٹس ایپ پر بھیجیں" یا "کاپی" دبائیں۔ یہ پاس ورڈ دوبارہ نہیں دکھایا جاتا؛ ضائع ہو جائے تو "پاس ورڈ ری سیٹ" کریں۔', 'After saving you get the owner login number and a temporary password. Tap "Send on WhatsApp" or "Copy". It is not shown again; if lost, use "Reset password".'],
      ['ایک موبائل نمبر صرف ایک صارف کا ہو سکتا ہے۔', 'One mobile number can belong to only one user.']
    ]],
    ['دکان کا انتظام', 'Managing a shop', [
      ['دکان پر ٹیپ کر کے تفصیل کھولیں: ترمیم، تجدید/ادائیگی، معطل، آرکائیو۔', 'Tap a shop for details: Edit, Renew / payment, Suspend, Archive.'],
      ['معطل کرتے وقت وجہ لکھیں۔ معطل، آرکائیو یا میعاد ختم دکان کے صارف اگلے لاگ اِن پر داخل نہیں ہو سکتے۔ جو فون پہلے سے لاگ اِن ہو وہ آف لائن بل بناتا رہ سکتا ہے۔', 'Give a reason when suspending. Users of a suspended, archived or expired shop cannot log in next time. A phone that is already logged in can keep billing offline.'],
      ['آرکائیو میں ڈیٹا محفوظ رہتا ہے؛ "بحال کریں" سے دکان واپس آ جاتی ہے۔', 'Archive keeps the data; "Restore" brings the shop back.']
    ]],
    ['صارفین', 'Users', [
      ['صارفین ← "نیا صارف": نام، نمبر، دکان اور کردار (مالک، مینیجر، کیشیئر) چنیں۔ لاگ اِن تفصیل اور عارضی پاس ورڈ اسی وقت ملتا ہے۔', 'Users -> "New user": enter name, number, shop and role (Owner, Manager, Cashier). Login details and a temporary password appear at once.'],
      ['ہر پلان میں صارفین کی حد ہے؛ حد پوری ہو تو نیا صارف نہیں بنتا۔ ہر دکان میں کم از کم ایک مالک لازمی ہے۔', 'Each plan has a user limit; at the limit no new user can be added. Every shop must keep at least one owner.'],
      ['"اکاؤنٹ فعال ہے" بند کرنے سے اس صارف کا لاگ اِن رک جاتا ہے۔ "پاس ورڈ ری سیٹ" نیا عارضی پاس ورڈ دیتا ہے۔ حذف کرنے سے لاگ اِن اکاؤنٹ بھی ختم ہو جاتا ہے۔', 'Turning off "Account is active" blocks that login. "Reset password" gives a new temporary one. Deleting also removes the login account.']
    ]],
    ['بلنگ اور پلانز', 'Billing and plans', [
      ['تجدید: بلنگ ← "ادائیگی درج کریں" (یا دکان کی تفصیل سے "تجدید")۔ دکان، پلان، مدت (1/3/6/12 ماہ) اور طریقہ (نقد، بینک، جاز کیش، ایزی پیسہ) چنیں۔ رقم خود بھر جاتی ہے، بدل سکتے ہیں۔', 'Renewal: Billing -> "Record payment" (or "Renew" in a shop). Choose shop, plan, period (1/3/6/12 months) and method (cash, bank, JazzCash, Easypaisa). The amount is pre-filled and editable.'],
      ['نئی میعاد پرانی میعاد (یا آج) سے آگے گنی جاتی ہے۔ ادائیگیاں اور اس ماہ کی وصولی اسی ٹیب میں نظر آتی ہے۔', 'The new expiry counts from the old expiry (or today). Payments and this month collected are listed in this tab.'],
      ['"پلانز" میں قیمت، صارفین کی حد اور پروڈکٹس کی حد (0 = لامحدود) بدلیں۔', 'Under "Plans" edit price, user limit and product limit (0 = unlimited).']
    ]],
    ['مزید: اعلان، لاگ، سیٹنگز', 'More: announcements, log, settings', [
      ['اعلان ایک وقت میں ایک چلتا ہے اور تمام دکانوں کے اوپر والی پٹی میں نظر آتا ہے۔ نیا اعلان پرانے کو بند کر دیتا ہے۔', 'One announcement is live at a time and appears in the top bar of every shop. A new one switches the old one off.'],
      ['لاگ میں ہر کارروائی (دکان، صارف، ادائیگی، سیٹنگ) کی تاریخ درج ہوتی ہے۔', 'The log records every action (shop, user, payment, setting) with its date.'],
      ['سیٹنگز: ٹرائل کے دن، نئی دکان کا ڈیفالٹ پلان، سپورٹ / تجدید کا نمبر۔ "پلیٹ فارم ڈیٹا ایکسپورٹ" سے بیک اپ لیں۔', 'Settings: trial days, default plan for new shops, support / renewal number. "Export platform data" takes a backup.']
    ]],
    ['حفاظت اور مسائل', 'Safety and troubleshooting', [
      ['اپنا Super Admin پاس ورڈ کسی کو نہ دیں۔ Supabase کی service-role / secret key کبھی ایپ یا config.js میں نہ ڈالیں۔', 'Never share your Super Admin password. Never put the Supabase service-role / secret key in the app or config.js.'],
      ['نیا Super Admin بنانے کے لیے Supabase میں اس کا لاگ اِن یوزر بنا کر platform_admins ٹیبل میں اس کی user_id ڈالیں۔', 'To add another Super Admin, create their login in Supabase and insert their user_id into the platform_admins table.'],
      ['"column ... does not exist" جیسی غلطی آئے تو 01_superadmin.sql دوبارہ چلائیں۔ نیا صارف نہ بنے تو Supabase میں Edge Function "admin-users" چیک کریں۔', 'On a "column ... does not exist" error rerun 01_superadmin.sql. If new users cannot be created, check the "admin-users" Edge Function in Supabase.']
    ]]
  ],
  owner: [
    HELP_SHARED_LOGIN, HELP_BILLING, HELP_PRODUCTS, HELP_CUSTOMERS, HELP_PURCHASES, HELP_REPORTS,
    ['سیٹنگز (صرف مالک)', 'Settings (owner only)', [
      ['ٹیکس فیصد، رسید کا اوپر/نیچے کا متن، دکان کا فون، پتہ، NTN اور کاغذ کی چوڑائی (58 mm، 80 mm، A4) یہاں سے بدلتی ہے۔', 'Tax rate, receipt header/footer, shop phone, address, NTN and paper width (58 mm, 80 mm, A4) are set here.'],
      ['"کیشیئر رعایت دے سکتا ہے" اور "کیشیئر قیمت بدل سکتا ہے" ٹک کریں تو کیشیئر کو یہ اختیار ملتا ہے؛ ورنہ وہ صرف مقررہ قیمت پر بیچ سکتا ہے۔', 'Tick "Cashier can give discount" and "Cashier can change price" to allow it; otherwise cashiers sell at the set price only.'],
      ['زبان (اردو / English) اور رنگ ہر صارف اپنے لیے بدل سکتا ہے۔', 'Language (Urdu / English) and colour can be changed by each user for themselves.']
    ]],
    ['اسٹاف اور سبسکرپشن', 'Staff and subscription', [
      ['مینیجر اور کیشیئر کے اکاؤنٹ سپر ایڈمن / سپورٹ بناتا ہے؛ نئے ملازم یا پاس ورڈ ری سیٹ کے لیے ان سے رابطہ کریں۔', 'Manager and cashier accounts are created by Super Admin / support; contact them for a new employee or a password reset.'],
      ['اپنی سبسکرپشن کی میعاد ختم ہونے سے پہلے تجدید کروائیں، ورنہ لاگ اِن بند ہو جائے گا۔', 'Renew your subscription before it expires or login will be blocked.']
    ]],
    HELP_BACKUP
  ],
  manager: [
    HELP_SHARED_LOGIN, HELP_BILLING, HELP_PRODUCTS, HELP_CUSTOMERS, HELP_PURCHASES, HELP_REPORTS,
    ['آپ کے اختیارات', 'What you can and cannot do', [
      ['آپ بل، پروڈکٹس، اسٹاک، کسٹمرز، خریداری، اخراجات اور رپورٹس سنبھال سکتے ہیں۔', 'You can handle billing, products, stock, customers, purchases, expenses and reports.'],
      ['ٹیکس، رسید کی سیٹنگز اور کیشیئر کے اختیارات صرف مالک بدل سکتا ہے۔ نئے صارف یا پاس ورڈ ری سیٹ کے لیے مالک کے ذریعے سپورٹ سے رابطہ کریں۔', 'Tax, receipt settings and cashier permissions can be changed by the owner only. For new users or password resets, go through the owner to support.']
    ]],
    HELP_BACKUP
  ],
  cashier: [
    HELP_SHARED_LOGIN, HELP_BILLING, HELP_CUSTOMERS,
    ['آپ کے اختیارات', 'What you can and cannot do', [
      ['آپ بل بنا سکتے ہیں، پروڈکٹس اور اسٹاک دیکھ سکتے ہیں، فروخت کی تاریخ اور رسید دوبارہ کھول کر پرنٹ کر سکتے ہیں، اور کسٹمرز سے وصولی درج کر سکتے ہیں۔', 'You can make bills, view products and stock, reopen and print past receipts, and record customer payments.'],
      ['رعایت دینا اور بل میں قیمت بدلنا تبھی ممکن ہے جب مالک نے سیٹنگز میں اجازت دی ہو۔', 'Giving a discount or changing a price works only if the owner allowed it in Settings.'],
      ['پروڈکٹ بدلنا، خریداری، اخراجات اور رپورٹس مالک / مینیجر کے لیے ہیں۔', 'Editing products, purchases, expenses and reports are for the owner / manager.'],
      ['بل میں غلطی ہو جائے تو مینیجر یا مالک کو فوراً بتائیں۔ پاس ورڈ کسی کو نہ دیں اور کام ختم ہونے پر لاگ آؤٹ کریں۔', 'Tell the manager or owner right away about a wrong bill. Never share your password and log out when your shift ends.']
    ]]
  ]
};

Object.assign(I18N.ur, { help_title: 'ہدایات', help_btn: 'ہدایات / مدد', sa_help: 'ہدایات' });
Object.assign(I18N.en, { help_title: 'How to use', help_btn: 'Help / Guide', sa_help: 'Help' });
Object.assign(ICONS, { help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .3c0 1.7-2.5 2-2.5 3.7"/><path d="M12 17h.01"/>' });

function helpHtml(role, openFirst = true) {
  const L = LANG === 'ur' ? 0 : 1, secs = HELP[role] || [];
  return `<div class="help">${secs.map((s, i) => `<details ${openFirst && i === 0 ? 'open' : ''}><summary>${esc(s[L])}</summary><ul>${s[2].map(x => `<li>${esc(x[L])}</li>`).join('')}</ul></details>`).join('')}</div>`;
}
function openHelp(role) {
  role = HELP[role] ? role : 'cashier';
  openModal(`<h2>${t('help_title')}</h2><div class="muted" style="margin-bottom:8px">${HELP_ROLE_LABEL[role][LANG === 'ur' ? 0 : 1]}</div>${helpHtml(role)}
    <div style="margin-top:12px"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}
document.addEventListener('click', ev => {
  if (ev.target.closest('#btn-help') && window.S && S.session) openHelp(S.session.admin && !['owner', 'manager', 'cashier'].includes(S.session.role) ? 'superadmin' : S.session.role);
});
