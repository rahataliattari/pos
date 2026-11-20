// Loads the app's REAL money code (db.js, expenses.js, reports.js and the subscription part of sync.js) in Node,
// on top of the in-memory Dexie stand-in used by the demo. No browser, no internet, no npm packages needed.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');

function load() {
  const sandbox = {
    console, setTimeout, clearTimeout, crypto: globalThis.crypto, structuredClone,
    localStorage: { getItem: () => null, setItem() {} },
    document: { addEventListener() {}, getElementById: () => null },
    navigator: { onLine: false },
    S: { session: null, cfg: {} },
    onUI: () => {}, emitUI: () => {}, t: k => k,                                   // translations are not needed for money maths
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const sync = rd('sync.js');
  const a = sync.indexOf('const SUB_GRACE_DAYS'), z = sync.indexOf('// ───────── Conflict resolution');
  if (a < 0 || z < 0) throw new Error('subscription block not found in sync.js');
  const app = rd('app.js');
  const numLine = app.split('\n').find(l => l.startsWith('const num = '));        // the app's own num(), copied from app.js
  if (!numLine) throw new Error('num() not found in app.js');
  const code = [rd('demo/dexie-shim.js'), rd('db.js'), numLine, rd('billing/cart.js'), rd('billing/hold-quotes.js'), rd('billing/quick.js'), rd('purchases.js'), sync.slice(a, z), rd('expenses.js'), rd('reports.js'),
    `globalThis.API = { db, saveSale, voidSale, returnSaleItems, getSaleWithItems, deleteVoidSale, getStock, saveCustomer,
       getCustomerBalance, getCustomerLedger, creditSummary, addCustomerPayment, softDeleteCustomer, saveSupplier,
       savePurchase, getSupplierBalance, getSupplierLedger, addSupplierPayment, softDeleteSupplier, payableSummary,
       salesSummary, saveExpense, cartTotals, bpTotals, qbSums, purTotal, lineTotal, linePrice, saleDiscountFor, billResetState, computeReport, subState, subLocked, round2, round3, setSetting, uuid, S };`
  ].join('\n;\n');
  vm.runInContext(code, sandbox, { filename: 'pos-bundle.js' });
  return sandbox.API;
}

// A fresh empty shop for every test (new in-memory database).
async function freshShop() {
  const A = load();
  const shop = A.uuid();
  await A.setSetting('shop_id', shop);
  A.shop = shop;
  A.S.session = null;
  return A;
}
async function addProduct(A, name, cost = 0) {            // a product + opening stock via a movement
  const id = A.uuid(), now = new Date().toISOString();
  await A.db.products.add({ id, shop_id: A.shop, name, cost_price: cost, version: 1, created_at: now, updated_at: now });
  return id;
}
async function addStock(A, productId, qty) {
  await A.db.stock_movements.add({ id: A.uuid(), shop_id: A.shop, product_id: productId, qty_change: qty, reason: 'opening', created_at: new Date().toISOString() });
}
module.exports = { freshShop, addProduct, addStock };
