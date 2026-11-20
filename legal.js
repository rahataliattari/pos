// Universal POS — legal documents (Urdu + English): Service Agreement, Terms of Use, Privacy Policy, Payment & Refund Policy.
// ⚠ These are TEMPLATES. Fill in LEGAL_CFG below and have a lawyer in Pakistan review them before you rely on them.
// Used by the app (Settings -> Legal, first-login acceptance) and by legal.html (printable / "Save as PDF" copy with signature blocks).
// Placeholders inside the text: {company} {app} {contact} {city} {retain} {trial}.

const LEGAL_CFG = {
  version: '1.2',                         // change this number when the text changes: every user is asked to accept again
  date: '2026-11-20',                     // date of this version
  app: 'Universal POS',
  company_ur: 'راحت علی',   // ← your company / your name
  company_en: 'Rahat Ali',
  contact_ur: '03234182526',   // ← support contact
  contact_en: '03234182526',
  city_ur: 'نارووال', city_en: 'Narowal',
  retain: 90,                             // days the data of an expired shop is kept
  trial: 2                                // free trial days (just a text; the real number is set in Super Admin settings)
};

// Each clause: [title_ur, title_en, text_ur, text_en]  ("\n" starts a new paragraph)
const LEGAL_DOCS = [
  { id: 'agreement', icon: 'shield', ur: 'سافٹ ویئر سروس معاہدہ', en: 'Software Service Agreement', sign: true, clauses: [
    ['فریقین اور مقصد', 'Parties and purpose',
      'یہ معاہدہ {company} ("فراہم کنندہ") اور اس دکان / کاروبار کے مالک ("صارف") کے درمیان ہے جس کا نام رجسٹریشن میں درج ہے۔ فراہم کنندہ صارف کو {app} استعمال کرنے کا حق دیتا ہے، جو بلنگ، اسٹاک، کسٹمر کھاتہ اور رپورٹس کی ایپ ہے اور انٹرنیٹ کے بغیر بھی چلتی ہے، اور انٹرنیٹ ملنے پر ڈیٹا سرور سے سنک کرتی ہے۔',
      'This agreement is between {company} (the "Provider") and the owner of the shop / business named at registration (the "Customer"). The Provider grants the Customer the right to use {app}, a billing, stock, customer-ledger and reporting app that also works offline and syncs to a server when internet is available.'],
    ['لائسنس', 'Licence',
      'فراہم کنندہ صارف کو ایک غیر خصوصی، ناقابلِ منتقلی اور محدود لائسنس دیتا ہے جو صرف اسی دکان کے لیے اور صرف سبسکرپشن کی مدت میں ہے۔ صارف ایپ کو نقل، فروخت، کرایہ پر دینے، تبدیل کرنے یا اس کا سورس کوڈ نکالنے کی کوشش نہیں کرے گا۔',
      'The Provider grants the Customer a non-exclusive, non-transferable, limited licence, for that shop only and only for the subscription period. The Customer will not copy, resell, rent, modify, or try to extract the source code of the app.'],
    ['پلان اور سبسکرپشن', 'Plan and subscription',
      'سہولیات اور حدود (صارفین، پروڈکٹس، بارکوڈ، بل پر QR، ہر آئی ڈی کے لیے ڈیوائسز کی تعداد وغیرہ) صارف کے منتخب پلان کے مطابق ہوں گی۔ سبسکرپشن 1، 3، 6 یا 12 ماہ کے لیے ہو سکتی ہے۔ نیا صارف {trial} دن کا مفت ٹرائل لے سکتا ہے، جس کے بعد سبسکرپشن لینا ضروری ہے۔',
      'Features and limits (users, products, barcodes, bill QR, devices per login ID, etc.) follow the plan the Customer chose. A subscription can run for 1, 3, 6 or 12 months. A new Customer may take a free trial of {trial} days, after which a subscription is needed.'],
    ['فیس اور ادائیگی', 'Fees and payment',
      'فیس فراہم کنندہ کی موجودہ قیمتوں کے مطابق ہے اور مدت شروع ہونے سے پہلے ادا کی جاتی ہے (نقد، بینک، جاز کیش یا ایزی پیسہ)۔ ادائیگی فراہم کنندہ کے ریکارڈ میں درج ہونے پر میعاد بڑھتی ہے۔ تجدید خود بخود نہیں ہوتی اور کوئی رقم خود بخود نہیں کٹتی۔ تفصیل "ادائیگی، تجدید اور واپسی کی پالیسی" میں ہے۔',
      'Fees follow the Provider’s current price list and are paid before the period starts (cash, bank, JazzCash or Easypaisa). The expiry date is extended once the payment is recorded by the Provider. Renewal is not automatic and nothing is charged automatically. Details are in the "Payment, Renewal and Refund Policy".'],
    ['میعاد ختم ہونا اور معطلی', 'Expiry and suspension',
      'میعاد ختم ہونے کے بعد 3 دن کی مہلت ملتی ہے جس میں بل بنتے رہتے ہیں۔ مہلت ختم ہونے پر نئے بل بنانا بند ہو جاتا ہے، پرانا ڈیٹا نظر آتا رہتا ہے، اور سرور سے سنک میعاد ختم ہوتے ہی رک جاتا ہے۔ دکان معطل ہونے پر داخلہ بند ہو جاتا ہے۔ فراہم کنندہ عدم ادائیگی، معاہدے کی خلاف ورزی یا غیر قانونی استعمال کی صورت میں دکان یا کسی اکاؤنٹ کو معطل کر سکتا ہے۔ معطلی یا میعاد ختم ہونے کے بعد ڈیٹا {retain} دن محفوظ رکھا جاتا ہے؛ تجدید پر سب بحال ہو جاتا ہے۔',
      'After the subscription expires there is a 3-day grace period during which billing continues. When the grace period ends, creating new bills is blocked, existing data stays viewable, and syncing with the server stops from the moment of expiry. When a shop is suspended, access is blocked. The Provider may suspend a shop or an account for non-payment, breach of this agreement or unlawful use. After suspension or expiry the data is kept for {retain} days; on renewal everything is restored.'],
    ['اکاؤنٹس اور ڈیوائسز', 'Accounts and devices',
      'ہر لاگ اِن آئی ڈی (موبائل نمبر) ایک ہی شخص کی ہے اور اسے آپس میں شیئر نہیں کیا جا سکتا۔ ایک آئی ڈی پلان میں طے شدہ تعداد کی ڈیوائسز پر چل سکتی ہے (ڈیفالٹ: ایک ڈیوائس)۔ ڈیوائس گم یا چوری ہو جائے تو فوراً فراہم کنندہ کو بتائیں؛ فراہم کنندہ وہ ڈیوائس بند کر سکتا ہے اور تصدیق کے بعد آئی ڈی نئی ڈیوائس پر چلانے کی اجازت دے سکتا ہے، اور بند کی گئی ڈیوائس کو دوبارہ اجازت بھی دے سکتا ہے۔ اپنے اکاؤنٹس کی تمام سرگرمی کا ذمہ دار صارف ہے۔',
      'Each login ID (mobile number) belongs to one person and must not be shared. An ID can run on the number of devices set by the plan (default: one device). If a device is lost or stolen, tell the Provider immediately; the Provider may block that device and, after verification, allow the ID on a new device, and may also allow a blocked device again. The Customer is responsible for all activity under its accounts.'],
    ['صارف کا ڈیٹا', 'Customer data',
      'دکان کا ڈیٹا (پروڈکٹس، فروخت، کسٹمرز، اخراجات وغیرہ) صارف کی ملکیت ہے۔ فراہم کنندہ اسے صرف سروس دینے، سپورٹ اور حفاظت کے لیے استعمال کرتا ہے اور فروخت نہیں کرتا۔ ڈیٹا کی درستی، قیمتوں، اسٹاک اور بلوں کی ذمہ داری صارف کی ہے۔ صارف باقاعدگی سے "ڈیٹا ایکسپورٹ" سے بیک اپ لے۔ تفصیل رازداری کی پالیسی میں ہے۔',
      'The shop’s data (products, sales, customers, expenses, etc.) belongs to the Customer. The Provider uses it only to deliver the service, give support and keep it secure, and does not sell it. The Customer is responsible for the accuracy of data, prices, stock and bills, and should take regular backups with "Data export". See the Privacy Policy.'],
    ['بل پر QR کوڈ', 'The QR code on bills',
      'بل پر چھپا QR صرف بل کی تصدیق کے لیے ہے، یعنی یہ دیکھنے کے لیے کہ بل دکان کے ریکارڈ سے ملتا ہے یا نہیں۔ یہ ادائیگی یا وصولی کا ذریعہ نہیں، نہ ہی کسی سرکاری ادارے (جیسے FBR) کی تصدیق ہے۔ تصدیقی کوڈ بل میں ردوبدل پکڑنے کا آسان طریقہ ہے، یہ کوئی ڈیجیٹل دستخط نہیں۔ فراہم کنندہ اس کی قانونی حیثیت کی ضمانت نہیں دیتا۔',
      'The QR printed on a bill is for verification only, i.e. to check that a bill matches the shop’s records. It is not a way to pay or receive money and is not a verification by any government body (such as the FBR). The verification code is a simple way to spot alterations, not a digital signature. The Provider does not guarantee its legal standing.'],
    ['ٹیکس اور قانونی تعمیل', 'Tax and legal compliance',
      'ٹیکس رجسٹریشن، سیلز ٹیکس، انوائس کے قواعد اور کسی بھی سرکاری سسٹم (بشمول FBR POS انٹیگریشن) کی تعمیل صرف صارف کی ذمہ داری ہے۔ جب تک تحریری طور پر الگ سے طے نہ ہو، ایپ FBR یا کسی صوبائی ادارے کے سسٹم سے منسلک نہیں۔',
      'Tax registration, sales tax, invoicing rules and compliance with any government system (including FBR POS integration) are solely the Customer’s responsibility. Unless agreed separately in writing, the app is not connected to the FBR or any provincial authority’s system.'],
    ['دستیابی اور سپورٹ', 'Availability and support',
      'فراہم کنندہ سروس کو بہتر طریقے سے چلانے کی معقول کوشش کرتا ہے مگر بلا تعطل چلنے کی ضمانت نہیں دیتا، کیونکہ سنک اور کچھ سہولیات انٹرنیٹ اور تھرڈ پارٹی سروسز پر منحصر ہیں۔ سپورٹ {contact} پر کام کے اوقات میں دستیاب ہے۔ دیکھ بھال کے لیے سروس عارضی طور پر بند ہو سکتی ہے۔',
      'The Provider makes reasonable efforts to keep the service running but does not guarantee uninterrupted service, as syncing and some features depend on internet and third-party services. Support is available at {contact} during working hours. The service may be paused briefly for maintenance.'],
    ['ضمانت سے انکار اور ذمہ داری کی حد', 'Disclaimer and limit of liability',
      'ایپ "جیسی ہے" کی بنیاد پر دی جاتی ہے۔ قانون کی اجازت کی حد تک فراہم کنندہ منافع، آمدن، ڈیٹا یا کاروباری نقصان جیسے بالواسطہ نقصانات کا ذمہ دار نہیں، اور کسی بھی دعوے میں اس کی کل ذمہ داری صارف کی طرف سے پچھلے 3 ماہ میں ادا کی گئی فیس سے زیادہ نہیں ہو گی۔ یہ حد صارف کی اس غلطی پر لاگو نہیں ہوتی جو قانوناً محدود نہیں کی جا سکتی۔',
      'The app is provided "as is". To the extent the law allows, the Provider is not liable for indirect losses such as lost profit, income, data or business, and its total liability for any claim will not exceed the fees paid by the Customer in the previous 3 months. This limit does not apply to liability that cannot be limited by law.'],
    ['ملکیتی حقوق اور رازداری', 'Ownership and confidentiality',
      'سافٹ ویئر، نام، لوگو اور ڈیزائن فراہم کنندہ کی ملکیت ہیں۔ دونوں فریق ایک دوسرے کی وہ معلومات خفیہ رکھیں گے جو انہیں اس معاہدے کے دوران ملیں، سوائے قانونی تقاضے کے۔',
      'The software, name, logo and design belong to the Provider. Each party will keep the other’s confidential information, learned through this agreement, secret, except where the law requires disclosure.'],
    ['مدت اور خاتمہ', 'Term and termination',
      'معاہدہ سبسکرپشن کی مدت کے لیے ہے اور تجدید پر جاری رہتا ہے۔ صارف تجدید نہ کر کے کسی بھی وقت ختم کر سکتا ہے۔ کوئی فریق سنگین خلاف ورزی کرے اور 30 دن کے نوٹس میں اصلاح نہ کرے تو دوسرا فریق معاہدہ ختم کر سکتا ہے۔ خاتمے پر صارف {retain} دن کے اندر اپنا ڈیٹا ایکسپورٹ کر سکتا ہے، اس کے بعد ڈیٹا مٹایا جا سکتا ہے۔',
      'The agreement runs for the subscription period and continues on renewal. The Customer may end it at any time by not renewing. If a party commits a serious breach and does not fix it within 30 days of notice, the other party may terminate. After termination the Customer can export its data within {retain} days, after which the data may be deleted.'],
    ['تبدیلیاں', 'Changes',
      'فراہم کنندہ ایپ کی سہولیات اور اس معاہدے میں تبدیلی کر سکتا ہے اور اس کا نوٹس ایپ میں یا رابطے کے ذریعے دے گا۔ نئی شرائط پر استعمال جاری رکھنا ان کی قبولیت سمجھا جائے گا۔ قیمتوں میں تبدیلی صرف اگلی تجدید پر لاگو ہو گی۔',
      'The Provider may change the app’s features and this agreement, and will give notice in the app or by contact. Continuing to use the app after the new terms means acceptance. Price changes apply only from the next renewal.'],
    ['قابلِ اطلاق قانون اور تنازعہ', 'Governing law and disputes',
      'اس معاہدے پر پاکستان کے قوانین لاگو ہوں گے۔ کوئی تنازعہ ہو تو دونوں فریق پہلے 30 دن باہمی گفتگو سے حل کی کوشش کریں گے، ورنہ {city} کی مجاز عدالتیں یا فریقین کی طے کردہ ثالثی کا فورم سماعت کرے گا۔',
      'This agreement is governed by the laws of Pakistan. In a dispute, the parties will first try to settle it by discussion for 30 days; failing that, the competent courts of {city} (or an arbitration forum agreed by the parties) will hear it.'],
    ['قبولیت', 'Acceptance',
      'صارف کا ایپ میں "قبول کرتا ہوں" دبانا اس معاہدے پر دستخط کے برابر ہے؛ ورژن، وقت اور ڈیوائس کا ریکارڈ رکھا جاتا ہے۔ چھپی ہوئی کاپی پر دونوں فریق دستخط بھی کر سکتے ہیں۔ دکان کی طرف سے قبول کرنے والا شخص تصدیق کرتا ہے کہ وہ ایسا کرنے کا مجاز ہے۔',
      'The Customer pressing "I accept" in the app is equivalent to signing this agreement; the version, time and device are recorded. The parties may also sign a printed copy. The person accepting for the shop confirms they are authorised to do so.']
  ] },

  { id: 'terms', icon: 'help', ur: 'شرائط و ضوابط (استعمال)', en: 'Terms and Conditions of Use', clauses: [
    ['قبولیت', 'Acceptance',
      '{app} استعمال کر کے آپ ان شرائط، سروس معاہدے اور رازداری کی پالیسی سے اتفاق کرتے ہیں۔ اتفاق نہ ہو تو ایپ استعمال نہ کریں۔',
      'By using {app} you agree to these terms, the Service Agreement and the Privacy Policy. If you do not agree, do not use the app.'],
    ['اہلیت', 'Eligibility',
      'ایپ استعمال کرنے والا 18 سال یا زیادہ عمر کا ہو اور اپنے کاروبار کی طرف سے استعمال کرنے کا مجاز ہو۔',
      'Users must be 18 or older and authorised to use the app for their business.'],
    ['اکاؤنٹ اور پاس ورڈ', 'Account and password',
      'اپنا پاس ورڈ خفیہ رکھیں اور کسی کو نہ دیں۔ اکاؤنٹ کے غلط استعمال کا شبہ ہو تو فوراً مالک یا سپورٹ کو بتائیں۔ ہر آئی ڈی صرف ایک شخص کے لیے ہے، اور ڈیوائسز کی تعداد پلان کے مطابق محدود ہے۔',
      'Keep your password secret and do not share it. If you suspect misuse, tell the owner or support immediately. Each ID is for one person only, and the number of devices is limited by the plan.'],
    ['جائز استعمال', 'Acceptable use',
      'ایپ کو غیر قانونی کاروبار، جعلی یا غلط بل بنانے، دھوکہ دہی، دوسروں کے ڈیٹا تک غیر مجاز رسائی، سسٹم میں خلل ڈالنے یا حفاظتی پابندیاں (جیسے ڈیوائس کی حد) توڑنے کے لیے استعمال نہ کریں۔',
      'Do not use the app for illegal business, making false or misleading bills, fraud, unauthorised access to others’ data, disrupting the system, or getting around its safeguards (such as the device limit).'],
    ['کردار اور اختیارات', 'Roles and permissions',
      'مالک، مینیجر اور کیشیئر کے اختیارات الگ ہیں۔ مالک اپنے عملے کے کام اور ان کی دی گئی رعایتوں اور بلوں کا ذمہ دار ہے۔',
      'Owner, manager and cashier have different permissions. The owner is responsible for the staff’s work and for the discounts and bills they make.'],
    ['آف لائن استعمال اور سنک', 'Offline use and sync',
      'انٹرنیٹ نہ ہو تو ڈیٹا اسی ڈیوائس میں محفوظ رہتا ہے اور انٹرنیٹ آنے پر سرور سے سنک ہوتا ہے۔ سنک ہونے سے پہلے براؤزر کا ڈیٹا صاف کرنے، ایپ ہٹانے یا ڈیوائس کھو جانے سے وہ ریکارڈ ضائع ہو سکتا ہے۔ اس لیے "زیرِ انتظار" ریکارڈ سنک کروائیں اور باقاعدگی سے ایکسپورٹ بیک اپ لیں۔',
      'Without internet, data stays on the device and syncs to the server when internet returns. Clearing browser data, removing the app, or losing the device before syncing can lose those records. So let "Pending" records sync and take regular export backups.'],
    ['بل، قیمتیں اور درستی', 'Bills, prices and accuracy',
      'بل میں قیمت، رعایت، ٹیکس اور اسٹاک کی درستی صارف کی ذمہ داری ہے۔ غلط بل کو "منسوخ" یا "واپسی" سے درست کریں؛ بل کا QR صرف تصدیق کے لیے ہے، ادائیگی یا وصولی کے لیے نہیں۔',
      'The accuracy of prices, discounts, tax and stock on a bill is the user’s responsibility. Correct a wrong bill with "Void" or "Return"; the QR on a bill is for verification only, not for payment or receipt.'],
    ['تھرڈ پارٹی سروسز اور اجازتیں', 'Third-party services and permissions',
      'ایپ سرور ہوسٹنگ (Supabase) اور واٹس ایپ / پرنٹر جیسی سہولیات استعمال کرتی ہے جن کی اپنی شرائط ہیں۔ کیمرا صرف بارکوڈ / QR سکین اور آپ کی چنی ہوئی پروفائل تصویر کے لیے استعمال ہوتا ہے۔',
      'The app uses server hosting (Supabase) and features such as WhatsApp and printers, which have their own terms. The camera is used only for barcode / QR scanning and for the profile picture you choose.'],
    ['معطلی', 'Suspension',
      'ان شرائط کی خلاف ورزی، عدم ادائیگی یا سیکیورٹی خطرے کی صورت میں اکاؤنٹ یا دکان معطل کی جا سکتی ہے۔',
      'An account or shop may be suspended for breach of these terms, non-payment or a security risk.'],
    ['ضمانت سے انکار', 'Disclaimer',
      'ایپ "جیسی ہے" دی جاتی ہے۔ ہم غلطی سے پاک یا بلا تعطل ہونے کی ضمانت نہیں دیتے۔ ذمہ داری کی حد سروس معاہدے میں درج ہے۔',
      'The app is provided "as is". We do not guarantee it is error-free or uninterrupted. The limit of liability is in the Service Agreement.'],
    ['تبدیلیاں اور رابطہ', 'Changes and contact',
      'ان شرائط میں تبدیلی ہو تو ایپ میں نیا ورژن دکھایا جائے گا اور دوبارہ قبولیت مانگی جا سکتی ہے۔ سوالات کے لیے: {contact}۔',
      'If these terms change, the app will show the new version and may ask you to accept again. Questions: {contact}.']
  ] },

  { id: 'privacy', icon: 'user', ur: 'رازداری کی پالیسی', en: 'Privacy Policy', clauses: [
    ['ہم کون ہیں', 'Who we are',
      '{company} ({app} کا فراہم کنندہ) آپ کی معلومات کا نگران ہے۔ رابطہ: {contact}۔',
      '{company} (the provider of {app}) looks after your information. Contact: {contact}.'],
    ['ایپ میں سرگرمی کا ریکارڈ', 'App activity record',
      'سروس بہتر بنانے، سپورٹ دینے اور اگر آپ کچھ دن ایپ نہ کھولیں تو آپ کو یاد دہانی بھیجنے کے لیے ایپ یہ ریکارڈ کرتی ہے کہ آپ نے کون سی اسکرین کھولی اور کون سا بٹن دبایا۔ اس میں بل کی رقم، کسٹمر، پروڈکٹ یا آپ کا لکھا ہوا کوئی متن شامل نہیں ہوتا۔ یہ ریکارڈ 30 دن بعد خود مٹ جاتا ہے۔',
      'To improve the service, give support and send you a reminder if you have not opened the app for some days, the app records which screens you opened and which buttons you pressed. It does not include bill amounts, customers, products or any text you type. This record is deleted automatically after 30 days.'],
    ['ہم کون سی معلومات لیتے ہیں', 'What we collect',
      'اکاؤنٹ: نام، موبائل نمبر، کردار، اور اگر آپ لگائیں تو پروفائل تصویر۔\nدکان: نام، پتہ، فون، NTN، رسید کا متن اور سیٹنگز۔\nکاروباری ڈیٹا: پروڈکٹس، اسٹاک، فروخت، خریداری، اخراجات، کسٹمرز اور سپلائرز کے نام / نمبر / کھاتہ۔\nتکنیکی: ڈیوائس کی بے ترتیب شناخت، ڈیوائس کا نام (جیسے Android · Chrome)، آخری استعمال کا وقت، سنک کی حالت۔\nہم آپ کی لوکیشن، کانٹیکٹس، مائیکروفون یا ایس ایم ایس نہیں لیتے۔',
      'Account: name, mobile number, role and, if you add one, a profile picture.\nShop: name, address, phone, NTN, receipt text and settings.\nBusiness data: products, stock, sales, purchases, expenses, and customers’ and suppliers’ names / numbers / ledgers.\nTechnical: a random device ID, the device name (e.g. Android · Chrome), last-used time and sync status.\nWe do not collect your location, contacts, microphone or SMS.'],
    ['استعمال کا مقصد', 'Why we use it',
      'سروس چلانے، لاگ اِن اور ڈیوائس کی حد نافذ کرنے، سنک، سپورٹ، سیکیورٹی اور بلنگ (سبسکرپشن کا حساب) کے لیے۔ ہم آپ کا ڈیٹا اشتہارات کے لیے استعمال یا فروخت نہیں کرتے۔',
      'To run the service, log you in and enforce the device limit, sync, give support, keep things secure and handle billing (subscription records). We do not use your data for advertising and we do not sell it.'],
    ['ڈیٹا کہاں رہتا ہے', 'Where data is kept',
      'آپ کی ڈیوائس پر (آف لائن کام کے لیے) اور سنک کے بعد کلاؤڈ سرور پر (Supabase)۔ سرور پر رسائی صرف مجاز اکاؤنٹس کو ہے اور ہر دکان کا ڈیٹا دوسری دکانوں سے الگ رکھا جاتا ہے۔',
      'On your device (for offline work) and, after syncing, on a cloud server (Supabase). Access to the server is limited to authorised accounts and each shop’s data is kept separate from other shops.'],
    ['کس کے ساتھ شیئر ہوتا ہے', 'Who it is shared with',
      'صرف اس دکان کے مجاز صارفین، سروس چلانے والی تھرڈ پارٹی کمپنیوں (جیسے ہوسٹنگ) کے ساتھ جتنا ضروری ہو، فراہم کنندہ کے سپورٹ عملے کے ساتھ (سپورٹ کے لیے)، اور قانون کے تقاضے پر متعلقہ اداروں کے ساتھ۔',
      'Only with the shop’s authorised users, with third-party companies that run the service (such as hosting) as far as needed, with the Provider’s support staff (for support), and with authorities where the law requires.'],
    ['آپ کے کسٹمرز کا ڈیٹا', 'Your customers’ data',
      'دکان کے کسٹمرز اور سپلائرز کی معلومات کی قانونی ذمہ داری دکان کی ہے؛ ہم انہیں صرف آپ کی ہدایت پر سروس دینے کے لیے سنبھالتے ہیں۔',
      'The shop is responsible, legally, for its customers’ and suppliers’ information; we handle it only to provide the service on your instructions.'],
    ['کیمرا اور تصویر', 'Camera and photo',
      'کیمرا صرف بارکوڈ / QR سکین کے لیے ہے اور سکین کی تصویر محفوظ نہیں کی جاتی۔ پروفائل تصویر آپ خود چنتے ہیں؛ اسے چھوٹا کر کے آپ کے اکاؤنٹ کے ساتھ محفوظ کیا جاتا ہے اور کسی وقت بھی ہٹائی جا سکتی ہے۔',
      'The camera is used only to scan barcodes / QR codes and scan images are not saved. You choose your profile picture yourself; it is shrunk and stored with your account and can be removed at any time.'],
    ['حفاظت', 'Security',
      'ڈیٹا انٹرنیٹ پر محفوظ کنکشن سے جاتا ہے اور رسائی پاس ورڈ، کردار اور ڈیوائس کی حد سے محدود ہے۔ کوئی نظام سو فیصد محفوظ نہیں ہوتا؛ اپنے فون پر لاک لگائیں اور پاس ورڈ کسی کو نہ دیں۔',
      'Data travels over secure connections, and access is limited by password, role and the device limit. No system is 100% secure; lock your phone and never share your password.'],
    ['ڈیٹا کی مدت اور حذف کرنا', 'Retention and deletion',
      'ڈیٹا سبسکرپشن کی مدت میں اور ختم ہونے کے بعد {retain} دن تک رکھا جاتا ہے۔ آپ کسی بھی وقت ایکسپورٹ یا حذف کی درخواست کر سکتے ہیں؛ قانونی یا حسابی ضرورت کے مطابق کچھ ریکارڈ مزید رکھا جا سکتا ہے۔',
      'Data is kept during the subscription and for {retain} days after it ends. You may ask for export or deletion at any time; some records may be kept longer where law or accounting requires.'],
    ['آپ کے حقوق', 'Your rights',
      'آپ اپنی معلومات دیکھنے، درست کرانے، ایکسپورٹ کرنے اور حذف کرانے کی درخواست {contact} پر کر سکتے ہیں۔',
      'You may ask to see, correct, export or delete your information at {contact}.'],
    ['بچے', 'Children',
      'ایپ 18 سال سے کم عمر کے لیے نہیں۔',
      'The app is not for people under 18.'],
    ['تبدیلیاں', 'Changes',
      'پالیسی بدلے تو ایپ میں نیا ورژن اور تاریخ دکھائی جائے گی۔',
      'If this policy changes, the app will show the new version and date.']
  ] },

  { id: 'refund', icon: 'wallet', ur: 'ادائیگی، تجدید اور واپسی کی پالیسی', en: 'Payment, Renewal and Refund Policy', clauses: [
    ['پلان اور قیمت', 'Plans and price',
      'ہر پلان کی ماہانہ قیمت اور سہولیات فراہم کنندہ کی قیمتوں کی فہرست میں ہیں۔ قیمت روپے (PKR) میں ہے اور اس میں لاگو ٹیکس شامل ہو بھی سکتا ہے اور نہیں بھی؛ ادائیگی سے پہلے تصدیق کر لیں۔',
      'Each plan’s monthly price and features are in the Provider’s price list. Prices are in rupees (PKR) and may or may not include applicable tax; confirm before paying.'],
    ['مفت ٹرائل', 'Free trial',
      'ٹرائل میں کوئی رقم نہیں لی جاتی۔ ٹرائل ختم ہونے پر سبسکرپشن نہ لیں تو دکان کی میعاد ختم ہو جاتی ہے اور ڈیٹا {retain} دن محفوظ رہتا ہے۔',
      'No money is taken for the trial. If you do not subscribe when it ends, the shop expires and the data is kept for {retain} days.'],
    ['ادائیگی کے طریقے', 'Payment methods',
      'نقد، بینک ٹرانسفر، جاز کیش یا ایزی پیسہ۔ ادائیگی کی رسید / اسکرین شاٹ سنبھال کر رکھیں۔ فراہم کنندہ کے ریکارڈ میں درج ہونے پر ہی میعاد بڑھتی ہے۔',
      'Cash, bank transfer, JazzCash or Easypaisa. Keep the receipt / screenshot. The expiry date is extended only once the payment is recorded by the Provider.'],
    ['تجدید', 'Renewal',
      'تجدید خود بخود نہیں ہوتی اور کوئی رقم خود بخود نہیں کٹتی۔ میعاد ختم ہونے سے پہلے ایپ میں یاد دہانی آ سکتی ہے۔ نئی میعاد پرانی میعاد (یا آج کی تاریخ، جو بعد کی ہو) سے گنی جاتی ہے۔',
      'Renewal is not automatic and nothing is charged automatically. The app may remind you before expiry. The new expiry counts from the old expiry (or today, whichever is later).'],
    ['دیر سے تجدید', 'Late renewal',
      'میعاد ختم ہونے کے بعد 3 دن کی مہلت کے بعد نئے بل بند ہو جاتے ہیں مگر ڈیٹا {retain} دن محفوظ رہتا ہے۔ اس مدت میں تجدید پر سب بحال ہو جاتا ہے۔ اس کے بعد ڈیٹا مٹایا جا سکتا ہے۔',
      'After expiry and a 3-day grace period, new bills are blocked but data is kept for {retain} days. Renewing within that time restores everything. After that the data may be deleted.'],
    ['واپسی (ریفنڈ)', 'Refunds',
      'ادا شدہ مدت شروع ہونے کے بعد فیس عام طور پر واپس نہیں ہوتی، سوائے ان صورتوں کے:\n(الف) ایک ہی ادائیگی غلطی سے دو بار ہوئی — اضافی رقم مکمل واپس۔\n(ب) فراہم کنندہ کی غلطی سے سروس طویل عرصہ دستیاب نہ رہی — متاثرہ دنوں کے برابر میعاد یا رقم کی واپسی۔\n(ج) پہلی بار کی سبسکرپشن کے پہلے 7 دن میں درخواست — فراہم کنندہ کی صوابدید پر، اصل اخراجات منہا کر کے۔',
      'Once a paid period has started, fees are generally not refundable, except:\n(a) the same payment was made twice by mistake — the extra amount is refunded in full;\n(b) the service was unavailable for a long time because of the Provider — extra days or a refund for the affected days;\n(c) a request within the first 7 days of a first-time subscription — at the Provider’s discretion, after deducting actual costs.'],
    ['پلان بدلنا', 'Changing plan',
      'اپ گریڈ فوراً ہو سکتا ہے اور فرق کی رقم بقیہ مدت کے حساب سے لی جاتی ہے۔ ڈاؤن گریڈ اگلی تجدید سے لاگو ہوتا ہے؛ نئے پلان کی حدیں (صارفین، پروڈکٹس، ڈیوائسز) پوری ہونا ضروری ہے۔',
      'An upgrade can take effect immediately, with the difference charged for the remaining period. A downgrade applies from the next renewal; the new plan’s limits (users, products, devices) must be met.'],
    ['منسوخی', 'Cancellation',
      'منسوخی کے لیے تجدید نہ کریں یا {contact} پر بتا دیں۔ میعاد کے آخر تک سروس چلتی رہتی ہے۔ جانے سے پہلے "ڈیٹا ایکسپورٹ" سے اپنا ڈیٹا نکال لیں۔',
      'To cancel, simply do not renew or tell us at {contact}. The service continues until the end of the paid period. Export your data with "Data export" before you leave.'],
    ['واپسی کا طریقہ اور وقت', 'How and when refunds are paid',
      'منظور شدہ واپسی اسی ذریعے سے جس سے ادائیگی ہوئی تھی، عام طور پر 14 کاری دنوں میں کی جاتی ہے۔',
      'Approved refunds are paid back through the same channel as the payment, usually within 14 working days.'],
    ['رابطہ', 'Contact',
      'ادائیگی، تجدید یا واپسی کے سوال کے لیے: {contact}۔',
      'For questions about payment, renewal or refunds: {contact}.']
  ] }
];

// ───────── helpers (work in the app and on legal.html) ─────────
const lgEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lgFill = (txt, L) => txt.replace(/\{(\w+)\}/g, (m, k) => {
  if (k === 'app') return LEGAL_CFG.app;
  if (k === 'company' || k === 'contact' || k === 'city') return LEGAL_CFG[k + (L === 0 ? '_ur' : '_en')];
  return k in LEGAL_CFG ? LEGAL_CFG[k] : m;
});
// L: 0 = Urdu, 1 = English
function legalDocHtml(doc, L) {
  const body = doc.clauses.map((c, i) => `<div class="lgc"><h4>${i + 1}. ${lgEsc(lgFill(c[L], L))}</h4>${lgFill(c[2 + L], L).split('\n').map(p => `<p>${lgEsc(p)}</p>`).join('')}</div>`).join('');
  return `<div class="legal" dir="${L === 0 ? 'rtl' : 'ltr'}"><div class="muted">${L === 0 ? 'ورژن' : 'Version'} ${LEGAL_CFG.version} · ${LEGAL_CFG.date}</div>${body}</div>`;
}

if (typeof I18N !== 'undefined') {
}

// ───────── in-app parts: viewer, Settings list, first-login acceptance (the app only; legal.html ignores these) ─────────
const termsKey = () => 'terms_' + ((S.session && S.session.user_id) || 'demo');
function legalListHtml(acc) {
  const L = LANG === 'ur' ? 0 : 1;
  return LEGAL_DOCS.map(d => `<button class="btn secondary block u-mb-8 u-jc-start" type="button" data-legal="${d.id}">${ic(d.icon, 18)} ${lgEsc(d[L === 0 ? 'ur' : 'en'])}</button>`).join('')
    + `<div class="muted">${t('lg_ver')} ${LEGAL_CFG.version}${acc ? ` · ${t('lg_accepted_on')}: ${lgEsc(fmtDate(acc.at))}` : ''}</div>`;
}
function openLegal(id, L) {
  const d = LEGAL_DOCS.find(x => x.id === id); if (!d) return;
  L = L == null ? (LANG === 'ur' ? 0 : 1) : L;
  openModal(`<h2>${lgEsc(d[L === 0 ? 'ur' : 'en'])}</h2>
    <div class="row u-mb-8"><button class="btn secondary sm" type="button" id="lg-lang">${L === 0 ? 'English' : 'اردو'}</button>
      <button class="btn secondary sm u-mis-6" type="button" id="lg-print">${L === 0 ? 'پرنٹ / PDF' : 'Print / PDF'}</button></div>
    ${legalDocHtml(d, L)}<div class="u-mt-12"><button class="btn secondary block" data-close>${t('close')}</button></div>`);
  $('lg-lang').onclick = () => openLegal(id, 1 - L);
  $('lg-print').onclick = () => doPrint(`<div class="legalprint"><h2>${lgEsc(d[L === 0 ? 'ur' : 'en'])}</h2>${legalDocHtml(d, L)}</div>`, 'a4');   // printed from inside the app: no separate page or address
}
async function termsPush() {
  if (window.POS_DEMO || !S.session || S.session.admin || !navigator.onLine) return;
  const acc = await getSetting(termsKey(), null);
  if (!acc || !(await getSetting(termsKey() + '_dirty', false))) return;
  try {
    const { error } = await getSb().rpc('accept_terms', { p_shop: S.session.shop_id, p_version: acc.v, p_device: typeof deviceName === 'function' ? deviceName() : '' });
    if (!error || /PGRST202|Could not find the function/i.test(error.message || '')) await delSetting(termsKey() + '_dirty');
  } catch (e) {}
}
// Shown after login until this user accepts the current version. Super Admin is exempt.
async function termsGate() {
  if (window.POS_DEMO || !S.session || S.session.admin) return;
  const acc = await getSetting(termsKey(), null);
  if (acc && acc.v === LEGAL_CFG.version) { termsPush(); return; }
  let g = $('terms-gate'); if (g) g.remove();
  g = document.createElement('div'); g.id = 'terms-gate';
  g.innerHTML = `<div class="tg-card"><h2>${t('lg_accept_title')}</h2><p>${t('lg_accept_intro')}</p>
    ${LEGAL_DOCS.map(d => `<button class="btn secondary block u-mb-8 u-jc-start" type="button" data-legal="${d.id}">${ic(d.icon, 18)} ${lgEsc(d[LANG === 'ur' ? 'ur' : 'en'])}</button>`).join('')}
    <label class="u-d-flex u-gap-10 u-ai-start u-m-14n0"><input type="checkbox" id="tg-chk" class="u-w-auto u-minh-0 u-mt-5"><span>${t('lg_agree')}</span></label>
    <button class="btn block" id="tg-ok" disabled>${t('lg_accept_btn')}</button>
    <button class="btn secondary block u-mt-8" id="tg-out">${t('lg_logout')}</button></div>`;
  document.body.appendChild(g);
  $('tg-chk').onchange = e => { $('tg-ok').disabled = !e.target.checked; };
  $('tg-ok').onclick = async () => {
    await setSetting(termsKey(), { v: LEGAL_CFG.version, at: new Date().toISOString() }); await setSetting(termsKey() + '_dirty', true);
    g.remove(); termsPush(); if (S.tab === 'settings') renderSettings();
  };
  $('tg-out').onclick = async () => { g.remove(); doLogout(); };
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-legal]'); if (b && typeof S !== 'undefined') openLegal(b.dataset.legal);
});

// Full-screen reader that opens ABOVE whatever is on screen (used by the sign-up form, so the typed form is not lost). No new page, no address bar.
function legalOverlay(id) {
  const d = LEGAL_DOCS.find(x => x.id === id), L = LANG === 'ur' ? 0 : 1; if (!d) return;
  const v = document.createElement('div'); v.className = 'lg-ov';
  v.innerHTML = `<div class="lg-ov-in"><div class="row"><h2 class="grow u-m-0">${lgEsc(d[L === 0 ? 'ur' : 'en'])}</h2><button class="btn secondary sm" type="button" data-lgclose>${t('close')}</button></div>${legalDocHtml(d, L)}</div>`;
  v.onclick = e => { if (e.target === v || e.target.closest('[data-lgclose]')) v.remove(); };
  document.body.appendChild(v);
}
document.addEventListener('click', ev => { const b = ev.target.closest('[data-lgov]'); if (b && typeof S !== 'undefined') { ev.preventDefault(); legalOverlay(b.dataset.lgov); } });
