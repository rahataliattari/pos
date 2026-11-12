# Universal POS — Offline-First Architecture (Stage 1)

Status: DESIGN ONLY. Nothing here has been tested on a device. The app must not be called production-ready until every acceptance test in section 10 passes.

## 1. Stages

| Stage | Deliverable | Exit criteria |
|-------|-------------|---------------|
| 1 | Architecture, local schema (`db.js`), cloud schema (`schema.sql`), sync design | Schemas reviewed, RLS policies reviewed |
| 2 | Offline billing MVP: login, product search, barcode, cart, sale save, stock movement, receipt, PWA shell | Acceptance tests 1-4 |
| 3 | Sync engine: queue, connectivity check, push, pull, backoff, logs, Sync Now | Tests 5-8, 11 |
| 4 | Customers, suppliers, payments, purchases, expenses | Offline CRUD works |
| 5 | Conflict screen, stock discrepancy detection, multi-device | Test 9 |
| 6 | Backup/restore, export, RLS verification, Bluetooth printing, Urdu/English polish | Tests 10, 12 |

## 2. Layers

```
UI (Urdu RTL / English)  ->  Services (sales, stock, customers...)
                                   |
                           Dexie (IndexedDB)  <-- single source of truth for the UI
                                   |
                           Sync Engine (background)
                                   |
                           Supabase (Auth + Postgres + RLS + RPC)
```

Rule: the UI NEVER talks to Supabase for business data. It reads and writes Dexie only. The sync engine is the only code that touches the network for business data.

## 3. Local data model

- All stores in `db.js`. Every business record carries: `id` (UUID v4), `shop_id`, `device_id`, `created_at`, `updated_at`, `version`, `sync_status` (`pending` | `synced` | `failed` | `conflict`).
- A sale is written in ONE Dexie transaction: `sales` + `sale_items` + `stock_movements` + `sync_queue` entries. Either everything is saved or nothing is.
- Stock is derived: `stock = SUM(stock_movements.qty_change)` per product. `products.stock_cache` is a convenience value rebuilt from movements; movements are the truth.
- Stock movements, sales, sale items, and payments are append-only. Corrections are new records (e.g. a `return` sale or an `adjustment` movement), never edits or deletes.
- Deletion of mutable records (products, customers) is a soft delete (`deleted_at`). Pending records are never removed locally until the server confirms them.

## 4. Sync protocol

### Push (device -> server)
1. Connectivity check: `HEAD/GET` to a tiny Supabase RPC `ping()` with a 5 s timeout. `navigator.onLine` is only a hint to try; success of `ping()` is what counts.
2. Read pending `sync_queue` rows ordered by `seq` (parents before children: sale before items, etc.), in batches of 50.
3. Send each batch to RPC `sync_push(shop_id, device_id, batch jsonb)`.
4. The server applies each op with `INSERT ... ON CONFLICT (id) DO NOTHING` for append-only tables, so a retried batch can never duplicate a sale or payment. The server returns per-op results: `applied`, `duplicate` (already there; treated as success), or `rejected` with a reason.
5. On `applied` / `duplicate`: mark local record `synced`, delete the queue row. On `rejected`: mark `failed`, keep the queue row, log it.
6. Network errors: queue rows stay untouched; `attempts++`, `next_retry_at = now + min(2^attempts * 5s, 15 min) + jitter`.
7. Interruption is safe because each op is idempotent and the queue row is removed only after server confirmation. On restart, the engine simply resumes from the remaining queue.

### Pull (server -> device)
1. For each synced table, request rows with `server_seq > last_pulled_seq` (stored in `app_settings`), paged (500 rows).
2. Apply in a Dexie transaction. For append-only tables: insert if the id is unknown. For mutable tables (products, customers): apply if the server version is higher AND the local record is not `pending`; if the local record is `pending`, mark `conflict` instead of overwriting.
3. Advance `last_pulled_seq` only after the page is committed.

### Triggers
App start, `online` event, every 30 s while online and visible, after each sale, and manual Sync Now. A lock (single-flight, via `navigator.locks` where available) prevents two syncs running at once across tabs.

## 5. Conflict resolution

- Sales/payments/stock movements: no conflicts by design; they are unique events keyed by UUID and are only ever added.
- Mutable records (product price, customer details): optimistic `version` check. If the server version differs from the client's base version, the server returns a conflict; the record is kept in a `conflicts` list with both copies and shown on the owner-only Conflict screen. Nothing is silently overwritten.
- Stock discrepancy: two devices can both sell the last unit offline. Both sales are legitimate and are kept. After the pull, the derived stock goes negative; the app flags the product as a discrepancy for the owner to review (adjust, reorder, or annotate). Sales are never blocked or rolled back for this.
- Audit: server table `audit_log` records every insert/update of mutable tables via trigger; originals are preserved.

## 6. Security

- Every table has `shop_id`. RLS allows access only if `auth.uid()` has a row in `shop_members` for that shop. The client-supplied `shop_id` is checked against membership server-side on every write (policy `WITH CHECK` and inside the RPC).
- Roles: `owner`, `manager`, `cashier`. Only owners can resolve conflicts, manage members, restore backups, and delete/adjust sensitive records.
- Frontend ships only the Supabase URL and anon key (loaded from config injected at build/deploy time, `config.js` generated from environment variables). The service-role key is never in frontend code or in the repo.
- RPC functions are `SECURITY INVOKER` (RLS applies). Any `SECURITY DEFINER` function must check membership explicitly.

## 7. Backup and recovery

- Cloud: Supabase backups depend on the plan. Free plan has no usable daily backups, so do not rely on it. Choose Pro (daily backups, optional PITR) for real shops. This is a hosting decision for the owner; I cannot configure it from here.
- Additionally: a scheduled export (Supabase scheduled function or external cron using a server-side key, never the frontend) writing per-shop JSON/CSV to storage.
- App: owner-only "Export all data" (JSON) and "Restore from file". Restore is additive and idempotent (same UUIDs, `ON CONFLICT DO NOTHING`), with a preview before applying.
- Sync is not backup: a bad delete or bug syncs everywhere. Hence soft deletes and append-only records.

## 8. Performance

Compound indexes for the common queries (barcode, name prefix, sale date, pending status). Lists use cursor/offset pagination via `.offset().limit()`; reports aggregate with indexed range queries, never `toArray()` on whole tables. Product search keeps only a small result set in memory. No heavy frameworks; vanilla JS modules plus Dexie.

## 9. UI notes

Urdu-first RTL (`dir="rtl"`, `lang="ur"`), English toggle, green/white theme, top bar showing Online/Offline (based on `ping()`, not `navigator.onLine`), pending count, last sync time. Bluetooth printing via Web Bluetooth (ESC/POS) where Android Chrome supports it, with a print-to-PDF/browser-print fallback.

## 10. Acceptance tests (all must pass before any "production-ready" claim)

1. Sale while online. 2. Sale while offline. 3. Reload offline. 4. Local records intact. 5. Reconnect. 6. Auto sync. 7. Interrupt sync and resume. 8. No duplicate sales. 9. Two devices selling offline at the same time. 10. Shop data isolation (user A cannot read/write shop B). 11. Failed sync recovery. 12. Backup and restore.

Current status: 0 of 12 run.

## 11. Open decisions for the owner

- Supabase plan (backups). 
- Whether cashiers may edit prices or give discounts.
- Tax/currency rules and receipt layout.
- Printer model(s) for Bluetooth testing.
