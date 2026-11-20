// Checks the three optional offline libraries in lib/.   Run:  node tests/check-libs.js
// A wrong or half-uploaded file would NOT fall back to the CDN (the browser only falls back when the file is missing),
// so this check catches it before you upload.
const fs = require('fs'), path = require('path');
const LIBS = [
  { file: 'dexie.min.js',  must: ['Dexie'],                       ver: '4.0.8',  min: 60000,  from: 'https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js' },
  { file: 'supabase.js',   must: ['createClient'],                ver: '2.45.4', min: 100000, from: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js' },
  { file: 'zxing.min.js',  must: ['BrowserMultiFormatReader'],    ver: null,     min: 100000, from: 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js' }
];
let bad = 0, missing = 0;
for (const L of LIBS) {
  const p = path.join(__dirname, '..', 'lib', L.file);
  if (!fs.existsSync(p)) { console.log(`MISSING  lib/${L.file}  (CDN is used)  <- ${L.from}`); missing++; continue; }
  const s = fs.readFileSync(p, 'utf8'); const probs = [];
  if (s.length < L.min) probs.push(`too small (${s.length} bytes) - incomplete download?`);
  if (/^\s*<(!doctype|html)/i.test(s)) probs.push('this is a web page, not JavaScript (wrong link saved)');
  for (const m of L.must) if (!s.includes(m)) probs.push(`does not contain "${m}"`);
  if (L.ver && !s.includes(L.ver)) probs.push(`version ${L.ver} not found (different version?)`);
  if (probs.length) { console.log(`BAD      lib/${L.file}: ${probs.join('; ')}`); bad++; }
  else console.log(`OK       lib/${L.file}  (${Math.round(s.length / 1024)} KB)`);
}
console.log(bad ? '\nFix the BAD files before uploading.' : missing ? '\nNo bad files. Missing ones simply use the CDN.' : '\nAll libraries are in place: the app can run fully offline from your own server.');
process.exit(bad ? 1 : 0);
