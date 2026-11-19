// Universal POS — one place that receives the page's click / input / change / keydown events and hands each to the screen that owns it.
// Every screen file registers its own handlers:  onUI('click', order, ev => { ...; return true; })
// Handlers run in `order`; the first one that returns true (or a promise that resolves to true) stops the chain — the same
// "first match wins" behaviour the old single big handler had. Orders: 10 core, 20 billing, 30 products, 40 sales, 50 purchases, 60 customers, 65 app, 70 settings.
const UI = { click: [], input: [], change: [], keydown: [] };
let searchTimer;                           // shared by the search boxes (typing in one cancels a pending search in another, as before)
function onUI(type, order, fn) { UI[type].push({ order, fn }); UI[type].sort((a, b) => a.order - b.order); }
for (const type of Object.keys(UI)) {
  document.addEventListener(type, async ev => {
    for (const h of UI[type]) {
      const r = h.fn(ev);
      if (r === true || (r && typeof r.then === 'function' && (await r) === true)) return;
    }
  });
}
