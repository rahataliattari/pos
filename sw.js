// Service worker: makes the app shell and libraries available offline.
// Bump CACHE when any shell file changes.
const CACHE = 'pos-shell-v2';

const SHELL = [
  './', 'index.html', 'styles.css', 'config.js', 'i18n.js', 'db.js', 'app.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png'
];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);                       // shell must succeed
    for (const u of LIBS) {                      // libraries: try each, report if one fails
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
    const cached = await c.match(req, { ignoreSearch: true });
    // Libraries are version-pinned, so cache-first. Shell files: serve cache, refresh in background.
    const refresh = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { if (!isLib) e.waitUntil(refresh); return cached; }
    const res = await refresh;
    if (res) return res;
    if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    return Response.error();
  })());
});
