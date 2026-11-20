// Bill-screen totals (cartTotals in billing/cart.js) must equal what saveSale() stores. Run:  node --test tests/cart.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshShop, addProduct } = require('./harness');

// Same mapping as completeSale() in billing/cart.js (keep in sync if that function changes).
const lines = A => A.S.cart.filter(l => l.qty > 0).map(l => ({ product_id: l.product_id, product_name: l.product_name, qty: l.qty,
  unit_name: l.unit_name || null, unit_factor: l.unit_factor || 1, unit_price: A.linePrice(l), line_total: A.lineTotal(l),
  item_discount: A.round2(l.qty * (l.unit_price - A.linePrice(l))), cost_price: l.cost_price }));
async function checkout(A, pid) {
  const tt = A.cartTotals();
  const sale = await A.saveSale({ discount: tt.discount, tax_rate: Number(A.S.cfg.tax_rate) || 0, paid: tt.total }, lines(A));
  return { tt, sale };
}
const line = (pid, o) => ({ product_id: pid, product_name: 'P', unit_name: 'pc', unit_factor: 1, cost_price: 0, ...o });
function setup(A, cart, { disc = 0, mode = 'rs', tax = 0 } = {}) {
  A.billResetState(); A.S.cart = cart; A.S.cfg = { tax_rate: tax };
  if (mode === 'pct') { A.S.discMode = 'pct'; A.S.discPct = disc; } else { A.S.discMode = 'rs'; A.S.discount = disc; }
}

test('cart: plain bill with Rs discount and tax', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  setup(A, [line(p, { qty: 3, unit_price: 19.99 })], { disc: 5.5, tax: 17 });
  const t = A.cartTotals();
  assert.deepEqual([t.subtotal, t.discount, t.tax, t.total], [59.97, 5.5, 9.26, 63.73]);
});
test('cart: line % discount and by-amount line', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  setup(A, [line(p, { qty: 2, unit_price: 100, disc: 10 }), line(A.uuid(), { qty: 0.0833, unit_price: 1200, amount: 100 })]);
  assert.equal(A.lineTotal(A.S.cart[0]), 180); assert.equal(A.lineTotal(A.S.cart[1]), 100);
  assert.equal(A.cartTotals().total, 280);
});
test('cart: discount can never exceed the bill or go negative; % is clamped to 0-100', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  setup(A, [line(p, { qty: 1, unit_price: 100 })], { disc: 500 });
  assert.equal(A.cartTotals().total, 0);
  setup(A, [line(p, { qty: 1, unit_price: 100 })], { disc: -50 });
  assert.equal(A.cartTotals().discount, 0);
  setup(A, [line(p, { qty: 1, unit_price: 100 })], { disc: 250, mode: 'pct' });
  assert.equal(A.cartTotals().total, 0);
});
test('cart: the total shown on screen equals the saved bill (1000 random bills)', async () => {
  const A = await freshShop(); const p = await addProduct(A, 'X');
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const bad = [];
  for (let n = 0; n < 1000; n++) {
    const cart = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => {
      const l = line(p, { qty: pick([1, 2, 3, 0.25, 0.5, 1.5, 2.75, 7, 0.333]), unit_price: pick([9.99, 19.99, 45, 120.5, 33.33, 1200, 0.5, 7.77, 249.95]) });
      if (rnd() < 0.3) l.disc = pick([5, 7.5, 10, 12.5, 33.3]);
      if (rnd() < 0.15) l.amount = pick([50, 100, 33.33, 75.5]);
      return l;
    });
    const o = { tax: pick([0, 0, 5, 13, 17, 18]), mode: pick(['rs', 'pct']) };
    o.disc = o.mode === 'pct' ? pick([0, 3, 5, 7.5, 10, 12.5, 33.3]) : pick([0, 1, 5.5, 10, 25.25]);
    setup(A, cart, o);
    const { tt, sale } = await checkout(A, p);
    if (tt.subtotal !== sale.subtotal || tt.discount !== sale.discount || tt.tax !== sale.tax || tt.total !== sale.total)
      bad.push({ n, o, screen: [tt.subtotal, tt.discount, tt.tax, tt.total], saved: [sale.subtotal, sale.discount, sale.tax, sale.total] });
    const q = A.bpTotals(A.S.cart, A.S.discount, A.S.discMode, A.S.discPct);   // held bills / quotes use the same maths
    if (JSON.stringify(q) !== JSON.stringify(tt)) bad.push({ n, o, held: q, screen: tt });
  }
  assert.equal(bad.length, 0, `${bad.length} of 1000 bills differ between screen and saved bill. First: ${JSON.stringify(bad[0])}`);
});
