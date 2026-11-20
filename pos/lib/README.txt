Offline libraries (optional - if a file is missing the app falls back to the CDN).

Download these three files and put them in THIS folder with exactly these names:

1) dexie.min.js   <- https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js
2) supabase.js    <- https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js
3) zxing.min.js   <- https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js   (camera scanner for phones without a built-in one)

(Open each link in the browser, then Save as... with the name above. Do not copy-paste the text.)

Then:
- run  node tests/check-libs.js   to confirm the files are complete,
- bump CACHE in sw.js (pos-shell-v68 -> v69) so phones download the new files,
- upload everything to GitHub as usual.

Use the exact versions above: the app was tested with them.
