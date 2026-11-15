// Demo mode: no login, no server. Seeds a sample shop through the app's REAL save functions.
window.POS_DEMO = true;
window.POS_CONFIG = { SUPABASE_URL: 'https://demo.invalid', LOGIN_DOMAIN: 'demo.invalid', SUPABASE_KEY: 'demo' };

// Demo wording for the two settings buttons / the sync note
I18N.ur.logout = 'ڈیمو ری سیٹ کریں';
I18N.ur.logout_confirm = 'ڈیمو کا سارا ڈیٹا مٹا کر نمونے کے ڈیٹا کے ساتھ دوبارہ شروع کریں؟';
I18N.ur.sync_note = 'ڈیمو ورژن: ڈیٹا صرف اسی فون کے براؤزر میں محفوظ ہے';
I18N.en.logout = 'Reset demo';
I18N.en.logout_confirm = 'Erase all demo data and start again with the sample data?';
I18N.en.sync_note = 'Demo version: data is stored only in this phone\'s browser';

window.POS_DEMO_RESET = () => { try { localStorage.removeItem('pos_demo_data_v1'); } catch (e) {} location.reload(); };

window.POS_DEMO_INIT = async () => {
  const session = { user_id: 'demo-user', email: 'demo', shop_id: 'demo-shop', shop_name: 'ڈیمو جنرل اسٹور', role: 'owner' };
  await setSetting('session', session);
  await setSetting('shop_id', session.shop_id);
  if (!(await getSetting('demo_seeded'))) {
    const P = [
      ['Sugar 1kg', 'چینی 1 کلو', 150, 138, 'پیک', 40, '8961001'], ['Rice Basmati 5kg', 'باسمتی چاول 5 کلو', 1650, 1520, 'تھیلا', 12, '8961002'],
      ['Cooking Oil 1L', 'کوکنگ آئل 1 لٹر', 520, 480, 'بوتل', 30, '8961003'], ['Tea Leaves 190g', 'چائے پتی 190 گرام', 340, 310, 'پیک', 25, '8961004'],
      ['Wheat Flour 10kg', 'آٹا 10 کلو', 1450, 1380, 'تھیلا', 15, '8961005'], ['Milk Pack 1L', 'دودھ پیک 1 لٹر', 290, 270, 'پیک', 3, '8961006'],
      ['Biscuits', 'بسکٹ', 60, 48, 'پیک', 80, '8961007'], ['Soap', 'صابن', 130, 108, 'پیس', 50, '8961008'],
      ['Detergent 1kg', 'سرف 1 کلو', 480, 430, 'پیک', 20, '8961009'], ['Salt 800g', 'نمک 800 گرام', 70, 58, 'پیک', 35, '8961010'],
      ['Lentils 1kg', 'دال چنا 1 کلو', 310, 280, 'کلو', 22, '8961011'], ['Cold Drink 1.5L', 'کولڈ ڈرنک 1.5 لٹر', 190, 165, 'بوتل', 0, '8961012']
    ];
    const prods = [];
    for (const [name, name_ur, sale_price, cost_price, unit, opening, barcode] of P)
      prods.push(await saveProduct({ name, name_ur, sale_price, cost_price, unit, barcode, min_stock: 5 }, { openingStock: opening }));
    const C = [['محمد علی', '03001234567', 0], ['فاطمہ بی بی', '03211234567', 2500], ['حاجی اکرم', '03331234567', 0], ['بشیر احمد', '03451234567', 0], ['زینب', '', 0]];
    const cust = [];
    for (const [name, phone, opening_balance] of C) cust.push(await saveCustomer({ name, phone, opening_balance }));
    const line = (i, qty) => ({ product_id: prods[i].id, product_name: prods[i].name, qty, unit_price: prods[i].sale_price, cost_price: prods[i].cost_price });
    const by = session.user_id;
    await saveSale({ customer_id: cust[0].id, paid: 1000, created_by: by }, [line(1, 1), line(2, 1), line(3, 1)]);   // 2510 bill, 1000 paid -> udhaar 1510
    await saveSale({ customer_id: cust[2].id, paid: 0, created_by: by }, [line(4, 2), line(0, 3)]);                // 3350 all udhaar
    await saveSale({ customer_id: cust[3].id, paid: 300, created_by: by }, [line(8, 1), line(7, 2), line(9, 1)]);  // 810 bill, 300 paid -> udhaar 510
    await addCustomerPayment(cust[1].id, 1000, 'receipt', 'پہلی قسط');
    await saveSale({ created_by: by }, [line(6, 2), line(11, 1), line(9, 1)]);                      // walk-in, paid in full (380)
    await saveSale({ created_by: by }, [line(5, 2), line(0, 1)]);                                                  // walk-in, paid in full
    const SUP = [['الفلاح ٹریڈرز', '03111234567', 0], ['نیشنل ڈسٹری بیوٹرز', '03221234567', 4000], ['رحمان کریانہ ہول سیل', '', 0]];
    const sup = [];
    for (const [name, phone, opening_balance] of SUP) sup.push(await saveSupplier({ name, phone, opening_balance }));
    const pl = (i, qty, cost) => ({ product_id: prods[i].id, product_name: prods[i].name, qty, unit_cost: cost });
    await savePurchase({ supplier_id: sup[0].id, paid: 10000, update_cost: true, created_by: by }, [pl(0, 50, 138), pl(10, 20, 280), pl(9, 40, 58)]);   // 14,820, paid 10,000 -> owes 4,820
    await savePurchase({ supplier_id: sup[1].id, paid: 5000, update_cost: true, created_by: by }, [pl(1, 10, 1520), pl(4, 5, 1380)]);                // 22,100, paid 5,000 -> owes 17,100
    await addSupplierPayment(sup[1].id, 2000, 'payment', 'پہلی قسط');
    await savePurchase({ paid: 1500, created_by: by }, [pl(6, 30, 48)]);                                                                               // no supplier, paid in full
    await setSetting('demo_seeded', true);
  }
  if (!(await getSetting('demo_seeded_exp'))) {
    const ago = d => new Date(Date.now() - d * 864e5).toISOString();
    for (const [category, amount, note, d] of [['rent', 35000, 'دکان کا کرایہ', 9], ['electricity', 8400, 'بجلی کا بل', 6], ['salary', 22000, 'ملازم کی تنخواہ', 4], ['transport', 1800, 'مال کا کرایہ', 2], ['food', 450, 'چائے', 0], ['repair', 2500, 'فریزر کی مرمت', 0]])
      await saveExpense({ category, amount, note, created_at: ago(d), created_by: session.user_id });
    await setSetting('demo_seeded_exp', true);
  }
  const r = document.createElement('div'); r.className = 'demo-ribbon'; r.textContent = t('demo_badge'); document.body.appendChild(r);
};
