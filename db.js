// Universal POS — local database (Dexie / IndexedDB). Stage 2.
// Requires Dexie (loaded before this file).

const db = new Dexie('universal_pos');

// First entry is the primary key (UUID string). [shop_id+x] compound indexes keep queries per shop.
db.version(1).stores({
  categories:      'id, [shop_id+name], sync_status, updated_at',
  products:        'id, [shop_id+barcode], [shop_id+name], [shop_id+category_id], sync_status, updated_at',
  customers:       'id, [shop_id+name], [shop_id+phone], sync_status, updated_at',
  suppliers:       'id, [shop_id+name], sync_status, updated_at',
  sales:           'id, [shop_id+created_at], [shop_id+invoice_no], [shop_id+customer_id], sync_status',
  sale_items:      'id, [shop_id+sale_id], [shop_id+product_id], sync_status',
  purchases:       'id, [shop_id+created_at], [shop_id+supplier_id], sync_status',
  purchase_items:  'id, [shop_id+purchase_id], [shop_id+product_id], sync_status',
  payments:        'id, [shop_id+created_at], [shop_id+party_id], sync_status',
  expenses:        'id, [shop_id+created_at], sync_status',
  stock_movements: 'id, [shop_id+product_id], [shop_id+created_at], sync_status',
  sync_queue:      '++seq, record_id, table_name, status, next_retry_at, [status+seq]',
  sync_logs:       '++id, at, level',
  conflicts:       'id, shop_id, table_name, record_id, resolved_at',
  app_settings:    'key'
});

const BUSINESS_TABLES = ['categories','products','customers','suppliers','sales','sale_items',
  'purchases','purchase_items','payments','expenses','stock_movements'];

// ───────── Helpers ─────────

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

async function getSetting(key, fallback = null) {
  const row = await db.app_settings.get(key);
  return row ? row.value : fallback;
}
async function setSetting(key, value) { await db.app_settings.put({ key, value }); }
async function delSetting(key) { await db.app_settings.delete(key); }

async function getDeviceId() {
  let id = await getSetting('device_id');
  if (!id) { id = uuid(); await setSetting('device_id', id); }
  return id;
}

// Build a business record with all required base fields.
// NOTE: reads app_settings, so any transaction that calls this must include db.app_settings.
async function newRecord(data) {
  const now = new Date().toISOString();
  const shop_id = await getSetting('shop_id');
  if (!shop_id) throw new Error('No shop selected');
  return {
    id: uuid(),
    shop_id,
    device_id: await getDeviceId(),
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: 'pending',
    ...data
  };
}

// Queue entry for the sync engine (Stage 3). Call inside the same transaction as the record write.
function enqueue(table, record, op = 'insert') {
  return db.sync_queue.add({
    table_name: table,
    record_id: record.id,
    shop_id: record.shop_id,
    op,
    base_version: op === 'update' ? record.version - 1 : 0,
    status: 'pending',
    attempts: 0,
    next_retry_at: 0,
    created_at: new Date().toISOString()
  });
}

async function logSync(level, message, detail = null) {
  await db.sync_logs.add({ at: new Date().toISOString(), level, message, detail });
}

// Invoice number = 6 chars of device id + local counter. Must run inside a transaction with app_settings.
async function nextInvoiceNo() {
  const dev = (await getDeviceId()).replace(/-/g, '').slice(0, 6).toUpperCase();
  const n = (await getSetting('invoice_counter', 0)) + 1;
  await setSetting('invoice_counter', n);
  return `${dev}-${String(n).padStart(6, '0')}`;
}

// ───────── Sales ─────────
// sale:  { customer_id, discount, tax_rate, paid, payment_method, created_by }
// items: [{ product_id, product_name, qty, unit_price, cost_price }]
// Everything is written in ONE transaction: a crash can never leave a half-saved sale.
async function saveSale(sale, items) {
  if (!items || !items.length) throw new Error('Cart is empty');
  for (const it of items) {
    if (!(it.qty > 0)) throw new Error('Invalid quantity');
    if (!(it.unit_price >= 0)) throw new Error('Invalid price');
  }
  const subtotal = round2(items.reduce((s, it) => s + round2(it.qty * it.unit_price), 0));
  const discount = round2(sale.discount || 0);
  if (discount < 0 || discount > subtotal) throw new Error('Invalid discount');
  const tax = round2((subtotal - discount) * (sale.tax_rate || 0) / 100);
  const total = round2(subtotal - discount + tax);
  const paid = round2(sale.paid == null ? total : sale.paid);
  if (paid < 0) throw new Error('Invalid paid amount');

  return db.transaction('rw',
    db.sales, db.sale_items, db.stock_movements, db.sync_queue, db.app_settings, async () => {
      const saleRec = await newRecord({
        invoice_no: await nextInvoiceNo(),
        customer_id: sale.customer_id || null,
        subtotal, discount, tax, total, paid,
        payment_method: sale.payment_method || 'cash',
        status: 'completed',
        created_by: sale.created_by || null
      });
      await db.sales.add(saleRec);
      await enqueue('sales', saleRec);

      for (const it of items) {
        const itemRec = await newRecord({
          sale_id: saleRec.id,
          product_id: it.product_id,
          product_name: it.product_name,
          qty: round3(it.qty),
          unit_price: round2(it.unit_price),
          cost_price: round2(it.cost_price || 0),
          discount: 0,
          line_total: round2(it.qty * it.unit_price)
        });
        await db.sale_items.add(itemRec);
        await enqueue('sale_items', itemRec);

        const mv = await newRecord({
          product_id: it.product_id,
          qty_change: -round3(Math.abs(it.qty)),
          reason: 'sale', ref_type: 'sale', ref_id: saleRec.id
        });
        await db.stock_movements.add(mv);
        await enqueue('stock_movements', mv);
      }
      return saleRec;
    });
}

// Cancel a sale (bill return): the sale stays for history with status 'void', stock is put back through
// reverse stock movements (ledger), and the customer's balance / reports ignore it automatically.
async function voidSale(saleId, reason = '') {
  return db.transaction('rw', db.sales, db.sale_items, db.stock_movements, db.sync_queue, db.app_settings, async () => {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'void') throw new Error('Already cancelled');
    const now = new Date().toISOString();
    const rec = { ...sale, status: 'void', void_reason: (reason || '').trim() || null, voided_at: now,
                  refunded: round2((sale.refunded || 0) + (sale.paid || 0)),
                  version: sale.version + 1, updated_at: now, sync_status: 'pending' };
    await db.sales.put(rec); await enqueue('sales', rec, 'update');
    const items = await db.sale_items.where('[shop_id+sale_id]').equals([sale.shop_id, saleId]).toArray();
    for (const it of items) {
      const mv = await newRecord({ product_id: it.product_id, qty_change: round3(Math.abs(it.qty)),
                                   reason: 'sale_void', ref_type: 'sale', ref_id: saleId });
      await db.stock_movements.add(mv); await enqueue('stock_movements', mv);
    }
    return rec;
  });
}

// Partial return: lines = [{ item_id, qty }]. Reduces the sale line, the sale totals (discount/tax scaled in proportion),
// puts stock back (ledger) and reduces `paid` only by what must be refunded (credit part is just removed from the udhaar).
async function returnSaleItems(saleId, lines, reason = '') {
  lines = (lines || []).filter(l => l.qty > 0);
  if (!lines.length) throw new Error('Nothing to return');
  return db.transaction('rw', db.sales, db.sale_items, db.stock_movements, db.sync_queue, db.app_settings, async () => {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'void') throw new Error('Already cancelled');
    const items = await db.sale_items.where('[shop_id+sale_id]').equals([sale.shop_id, saleId]).toArray();
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    const now = new Date().toISOString();
    let value = 0;
    for (const l of lines) {
      const it = byId[l.item_id]; if (!it) throw new Error('Item not found');
      const q = round3(l.qty);
      if (q > it.qty + 1e-9) throw new Error('Return quantity is more than sold');
      const amount = round2(q * it.unit_price);
      value = round2(value + amount);
      const upd = { ...it, qty: round3(it.qty - q), returned_qty: round3((it.returned_qty || 0) + q),
                    line_total: round2(it.line_total - amount), version: it.version + 1, updated_at: now, sync_status: 'pending' };
      await db.sale_items.put(upd); await enqueue('sale_items', upd, 'update');
      byId[it.id] = upd;
      const mv = await newRecord({ product_id: it.product_id, qty_change: q, reason: 'sale_return', ref_type: 'sale', ref_id: saleId });
      await db.stock_movements.add(mv); await enqueue('stock_movements', mv);
    }
    const ratio = sale.subtotal > 0 ? value / sale.subtotal : 1;
    const subtotal = round2(sale.subtotal - value);
    const discount = round2(sale.discount * (1 - ratio));
    const tax = round2(sale.tax * (1 - ratio));
    const total = round2(subtotal - discount + tax);
    const paid = round2(Math.min(sale.paid, total));
    const allGone = Object.values(byId).every(i => i.qty <= 0);
    const rec = { ...sale, subtotal, discount, tax, total, paid,
                  returned_total: round2((sale.returned_total || 0) + (sale.total - total)),
                  refunded: round2((sale.refunded || 0) + (sale.paid - paid)),
                  status: allGone ? 'void' : sale.status, void_reason: allGone ? ((reason || '').trim() || 'full return') : sale.void_reason,
                  note_return: (reason || '').trim() || sale.note_return || null,
                  version: sale.version + 1, updated_at: now, sync_status: 'pending' };
    await db.sales.put(rec); await enqueue('sales', rec, 'update');
    return rec;
  });
}

async function getSaleWithItems(saleId) {
  const sale = await db.sales.get(saleId);
  if (!sale) return null;
  const items = await db.sale_items.where('[shop_id+sale_id]').equals([sale.shop_id, saleId]).toArray();
  return { sale, items };
}

function listSales(shopId, page = 0, pageSize = 30) {
  return db.sales.where('[shop_id+created_at]')
    .between([shopId, ''], [shopId, '￿'])
    .reverse().filter(s => !s.deleted_at).offset(page * pageSize).limit(pageSize).toArray();
}

// Remove a CANCELLED bill from the sales history. Only a bill that is already void can be removed.
// It is a soft delete (deleted_at) so it syncs to the server and disappears on every phone.
// Stock was already put back when the bill was cancelled, so nothing else changes; reports keep counting
// the cash that was refunded for it.
async function deleteVoidSale(saleId) {
  return db.transaction('rw', db.sales, db.sale_items, db.sync_queue, db.app_settings, async () => {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new Error('Sale not found');
    if (sale.status !== 'void') throw new Error('Only a cancelled bill can be removed');
    if (sale.deleted_at) return sale;
    const now = new Date().toISOString();
    const rec = { ...sale, deleted_at: now, version: sale.version + 1, updated_at: now, sync_status: 'pending' };
    await db.sales.put(rec); await enqueue('sales', rec, 'update');
    const items = await db.sale_items.where('[shop_id+sale_id]').equals([sale.shop_id, saleId]).toArray();
    for (const it of items) {
      const upd = { ...it, deleted_at: now, version: it.version + 1, updated_at: now, sync_status: 'pending' };
      await db.sale_items.put(upd); await enqueue('sale_items', upd, 'update');
    }
    return rec;
  });
}

// ───────── Products & stock ─────────

// Stock = sum of append-only movements (the source of truth).
async function getStock(shopId, productId) {
  let total = 0;
  await db.stock_movements.where('[shop_id+product_id]').equals([shopId, productId])
    .each(m => { total += m.qty_change; });
  return round3(total);
}

async function getStocks(shopId, productIds) {
  const arr = await Promise.all(productIds.map(id => getStock(shopId, id)));
  const map = {};
  productIds.forEach((id, i) => { map[id] = arr[i]; });
  return map;
}

function findByBarcode(shopId, barcode) {
  return db.products.where('[shop_id+barcode]').equals([shopId, barcode])
    .filter(p => !p.deleted_at && p.is_active !== false).first();
}

function productMatcher(q) {
  const s = (q || '').trim().toLowerCase();
  return p => {
    if (p.deleted_at || p.is_active === false) return false;
    if (!s) return true;
    return (p.name || '').toLowerCase().includes(s) ||
           (p.name_ur || '').toLowerCase().includes(s) ||
           (p.sku || '').toLowerCase().includes(s) ||
           (p.barcode || '') === s;
  };
}

// Offline search: walks the name index and stops as soon as `limit` matches are found.
function searchProducts(shopId, q, limit = 20) {
  return db.products.where('[shop_id+name]').between([shopId, ''], [shopId, '￿'])
    .filter(productMatcher(q)).limit(limit).toArray();
}

function listProducts(shopId, q, page = 0, pageSize = 30) {
  return db.products.where('[shop_id+name]').between([shopId, ''], [shopId, '￿'])
    .filter(productMatcher(q)).offset(page * pageSize).limit(pageSize).toArray();
}

// Create or update a product. opts: { openingStock, adjust, adjustNote }
async function saveProduct(data, opts = {}) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('Name required');
  const fields = {
    name,
    name_ur: (data.name_ur || '').trim() || null,
    barcode: (data.barcode || '').trim() || null,
    sku: (data.sku || '').trim() || null,
    unit: (data.unit || 'pcs').trim() || 'pcs',
    cost_price: round2(Number(data.cost_price) || 0),
    sale_price: round2(Number(data.sale_price) || 0),
    min_stock: round3(Number(data.min_stock) || 0),
    is_active: data.is_active !== false
  };
  if (fields.sale_price < 0 || fields.cost_price < 0) throw new Error('Invalid price');

  return db.transaction('rw', db.products, db.stock_movements, db.sync_queue, db.app_settings, async () => {
    let rec;
    if (data.id) {
      const old = await db.products.get(data.id);
      if (!old) throw new Error('Product not found');
      rec = { ...old, ...fields, version: old.version + 1,
              updated_at: new Date().toISOString(), sync_status: 'pending' };
      await db.products.put(rec);
      await enqueue('products', rec, 'update');
    } else {
      rec = await newRecord({ category_id: null, deleted_at: null, ...fields });
      await db.products.add(rec);
      await enqueue('products', rec, 'insert');
    }
    const qty = data.id ? Number(opts.adjust) : Number(opts.openingStock);
    if (qty && isFinite(qty)) {
      const mv = await newRecord({
        product_id: rec.id, qty_change: round3(qty),
        reason: data.id ? 'adjustment' : 'opening', ref_type: 'product', ref_id: rec.id,
        note: opts.adjustNote || null
      });
      await db.stock_movements.add(mv);
      await enqueue('stock_movements', mv);
    }
    return rec;
  });
}

// Soft delete only: the record stays for history and sync.
async function softDeleteProduct(id) {
  return db.transaction('rw', db.products, db.sync_queue, async () => {
    const old = await db.products.get(id);
    if (!old) return;
    const rec = { ...old, deleted_at: new Date().toISOString(), version: old.version + 1,
                  updated_at: new Date().toISOString(), sync_status: 'pending' };
    await db.products.put(rec);
    await enqueue('products', rec, 'update');
  });
}

// Totals for a time range (e.g. today) without loading every sale into memory.
async function salesSummary(shopId, fromIso, toIso) {
  let count = 0, total = 0;
  await db.sales.where('[shop_id+created_at]').between([shopId, fromIso], [shopId, toIso])
    .each(s => { if (s.status !== 'void') { count++; total += s.total; } });
  return { count, total: round2(total) };
}

// ───────── Customers & credit (udhaar) ─────────
// Balance a customer owes = opening balance
//   + Σ unpaid part of each completed sale (total − paid, never negative)
//   + Σ manual "charge" entries
//   − Σ "receipt" entries (money received later).
// Nothing is stored as a running total: it is always computed from the records, so it can never drift.

function customerMatcher(q) {
  const s = (q || '').trim().toLowerCase();
  return c => {
    if (c.deleted_at) return false;
    if (!s) return true;
    return (c.name || '').toLowerCase().includes(s) || (c.phone || '').includes(s);
  };
}

function listCustomers(shopId, q, page = 0, pageSize = 30) {
  return db.customers.where('[shop_id+name]').between([shopId, ''], [shopId, '￿'])
    .filter(customerMatcher(q)).offset(page * pageSize).limit(pageSize).toArray();
}

async function saveCustomer(data) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('Name required');
  const fields = {
    name,
    phone: (data.phone || '').replace(/[^\d+]/g, '') || null,
    address: (data.address || '').trim() || null,
    note: (data.note || '').trim() || null
  };
  if (data.opening_balance !== undefined) fields.opening_balance = round2(Number(data.opening_balance) || 0);
  return db.transaction('rw', db.customers, db.sync_queue, db.app_settings, async () => {
    let rec;
    if (data.id) {
      const old = await db.customers.get(data.id);
      if (!old) throw new Error('Customer not found');
      rec = { ...old, ...fields, version: old.version + 1, updated_at: new Date().toISOString(), sync_status: 'pending' };
      await db.customers.put(rec);
      await enqueue('customers', rec, 'update');
    } else {
      rec = await newRecord({ opening_balance: 0, deleted_at: null, ...fields });
      await db.customers.add(rec);
      await enqueue('customers', rec, 'insert');
    }
    return rec;
  });
}

async function getCustomerBalance(shopId, customerId) {
  const c = await db.customers.get(customerId);
  let bal = c ? (c.opening_balance || 0) : 0;
  await db.sales.where('[shop_id+customer_id]').equals([shopId, customerId])
    .each(s => { if (s.status !== 'void') bal += Math.max(0, round2(s.total - s.paid)); });
  await db.payments.where('[shop_id+party_id]').equals([shopId, customerId])
    .each(p => { if (p.party_type === 'customer' && !p.voided) bal += p.kind === 'charge' ? p.amount : -p.amount; });
  return round2(bal);
}

async function getCustomerBalances(shopId, ids) {
  const arr = await Promise.all(ids.map(id => getCustomerBalance(shopId, id)));
  const map = {};
  ids.forEach((id, i) => { map[id] = arr[i]; });
  return map;
}

// Total udhaar across the shop (only customers who owe money are counted).
async function creditSummary(shopId) {
  const all = await db.customers.where('[shop_id+name]').between([shopId, ''], [shopId, '￿'])
    .filter(c => !c.deleted_at).toArray();
  const bals = await getCustomerBalances(shopId, all.map(c => c.id));
  let total = 0, count = 0;
  for (const id in bals) if (bals[id] > 0) { total += bals[id]; count++; }
  return { total: round2(total), count, customers: all.length };
}

// kind: 'receipt' (customer paid us) | 'charge' (add udhaar manually, e.g. an old paper-ledger entry)
async function addCustomerPayment(customerId, amount, kind = 'receipt', note = '', method = 'cash') {
  amount = round2(Number(amount));
  if (!(amount > 0)) throw new Error('Invalid amount');
  if (!['receipt', 'charge'].includes(kind)) throw new Error('Invalid kind');
  return db.transaction('rw', db.payments, db.sync_queue, db.app_settings, async () => {
    const rec = await newRecord({
      party_type: 'customer', party_id: customerId, kind, amount,
      method, note: (note || '').trim() || null, voided: false
    });
    await db.payments.add(rec);
    await enqueue('payments', rec);
    return rec;
  });
}

// Soft delete: refused while the customer still owes money (or is owed), so no udhaar is ever lost by accident.
async function softDeleteCustomer(shopId, id) {
  const bal = await getCustomerBalance(shopId, id);
  if (bal !== 0) throw new Error('BALANCE_NOT_ZERO');
  return db.transaction('rw', db.customers, db.sync_queue, async () => {
    const old = await db.customers.get(id);
    if (!old) return;
    const rec = { ...old, deleted_at: new Date().toISOString(), version: old.version + 1,
                  updated_at: new Date().toISOString(), sync_status: 'pending' };
    await db.customers.put(rec);
    await enqueue('customers', rec, 'update');
  });
}

// Full ledger, oldest → newest with a running balance. The caller reverses/slices for display.
async function getCustomerLedger(shopId, customerId) {
  const c = await db.customers.get(customerId);
  const rows = [];
  const open = c ? (c.opening_balance || 0) : 0;
  if (open) rows.push({ type: 'opening', at: c.created_at, delta: open });
  await db.sales.where('[shop_id+customer_id]').equals([shopId, customerId]).each(s => {
    if (s.status === 'void') return;
    rows.push({ type: 'sale', at: s.created_at, delta: Math.max(0, round2(s.total - s.paid)), total: s.total, paid: s.paid, ref: s.invoice_no, id: s.id });
  });
  await db.payments.where('[shop_id+party_id]').equals([shopId, customerId]).each(p => {
    if (p.party_type !== 'customer' || p.voided) return;
    rows.push({ type: p.kind, at: p.created_at, delta: p.kind === 'charge' ? p.amount : -p.amount, note: p.note });
  });
  rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  let run = 0;
  for (const r of rows) { run = round2(run + r.delta); r.running = run; }
  return rows;
}

// ───────── Suppliers & purchases ─────────
// Amount we owe a supplier = opening balance + Σ unpaid part of purchases + Σ "charge" entries − Σ "payment" entries.
// Like customer balances it is always computed from the records, never stored.

function listSuppliers(shopId, q, page = 0, pageSize = 30) {
  return db.suppliers.where('[shop_id+name]').between([shopId, ''], [shopId, '￿'])
    .filter(customerMatcher(q)).offset(page * pageSize).limit(pageSize).toArray();
}

async function saveSupplier(data) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('Name required');
  const fields = {
    name,
    phone: (data.phone || '').replace(/[^\d+]/g, '') || null,
    address: (data.address || '').trim() || null,
    note: (data.note || '').trim() || null
  };
  if (data.opening_balance !== undefined) fields.opening_balance = round2(Number(data.opening_balance) || 0);
  return db.transaction('rw', db.suppliers, db.sync_queue, db.app_settings, async () => {
    let rec;
    if (data.id) {
      const old = await db.suppliers.get(data.id);
      if (!old) throw new Error('Supplier not found');
      rec = { ...old, ...fields, version: old.version + 1, updated_at: new Date().toISOString(), sync_status: 'pending' };
      await db.suppliers.put(rec);
      await enqueue('suppliers', rec, 'update');
    } else {
      rec = await newRecord({ opening_balance: 0, deleted_at: null, ...fields });
      await db.suppliers.add(rec);
      await enqueue('suppliers', rec, 'insert');
    }
    return rec;
  });
}

async function getSupplierBalance(shopId, supplierId) {
  const c = await db.suppliers.get(supplierId);
  let bal = c ? (c.opening_balance || 0) : 0;
  await db.purchases.where('[shop_id+supplier_id]').equals([shopId, supplierId])
    .each(p => { if (p.status !== 'void') bal += Math.max(0, round2(p.total - p.paid)); });
  await db.payments.where('[shop_id+party_id]').equals([shopId, supplierId])
    .each(p => { if (p.party_type === 'supplier' && !p.voided) bal += p.kind === 'charge' ? p.amount : -p.amount; });
  return round2(bal);
}

async function getSupplierBalances(shopId, ids) {
  const arr = await Promise.all(ids.map(id => getSupplierBalance(shopId, id)));
  const map = {};
  ids.forEach((id, i) => { map[id] = arr[i]; });
  return map;
}

async function payableSummary(shopId) {
  const all = await db.suppliers.where('[shop_id+name]').between([shopId, ''], [shopId, '￿'])
    .filter(c => !c.deleted_at).toArray();
  const bals = await getSupplierBalances(shopId, all.map(c => c.id));
  let total = 0, count = 0;
  for (const id in bals) if (bals[id] > 0) { total += bals[id]; count++; }
  return { total: round2(total), count, suppliers: all.length };
}

// kind: 'payment' (we paid the supplier) | 'charge' (add an old amount we owe)
async function addSupplierPayment(supplierId, amount, kind = 'payment', note = '', method = 'cash') {
  amount = round2(Number(amount));
  if (!(amount > 0)) throw new Error('Invalid amount');
  if (!['payment', 'charge'].includes(kind)) throw new Error('Invalid kind');
  return db.transaction('rw', db.payments, db.sync_queue, db.app_settings, async () => {
    const rec = await newRecord({ party_type: 'supplier', party_id: supplierId, kind, amount, method, note: (note || '').trim() || null, voided: false });
    await db.payments.add(rec);
    await enqueue('payments', rec);
    return rec;
  });
}

async function softDeleteSupplier(shopId, id) {
  const bal = await getSupplierBalance(shopId, id);
  if (bal !== 0) throw new Error('BALANCE_NOT_ZERO');
  return db.transaction('rw', db.suppliers, db.sync_queue, async () => {
    const old = await db.suppliers.get(id);
    if (!old) return;
    const rec = { ...old, deleted_at: new Date().toISOString(), version: old.version + 1, updated_at: new Date().toISOString(), sync_status: 'pending' };
    await db.suppliers.put(rec);
    await enqueue('suppliers', rec, 'update');
  });
}

async function getSupplierLedger(shopId, supplierId) {
  const c = await db.suppliers.get(supplierId);
  const rows = [];
  const open = c ? (c.opening_balance || 0) : 0;
  if (open) rows.push({ type: 'opening', at: c.created_at, delta: open });
  await db.purchases.where('[shop_id+supplier_id]').equals([shopId, supplierId]).each(p => {
    if (p.status === 'void') return;
    rows.push({ type: 'purchase', at: p.created_at, delta: Math.max(0, round2(p.total - p.paid)), total: p.total, paid: p.paid, ref: p.ref_no, id: p.id });
  });
  await db.payments.where('[shop_id+party_id]').equals([shopId, supplierId]).each(p => {
    if (p.party_type !== 'supplier' || p.voided) return;
    rows.push({ type: p.kind, at: p.created_at, delta: p.kind === 'charge' ? p.amount : -p.amount, note: p.note });
  });
  rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  let run = 0;
  for (const r of rows) { run = round2(run + r.delta); r.running = run; }
  return rows;
}

// purchase: { supplier_id, paid, note, created_by, update_cost }   items: [{ product_id, product_name, qty, unit_cost }]
// One transaction: purchase + lines + stock increase (+ optional cost-price update). All or nothing.
async function savePurchase(purchase, items) {
  if (!items || !items.length) throw new Error('Cart is empty');
  for (const it of items) {
    if (!(it.qty > 0)) throw new Error('Invalid quantity');
    if (!(it.unit_cost >= 0)) throw new Error('Invalid price');
  }
  const total = round2(items.reduce((s, it) => s + round2(it.qty * it.unit_cost), 0));
  const paid = round2(purchase.paid == null ? total : purchase.paid);
  if (paid < 0) throw new Error('Invalid paid amount');
  return db.transaction('rw', db.purchases, db.purchase_items, db.products, db.stock_movements, db.sync_queue, db.app_settings, async () => {
    const rec = await newRecord({
      ref_no: 'P' + (await nextInvoiceNo()),
      supplier_id: purchase.supplier_id || null,
      total, paid, status: 'completed', note: (purchase.note || '').trim() || null,
      created_by: purchase.created_by || null
    });
    await db.purchases.add(rec);
    await enqueue('purchases', rec);
    for (const it of items) {
      const line = await newRecord({
        purchase_id: rec.id, product_id: it.product_id, product_name: it.product_name,
        qty: round3(it.qty), unit_cost: round2(it.unit_cost), line_total: round2(it.qty * it.unit_cost)
      });
      await db.purchase_items.add(line);
      await enqueue('purchase_items', line);
      const mv = await newRecord({ product_id: it.product_id, qty_change: round3(Math.abs(it.qty)), reason: 'purchase', ref_type: 'purchase', ref_id: rec.id });
      await db.stock_movements.add(mv);
      await enqueue('stock_movements', mv);
      if (purchase.update_cost) {
        const old = await db.products.get(it.product_id);
        if (old && old.cost_price !== round2(it.unit_cost)) {
          const up = { ...old, cost_price: round2(it.unit_cost), version: old.version + 1, updated_at: new Date().toISOString(), sync_status: 'pending' };
          await db.products.put(up);
          await enqueue('products', up, 'update');
        }
      }
    }
    return rec;
  });
}

function listPurchases(shopId, page = 0, pageSize = 30) {
  return db.purchases.where('[shop_id+created_at]').between([shopId, ''], [shopId, '￿'])
    .reverse().offset(page * pageSize).limit(pageSize).toArray();
}

async function getPurchaseWithItems(id) {
  const p = await db.purchases.get(id);
  if (!p) return null;
  const items = await db.purchase_items.where('[shop_id+purchase_id]').equals([p.shop_id, id]).toArray();
  return { purchase: p, items };
}

// ───────── Status & export ─────────
function pendingCount() { return db.sync_queue.where('status').equals('pending').count(); }
function failedCount()  { return db.sync_queue.where('status').equals('failed').count(); }

// Local export (JSON). Built table by table, in chunks, to keep memory reasonable.
async function exportAllData() {
  const parts = ['{"exported_at":' + JSON.stringify(new Date().toISOString()) + ',"tables":{'];
  const names = [...BUSINESS_TABLES, 'sync_queue', 'conflicts'];
  for (let i = 0; i < names.length; i++) {
    const t = names[i];
    parts.push((i ? ',' : '') + JSON.stringify(t) + ':[');
    let first = true;
    const total = await db.table(t).count();
    for (let off = 0; off < total; off += 500) {
      const rows = await db.table(t).offset(off).limit(500).toArray();
      for (const r of rows) { parts.push((first ? '' : ',') + JSON.stringify(r)); first = false; }
    }
    parts.push(']');
  }
  parts.push('}}');
  return new Blob(parts, { type: 'application/json' });
}
