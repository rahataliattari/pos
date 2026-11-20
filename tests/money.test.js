// Money-calculation tests. Run:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshShop, addProduct, addStock } = require('./harness');

const item = (pid, qty, price, extra = {}) => ({ product_id: pid, product_name: 'P', qty, unit_price: price, cost_price: 0, ...extra });
const cust = async (A, opening = 0) => (await A.saveCustomer({ name: 'Ali', opening_balance: opening })).id;

// ───────── Sale totals ─────────
test('sale: subtotal, discount, tax and total are rounded to paisa', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'Rice');
  const s = await A.saveSale({ discount: 5.5, tax_rate: 17 }, [item(p, 3, 19.99)]);
  assert.equal(s.subtotal, 59.97);
  assert.equal(s.tax, 9.26);            // (59.97 - 5.5) * 17% = 9.2599
  assert.equal(s.total, 63.73);
  assert.equal(s.paid, 63.73);          // paid defaults to the full total
});
test('sale: classic float traps (0.1+0.2, 1.005) stay exact', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const s = await A.saveSale({}, [item(p, 1, 0.1), item(p, 1, 0.2), item(p, 1, 1.005)]);
  assert.equal(s.subtotal, 1.31);
  assert.equal(s.total, 1.31);
});
test('sale: invalid input is refused and nothing is saved', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  await assert.rejects(A.saveSale({}, []), /empty/i);
  await assert.rejects(A.saveSale({}, [item(p, 0, 10)]), /quantity/i);
  await assert.rejects(A.saveSale({}, [item(p, -1, 10)]), /quantity/i);
  await assert.rejects(A.saveSale({}, [item(p, 1, -5)]), /price/i);
  await assert.rejects(A.saveSale({ discount: 11 }, [item(p, 1, 10)]), /discount/i);
  await assert.rejects(A.saveSale({ discount: -1 }, [item(p, 1, 10)]), /discount/i);
  await assert.rejects(A.saveSale({ paid: -1 }, [item(p, 1, 10)]), /paid/i);
  await assert.rejects(A.saveSale({}, [item(p, 1, 10, { unit_factor: 0 })]), /unit/i);
  assert.equal(await A.db.sales.count(), 0);
  assert.equal(await A.db.sale_items.count(), 0);
});
test('sale: "by amount" line (Rs 100 of a Rs 1200/kg item) charges exactly Rs 100', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'Ghee');
  const s = await A.saveSale({}, [item(p, 100 / 1200, 1200, { line_total: 100 })]);
  assert.equal(s.total, 100);
});
test('sale: a failing line rolls the whole bill back', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  await assert.rejects(A.saveSale({}, [item(p, 1, 10), item(p, 1, NaN)]));
  assert.equal(await A.db.sales.count(), 0);
});

// ───────── Stock ─────────
test('stock: sale reduces stock in BASE units (dozen = 12)', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'Eggs'); await addStock(A, p, 100);
  await A.saveSale({}, [item(p, 2, 300, { unit_name: 'dozen', unit_factor: 12 })]);
  assert.equal(await A.getStock(A.shop, p), 76);
});
test('stock: Quick Bill lines never touch stock', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); await addStock(A, p, 10);
  await A.saveSale({}, [item(p, 3, 50, { quick: true })]);
  assert.equal(await A.getStock(A.shop, p), 10);
});
test('stock: purchase adds stock, cost update is per base unit', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'Oil', 0);
  await A.savePurchase({ update_cost: true }, [{ product_id: p, product_name: 'Oil', qty: 2, unit_cost: 2400, unit_name: 'carton', unit_factor: 12 }]);
  assert.equal(await A.getStock(A.shop, p), 24);
  assert.equal((await A.db.products.get(p)).cost_price, 200);
});

// ───────── Customer udhaar ─────────
test('udhaar: balance = opening + unpaid part of sales + charges - receipts', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const c = await cust(A, 100);
  await A.saveSale({ customer_id: c, paid: 400 }, [item(p, 1, 1000)]);
  assert.equal(await A.getCustomerBalance(A.shop, c), 700);
  await A.addCustomerPayment(c, 200, 'receipt');
  assert.equal(await A.getCustomerBalance(A.shop, c), 500);
  await A.addCustomerPayment(c, 50.25, 'charge');
  assert.equal(await A.getCustomerBalance(A.shop, c), 550.25);
});
test('udhaar: an overpaid bill never creates negative udhaar', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const c = await cust(A);
  await A.saveSale({ customer_id: c, paid: 1500 }, [item(p, 1, 1000)]);
  assert.equal(await A.getCustomerBalance(A.shop, c), 0);
});
test('udhaar: ledger running total ends at the balance', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const c = await cust(A, 250);
  await A.saveSale({ customer_id: c, paid: 100.1 }, [item(p, 3, 33.33)]);
  await A.addCustomerPayment(c, 49.9, 'receipt');
  const led = await A.getCustomerLedger(A.shop, c);
  assert.equal(led.at(-1).running, await A.getCustomerBalance(A.shop, c));
});
test('udhaar: payment amounts are validated', async () => {
  const A = await freshShop(); const c = await cust(A);
  await assert.rejects(A.addCustomerPayment(c, 0), /amount/i);
  await assert.rejects(A.addCustomerPayment(c, -5), /amount/i);
  await assert.rejects(A.addCustomerPayment(c, 'abc'), /amount/i);
  await assert.rejects(A.addCustomerPayment(c, 5, 'gift'), /kind/i);
});
test('udhaar: customer with a balance cannot be deleted; at zero it can', async () => {
  const A = await freshShop(); const c = await cust(A, 10);
  await assert.rejects(A.softDeleteCustomer(A.shop, c), /BALANCE_NOT_ZERO/);
  await A.addCustomerPayment(c, 10, 'receipt');
  await A.softDeleteCustomer(A.shop, c);
  assert.ok((await A.db.customers.get(c)).deleted_at);
});
test('udhaar: creditSummary counts only customers who owe', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const a = await cust(A), b = await A.saveCustomer({ name: 'Bilal', opening_balance: 0 });
  await A.saveSale({ customer_id: a, paid: 0 }, [item(p, 1, 300)]);
  await A.addCustomerPayment(b.id, 50, 'receipt');                  // Bilal overpaid: must not reduce the total
  assert.deepEqual({ ...(await A.creditSummary(A.shop)) }, { total: 300, count: 1, customers: 2 });
});

// ───────── Cancel (void) ─────────
test('void: stock returns, customer udhaar drops, cash refunded = paid', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); await addStock(A, p, 10); const c = await cust(A);
  const s = await A.saveSale({ customer_id: c, paid: 400 }, [item(p, 4, 250)]);
  assert.equal(await A.getStock(A.shop, p), 6);
  assert.equal(await A.getCustomerBalance(A.shop, c), 600);
  const v = await A.voidSale(s.id, 'wrong bill');
  assert.equal(v.status, 'void'); assert.equal(v.refunded, 400);
  assert.equal(await A.getStock(A.shop, p), 10);
  assert.equal(await A.getCustomerBalance(A.shop, c), 0);
  await assert.rejects(A.voidSale(s.id), /already/i);
});
test('void: a bill replaced by its edited copy refunds no cash', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const s = await A.saveSale({}, [item(p, 1, 100)]);
  assert.equal((await A.voidSale(s.id, '', { edited: true })).refunded, 0);
});
test('void: only a cancelled bill can be removed from history', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const s = await A.saveSale({}, [item(p, 1, 100)]);
  await assert.rejects(A.deleteVoidSale(s.id), /cancelled/i);
  await A.voidSale(s.id); await A.deleteVoidSale(s.id);
  assert.ok((await A.db.sales.get(s.id)).deleted_at);
});

// ───────── Partial return ─────────
test('return: totals, discount and tax shrink in proportion; cash refunded matches', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); await addStock(A, p, 10);
  const q = await addProduct(A, 'Y');
  const s = await A.saveSale({ discount: 100, tax_rate: 10 }, [item(p, 4, 250), item(q, 1, 1000)]);   // subtotal 2000, tax 190, total 2090
  assert.equal(s.total, 2090);
  const items = (await A.getSaleWithItems(s.id)).items; const line = items.find(i => i.product_id === p);
  const r = await A.returnSaleItems(s.id, [{ item_id: line.id, qty: 2 }]);                              // returns 500 of 2000
  assert.equal(r.subtotal, 1500); assert.equal(r.discount, 75); assert.equal(r.tax, 142.5); assert.equal(r.total, 1567.5);
  assert.equal(r.paid, 1567.5);
  assert.equal(r.refunded, 522.5);                                                                      // 2090 - 1567.5
  assert.equal(r.returned_total, 522.5);
  assert.equal(r.status, 'completed');
  assert.equal(await A.getStock(A.shop, p), 8);                                                         // 10 - 4 + 2
});
test('return: on a credit bill the returned value only reduces udhaar, no cash refund', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const c = await cust(A);
  const s = await A.saveSale({ customer_id: c, paid: 400 }, [item(p, 4, 250)]);                         // total 1000, owes 600
  const line = (await A.getSaleWithItems(s.id)).items[0];
  const r = await A.returnSaleItems(s.id, [{ item_id: line.id, qty: 1 }]);                              // total 750, paid still 400
  assert.equal(r.total, 750); assert.equal(r.paid, 400); assert.equal(r.refunded, 0);
  assert.equal(await A.getCustomerBalance(A.shop, c), 350);
});
test('return: returning everything cancels the bill; more than sold is refused', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const s = await A.saveSale({}, [item(p, 3, 33.33)]);
  const line = (await A.getSaleWithItems(s.id)).items[0];
  await assert.rejects(A.returnSaleItems(s.id, [{ item_id: line.id, qty: 4 }]), /more than sold/i);
  await assert.rejects(A.returnSaleItems(s.id, []), /nothing/i);
  const r = await A.returnSaleItems(s.id, [{ item_id: line.id, qty: 3 }]);
  assert.equal(r.status, 'void'); assert.equal(r.total, 0); assert.equal(r.refunded, s.total);
});
test('return: returning a "by amount" line in full gives back exactly what was charged', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'Ghee');
  const s = await A.saveSale({}, [item(p, 100 / 1200, 1200, { line_total: 100 })]);
  const line = (await A.getSaleWithItems(s.id)).items[0];
  const r = await A.returnSaleItems(s.id, [{ item_id: line.id, qty: line.qty }]);
  assert.equal(r.refunded, 100); assert.equal(r.total, 0);
});
test('return then cancel: refunds add up to exactly what the customer paid', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const s = await A.saveSale({}, [item(p, 4, 250)]);
  const line = (await A.getSaleWithItems(s.id)).items[0];
  await A.returnSaleItems(s.id, [{ item_id: line.id, qty: 1 }]);                                       // refund 250
  const v = await A.voidSale(s.id);                                                                     // refund remaining 750
  assert.equal(v.refunded, 1000);
});

// ───────── Suppliers & purchases ─────────
test('supplier: balance = opening + unpaid purchases + charges - payments; delete rules', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const sup = (await A.saveSupplier({ name: 'Haji', opening_balance: 500 })).id;
  await A.savePurchase({ supplier_id: sup, paid: 1000 }, [{ product_id: p, product_name: 'X', qty: 10, unit_cost: 250.5 }]);   // total 2505
  assert.equal(await A.getSupplierBalance(A.shop, sup), 2005);
  await A.addSupplierPayment(sup, 5);
  assert.equal(await A.getSupplierBalance(A.shop, sup), 2000);
  assert.equal((await A.getSupplierLedger(A.shop, sup)).at(-1).running, 2000);
  await assert.rejects(A.softDeleteSupplier(A.shop, sup), /BALANCE_NOT_ZERO/);
  await A.addSupplierPayment(sup, 2000); await A.softDeleteSupplier(A.shop, sup);
  assert.deepEqual({ ...(await A.payableSummary(A.shop)) }, { total: 0, count: 0, suppliers: 0 });
});
test('purchase: invalid input refused', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  await assert.rejects(A.savePurchase({}, []), /empty/i);
  await assert.rejects(A.savePurchase({}, [{ product_id: p, qty: 0, unit_cost: 5 }]), /quantity/i);
  await assert.rejects(A.savePurchase({ paid: -1 }, [{ product_id: p, qty: 1, unit_cost: 5 }]), /paid/i);
});

// ───────── Profit report ─────────
test('report: revenue/cogs/expenses/net, void bills excluded, refunds and credit shown', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const c = await cust(A);
  await A.saveSale({}, [item(p, 2, 100, { cost_price: 60 })]);                                          // 200, cost 120
  await A.saveSale({ customer_id: c, paid: 50 }, [item(p, 1, 300, { cost_price: 100 })]);               // 300, credit 250
  const gone = await A.saveSale({}, [item(p, 1, 999, { cost_price: 1 })]); await A.voidSale(gone.id);   // refunded 999, not revenue
  await A.saveExpense({ title: 'Rent', amount: 80, category: 'rent' });
  const r = await A.computeReport(A.shop, 'today');
  assert.equal(r.revenue, 500); assert.equal(r.cogs, 220); assert.equal(r.gross, 280);
  assert.equal(r.expenses, 80); assert.equal(r.net, 200);
  assert.equal(r.credit, 250); assert.equal(r.refunds, 999); assert.equal(r.bills, 2);
  assert.equal(r.byMethod.cash, 250);                                                                   // 200 + 50 actually paid
});
test('report: salesSummary ignores cancelled bills', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  await A.saveSale({}, [item(p, 1, 100)]); const b = await A.saveSale({}, [item(p, 1, 50)]); await A.voidSale(b.id);
  const r = await A.salesSummary(A.shop, '', '￿');
  assert.deepEqual({ ...r }, { count: 1, total: 100 });
});

// ───────── Subscription (offline enforcement) ─────────
const DAY = 86400000;
test('subscription: ok → grace → locked, with 3 grace days', async () => {
  const A = await freshShop(); const now = Date.now();
  A.S.session = { expires_at: new Date(now + DAY).toISOString() };
  assert.equal(A.subState().state, 'ok');
  A.S.session = { expires_at: new Date(now - 1000).toISOString() };
  assert.equal(A.subState().state, 'grace');
  A.S.session = { expires_at: new Date(now - 2.5 * DAY).toISOString() };
  assert.equal(A.subState().state, 'grace');
  A.S.session = { expires_at: new Date(now - 3.5 * DAY).toISOString() };
  assert.equal(A.subState().state, 'locked'); assert.equal(A.subLocked(), true);
});
test('subscription: setting the phone clock back does not unlock (clock_max)', async () => {
  const A = await freshShop(); const now = Date.now();
  A.S.session = { expires_at: new Date(now - 5 * DAY).toISOString(), clock_max: now };               // already seen "now" while expired
  const real = Date.now; Date.now = () => now - 10 * DAY;                                               // user rolls the date back
  try { assert.equal(A.subState().state, 'locked'); } finally { Date.now = real; }
});
test('subscription: locked app refuses new bills but grace period still bills', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const now = Date.now();
  A.S.session = { expires_at: new Date(now - DAY).toISOString() };
  await A.saveSale({}, [item(p, 1, 10)]);                                                               // grace: allowed
  A.S.session = { expires_at: new Date(now - 4 * DAY).toISOString() };
  await assert.rejects(A.saveSale({}, [item(p, 1, 10)]), /sub_locked/);
  assert.equal(await A.db.sales.count(), 1);
});
test('subscription: admin and no-expiry sessions are never locked', async () => {
  const A = await freshShop(); const old = new Date(Date.now() - 99 * DAY).toISOString();
  A.S.session = { admin: true, expires_at: old }; assert.equal(A.subState().state, 'ok');
  A.S.session = { expires_at: null }; assert.equal(A.subState().state, 'ok');
});
