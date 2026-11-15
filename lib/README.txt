Put these two files here (optional - the app falls back to the CDN if they are missing):

1) dexie.min.js   <- https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js
2) supabase.js    <- https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js
3) zxing.min.js   <- https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js   (camera scanner for phones without a built-in one)

After adding or changing ANY app file, bump CACHE in sw.js (currently pos-shell-v39 -> v40 ...).
