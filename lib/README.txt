Put these two files here (optional - the app falls back to the CDN if they are missing):

1) dexie.min.js   <- https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js
2) supabase.js    <- https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js

After adding or changing ANY app file, bump CACHE in sw.js (pos-shell-v35 -> v36 ...).
