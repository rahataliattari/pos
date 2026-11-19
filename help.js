// Universal POS — in-app guides, one per role. Each section: [title_ur, title_en, [[line_ur, line_en], ...]].
// Shown from Settings -> "ہدایات / Help" (shop roles) and Super Admin -> More -> Help. Loaded BEFORE superadmin.js and app.js.

const HELP_ROLE_LABEL = { superadmin: ['سپر ایڈمن', 'Super Admin'], owner: ['مالک', 'Owner'], manager: ['مینیجر', 'Manager'], cashier: ['کیشیئر', 'Cashier'] };

const HELP_SHARED_LOGIN = ['لاگ اِن اور آف لائن کام', 'Login and working offline', [
  ['لاگ اِن اپنے موبائل نمبر (مثلاً 03001234567) اور پاس ورڈ سے ہوتا ہے۔ نمبر اور عارضی پاس ورڈ آپ کو سپر ایڈمن / سپورٹ دیتا ہے۔', 'Log in with your mobile number (e.g. 03001234567) and password. Your number and temporary password come from Super Admin / support.'],
  ['پہلی بار لاگ اِن کے لیے انٹرنیٹ ضروری ہے۔ اس کے بعد انٹرنیٹ نہ بھی ہو تو بل بنتے رہتے ہیں؛ اوپر "آف لائن" لکھا آئے گا اور بل "زیرِ انتظار" میں گنے جائیں گے۔', 'The first login needs internet. After that you can keep billing without it; the header shows "Offline" and bills count as "Pending".'],
  ['پاس ورڈ بھول جائیں تو لاگ اِن اسکرین پر "پاس ورڈ بھول گئے؟" دبائیں، اپنا موبائل نمبر لکھیں۔ سپورٹ آپ کو اسی نمبر پر فون/واٹس ایپ کر کے شناخت کرے گی اور نیا عارضی پاس ورڈ دے گی۔ پاس ورڈ خود بخود نہیں بدلتا۔', 'If you forget your password tap "Forgot password?" on the login screen and enter your mobile number. Support will call/WhatsApp that number to confirm it is you and give you a new temporary password. It is never reset automatically.'],
  ['لاگ آؤٹ کرنے سے فون میں محفوظ ریکارڈ ختم نہیں ہوتا۔', 'Logging out does not delete the records saved on the phone.'],
  ['ہر آئی ڈی (موبائل نمبر) صرف اتنی ڈیوائسز پر چلتی ہے جتنی آپ کے پلان میں ہیں، عام طور پر ایک۔ دوسری ڈیوائس پر لاگ اِن کریں تو "یہ آئی ڈی کسی اور ڈیوائس پر ہے" کا پیغام آتا ہے۔', 'Each ID (mobile number) works on as many devices as your plan allows, usually one. Logging in on another device shows "this ID is on another device".'],
  ['فون گم یا چوری ہو جائے تو فوراً سپر ایڈمن / سپورٹ کو بتائیں۔ وہ پرانا فون بند کر دیں گے اور آپ نئے فون پر اسی آئی ڈی سے لاگ اِن کر سکیں گے۔ ساتھ پاس ورڈ بھی بدلوا لیں۔', 'If your phone is lost or stolen, tell Super Admin / support right away. They block the old phone and you can log in on a new one with the same ID. Also have the password changed.'],
  ['پہلی بار لاگ اِن پر سروس معاہدہ، شرائط و ضوابط، رازداری اور ادائیگی/واپسی کی پالیسی پڑھ کر "قبول کرتا/کرتی ہوں" دبانا ضروری ہے۔ یہ دستاویزات بعد میں سیٹنگز ← "قانونی دستاویزات" میں پڑھی اور PDF/پرنٹ کی جا سکتی ہیں۔', 'On first login you must read and accept the Service Agreement, Terms, Privacy and Payment/Refund policies. You can read them again, and print or save as PDF, under Settings -> "Legal documents".'],
  ['اگر آپ کی دکان معطل یا میعاد ختم ہو تو اگلے لاگ اِن پر داخلہ بند ہوگا۔ تجدید کے لیے سپورٹ سے رابطہ کریں۔', 'If your shop is suspended or expired, login is blocked next time. Contact support to renew.']
]];

const HELP_BILLING = ['بل بنانا (بلنگ)', 'Making a bill', [
  ['نیچے بیچ والے سبز "بل" بٹن سے بلنگ کھولیں۔ اوپر نام یا بارکوڈ لکھ کر پروڈکٹ ڈھونڈیں، یا سکین بٹن سے کیمرا استعمال کریں۔', 'Open Billing with the green "Bill" button at the bottom. Search a product by name or barcode, or use Scan for the camera.'],
  ['پروڈکٹ پر ٹیپ کرنے سے وہ بل میں شامل ہو جاتی ہے؛ + / − سے مقدار بدلیں۔', 'Tap a product to add it; change quantity with + / −.'],
  ['"وصول رقم" میں گاہک سے لی گئی رقم لکھیں۔ باقی بچے تو وہ ادھار بنتا ہے اور اس کے لیے کسٹمر منتخب کرنا ضروری ہے۔', 'Enter the money received under "Paid". Any remainder becomes credit (udhaar) and needs a customer selected.'],
  ['اسٹاک کم یا ختم ہو تو وارننگ آتی ہے مگر بل پھر بھی بن سکتا ہے۔', 'Low or zero stock shows a warning, but the bill can still be made.'],
  ['بارکوڈ (سکین بٹن اور بارکوڈ سکینر) صرف ان پلانز میں ہے جن میں یہ سہولت آن ہو۔ بند ہو تو نام لکھ کر پروڈکٹ ڈھونڈیں۔', 'Barcodes (the Scan button and barcode scanners) work only on plans that include them. If off, search products by name.'],
  ['پریمیم جیسے پلانز میں رسید کے اوپر QR کوڈ چھپتا ہے۔ یہ صرف بل کی تصدیق کے لیے ہے — اس سے ادائیگی یا وصولی نہیں ہوتی۔ QR کے نیچے تصدیقی کوڈ بھی لکھا ہوتا ہے۔', 'Plans such as Premium print a QR code at the top of the receipt. It is for bill verification only — it does not pay or receive money. A verification code is printed under it.'],
  ['اسٹاک: جس چیز کا اسٹاک ختم ہو وہ بل میں شامل نہیں ہوتی (ہلکی نظر آتی ہے)، اور اسٹاک سے زیادہ مقدار بھی نہیں بکتی۔ اگر آپ اسٹاک لکھے بغیر بیچتے ہیں تو مالک سیٹنگز ← بلنگ میں "اسٹاک سے زیادہ بیچنے کی اجازت" ٹک کر دے۔ قیمت 0 والی چیز بھی بل مکمل نہیں ہونے دیتی؛ پروڈکٹ میں قیمت لکھیں۔', 'Stock: an item with no stock cannot be added to a bill (it looks faded), and more than the stock cannot be sold. If you sell without entering stock, the owner can tick "Allow selling more than the stock" in Settings -> Billing. An item with price 0 also blocks the bill; set its price in the product.'],
  ['حصہ یا رقم سے فروخت: ہر آئٹم کے نیچے "رقم سے (Rs)" میں مثلاً 100 لکھیں تو مقدار خود نکل آتی ہے (1200 روپے کلو والی چیز کے 100 روپے)۔ کلو والی چیز میں "100 گرام / پاؤ / آدھا کلو / پون کلو / 1 کلو" بٹن اور "گرام" کا خانہ بھی ہے۔ لٹر والی چیز میں ¼ ½ ¾ بٹن ہیں۔ مقدار ہاتھ سے بدلیں تو رقم والا حساب ہٹ جاتا ہے۔', 'Selling a part or by amount: under an item type e.g. 100 in "By amount (Rs)" and the quantity is worked out (Rs 100 of a Rs 1200/kg item). Kg items also have "100 g / quarter / half / three-quarter / 1 kg" buttons and a grams box; litre items have ¼ ½ ¾ buttons. Changing the quantity by hand clears the amount.'],
  ['بل میں ترمیم: فروخت ٹیب میں بل کھول کر "بل میں ترمیم" دبائیں (مالک/مینیجر)۔ بل چیک آؤٹ میں کھلتا ہے، مقدار/قیمت/کسٹمر درست کر کے محفوظ کریں۔ پرانا بل منسوخ ہو جاتا ہے (اسٹاک خود ٹھیک ہوتا ہے، کوئی نقد واپسی نہیں گنی جاتی) اور نیا بل بنتا ہے جس پر "پرانا بل: نمبر" لکھا ہوتا ہے۔ جس بل میں واپسی ہو چکی اس میں ترمیم نہیں ہوتی۔', 'Editing a bill: open the bill in the Sales tab and tap "Edit this bill" (owner/manager). It opens in checkout; fix quantity/price/customer and save. The old bill is cancelled (stock is corrected, no cash refund is counted) and a new bill is created that says "Corrects bill: number". A bill that already has a return cannot be edited.'],
  ['رعایت: ہر آئٹم کے نیچے "رعایت %" لکھ کر اس آئٹم پر فیصد رعایت دیں؛ پورے بل کی رعایت "Rs / %" چن کر لکھیں۔ (کیشیئر کو یہ تب ملتی ہے جب مالک نے اجازت دی ہو۔)', 'Discounts: type "Discount %" under an item for a percentage off that item; for the whole bill pick "Rs / %" and enter the value. (Cashiers need the owner’s permission.)'],
  ['ادائیگی کا طریقہ: نقد، جاز کیش، ایزی پیسہ، کارڈ یا بینک چنیں۔ کسٹمر دو طریقوں سے دے تو "تقسیم" دبا کر ہر طریقے کی رقم لکھیں۔ رپورٹس میں طریقے کے حساب سے رقم نظر آتی ہے۔', 'Payment method: choose cash, JazzCash, Easypaisa, card or bank. If a customer pays in two ways tap "Split" and enter each amount. Reports show the amount per method.'],
  ['"روک لیں": بل بیچ میں چھوڑ کر دوسرے گاہک کو نمٹانا ہو تو بل روک لیں؛ بلنگ کے اوپر گھڑی والے بٹن سے روکے ہوئے بل واپس کھولیں۔ روکا ہوا بل فروخت نہیں گنا جاتا اور اسٹاک نہیں گھٹتا۔', '"Hold": to serve another customer first, put the bill on hold; reopen it from the clock button at the top of Billing. A held bill is not a sale and does not reduce stock.'],
  ['"کوٹیشن": گاہک کو قیمت بتانے کے لیے کوٹیشن بنائیں، پرنٹ کریں یا واٹس ایپ پر بھیجیں؛ پسند آنے پر "بل میں لوڈ کریں"۔ کوٹیشن بل نہیں، اسٹاک محفوظ نہیں کرتی۔', '"Quotation": to quote prices, create a quotation, print it or send it on WhatsApp; if accepted tap "Load into bill". A quotation is not a bill and does not reserve stock.'],
  ['"بل مکمل کریں" کے بعد رسید پرنٹ کریں یا واٹس ایپ پر بھیجیں۔ پرانی رسید "فروخت" ٹیب میں دوبارہ کھل جاتی ہے۔', 'After "Complete sale", print the receipt or send it on WhatsApp. Old receipts reopen from the "Sales" tab.']
]];

const HELP_VERIFY = ['بل چیک کریں (تصدیق)', 'Checking a bill (verification)', [
  ['کوئی بل لے کر آئے اور آپ دیکھنا چاہیں کہ یہ ہماری دکان کا اصلی بل ہے یا نہیں: "فروخت" ٹیب ← اوپر "بل چیک کریں"۔ یہ سہولت ہر پلان اور ہر کردار کے لیے مفت ہے۔', 'When someone brings a bill and you want to know if it is really from your shop: "Sales" tab -> "Check a bill" at the top. This is free on every plan and for every role.'],
  ['"QR سکین کریں" دبا کر بل کا QR کیمرے کے سامنے رکھیں۔ کیمرا سکین نہ کرے تو بل نمبر اور QR کے نیچے چھپا کوڈ ہاتھ سے لکھیں، یا QR کا پورا متن چپکائیں۔', 'Tap "Scan QR" and show the bill’s QR to the camera. If the camera cannot scan, type the bill number and the code printed under the QR, or paste the full QR text.'],
  ['سبز ✓: بل نمبر، تاریخ، رقم اور کوڈ ہمارے ریکارڈ سے مل گئے — بل اصلی ہے۔ سرخ ✗: بل نہیں ملا، کسی اور دکان کا ہے، یا رقم/کوڈ مختلف ہے (بل تبدیل شدہ یا جعلی ہو سکتا ہے)۔ نارنجی: بل ملا مگر کوڈ نہیں ملایا گیا۔', 'Green ✓: bill number, date, amount and code match your records — the bill is genuine. Red ✗: not found, from another shop, or amount/code differ (it may be altered or fake). Orange: bill found but the code was not checked.'],
  ['"نہیں ملا" آئے تو پہلے سنک کر لیں؛ ہو سکتا ہے بل کسی اور فون پر بنا ہو اور اس فون پر ابھی نہ پہنچا ہو۔ منسوخ (void) بل پر الگ وارننگ آتی ہے۔', 'If it says "not found", sync first; the bill may have been made on another phone and not reached this one yet. A voided bill shows a separate warning.'],
  ['یہ جانچ صرف تصدیق ہے؛ اس سے کوئی ادائیگی، وصولی یا بل میں تبدیلی نہیں ہوتی۔', 'This check is verification only; it does not take payment, receive money or change any bill.']
]];

const HELP_PROFILE = ['پروفائل تصویر اور قانونی دستاویزات', 'Profile picture and legal documents', [
  ['اپنی تصویر لگانے کے لیے سیٹنگز کے اوپر والے کارڈ میں تصویر یا "تصویر بدلیں" دبائیں اور کیمرے/گیلری سے تصویر چنیں۔ تصویر خود چھوٹی ہو کر آپ کے اکاؤنٹ کے ساتھ محفوظ ہوتی ہے اور ایپ کے اوپر نظر آتی ہے۔ "تصویر ہٹائیں" سے ہٹ جاتی ہے۔', 'To set your picture, tap the picture (or "Change photo") in the top card of Settings and choose from camera/gallery. It is shrunk automatically, saved with your account and shown in the app header. "Remove photo" deletes it.'],
  ['انٹرنیٹ نہ ہو تو تصویر فون میں محفوظ ہو جاتی ہے اور انٹرنیٹ آنے پر سرور پر چلی جاتی ہے۔', 'Offline, the picture is saved on the phone and uploads when internet returns.'],
  ['سیٹنگز ← "قانونی دستاویزات": سروس معاہدہ، شرائط و ضوابط، رازداری کی پالیسی اور ادائیگی/واپسی کی پالیسی اردو اور English میں پڑھیں؛ "پرنٹ / PDF" سے کاپی نکالیں۔', 'Settings -> "Legal documents": read the Service Agreement, Terms, Privacy Policy and Payment/Refund Policy in Urdu and English; "Print / PDF" gives a copy.']
]];

const HELP_CUSTOMERS = ['کسٹمرز اور ادھار', 'Customers and credit', [
  ['کسٹمرز میں نام اور نمبر کے ساتھ نیا کسٹمر بنائیں؛ پرانا ادھار "پرانا ادھار (شروع کا)" میں لکھ سکتے ہیں۔', 'Add a customer with name and number; enter any old balance under "Opening balance".'],
  ['کسٹمر کھول کر "وصولی" سے رقم وصول کریں، یا "ادھار درج کریں" سے ادھار بڑھائیں۔ کھاتہ میں ہر لین دین اور باقی رقم نظر آتی ہے۔', 'Open a customer: "Receive payment" collects money, "Add udhaar" adds credit. The ledger shows every entry and the running balance.'],
  ['"یاد دہانی" واٹس ایپ پر ادھار کا پیغام تیار کرتی ہے؛ "کال" سے براہِ راست فون ملائیں۔', '"Remind" prepares a WhatsApp message about the balance; "Call" dials directly.'],
  ['"سب کو یاد دہانی" (کسٹمرز اسکرین پر): ادھار والے سب کسٹمرز کی فہرست کھلتی ہے؛ ہر نام کے آگے واٹس ایپ بٹن دبائیں، پیغام تیار کھلے گا، آپ "بھیجیں" دبائیں۔ کم از کم رقم لکھ کر چھوٹے ادھار چھپا سکتے ہیں۔ واٹس ایپ سب کو خود بخود نہیں بھیجنے دیتا۔', '"Remind all" (Customers screen): lists every customer who owes; tap the WhatsApp button next to a name, the message opens ready and you press Send. Enter a minimum amount to hide small balances. WhatsApp does not allow automatic sending to everyone.'],
  ['جب تک ادھار باقی ہو کسٹمر حذف نہیں ہو سکتا۔', 'A customer with an outstanding balance cannot be deleted.']
]];

const HELP_PRODUCTS = ['پروڈکٹس اور اسٹاک', 'Products and stock', [
  ['انوینٹری ٹیب میں "نئی پروڈکٹ": نام، بارکوڈ، خرید قیمت، فروخت قیمت، کم از کم اسٹاک اور ابتدائی اسٹاک لکھیں۔', 'Inventory tab -> "New product": enter name, barcode, cost, sale price, minimum stock and opening stock.'],
  ['پروڈکٹ پر ٹیپ کر کے ترمیم کریں۔ اسٹاک میں کمی/اضافہ (+/−) وجہ کے ساتھ لکھیں تاکہ بعد میں حساب ملے۔', 'Tap a product to edit. Adjust stock with +/− and a reason so the count can be traced later.'],
  ['"دیگر اکائیاں" ایک ہی مال کو مختلف اکائی میں بیچنے کے لیے ہیں: مثلاً بنیادی اکائی "عدد" ہو اور "کارٹن = 12 عدد" لکھ دیں؛ بل پر کارٹن یا عدد چن کر بیچیں، اسٹاک خود حساب ہوتا ہے۔', '"Other units" lets you sell one item in several units: e.g. base unit "piece" and "carton = 12 pieces"; pick carton or piece on the bill and stock is calculated for you.'],
  ['"سائز / رنگ کے ویریئنٹس" صرف گارمنٹس (کپڑوں/جوتوں) جیسی دکانوں کے نئے پروڈکٹ فارم میں نظر آتے ہیں۔ کاما سے سائز/رنگ لکھیں تو ہر ایک کی الگ پروڈکٹ اور الگ اسٹاک بنتا ہے۔', '"Size / colour variants" appear in the new-product form only for garment-type shops. Type sizes/colours separated by commas and each gets its own product and stock.'],
  ['بارکوڈ کا خانہ صرف ان پلانز میں ہے جن میں بارکوڈ آن ہو۔ پہلے سے محفوظ بارکوڈ پلان بدلنے پر بھی نہیں مٹتے۔', 'The barcode field exists only on plans that include barcodes. Barcodes already saved are never erased, even if the plan changes.'],
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

const HELP_CONTACT = ['ہم سے رابطہ کریں', 'Contact us', [
  ['سیٹنگز ← "ہم سے رابطہ کریں" ← "نیا پیغام"۔ قسم (مسئلہ / تجویز / سوال) اور موضوع چنیں، مختصر عنوان اور تفصیل لکھ کر "بھیجیں" دبائیں۔ مسئلے میں لکھیں کون سی اسکرین پر، کب سے اور کیا ہوا۔', 'Settings -> "Contact us" -> "New message". Pick the type (problem / suggestion / question) and topic, write a short subject and details, then tap "Send". For a problem say which screen, since when and what happened.'],
  ['پیغام بھیجنے اور جواب دیکھنے کے لیے انٹرنیٹ ضروری ہے۔ سپورٹ ٹیم کا جواب اسی پیغام کے اندر آتا ہے؛ نیا جواب آنے پر سیٹنگز کے ٹیب اور "ہم سے رابطہ کریں" بٹن پر سرخ نشان نظر آتا ہے۔', 'Internet is needed to send a message and read replies. The support reply appears inside the same message; a red badge shows on the Settings tab and the "Contact us" button when a new reply arrives.'],
  ['جواب کے نیچے اسی پیغام میں مزید لکھ سکتے ہیں۔ بند پیغام میں لکھیں تو وہ دوبارہ کھل جاتا ہے۔ فوری ضرورت ہو تو وہیں دیے گئے کال / واٹس ایپ بٹن استعمال کریں۔', 'You can keep writing in the same message under the reply. Writing in a closed message reopens it. For something urgent use the Call / WhatsApp buttons shown there.'],
  ['پاس ورڈ یا بینک کی خفیہ معلومات پیغام میں نہ لکھیں۔ ایک گھنٹے میں زیادہ سے زیادہ 10 پیغام بھیجے جا سکتے ہیں۔', 'Never write passwords or private bank details in a message. At most 10 messages can be sent per hour.']
]];

const HELP_NOTIF = ['نوٹیفکیشن، انسٹال اور ایپ کی معلومات', 'Notifications, install and app info', [
  ['سیٹنگز ← "نوٹیفکیشن" ← "نوٹیفکیشن آن کریں": سپورٹ کے جواب، اعلان اور سبسکرپشن کی یاد دہانی ایپ بند ہونے پر بھی فون پر آتی ہے (Android/Chrome)۔ iPhone پر پہلے "Add to Home Screen" ضروری ہے۔', 'Settings -> "Notifications" -> "Turn notifications on": support replies, announcements and subscription reminders reach your phone even when the app is closed (Android/Chrome). On iPhone first use "Add to Home Screen".'],
  ['کم اسٹاک کی یاد دہانی: جن پروڈکٹس میں "کم از کم اسٹاک" لکھا ہو وہ اسٹاک اس حد تک گر جائے تو ہوم پر پیلی پٹی آتی ہے اور (نوٹیفکیشن آن ہوں تو) دن میں ایک بار فون پر اطلاع۔ یہ جانچ ایپ کھولنے یا بل بنانے پر ہوتی ہے۔ سیٹنگز میں اسے بند بھی کر سکتے ہیں۔', 'Low-stock reminder: when a product with a "minimum stock" falls to that level a yellow strip shows on Home and (if notifications are on) one phone notification per day. It is checked when you open the app or make a bill. You can switch it off in Settings.'],
  ['"ایپ انسٹال کریں" بٹن ایپ کو فون کی ہوم اسکرین پر رکھ دیتا ہے تاکہ براؤزر کے بغیر کھلے۔', 'The "Install the app" button puts the app on the phone’s home screen so it opens without the browser.'],
  ['"ایپ کے بارے میں": ورژن، پلان، میعاد، ڈیوائس اور سپورٹ کا نمبر ایک جگہ۔ سپورٹ سے بات کرتے وقت یہ معلومات بتائیں۔', '"About the app": version, plan, expiry, device and support number in one place. Share these when you talk to support.']
]];

const HELP_BACKUP = ['ڈیٹا کی حفاظت', 'Keeping your data safe', [
  ['دکان کا ڈیٹا پہلے فون میں محفوظ ہوتا ہے اور انٹرنیٹ ملنے پر خود بخود سرور سے سنک ہو جاتا ہے۔ سنک ہونے سے پہلے فون کھو جائے یا براؤزر کا ڈیٹا صاف ہو جائے تو وہ ریکارڈ ضائع ہو سکتے ہیں، اس لیے "زیرِ انتظار" نہ چھوڑیں۔', 'Shop data is saved on the phone first and syncs to the server automatically when internet is available. If the phone is lost or browser data is cleared before syncing, those records can be lost, so do not leave items "Pending".'],
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
      ['ایک آئی ڈی صرف پلان میں طے شدہ تعداد کی ڈیوائسز پر چلتی ہے (سپر ایڈمن پر کوئی حد نہیں)۔ صارف میں ترمیم کھولیں تو نیچے اس کی ڈیوائسز کی فہرست (نام، آخری استعمال) نظر آتی ہے۔', 'A login ID runs only on the number of devices its plan allows (Super Admin has no limit). Open a user to edit and the device list (name, last used) shows at the bottom.'],
      ['فون گم/چوری: صارف ← ترمیم ← "گم/چوری: ڈیوائسز ری سیٹ"۔ اس سے پرانی ڈیوائس بند ہوتی ہے اور اس آئی ڈی کے سب لاگ اِن ختم ہوتے ہیں؛ صارف نئے فون پر پاس ورڈ سے لاگ اِن کر سکتا ہے۔ ساتھ "پاس ورڈ ری سیٹ" بھی کر دیں۔ ری سیٹ سے پہلے تصدیق کر لیں کہ بات واقعی آئی ڈی کے مالک سے ہو رہی ہے۔', 'Lost/stolen phone: User -> Edit -> "Lost/stolen: reset devices". This blocks the old device and ends every login of that ID; the user can then log in on the new phone with the password. Also do "Reset password". Make sure you are really talking to the ID’s owner before resetting.'],
      ['بند ڈیوائس کے آگے "اجازت دیں" سے اسے دوبارہ کھولا جا سکتا ہے (مثلاً فون مل گیا)۔ اگر پلان کی حد پوری ہو تو پہلے نئی ڈیوائس بند کریں یا پلان کی حد بڑھائیں۔ ایک ڈیوائس کو الگ سے بند کرنے کے لیے اس کے آگے والا بٹن دبائیں۔', 'A blocked device can be opened again with "Allow" (e.g. the phone was found). If the plan limit is full, first block the new device or raise the plan limit. To block one device only, tap the button next to it.'],
      ['صارفین کی فہرست میں ہر صارف کی پروفائل تصویر (اگر لگائی ہو) نظر آتی ہے۔', 'The users list shows each user’s profile picture (if set).'],
      ['"اکاؤنٹ فعال ہے" بند کرنے سے اس صارف کا لاگ اِن رک جاتا ہے۔ "پاس ورڈ ری سیٹ" نیا عارضی پاس ورڈ دیتا ہے۔ حذف کرنے سے لاگ اِن اکاؤنٹ بھی ختم ہو جاتا ہے۔', 'Turning off "Account is active" blocks that login. "Reset password" gives a new temporary one. Deleting also removes the login account.']
    ]],
    ['بلنگ اور پلانز', 'Billing and plans', [
      ['تجدید: بلنگ ← "ادائیگی درج کریں" (یا دکان کی تفصیل سے "تجدید")۔ دکان، پلان، مدت (1/3/6/12 ماہ) اور طریقہ (نقد، بینک، جاز کیش، ایزی پیسہ) چنیں۔ رقم خود بھر جاتی ہے، بدل سکتے ہیں۔', 'Renewal: Billing -> "Record payment" (or "Renew" in a shop). Choose shop, plan, period (1/3/6/12 months) and method (cash, bank, JazzCash, Easypaisa). The amount is pre-filled and editable.'],
      ['نئی میعاد پرانی میعاد (یا آج) سے آگے گنی جاتی ہے۔ ادائیگیاں اور اس ماہ کی وصولی اسی ٹیب میں نظر آتی ہے۔', 'The new expiry counts from the old expiry (or today). Payments and this month collected are listed in this tab.'],
      ['"پلانز" میں قیمت، صارفین کی حد اور پروڈکٹس کی حد (0 = لامحدود) بدلیں۔', 'Under "Plans" edit price, user limit and product limit (0 = unlimited).'],
      ['ہر پلان میں تین سہولیات آن/آف ہو سکتی ہیں: "بل پر تصدیقی QR کوڈ"، "بارکوڈ (فیلڈ، کیمرہ اور سکینر)" اور "ہر آئی ڈی کتنی ڈیوائسز پر چل سکے" (ڈیفالٹ 1، 0 = لامحدود)۔ تبدیلی دکان کو اگلے لاگ اِن / سنک پر لگتی ہے۔ فہرست میں پلان کے نیچے ڈیوائسز کی تعداد اور QR ✓ / ▮▯ ✓ نظر آتا ہے۔', 'Each plan switches three features: "Verification QR on bills", "Barcodes (field, camera & scanner)" and "Devices allowed per login ID" (default 1, 0 = unlimited). A change reaches the shop at its next login / sync. The plan list shows the device count and QR ✓ / ▮▯ ✓.']
    ]],
    ['مزید: اعلان، لاگ، سیٹنگز', 'More: announcements, log, settings', [
      ['اعلان ایک وقت میں ایک چلتا ہے اور تمام دکانوں کے اوپر والی پٹی میں نظر آتا ہے۔ نیا اعلان پرانے کو بند کر دیتا ہے۔', 'One announcement is live at a time and appears in the top bar of every shop. A new one switches the old one off.'],
      ['لاگ میں ہر کارروائی (دکان، صارف، ادائیگی، سیٹنگ) کی تاریخ درج ہوتی ہے۔', 'The log records every action (shop, user, payment, setting) with its date.'],
      ['سیٹنگز: ٹرائل کے دن، نئی دکان کا ڈیفالٹ پلان، سپورٹ / تجدید کا نمبر۔ "پلیٹ فارم ڈیٹا ایکسپورٹ" سے بیک اپ لیں۔', 'Settings: trial days, default plan for new shops, support / renewal number. "Export platform data" takes a backup.']
    ]],
    ['صارفین کے پیغامات (ان باکس)', 'User messages (Inbox)', [
      ['نیچے "پیغامات" ٹیب میں دکانداروں کے مسائل، تجاویز اور سوال آتے ہیں۔ نیا پیغام آنے پر ٹیب اور سیٹنگز کے "سپر ایڈمن پینل" بٹن پر سرخ گنتی آتی ہے اور اسکرین پر اطلاع نظر آتی ہے۔', 'The "Inbox" tab at the bottom shows problems, suggestions and questions from shopkeepers. A new message puts a red count on the tab and on the "Super Admin panel" button and shows an alert on screen.'],
      ['پیغام کھولیں تو صارف کا نام، دکان، فون / واٹس ایپ بٹن، اور ڈیوائس کی معلومات (ایپ ورژن، کردار، آن لائن/آف لائن) نظر آتی ہیں۔ نیچے جواب لکھیں یا "فوری جوابات" سے تیار جملہ چنیں۔', 'Open a message to see the user, shop, a phone / WhatsApp button and device info (app version, role, online/offline). Write your reply below or pick a ready sentence from "Quick replies".'],
      ['"بھیجیں" سے پیغام "جواب آ گیا" ہو جاتا ہے؛ "جواب دے کر بند کریں" سے بند۔ صارف جواب میں لکھے تو پیغام دوبارہ "نئے / کھلے" میں آ جاتا ہے۔', '"Send reply" marks it Answered; "Reply and close" closes it. If the user writes again it returns to "New / open".'],
      ['اپنے فون پر پیغام کی اطلاع کے لیے "پیغامات" ٹیب کے اوپر "نوٹیفکیشن آن کریں" دبائیں۔ اس کے بعد ایپ بند ہو تب بھی نیا پیغام، پاس ورڈ درخواست آنے پر فون بجے گا۔ ہر ایڈمن ڈیوائس پر ایک بار آن کریں۔', 'To get alerts on your phone tap "Turn notifications on" at the top of the Inbox tab. After that the phone rings for a new message or password request even when the app is closed. Turn it on once per admin device.'],
      ['"پاس ورڈ درخواستیں" (پیغامات ٹیب کے اندر): لاگ اِن اسکرین پر "پاس ورڈ بھول گئے؟" سے آنے والی درخواستیں۔ پہلے فون/واٹس ایپ پر شناخت کریں، پھر "پاس ورڈ ری سیٹ" دبا کر نیا عارضی پاس ورڈ واٹس ایپ پر بھیجیں اور "مکمل کریں" دبائیں۔ شناخت کے بغیر ری سیٹ نہ کریں۔', '"Password requests" (inside the Inbox tab): requests from "Forgot password?" on the login screen. First confirm identity by phone/WhatsApp, then tap "Reset password", send the temporary password on WhatsApp and tap "Mark done". Never reset without confirming identity.'],
      ['اعلان: "مزید ← اعلانات ← نیا اعلان" میں "کس کو دکھانا ہے" سے تمام دکانیں یا کوئی ایک دکان چنیں؛ "فون پر نوٹیفکیشن بھی بھیجیں" ٹک ہو تو پش بھی جاتا ہے۔ ہر ہدف (سب / ایک دکان) کا ایک ہی اعلان چلتا ہے۔ دکان کی تفصیل میں گھنٹی بٹن اس دکان کے سب صارفین کو فوری نوٹیفکیشن بھیجتا ہے (مثلاً تجدید کی یاد دہانی)۔', 'Announcements: in "More -> Announcements -> New" choose "Show to": all shops or one shop; with "Also send a phone notification" ticked a push goes out too. One announcement runs per target (all / one shop). The bell button in a shop’s details sends an instant notification to all its users (e.g. a renewal reminder).'],
      ['ہر روز میعاد ختم ہونے والی دکانوں کو خود بخود نوٹیفکیشن بھیجنے کے لیے Supabase میں push-notify کے expiry_sweep کا روزانہ شیڈول لگائیں (سیٹ اپ گائیڈ دیکھیں)۔', 'To notify shops automatically before expiry, schedule push-notify’s expiry_sweep daily in Supabase (see the setup guide).']
    ]],
    ['حفاظت اور مسائل', 'Safety and troubleshooting', [
      ['اپنا Super Admin پاس ورڈ کسی کو نہ دیں۔ Supabase کی service-role / secret key کبھی ایپ یا config.js میں نہ ڈالیں۔', 'Never share your Super Admin password. Never put the Supabase service-role / secret key in the app or config.js.'],
      ['Supabase میں SQL فائلیں ترتیب سے ایک بار چلائیں، ایپ ڈیپلائے کرنے سے پہلے: 09 (بل QR پلان)، 10 (بارکوڈ پلان)، 11 (ڈیوائس حد)، 12 (ڈیوائس کو دوبارہ اجازت)، 13 (پروفائل تصویر)، 14 (شرائط کی قبولیت)، 15 (ہم سے رابطہ / سپورٹ پیغامات)، 16 (Web Push)، 17 (پاس ورڈ درخواستیں اور مخصوص اعلان)۔ Web Push کے لیے Edge Function push-notify بھی ڈیپلائے کریں۔ جب تک متعلقہ فائل نہ چلے وہ سہولت دکانوں کو نہیں ملتی۔', 'Run the SQL files once, in order, in Supabase before deploying the app: 09 (bill-QR plan), 10 (barcode plan), 11 (device limit), 12 (allow a device again), 13 (profile picture), 14 (terms acceptance), 15 (Contact us / support messages), 16 (Web Push), 17 (password requests and targeted announcements). For Web Push also deploy the push-notify Edge Function. A feature does not reach shops until its file has been run.'],
      ['قانونی دستاویزات: legal.js کے اوپر LEGAL_CFG میں اپنا نام، رابطہ اور شہر لکھیں اور کسی وکیل سے دستاویزات جانچ لیں۔ متن بدلیں تو version بڑھائیں، سب صارفین سے دوبارہ قبولیت مانگی جائے گی۔ قبولیت کا ریکارڈ Supabase کے terms_acceptance ٹیبل میں ملتا ہے۔ دستخط والی کاپی کے لیے legal.html کھولیں اور "Print / PDF" دبائیں۔', 'Legal documents: put your name, contact and city in LEGAL_CFG at the top of legal.js and have a lawyer review the texts. Raise the version when the text changes and everyone is asked to accept again. Acceptances are stored in the Supabase terms_acceptance table. For a signable copy open legal.html and press "Print / PDF".'],
      ['بل چیک کریں: فروخت ٹیب میں "بل چیک کریں" سے آپ دیکھ سکتے ہیں کہ کوئی بل دکان کے ریکارڈ میں ہے یا نہیں۔', 'Check a bill: the "Check a bill" button in the Sales tab shows whether a bill is in the shop’s records.'],
      ['نیا Super Admin بنانے کے لیے Supabase میں اس کا لاگ اِن یوزر بنا کر platform_admins ٹیبل میں اس کی user_id ڈالیں۔', 'To add another Super Admin, create their login in Supabase and insert their user_id into the platform_admins table.'],
      ['"column ... does not exist" جیسی غلطی آئے تو supabase/schema.sql دوبارہ چلائیں (محفوظ ہے)۔ نیا صارف نہ بنے تو Supabase میں Edge Function "admin-users" چیک کریں۔', 'On a "column ... does not exist" error rerun supabase/schema.sql (it is safe to re-run). If new users cannot be created, check the "admin-users" Edge Function in Supabase.']
    ]]
  ],
  owner: [
    HELP_SHARED_LOGIN, HELP_BILLING, HELP_VERIFY, HELP_PRODUCTS, HELP_CUSTOMERS, HELP_PURCHASES, HELP_REPORTS,
    ['سیٹنگز (صرف مالک)', 'Settings (owner only)', [
      ['ٹیکس فیصد، رسید کا اوپر/نیچے کا متن، دکان کا فون، پتہ، NTN اور کاغذ کی چوڑائی (58 mm، 80 mm، A4) یہاں سے بدلتی ہے۔', 'Tax rate, receipt header/footer, shop phone, address, NTN and paper width (58 mm, 80 mm, A4) are set here.'],
      ['"کیشیئر رعایت دے سکتا ہے" اور "کیشیئر قیمت بدل سکتا ہے" ٹک کریں تو کیشیئر کو یہ اختیار ملتا ہے؛ ورنہ وہ صرف مقررہ قیمت پر بیچ سکتا ہے۔', 'Tick "Cashier can give discount" and "Cashier can change price" to allow it; otherwise cashiers sell at the set price only.'],
      ['"بل پر تصدیقی QR کوڈ" کا بٹن (اگر آپ کے پلان میں QR ہو) رسید پر QR آن/آف کرتا ہے۔ پلان میں QR نہ ہو تو سیٹنگز میں اپ گریڈ کا پیغام نظر آتا ہے۔', 'The "Verification QR on bills" switch (if your plan includes QR) turns the receipt QR on/off. If your plan has no QR, Settings shows an upgrade note instead.'],
      ['زبان (اردو / English) اور رنگ ہر صارف اپنے لیے بدل سکتا ہے۔', 'Language (Urdu / English) and colour can be changed by each user for themselves.']
    ]],
    ['اسٹاف اور سبسکرپشن', 'Staff and subscription', [
      ['مینیجر اور کیشیئر کے اکاؤنٹ سپر ایڈمن / سپورٹ بناتا ہے؛ نئے ملازم یا پاس ورڈ ری سیٹ کے لیے ان سے رابطہ کریں۔', 'Manager and cashier accounts are created by Super Admin / support; contact them for a new employee or a password reset.'],
      ['آپ کے پلان کے مطابق صارفین، پروڈکٹس، بارکوڈ، بل پر QR اور ہر آئی ڈی کی ڈیوائسز کی حد طے ہوتی ہے۔ زیادہ سہولت کے لیے سپورٹ سے پلان اپ گریڈ کروائیں۔', 'Your plan sets the limits for users, products, barcodes, bill QR and devices per ID. Ask support to upgrade the plan for more.'],
      ['آپ کے عملے کا فون گم ہو جائے تو سپورٹ کو اس کا نمبر بتائیں تاکہ پرانا فون بند ہو اور وہ نئے فون پر لاگ اِن کر سکے۔', 'If a staff member’s phone is lost, give support their number so the old phone is blocked and they can log in on a new one.'],
      ['اپنی سبسکرپشن کی میعاد ختم ہونے سے پہلے تجدید کروائیں، ورنہ لاگ اِن بند ہو جائے گا۔', 'Renew your subscription before it expires or login will be blocked.']
    ]],
    HELP_PROFILE, HELP_CONTACT, HELP_NOTIF, HELP_BACKUP
  ],
  manager: [
    HELP_SHARED_LOGIN, HELP_BILLING, HELP_VERIFY, HELP_PRODUCTS, HELP_CUSTOMERS, HELP_PURCHASES, HELP_REPORTS,
    ['آپ کے اختیارات', 'What you can and cannot do', [
      ['آپ بل، پروڈکٹس، اسٹاک، کسٹمرز، خریداری، اخراجات اور رپورٹس سنبھال سکتے ہیں۔', 'You can handle billing, products, stock, customers, purchases, expenses and reports.'],
      ['ٹیکس، رسید کی سیٹنگز اور کیشیئر کے اختیارات صرف مالک بدل سکتا ہے۔ نئے صارف یا پاس ورڈ ری سیٹ کے لیے مالک کے ذریعے سپورٹ سے رابطہ کریں۔', 'Tax, receipt settings and cashier permissions can be changed by the owner only. For new users or password resets, go through the owner to support.']
    ]],
    HELP_PROFILE, HELP_CONTACT, HELP_NOTIF, HELP_BACKUP
  ],
  cashier: [
    HELP_SHARED_LOGIN, HELP_BILLING, HELP_VERIFY, HELP_CUSTOMERS, HELP_PROFILE, HELP_CONTACT, HELP_NOTIF,
    ['آپ کے اختیارات', 'What you can and cannot do', [
      ['آپ بل بنا سکتے ہیں، پروڈکٹس اور اسٹاک دیکھ سکتے ہیں، فروخت کی تاریخ اور رسید دوبارہ کھول کر پرنٹ کر سکتے ہیں، اور کسٹمرز سے وصولی درج کر سکتے ہیں۔', 'You can make bills, view products and stock, reopen and print past receipts, and record customer payments.'],
      ['رعایت دینا اور بل میں قیمت بدلنا تبھی ممکن ہے جب مالک نے سیٹنگز میں اجازت دی ہو۔', 'Giving a discount or changing a price works only if the owner allowed it in Settings.'],
      ['پروڈکٹ بدلنا، خریداری، اخراجات اور رپورٹس مالک / مینیجر کے لیے ہیں۔', 'Editing products, purchases, expenses and reports are for the owner / manager.'],
      ['بل میں غلطی ہو جائے تو مینیجر یا مالک کو فوراً بتائیں۔ پاس ورڈ کسی کو نہ دیں اور کام ختم ہونے پر لاگ آؤٹ کریں۔', 'Tell the manager or owner right away about a wrong bill. Never share your password and log out when your shift ends.']
    ]]
  ]
};

Object.assign(ICONS, { help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .3c0 1.7-2.5 2-2.5 3.7"/><path d="M12 17h.01"/>' });

function helpHtml(role, openFirst = true) {
  const L = LANG === 'ur' ? 0 : 1, secs = HELP[role] || [];
  return `<div class="help">${secs.map((s, i) => `<details ${openFirst && i === 0 ? 'open' : ''}><summary>${esc(s[L])}</summary><ul>${s[2].map(x => `<li>${esc(x[L])}</li>`).join('')}</ul></details>`).join('')}</div>`;
}
function openHelp(role) {
  role = HELP[role] ? role : 'cashier';
  openModal(`<h2>${t('help_title')}</h2><div class="muted u-mb-8">${HELP_ROLE_LABEL[role][LANG === 'ur' ? 0 : 1]}</div>${helpHtml(role)}
    <div class="u-mt-12"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
}
document.addEventListener('click', ev => {
  // `S` is a top-level const in app.js (not a window property), so check it with typeof, not window.S.
  if (ev.target.closest('#btn-help') && typeof S !== 'undefined' && S.session) openHelp(S.session.admin && !['owner', 'manager', 'cashier'].includes(S.session.role) ? 'superadmin' : S.session.role);
});
