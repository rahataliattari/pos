// Builds ONE self-contained HTML file for testing on a phone: node build-demo.js  ->  Universal-POS-Demo.html
// Everything (styles, scripts, icons, a tiny database stand-in, sample data) is inside the file: no internet needed.
const fs = require('fs');
const rd = f => fs.readFileSync(f, 'utf8');
const safe = js => js.replace(/<\/script/gi, '<\\/script');
let html = rd('index.html');
const icon = 'data:image/png;base64,' + fs.readFileSync('icon-192.png').toString('base64');
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}">`)
  .replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${icon}">`)
  .replace(/<link rel="stylesheet" href="styles.css">/, () => `<style>\n${rd('styles.css')}\n</style>`);
// drop every external <script src=…>, then add our own inline bundle at the end of <body>
html = html.replace(/\s*<!-- Libraries:[\s\S]*?-->/, '').replace(/\s*<script src="[^"]+"><\/script>/g, '');
const order = ['demo/dexie-shim.js', 'icons.js', 'i18n.js', 'db.js', 'sync.js', 'demo/demo.js', 'customers.js', 'purchases.js', 'print.js', 'expenses.js', 'reports.js', 'help.js', 'superadmin.js', 'app.js'];
const bundle = order.map(f => `<script>\n// ── ${f}\n${safe(rd(f))}\n</script>`).join('\n');
html = html.replace('</body>', bundle + '\n</body>');
fs.writeFileSync('Universal-POS-Demo.html', html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
