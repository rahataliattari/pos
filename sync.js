// Universal POS — Sync Engine (Stage 3).
// Local DB (Dexie) is always the source the UI reads. This engine only moves data:
//   1) PUSH  pending records from sync_queue -> Supabase (sync_push RPC), with retry/backoff
//   2) PULL  records changed on the server (other devices) -> local DB (sync_pull RPC, server-time cursor)
// Conflict rule: higher version wins; same version -> newer updated_at wins; otherwise the SERVER copy wins
// and the losing local copy is kept in the `conflicts` table for review. Stock is a ledger (stock_movements),
// so stock from several devices always adds up and never conflicts.

const SYNC = {
  running: false, timer: null, debounce: null, lastError: null, lastOk: null,
  BATCH: 100, MAX_ATTEMPTS: 8, INTERVAL: 30000
};

function syncEnabled() { return !window.POS_DEMO && typeof db !== 'undefined' && S.session && navigator.onLine; }

function syncSchedule(ms = 1500) {            // call after local writes; coalesces bursts into one run
  clearTimeout(SYNC.debounce);
  SYNC.debounce = setTimeout(() => syncRun(), ms);
}

function syncStart() {
  if (window.POS_DEMO || syncStart._on) return;
  syncStart._on = true;
  db.sync_queue.hook('creating', () => { syncSchedule(); });   // every enqueue() triggers a (debounced) sync
  window.addEventListener('online', () => syncRun());
  SYNC.timer = setInterval(() => syncRun(), SYNC.INTERVAL);
  syncRun();
}

function syncBackoff(attempts) { return Date.now() + Math.min(5000 * 2 ** attempts, 10 * 60 * 1000); }

// Returns true if the failure is about login/permissions (retrying won't help).
function syncIsAuthError(e) {
  const m = String((e && (e.message || e.code)) || '');
  return /not_member|shop_blocked|JWT|401|403|42501|not authenticated/i.test(m);
}

async function syncRun(opts = {}) {
  if (SYNC.running || !syncEnabled()) return { skipped: true };
  const locked = async fn => (navigator.locks ? navigator.locks.request('pos-sync', { ifAvailable: true }, l => l ? fn() : { skipped: true }) : fn());
  SYNC.running = true; syncUi();
  try {
    return await locked(async () => {
      const sb = getSb();
      const { data: ses } = await sb.auth.getSession();
      if (!ses || !ses.session) { SYNC.lastError = 'auth'; await logSync('warn', 'sync: no auth session'); return { error: 'auth' }; }
      if (!(await pingServer())) return { offline: true };
      const shop = await getSetting('shop_id'); if (!shop) return { error: 'no_shop' };
      const pushed = await syncPush(sb, shop);
      const pulled = await syncPull(sb, shop);
      await syncShopCfg(sb, shop);                  // رسید کی سیٹنگز (فون، پتہ...) سرور کے ساتھ
      SYNC.lastError = null; SYNC.lastOk = new Date().toISOString();
      await setSetting('last_sync_at', SYNC.lastOk);
      await syncCheckExpiry(sb, shop);
      await syncTrimLogs();
      return { pushed, pulled };
    });
  } catch (e) {
    SYNC.lastError = syncIsAuthError(e) ? 'auth' : (e.message || String(e));
    try { await logSync('error', 'sync failed', String(e && e.message || e)); } catch (x) {}
    return { error: SYNC.lastError };
  } finally {
    SYNC.running = false; syncUi();
    if (typeof refreshStatus === 'function') refreshStatus();
  }
}

// ───────── PUSH ─────────
async function syncPush(sb, shop) {
  let total = 0;
  for (let round = 0; round < 50; round++) {                       // safety cap
    const entries = await db.sync_queue.where('status').equals('pending')
      .filter(q => (q.next_retry_at || 0) <= Date.now() && q.shop_id === shop).limit(500).toArray();
    if (!entries.length) break;

    // latest local state per record (many queue entries for one record collapse into one push)
    const groups = {};                                            // table -> id -> { maxSeq, seqs[] }
    for (const q of entries) {
      const g = ((groups[q.table_name] ||= {})[q.record_id] ||= { seqs: [], maxSeq: 0 });
      g.seqs.push(q.seq); g.maxSeq = Math.max(g.maxSeq, q.seq);
    }
    let progressed = false;
    for (const table of Object.keys(groups)) {
      const ids = Object.keys(groups[table]);
      for (let i = 0; i < ids.length; i += SYNC.BATCH) {
        const chunkIds = ids.slice(i, i + SYNC.BATCH);
        const recs = (await db.table(table).bulkGet(chunkIds));
        const rows = [], sent = {};
        chunkIds.forEach((id, k) => {
          const r = recs[k];
          if (!r) { db.sync_queue.bulkDelete(groups[table][id].seqs); return; }   // record gone: nothing to send
          const { sync_status, ...payload } = r; rows.push(payload); sent[id] = r.version;
        });
        if (!rows.length) continue;
        let res;
        try {
          const { data, error } = await sb.rpc('sync_push', { p_shop: shop, p_table: table, p_rows: rows });
          if (error) throw error; res = data || [];
        } catch (e) {
          if (syncIsAuthError(e)) throw e;                          // stop everything, show "login again"
          for (const id of Object.keys(sent)) await syncMarkAttempt(groups[table][id].seqs, e);
          throw e;                                                  // network/server trouble: try later
        }
        for (const out of res) {
          const g = groups[table][out.id]; if (!g) continue;
          if (out.status === 'ok') {
            // mark synced only if the record wasn't edited again while the request was in flight
            await db.transaction('rw', db.table(table), db.sync_queue, async () => {
              const cur = await db.table(table).get(out.id);
              if (cur && cur.version === sent[out.id]) await db.table(table).update(out.id, { sync_status: 'synced' });
              await db.sync_queue.bulkDelete(g.seqs);
            });
          } else if (out.status === 'conflict') {
            await syncResolveConflict(table, out.id, out.server, g.seqs);
          } else if (out.status === 'denied') {       // role not allowed on the server: stop retrying, show as failed
            await db.sync_queue.bulkUpdate(g.seqs.map(seq => ({ key: seq, changes: { status: 'failed', last_error: 'denied' } })));
            await logSync('warn', `denied by server (role) on ${table}`, out.id);
          }
          total++; progressed = true;
        }
      }
    }
    if (!progressed) break;
  }
  return total;
}

async function syncMarkAttempt(seqs, err) {
  await db.transaction('rw', db.sync_queue, async () => {
    for (const seq of seqs) {
      const q = await db.sync_queue.get(seq); if (!q) continue;
      const attempts = (q.attempts || 0) + 1;
      await db.sync_queue.update(seq, {
        attempts, last_error: String(err && err.message || err).slice(0, 300),
        status: attempts >= SYNC.MAX_ATTEMPTS ? 'failed' : 'pending',
        next_retry_at: syncBackoff(attempts)
      });
    }
  });
}

async function syncResolveConflict(table, id, serverRec, seqs) {
  await db.transaction('rw', db.table(table), db.conflicts, db.sync_queue, async () => {
    const local = await db.table(table).get(id);
    await db.conflicts.put({
      id: uuid(), shop_id: local ? local.shop_id : serverRec.shop_id, table_name: table, record_id: id,
      local: local || null, server: serverRec, detected_at: new Date().toISOString(), resolved_at: null, resolution: 'server_wins'
    });
    if (serverRec) await db.table(table).put({ ...serverRec, sync_status: 'synced' });
    await db.sync_queue.bulkDelete(seqs);
  });
  await logSync('warn', `conflict on ${table}`, id);
}

// ───────── PULL ─────────
async function syncPull(sb, shop) {
  let total = 0;
  for (const table of BUSINESS_TABLES) {
    const key = `pull_cursor_${shop}_${table}`;
    let cursor = await getSetting(key, null);
    for (let round = 0; round < 200; round++) {
      const { data, error } = await sb.rpc('sync_pull', { p_shop: shop, p_table: table, p_since: cursor, p_limit: 500 });
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) break;
      await db.transaction('rw', db.table(table), db.app_settings, async () => {
        const ids = rows.map(r => r.data.id);
        const locals = await db.table(table).bulkGet(ids);
        const put = [];
        rows.forEach((r, i) => {
          const l = locals[i], s = r.data;
          if (l && l.sync_status === 'pending') return;           // unsynced local change: its push decides
          if (l && l.version > s.version) return;                 // local is newer
          put.push({ ...s, sync_status: 'synced' });
        });
        if (put.length) await db.table(table).bulkPut(put);
        await setSetting(key, rows[rows.length - 1].server_ts);
      });
      cursor = rows[rows.length - 1].server_ts;
      total += rows.length;
      if (rows.length < 500) break;
    }
  }
  return total;
}

// ───────── Receipt settings (shop-wide: header, footer, phone, address, NTN) ─────────
// These live on the server (shops.settings) so every phone of the shop shows the same receipt text.
// Paper size, language and theme stay per-device on purpose (they depend on the phone/printer).
const SHOP_CFG_KEYS = ['receipt_header', 'receipt_footer', 'shop_phone', 'shop_address', 'shop_tax_no'];
const shopCfgCanWrite = () => S.session && ['owner', 'manager'].includes(S.session.role);

async function shopCfgChanged() {                  // call after the user edits one of SHOP_CFG_KEYS
  if (window.POS_DEMO || !shopCfgCanWrite()) return;
  const shop = await getSetting('shop_id'); if (!shop) return;
  await setSetting('cfg_dirty_' + shop, true);
  setSetting('cfg_shop', shop).catch(() => {});
  syncSchedule(300);
}

async function syncShopCfg(sb, shop) {
  try {
    const dirtyKey = 'cfg_dirty_' + shop;
    const localShop = await getSetting('cfg_shop', null);          // which shop this phone's saved cfg belongs to
    const pick = () => Object.fromEntries(SHOP_CFG_KEYS.map(k => [k, S.cfg[k] || '']));
    const hasLocal = SHOP_CFG_KEYS.some(k => S.cfg[k]);
    const { data, error } = await sb.rpc('get_shop_settings', { p_shop: shop });
    if (error) throw error;
    const server = data && typeof data === 'object' ? data : {};
    const hasServer = SHOP_CFG_KEYS.some(k => server[k]);

    // phone was used with another shop before: its receipt text must not leak into this shop
    if (localShop && localShop !== shop) {
      for (const k of SHOP_CFG_KEYS) await saveCfg(k, '');
      await setSetting('cfg_shop', shop);
    }
    const mine = !localShop || localShop === shop;                  // old installs (no marker) count as this shop's

    if (await getSetting(dirtyKey, false) || (mine && hasLocal && !hasServer)) {
      // local edit not yet on the server (or first upload from the phone that already had the data)
      if (!shopCfgCanWrite()) return;
      const { error: e2 } = await sb.rpc('save_shop_settings', { p_shop: shop, p_settings: pick() });
      if (e2) throw e2;
      await setSetting(dirtyKey, false); await setSetting('cfg_shop', shop);
      return;
    }
    // otherwise the server copy wins and is applied on this phone
    let changed = false;
    for (const k of SHOP_CFG_KEYS) {
      const v = typeof server[k] === 'string' ? server[k] : '';
      if ((S.cfg[k] || '') !== v) { await saveCfg(k, v); changed = true; }
    }
    await setSetting('cfg_shop', shop);
    if (changed && S.tab === 'settings' && !(document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName))) renderSettings();
  } catch (e) {
    if (syncIsAuthError(e)) throw e;
    try { await logSync('warn', 'shop settings sync failed', String(e && e.message || e)); } catch (x) {}   // e.g. 04 SQL not run yet
  }
}

// ───────── Housekeeping, retry, UI ─────────
async function syncTrimLogs() {
  const n = await db.sync_logs.count();
  if (n > 500) { const old = await db.sync_logs.orderBy('id').limit(n - 500).primaryKeys(); await db.sync_logs.bulkDelete(old); }
}

async function syncRetryFailed() {
  await db.sync_queue.where('status').equals('failed').modify({ status: 'pending', attempts: 0, next_retry_at: 0 });
  return syncRun();
}

function syncUi() {
  const el = document.getElementById('sync-state'); if (!el) return;
  el.textContent = SYNC.running ? t('sync_running')
    : SYNC.lastError === 'auth' ? t('sync_auth')
    : SYNC.lastError ? t('sync_error') + ': ' + SYNC.lastError
    : SYNC.lastOk ? t('sync_ok') + ' · ' + fmtDate(SYNC.lastOk) : t('sync_idle');
}

// ───────── Subscription expiry ─────────
async function syncCheckExpiry(sb, shop) {
  try {
    const { data } = await sb.from('shops').select('expires_at').eq('id', shop).maybeSingle();
    if (!data) return;
    S.session.expires_at = data.expires_at;
    try {                                            // sessions saved before names existed: fetch the person's name once
      const m = await sb.from('shop_members').select('name').eq('shop_id', shop).eq('user_id', S.session.user_id).maybeSingle();
      if (m.data && m.data.name && m.data.name !== S.session.user_name) {
        S.session.user_name = m.data.name;
        if (S.tab === 'home') { const h = document.getElementById('hdr-hello'); if (h) h.textContent = m.data.name; }
      }
    } catch (x) {}
    await setSetting('session', S.session);
    const d = syncDaysLeft();
    if (d !== null && d <= 7 && !syncCheckExpiry._warned) { syncCheckExpiry._warned = true; toast(syncExpiryText(), 6000); }
  } catch (e) {}
}
function syncDaysLeft() {
  if (!S.session || !S.session.expires_at) return null;
  return Math.ceil((new Date(S.session.expires_at).getTime() - Date.now()) / 86400000);
}
function syncExpiryText() {
  const d = syncDaysLeft();
  return d === null ? '' : d < 0 ? t('sub_expired') : t('sub_days').replace('{n}', d);
}

// ───────── Conflict review ─────────
const conflictLabel = r => r ? (r.name || r.invoice_no || r.product_name || (r.id || '').slice(0, 8)) : '—';
async function syncShowConflicts() {
  const list = await db.conflicts.filter(c => !c.resolved_at).toArray();
  openModal(`<h3>${t('sync_conflicts')}</h3>` + (list.length ? list.map(c => `
    <div class="card" style="margin-bottom:8px"><b>${esc(c.table_name)}</b> · ${esc(conflictLabel(c.server || c.local))}
      <div class="muted">${t('cf_local')}: ${esc(fmtDate(c.local && c.local.updated_at))} · ${t('cf_server')}: ${esc(fmtDate(c.server && c.server.updated_at))}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn secondary grow" data-cf-ok="${c.id}">${t('cf_keep_server')}</button>
        <button class="btn grow" data-cf-local="${c.id}">${t('cf_keep_local')}</button>
      </div></div>`).join('') : `<div class="muted">${t('cf_none')}</div>`) +
    `<button class="btn secondary block" id="btn-close-modal">${t('cancel')}</button>`);
}
async function syncResolveChoice(id, keepLocal) {
  const c = await db.conflicts.get(id); if (!c) return;
  await db.transaction('rw', db.table(c.table_name), db.conflicts, db.sync_queue, async () => {
    if (keepLocal && c.local) {
      const rec = { ...c.local, version: Math.max(c.local.version, c.server ? c.server.version : 0) + 1,
                    updated_at: new Date().toISOString(), sync_status: 'pending' };
      await db.table(c.table_name).put(rec); await enqueue(c.table_name, rec, 'update');
    }
    await db.conflicts.update(id, { resolved_at: new Date().toISOString(), resolution: keepLocal ? 'local_kept' : 'server_kept' });
  });
  syncSchedule(500); syncShowConflicts();
}

// ───────── Restore from an exported backup (JSON) ─────────
async function syncImportFile(file) {
  const shop = await getSetting('shop_id'); if (!shop) throw new Error('No shop');
  const obj = JSON.parse(await file.text());
  if (!obj || !obj.tables) throw new Error(t('import_bad'));
  let n = 0;
  for (const table of BUSINESS_TABLES) {
    const rows = (obj.tables[table] || []).filter(r => r && r.id && r.shop_id === shop);
    for (let i = 0; i < rows.length; i += 300) {
      const chunk = rows.slice(i, i + 300);
      await db.transaction('rw', db.table(table), db.sync_queue, async () => {
        const locals = await db.table(table).bulkGet(chunk.map(r => r.id));
        for (let k = 0; k < chunk.length; k++) {
          const l = locals[k], r = chunk[k];
          if (l && l.version >= r.version) continue;               // keep what is already here if it is as new or newer
          const rec = { ...r, sync_status: 'pending' };
          await db.table(table).put(rec); await enqueue(table, rec, 'insert'); n++;
        }
      });
    }
  }
  syncSchedule(500);
  return n;
}

window.addEventListener('pos-sync-ready', syncStart);
