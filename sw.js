// Service worker: makes the app shell and libraries available offline.
// IMPORTANT: bump CACHE (v34 -> v35 ...) every time ANY shell file changes. Files are served from the cache only,
// and a new CACHE version downloads ALL files fresh together, so old and new files are never mixed.
const CACHE = 'pos-shell-v60';

const SHELL = [
  './', 'index.html', 'styles.css', 'config.js', 'icons.js', 'i18n.js', 'events.js', 'db.js', 'catalog.js', 'catalog/kiryana.json', 'catalog/medical.json', 'catalog/garments.json', 'catalog/general.json', 'catalog/auto.json', 'catalog/hardware.json', 'sync.js', 'device.js', 'profile.js', 'legal.js', 'customers.js', 'purchases.js', 'qr.js', 'print.js', 'verify.js', 'expenses.js', 'reports.js', 'help.js', 'activity.js', 'lazy.js', 'announce.js', 'signup.js', 'contact.js', 'push.js', 'scanner.js', 'products.js', 'sales.js', 'billing/hold-quotes.js', 'billing/quick.js', 'billing/cart.js', 'home.js', 'settings.js', 'app.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'legal.html'
];
const LOCAL_LIBS = ['lib/dexie.min.js', 'lib/supabase.js', 'lib/zxing.min.js'];   // optional: used when uploaded to the lib/ folder
const LIBS = [
  'https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'      // camera scanner for phones without BarcodeDetector
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 'reload' skips the browser's HTTP cache, so a new version always gets fresh files (never a mix of old and new)
    await c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));            // shell must succeed
    for (const u of LOCAL_LIBS) {                // local libraries: cache if present
      try { await c.add(new Request(u, { cache: 'reload' })); } catch (err) { /* not uploaded: CDN fallback is used */ }
    }
    for (const u of LIBS) {                      // CDN libraries: try each, retried on next fetch if one fails
      try { await c.add(new Request(u, { mode: 'cors' })); } catch (err) { /* retried on next fetch */ }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never intercept the backend (auth, REST, RPC): those must always go to the network.
  if (url.hostname.endsWith('.supabase.co')) return;

  const isLib = LIBS.includes(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!isLib && !sameOrigin) return;

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // Cache-first for everything: files only change together when CACHE is bumped (see top of this file).
    const cached = await c.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) c.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});

// ───────── Web Push (Stage 9) ─────────
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Universal POS', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'pos', renotify: true, lang: 'ur', dir: 'auto',
    data: { kind: d.kind || '', ticket_id: d.ticket_id || '' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { c.postMessage({ type: 'push-open', data }); if ('focus' in c) return c.focus(); }
    return clients.openWindow('./?push=' + encodeURIComponent(data.kind || '') + '&t=' + encodeURIComponent(data.ticket_id || ''));
  })());
});
