// Universal POS — camera scanning that works on every phone.
// 1) If the browser has the built-in BarcodeDetector, it is used (fast, nothing to download).
// 2) Otherwise the ZXing library is loaded: first from lib/zxing.min.js (if you upload it), else from the CDN.
//    The service worker caches it, so after the first online use it also works offline.
// Used by startScan() (app.js, product barcodes) and the "Check a bill" QR scan (verify.js). Loaded before app.js.
let scanZx = null;
const ZX_URLS = ['lib/zxing.min.js', 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'];
function zxLoad() {
  return new Promise((resolve, reject) => {
    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) return resolve();
    let i = 0;
    const next = () => {
      if (i >= ZX_URLS.length) return reject(new Error('scanlib'));
      const s = document.createElement('script'); s.src = ZX_URLS[i++];
      s.onload = () => (window.ZXing && window.ZXing.BrowserMultiFormatReader ? resolve() : next());
      s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    };
    next();
  });
}
function scanErrorMsg(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') return t('scan_perm');
  if (e && e.message === 'scanlib') return t('scan_lib');
  return t('scan_unsupported');
}
// Start the camera in <video> `v`; onCode(text) is called once, for the first code read. Throws when the camera/scanner cannot start.
async function posScanStart(v, onCode, qrOnly) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocamera');
  let done = false;
  const fire = val => { if (done || !val) return; done = true; onCode(String(val)); };
  if ('BarcodeDetector' in window) {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    v.srcObject = scanStream; await v.play();
    let det; try { det = qrOnly ? new BarcodeDetector({ formats: ['qr_code'] }) : new BarcodeDetector(); } catch (e) { det = new BarcodeDetector(); }
    scanTimer = setInterval(async () => { try { const c = await det.detect(v); if (c.length) fire(c[0].rawValue); } catch (e) { /* next frame */ } }, 300);
    return;
  }
  await zxLoad();
  let hints = null;
  if (qrOnly) { try { hints = new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]]]); } catch (e) { hints = null; } }
  scanZx = new ZXing.BrowserMultiFormatReader(hints, 300);
  await scanZx.decodeFromConstraints({ video: { facingMode: 'environment' } }, v, res => { if (res) fire(res.getText()); });
}
function posScanStop() { if (scanZx) { try { scanZx.reset(); } catch (e) { /* already stopped */ } scanZx = null; } }

// ───────── Barcode camera scan (where BarcodeDetector exists) ─────────
let scanStream = null, scanTimer = null;
async function startScan() {
  if (!navigator.mediaDevices) { toast(t('scan_unsupported'), 3500); return; }
  openModal(`<h2>${t('scan')}</h2><div class="scanwrap"><video id="scanvideo" playsinline muted></video><div class="scanframe"><i class="scanline"></i></div></div>
    <div class="u-mt-10"><button class="btn secondary block" data-close>${t('cancel')}</button></div>`);
  try {
    await posScanStart($('scanvideo'), async val => { closeModal(); await handleBarcode(val); }, false);
  } catch (e) { closeModal(); toast(scanErrorMsg(e), 4500); }
}
function stopScan() {
  clearInterval(scanTimer); scanTimer = null; posScanStop();
  if (scanStream) { scanStream.getTracks().forEach(tr => tr.stop()); scanStream = null; }
}
