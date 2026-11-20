// Products screen: list, add/edit form, selling units (carton = 12 pcs) and size/colour variants.
// Moved out of app.js (step 2 of the restructuring) — NO behaviour change. Loaded BEFORE app.js.
// Uses (defined elsewhere): S, $, esc, t, money, num, openModal, closeModal, toast, canEditProducts, saveProduct, listProducts, getStock, uuid …
// The click/submit wiring for these screens is still in app.js "Event wiring" (moves in a later step).

// ───────── Products ─────────
async function renderProducts(append = false) {
  const v = $('view-products');
  if (!append) {
    v.innerHTML = `
      <input id="prod-search" class="u-w-full" type="search" placeholder="${t('search_ph')}" value="${esc(S.productQuery)}">
      ${canEditProducts()
        ? `<div class="row u-mt-8"><button class="btn grow" id="btn-addprod">+ ${t('add_product')}</button>${typeof catalogStart === 'function' ? `<button class="btn secondary grow" id="btn-catalog">${t('cat_from')}</button>` : ''}</div>`
        : `<div class="muted u-m-6n0">${t('read_only')}</div>`}
      <div id="prod-list" class="u-mt-8"></div><div id="prod-more"></div>`;
  }
  const list = await listProducts(S.session.shop_id, S.productQuery, S.productPage, 30);
  const stocks = await getStocks(S.session.shop_id, list.map(p => p.id));
  const html = list.map(p => `
    <div class="card" ${canEditProducts() ? `data-edit="${p.id}"` : ''}>
      <div class="row"><div class="grow"><b>${esc(p.name)}</b>${p.name_ur ? ` <span class="muted">${esc(p.name_ur)}</span>` : ''}
        <div class="muted">${p.barcode && planHasBarcode() ? esc(p.barcode) + ' · ' : ''}${t('stock')}: ${stocks[p.id]} ${esc(p.unit || '')}${(p.units || []).map(u => ` · 1 ${esc(u.name)} = ${u.factor} ${esc(p.unit || '')}`).join('')}</div></div>
        <div class="price">${money(p.sale_price)}</div></div>
      ${p.min_stock && stocks[p.id] <= p.min_stock ? `<div class="warn">${t('stock')}: ${stocks[p.id]} ≤ ${p.min_stock}</div>` : ''}
      ${!p.sale_price ? `<div class="warn">${t('cat_no_price')}</div>` : ''}
    </div>`).join('');
  const target = $('prod-list');
  if (!append) target.innerHTML = html || `<div class="muted u-ta-center u-p-20">${t('no_products')}</div>`;
  else target.insertAdjacentHTML('beforeend', html);
  $('prod-more').innerHTML = list.length === 30 ? `<button class="btn secondary block" id="btn-moreprod">${t('more')}</button>` : '';
}

async function openProductForm(id) {
  const p = id ? await db.products.get(id) : {};
  const stock = id ? await getStock(S.session.shop_id, id) : 0;
  // Size/colour variants only make sense for clothing-type shops (or when the shop type isn't chosen yet).
  const bt = typeof catalogGetType === 'function' ? await catalogGetType(S.session.shop_id) : null, showVariants = !bt || bt === 'garments';
  openModal(`<h2>${id ? t('edit_product') : t('add_product')}</h2>
    <form id="prod-form">
      <label>${t('name')}</label><input name="name" required value="${esc(p.name)}">
      <label>${t('name_ur')}</label><input name="name_ur" value="${esc(p.name_ur)}">
      ${planHasBarcode() ? `<label>${t('barcode')}</label><input name="barcode" inputmode="numeric" dir="ltr" value="${esc(p.barcode)}">` : ''}
      <div class="row"><div class="grow"><label>${t('cost')}</label><input name="cost_price" type="number" inputmode="decimal" step="any" min="0" value="${p.cost_price ?? ''}"></div>
        <div class="grow"><label>${t('sale_price')}</label><input name="sale_price" type="number" inputmode="decimal" step="any" min="0" required value="${p.sale_price ?? ''}"></div></div>
      <div class="row"><div class="grow"><label>${t('unit')}</label><input name="unit" value="${esc(p.unit || 'pcs')}"></div>
        <div class="grow"><label>${t('min_stock')}</label><input name="min_stock" type="number" inputmode="decimal" step="any" min="0" value="${p.min_stock ?? ''}"></div></div>
      <label>${t('units_extra')}</label><div class="muted">${t('units_hint')}</div>
      ${[0, 1, 2].map(k => { const u = (p.units || [])[k] || {}; return `<div class="row u-mt-4">
        <input name="u_name_${k}" placeholder="${t('unit_name_ph')}" value="${esc(u.name || '')}" class="grow">
        <input name="u_factor_${k}" type="number" inputmode="decimal" step="any" min="0" placeholder="${t('unit_factor_ph')}" value="${u.factor ?? ''}" class="u-w-80">
        <input name="u_price_${k}" type="number" inputmode="decimal" step="any" min="0" placeholder="${t('sale_price')}" value="${u.price ?? ''}" class="u-w-90"></div>`; }).join('')}
      ${id || !showVariants ? '' : `<label>${t('variants_title')}</label><div class="muted">${t('variants_hint')}</div>
        <div class="row u-mt-4"><input name="v_sizes" class="grow" placeholder="${t('variants_sizes_ph')}">
          <input name="v_colors" class="grow" placeholder="${t('variants_colors_ph')}"></div>`}
      ${id ? `<div class="muted u-mt-8">${t('stock')}: ${stock}</div>
              <label>${t('stock_adjust')}</label><input name="adjust" type="number" inputmode="decimal" step="any">
              <label>${t('adjust_note')}</label><input name="adjust_note">`
           : `<label>${t('opening_stock')}</label><input name="opening" type="number" inputmode="decimal" step="any" min="0">`}
      <div class="row u-mt-14">
        <button class="btn grow" type="submit">${t('save')}</button>
        <button class="btn secondary" type="button" data-close>${t('cancel')}</button>
        ${id ? `<button class="btn danger" type="button" id="btn-delprod">${t('delete')}</button>` : ''}
      </div>
    </form>`);
  $('prod-form').onsubmit = async ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target).entries());
    try {
      const base = { name: f.name, name_ur: f.name_ur, barcode: planHasBarcode() ? f.barcode : (p.barcode || ''),
        cost_price: f.cost_price, sale_price: f.sale_price, unit: f.unit, min_stock: f.min_stock,
        units: [0, 1, 2].map(k => ({ name: f['u_name_' + k], factor: f['u_factor_' + k], price: f['u_price_' + k] })) };
      const combos = id ? [] : variantCombos(f.v_sizes, f.v_colors);
      if (combos.length > 40) throw new Error(t('variants_too_many'));
      if (combos.length) {
        // one normal product per size/colour (own stock, own barcode, own price) — all share variant_group
        if (!String(f.name || '').trim()) throw new Error('Name required');
        const group = uuid();
        for (const label of combos)
          await saveProduct({ ...base, name: `${f.name.trim()} - ${label}`, name_ur: f.name_ur ? `${f.name_ur.trim()} - ${label}` : '',
            barcode: '', variant_group: group, variant_label: label }, { openingStock: f.opening });
      } else {
        await saveProduct({ ...(id ? { id } : {}), ...base }, { openingStock: f.opening, adjust: f.adjust, adjustNote: f.adjust_note });
      }
      closeModal(); toast(t('saved')); S.productPage = 0; renderProducts(); refreshStatus();
    } catch (ex) { toast(ex.message || t('err_generic'), 4000); }
  };
  if (id) $('btn-delprod').onclick = async () => {
    if (!await askConfirm(t('confirm_delete'))) return;
    await softDeleteProduct(id); closeModal(); renderProducts(); refreshStatus();
  };
}

// ───────── Units: translations (the bill's unit selector is in app.js) ─────────

// ───────── Variants (Stage 4): size × colour -> one product each ─────────
function variantCombos(sizes, colors) {
  const split = s => [...new Set(String(s || '').split(/[,،\n]/).map(x => x.trim()).filter(Boolean))];
  const S_ = split(sizes), C_ = split(colors);
  if (!S_.length && !C_.length) return [];
  if (!S_.length) return C_;
  if (!C_.length) return S_;
  return S_.flatMap(s => C_.map(c => `${s} / ${c}`));
}

// ───────── Events for this screen (dispatched by events.js) ─────────
onUI('click', 30, ev => {
  const el = ev.target;
  if (el.closest('#btn-addprod2')) { openProductForm(null); return true; }
  if (el.closest('#btn-addprod')) { openProductForm(null); return true; }
  const ed = el.closest('[data-edit]'); if (ed) { openProductForm(ed.dataset.edit); return true; }
  if (el.closest('#btn-moreprod')) { S.productPage++; renderProducts(true); return true; }
});

onUI('input', 30, ev => {
  const el = ev.target;
  if (el.id === 'prod-search') { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.productQuery = el.value; S.productPage = 0; renderProducts(); }, 200); return true; }
});
