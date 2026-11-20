// Quick Bill and purchase-screen totals must equal what is saved. Run:  node --test tests/more.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshShop, addProduct } = require('./harness');
const prng = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

test('quick bill: screen total equals saved total (1000 random bills, 2-decimal amounts)', async () => {
  const A = await freshShop(); const rnd = prng(777); const bad = [];
  for (let n = 0; n < 1000; n++) {
    const rate = [0, 0, 5, 13, 17, 18][Math.floor(rnd() * 6)];
    A.S.cfg = { tax_rate: rate };
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({ name: 'x', amount: Math.round(rnd() * 500000) / 100 }));
    const c = { root: { querySelector: () => null }, st: { lines } };
    const s = A.qbSums(c);
    const sale = await A.saveSale({ tax_rate: rate, paid: null }, lines.map((l, k) => ({ line_no: k, product_id: 'quick-bill', product_name: l.name, qty: 1,
      unit_price: l.amount, line_total: l.amount, cost_price: 0, quick: true })));
    if (s.sub !== sale.subtotal || s.tax !== sale.tax || s.total !== sale.total) bad.push({ rate, lines: lines.map(l => l.amount), screen: s, saved: [sale.subtotal, sale.tax, sale.total] });
  }
  assert.equal(bad.length, 0, `${bad.length} differ. First: ${JSON.stringify(bad[0])}`);
});

test('purchase: screen total equals saved total (1000 random purchases)', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const rnd = prng(4242); const bad = [];
  const pick = a => a[Math.floor(rnd() * a.length)];
  for (let n = 0; n < 1000; n++) {
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({ product_id: p, product_name: 'X',
      qty: pick([1, 2, 3, 0.25, 0.5, 1.5, 2.75, 12, 0.333, 24]), unit_cost: pick([9.99, 19.99, 45, 120.5, 33.33, 1200, 0.5, 7.77, 249.95, 10.005, 2.675]) }));
    A.S.pur = { lines };
    const screen = A.purTotal();
    const rec = await A.savePurchase({ paid: null }, lines);
    if (screen !== rec.total) bad.push({ lines, screen, saved: rec.total });
  }
  assert.equal(bad.length, 0, `${bad.length} differ. First: ${JSON.stringify(bad[0])}`);
});

test('purchase: paid vs total gives the right payable', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  const sup = (await A.saveSupplier({ name: 'S' })).id;
  const rec = await A.savePurchase({ supplier_id: sup, paid: 100 }, [{ product_id: p, product_name: 'X', qty: 3, unit_cost: 99.99 }]);
  assert.equal(rec.total, 299.97);
  assert.equal(await A.getSupplierBalance(A.shop, sup), 199.97);
});

test('returns: after random partial returns the books always balance (500 bills)', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X'); const rnd = prng(99); const bad = [];
  const pick = a => a[Math.floor(rnd() * a.length)];
  for (let n = 0; n < 500; n++) {
    const items = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({ product_id: p, product_name: 'X', qty: pick([1, 2, 3, 5, 0.5, 2.5]), unit_price: pick([9.99, 19.99, 45, 120.5, 33.33, 7.77]), cost_price: 0 }));
    const gross = A.round2(items.reduce((s, i) => s + A.round2(i.qty * i.unit_price), 0));
    const sale0 = await A.saveSale({ discount: A.round2(gross * pick([0, 0.05, 0.1]) ), tax_rate: pick([0, 5, 17]), paid: null }, items);
    const paid0 = sale0.paid; let sale = sale0;
    for (let k = 0; k < 3; k++) {                                                  // up to 3 partial returns
      const cur = await A.getSaleWithItems(sale0.id); if (cur.sale.status === 'void') break;
      const open = cur.items.filter(i => i.qty > 0); if (!open.length) break;
      const it = pick(open); const q = Math.min(it.qty, pick([1, 0.5, it.qty]));
      sale = await A.returnSaleItems(sale0.id, [{ item_id: it.id, qty: q }]);
    }
    const fin = await A.getSaleWithItems(sale0.id); const lineSum = A.round2(fin.items.reduce((s, i) => s + i.line_total, 0));
    const problems = [];
    if (Math.abs(A.round2(sale.subtotal - sale.discount + sale.tax) - sale.total) > 0.011) problems.push('total != subtotal-discount+tax');
    if (Math.abs(lineSum - sale.subtotal) > 0.011) problems.push(`line sum ${lineSum} != subtotal ${sale.subtotal}`);
    if (A.round2(sale.paid + (sale.refunded || 0)) !== paid0) problems.push(`paid ${sale.paid} + refunded ${sale.refunded} != original ${paid0}`);
    if (sale.total < 0 || sale.paid < 0) problems.push('negative');
    if (problems.length) bad.push({ n, problems, sale0: [sale0.subtotal, sale0.discount, sale0.tax, sale0.total], now: [sale.subtotal, sale.discount, sale.tax, sale.total, sale.paid, sale.refunded] });
  }
  assert.equal(bad.length, 0, `${bad.length} of 500 unbalanced. First: ${JSON.stringify(bad[0])}`);
});
