// Dev check (not shipped to phones):  node check-i18n.js
// 1. every t('key') used in the app is defined (i18n.js, or superadmin.js's own table for Super Admin screens)
// 2. every key has BOTH Urdu and English
// 3. a key used by a screen that loads for EVERYONE is not hidden inside superadmin.js (that file is fetched only for platform admins)
const fs = require('fs');
globalThis.window = globalThis; globalThis.document = { addEventListener() {} }; globalThis.localStorage = { getItem() { return null }, setItem() {} };
(0, eval)(fs.readFileSync('i18n.js', 'utf8') + ';globalThis.I18N = I18N;');
const sa = fs.readFileSync('superadmin.js', 'utf8');
globalThis.SAT = null;
(0, eval)(sa.slice(sa.indexOf('const SAT = {'), sa.indexOf('addI18N(SAT);')).replace('const SAT', 'globalThis.SAT'));
const LAZY = ['superadmin.js', 'contact-admin.js'];
const files = fs.readdirSync('.').filter(f => f.endsWith('.js') && f !== 'check-i18n.js').concat(fs.readdirSync('billing').map(f => 'billing/' + f));
const used = (list) => { const u = {}; for (const f of list) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g)) (u[m[1]] = u[m[1]] || new Set()).add(f); return u; };
let bad = 0; const fail = (msg, list) => { if (list.length) { bad++; console.log('✗', msg, list); } };
const all = used(files), shared = used(files.filter(f => !LAZY.includes(f)));
fail('used but defined nowhere:', Object.keys(all).filter(k => !(k in I18N.en) && !(k in SAT)).map(k => k + ' <- ' + [...all[k]].join(',')));
fail('only in superadmin.js but used by screens everyone loads (move to i18n.js):', Object.keys(shared).filter(k => k in SAT && !(k in I18N.en)));
fail('missing Urdu or English:', Object.keys(I18N.en).filter(k => !(k in I18N.ur)).concat(Object.keys(I18N.ur).filter(k => !(k in I18N.en))));
fail('defined in both i18n.js and superadmin.js:', Object.keys(SAT).filter(k => k in I18N.en));
console.log(bad ? 'FAILED' : `OK — ${Object.keys(I18N.en).length} keys in i18n.js, ${Object.keys(SAT).length} in superadmin.js`);
process.exit(bad ? 1 : 0);
