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

async function getSaleWithItems(saleId) {
  const sale = await db.sales.get(saleId);
  if (!sale) return null;
  const items = await db.sale_items.where('[shop_id+sale_id]').equals([sale.shop_id, saleId]).toArray();
  return { sale, items };
}

function listSales(shopId, page = 0, pageSize = 30) {
  return db.sales.where('[shop_id+created_at]')
    .between([shopId, ''], [shopId, '￿'])
    .reverse().offset(page * pageSize).limit(pageSize).toArray();
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
