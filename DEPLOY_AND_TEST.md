# Stage 2 — Deploy and test

## Status
Stage 2 (offline billing MVP) is built. Tested only with an in-memory Dexie stand-in in headless Chromium
(13 logic checks passed). NOT yet tested with real Dexie/IndexedDB, the service worker, real Supabase login,
or on Android Chrome. Sync (Stage 3) does not exist yet: records stay "pending" on the phone.

## Hosting (HTTPS is required for PWA + service worker)
Any static host works. Easiest from a phone: GitHub Pages.
1. Create a GitHub account and a new PUBLIC repository (e.g. `pos`).
2. Upload all files from this folder (keep the `icons/` folder). Do NOT upload any secret keys (there are none in this folder).
3. Settings -> Pages -> Deploy from branch `main` / root. After a minute you get `https://<name>.github.io/pos/`.
Alternatives: Cloudflare Pages, Netlify.

## Supabase settings to check
- Authentication -> URL Configuration: add your site URL (the GitHub Pages address) as Site URL.
- Run `schema.sql` (already done) and keep the user + shop rows created earlier.

## Android Chrome test checklist (Stage 2)
1. Open the site online, log in with your Supabase user. Wait ~10 s on the billing screen (libraries get cached).
2. Chrome menu -> "Add to Home screen" / "Install app".
3. Products tab: add a product with a barcode and opening stock.
4. Billing: search it, add to bill, complete sale. Receipt appears. (acceptance 1)
5. Turn on airplane mode. Top bar must say Offline. Make another sale. (acceptance 2)
6. Close the app fully and reopen it in airplane mode. It must open and show both sales. (acceptance 3, 4)
7. Stock shown in Products must equal opening stock minus quantities sold.
8. Settings -> Export data: a JSON file downloads.
9. The yellow "Pending: N" chip should count unsynced records (it will not go down until Stage 3).

## Known limits (by design, for now)
- No sync/pull yet. Products created on another phone will not appear.
- Cashier "no discount / no price edit" is enforced in the app only, not by the server.
- Settings (tax, receipt text) are stored per device.
- Bluetooth thermal printing is not built yet; Print uses the browser print dialog.
- If several shops are linked to one user, you choose at login; there is no in-app shop switcher yet.
- Libraries load from jsdelivr on first visit and are then cached; vendoring them into the repo is recommended before production.
