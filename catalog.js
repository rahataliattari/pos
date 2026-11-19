// Universal POS — shared product catalog (Stage 1).
// Level 1: read-only catalog (catalog/<type>.json -> local table catalog_items, never synced).
// Level 2: the shop's own products (db.products) — the shopkeeper copies chosen items in (with catalog_id).
// Level 3: custom products stay available through the normal "add product" form.
// Catalog items carry NO price and NO stock: only name, Urdu name, category, unit (and barcode if known).
// Requires: db.js (db, newRecord, enqueue, getSetting, setSetting), app.js globals (S, $, esc, t, openModal, closeModal, toast, canEditProducts, renderProducts, refreshStatus).

const BUSINESS_TYPES = [
  { id: 'kiryana',  ur: 'کریانہ اسٹور',  en: 'Grocery (Kiryana)' },
  { id: 'general',  ur: 'جنرل اسٹور',    en: 'General store' },
  { id: 'auto',     ur: 'آٹو پارٹس',      en: 'Auto parts' },
  { id: 'hardware', ur: 'ہارڈویئر اور پینٹ', en: 'Hardware & paint' },
  { id: 'medical',  ur: 'میڈیکل اسٹور',  en: 'Medical store' },
  { id: 'garments', ur: 'گارمنٹس',        en: 'Garments' },
  { id: 'other',    ur: 'دیگر (خالی شروع کریں)', en: 'Other (start empty)' }
];

const CAT = { type: null, rows: [], cats: {}, sel: new Set(), q: '', cat: '', have: null };
const CAT_SHOW = 60;
const catLabel = o => (LANG === 'ur' ? o.ur : o.en) || o.en || o.ur || '';

// Load catalog/<type>.json into the local table (only when the version changed or the table is empty).
async function catalogLoad(type) {
  const verKey = 'catalog_ver_' + type, catsKey = 'catalog_cats_' + type;
  const have = await db.catalog_items.where('type').equals(type).count();
  let json = null;
  try { const r = await fetch(`catalog/${type}.json`); if (r.ok) json = await r.json(); } catch (e) { /* offline */ }
  if (json && Array.isArray(json.items) && (!have || (await getSetting(verKey, 0)) !== json.version)) {
    const rows = json.items.map(it => ({
      id: `${type}:${it.id}`, type, cat: it.c || '', name: it.n, name_ur: it.u || null,
      unit: it.unit || 'pcs', barcode: it.bc || null,
      q: `${it.n} ${it.u || ''}`.toLowerCase()
    }));
    await db.transaction('rw', db.catalog_items, db.app_settings, async () => {
      await db.catalog_items.where('type').equals(type).delete();
      await db.catalog_items.bulkAdd(rows);
      await setSetting(verKey, json.version);
      await setSetting(catsKey, json.categories || {});
    });
  } else if (!have) throw new Error(t('cat_load_fail'));
  CAT.cats = await getSetting(catsKey, {});
  CAT.rows = (await db.catalog_items.where('type').equals(type).toArray()).sort((a, b) => a.name.localeCompare(b.name));
}

// Which catalog items / names this shop already has (so nothing is added twice).
async function catalogHave(shop) {
  const all = await db.products.where('[shop_id+name]').between([shop, ''], [shop, '\uffff']).toArray();
  const ids = new Set(), names = new Set();
  for (const p of all) { if (p.deleted_at) continue; if (p.catalog_id) ids.add(p.catalog_id); names.add((p.name || '').toLowerCase()); }
  return { ids, names };
}
const catIsHave = r => CAT.have && (CAT.have.ids.has(r.id) || CAT.have.names.has(r.name.toLowerCase()));

// ───────── UI ─────────
function catalogPickType(first) {
  openModal(`<h2>${t('cat_pick_title')}</h2>
    <div class="muted u-mb-10">${t('cat_pick_hint')}</div>
    ${BUSINESS_TYPES.map(b => `<button class="btn secondary block u-mb-8"  data-cat-type="${b.id}">${esc(catLabel(b))}</button>`).join('')}
    ${first ? `<button class="btn secondary block" id="cat-skip">${t('cat_skip')}</button>` : `<button class="btn secondary block" data-close>${t('cancel')}</button>`}`);
}

async function catalogOpen(type) {
  CAT.type = type; CAT.sel = new Set(); CAT.q = ''; CAT.cat = '';
  openModal(`<h2>${esc(catLabel(BUSINESS_TYPES.find(b => b.id === type) || { en: '' }))}</h2><div class="muted">…</div>`);
  try { await catalogLoad(type); CAT.have = await catalogHave(S.session.shop_id); }
  catch (ex) { closeModal(); return toast(ex.message || t('cat_load_fail'), 4000); }
  const catOpts = Object.entries(CAT.cats).map(([k, v]) => `<option value="${esc(k)}">${esc(catLabel(v))}</option>`).join('');
  openModal(`<h2>${esc(catLabel(BUSINESS_TYPES.find(b => b.id === type)))}</h2>
    <input id="cat-q" type="search" placeholder="${t('cat_search')}" class="u-w-full">
    <select id="cat-c" class="u-w-full u-mt-8"><option value="">${t('cat_all_cats')}</option>${catOpts}</select>
    <div class="row u-mt-8">
      <button class="btn secondary grow" type="button" id="cat-all">${t('cat_select_shown')}</button>
      <button class="btn grow" type="button" id="cat-add" disabled></button>
    </div>
    <div class="muted u-m-6n0">${t('cat_price_note')}</div>
    <div id="cat-info" class="muted"></div>
    <div id="cat-list" class="u-mt-6"></div>
    <div class="row u-mt-10">
      <button class="btn secondary grow" type="button" id="cat-change">${t('cat_change')}</button>
      <button class="btn secondary" type="button" data-close>${t('cancel')}</button>
    </div>`);
  catalogRenderList();
}

function catalogFiltered() {
  const q = CAT.q.trim().toLowerCase();
  return CAT.rows.filter(r => (!CAT.cat || r.cat === CAT.cat) && (!q || r.q.includes(q)));
}

function catalogRenderList() {
  const list = catalogFiltered(), shown = list.slice(0, CAT_SHOW);
  $('cat-list').innerHTML = shown.map(r => {
    const have = catIsHave(r);
    return `<label class="card row u-ai-center u-gap-10">
      <input type="checkbox" data-cat-pick="${esc(r.id)}" ${have || CAT.sel.has(r.id) ? 'checked' : ''} ${have ? 'disabled' : ''}>
      <div class="grow"><b>${esc(r.name)}</b>${r.name_ur ? ` <span class="muted">${esc(r.name_ur)}</span>` : ''}
        <div class="muted">${esc(r.unit)}${have ? ` · ${t('cat_added_tag')}` : ''}</div></div></label>`;
  }).join('') || `<div class="muted u-ta-center u-p-16">${t('cat_empty')}</div>`;
  $('cat-info').textContent = list.length > CAT_SHOW ? `${t('cat_showing')}: ${shown.length} / ${list.length}` : '';
  catalogRenderCount();
}
function catalogRenderCount() {
  const b = $('cat-add'); if (!b) return;
  b.disabled = !CAT.sel.size;
  b.textContent = CAT.sel.size ? `${t('cat_add_n')} (${CAT.sel.size})` : t('cat_add_n');
}

async function catalogAddSelected() {
  const shop = S.session.shop_id;
  const have = await catalogHave(shop);
  let rows = CAT.rows.filter(r => CAT.sel.has(r.id) && !have.ids.has(r.id) && !have.names.has(r.name.toLowerCase()));
  if (!rows.length) { toast(t('cat_nothing_new')); return; }
  if (typeof planRoom === 'function') {                      // plan / demo product limit: add only what fits
    const room = await planRoom('products');
    if (room <= 0) return toast(suFill(t('lim_products'), { n: S.session.max_products }), 5000);
    if (rows.length > room) { rows = rows.slice(0, room); toast(suFill(t('lim_products'), { n: S.session.max_products }), 5000); }
  }
  let added = 0;
  await db.transaction('rw', db.products, db.categories, db.sync_queue, db.app_settings, async () => {
    const existing = await db.categories.where('[shop_id+name]').between([shop, ''], [shop, '\uffff']).toArray();
    const catIds = {}; for (const c of existing) if (!c.deleted_at) catIds[c.name] = c.id;
    for (const r of rows) {
      const cobj = CAT.cats[r.cat]; const cname = cobj ? catLabel(cobj) : '';
      let cid = null;
      if (cname) {
        cid = catIds[cname];
        if (!cid) {
          const c = await newRecord({ name: cname, deleted_at: null });
          await db.categories.add(c); await enqueue('categories', c, 'insert'); cid = catIds[cname] = c.id;
        }
      }
      const rec = await newRecord({ category_id: cid, deleted_at: null, catalog_id: r.id, name: r.name, name_ur: r.name_ur,
        barcode: r.barcode, sku: null, unit: r.unit, cost_price: 0, sale_price: 0, min_stock: 0, is_active: true });
      await db.products.add(rec); await enqueue('products', rec, 'insert'); added++;
    }
  });
  closeModal(); toast(`${added} ${t('cat_added_n')}`);
  S.productPage = 0; if (S.tab === 'products') renderProducts(); refreshStatus();
}

// Shown once after first login of an owner/manager whose shop has no products yet.
async function catalogFirstRun() {
  if (window.POS_DEMO || !S.session || S.session.admin || !canEditProducts()) return;
  const shop = S.session.shop_id;
  if (await getSetting('catalog_prompted_' + shop, false)) return;
  if (await catalogGetType(shop)) { await setSetting('catalog_prompted_' + shop, true); return; }   // already chosen (e.g. on another phone)
  const any = await db.products.where('[shop_id+name]').between([shop, ''], [shop, '\uffff']).limit(1).count();
  if (any) { await setSetting('catalog_prompted_' + shop, true); return; }
  catalogPickType(true);
}

// "Add from catalog" button: open the saved business type, or ask for it first.
// Business type lives in the shop settings (synced to the server, same on every phone). The old per-phone key is
// kept as a fallback, so nothing breaks if the server SQL (08) has not been run yet.
const catalogGetType = async shop => S.cfg.business_type || await getSetting('business_type_' + shop, null);
async function catalogSetType(shop, type) {
  await setSetting('business_type_' + shop, type);
  await saveCfg('business_type', type);
  if (typeof shopCfgChanged === 'function') shopCfgChanged();
}
async function catalogStart() {
  const type = await catalogGetType(S.session.shop_id);
  if (type && type !== 'other') return catalogOpen(type);
  catalogPickType(false);
}

// ───────── Events (delegated; independent of app.js handlers) ─────────
document.addEventListener('click', async ev => {
  const el = ev.target;
  const ty = el.closest('[data-cat-type]');
  if (ty) {
    const type = ty.dataset.catType, shop = S.session.shop_id;
    await catalogSetType(shop, type); await setSetting('catalog_prompted_' + shop, true);
    if (type === 'other') { closeModal(); return; }
    return catalogOpen(type);
  }
  if (el.closest('#cat-skip')) { await setSetting('catalog_prompted_' + S.session.shop_id, true); return closeModal(); }
  if (el.closest('#btn-catalog')) return catalogStart();
  if (el.closest('#cat-change')) return catalogPickType(false);
  if (el.closest('#cat-all')) { catalogFiltered().forEach(r => { if (!catIsHave(r)) CAT.sel.add(r.id); }); return catalogRenderList(); }
  if (el.closest('#cat-add')) { try { await catalogAddSelected(); } catch (ex) { toast(ex.message || t('err_generic'), 4000); } }
});
document.addEventListener('input', ev => { if (ev.target.id === 'cat-q') { CAT.q = ev.target.value; catalogRenderList(); } });
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.id === 'cat-c') { CAT.cat = el.value; return catalogRenderList(); }
  if (el.dataset && el.dataset.catPick) { el.checked ? CAT.sel.add(el.dataset.catPick) : CAT.sel.delete(el.dataset.catPick); catalogRenderCount(); }
});
