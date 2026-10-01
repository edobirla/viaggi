# Handoff — Viaggi (travel planner PWA)

> Generated on 2026-10-01 02:08 — resume in a new Claude Code session.

---

## 🎯 Goal

A personal, premium-looking travel planner (inspired by the Plotline iOS app) for the user (Edoardo, Italian, non-developer) and their travel companion. It covers multiple trips. Each trip has cities, a day-by-day plan, flights (with layovers and baggage), stays (board, check-in/out, tourist tax), transfers, places (with vegan/vegetarian flags, favourites, visited), city-specific shopping lists, a multi-currency budget, a checklist, documents and tickets, plus a profile and settings. It must run on iPhone, iPad and Mac with **zero recurring cost** and **no paid Apple developer account**, so it is a PWA, not a native app. The UI is in Italian and must look premium, not "AI slop": an iOS 26 Liquid Glass approximation. The first real trip is the honeymoon in Japan, 23 Jun – 15 Jul 2027.

---

## 📍 Current State

The repo is `https://github.com/edobirla/viaggi` (private, branch `main`). The app lives in this folder (`app/`). The parent folder `../` holds the source data files (`HoneyMoon - Japan .xmind`, `Budget Luna di Miele.xlsx`) and `.claude/launch.json`. These are not in the repo.

**Working (verified in browser at 390px and 1280px):**
- **Layout:** sidebar on ≥900px (iPad/Mac); floating glass tab bar on phones. Item detail opens as a right-side inspector on wide screens and a bottom sheet on phones.
- **Trips list and trip overview:**
  - Hero with a cover (uploaded, or the city photo from Wikipedia) and a countdown (top-left on phones).
  - Traveler pills on the hero.
  - Bento tiles: next item, budget ring, checklist, "da visitare/visitati", shopping, deadlines with `.ics` export.
  - City rail.
- **City dashboard** (`#/t/:id/city/:cityId`):
  - Days, dates and stay card.
  - "Come arrivi" / "Come riparti" (heuristic) and "In programma" (by stay dates).
  - Favourites.
  - Tiles deep-link to filtered pages: `places?city=&status=`, `shop?city=`, `plan?day=`.
- **Plan:**
  - Day strip, timeline and night rows.
  - Flight card: IATA codes, duration and layovers under the plane, airline only.
  - Transfer cards show the duration: manual, or estimated from the mode plus endpoint coordinates.
  - Hops between consecutive places show km and estimated time, linking to Google Maps transit directions.
  - "Ottimizza percorso" orders places with nearest-neighbour from the hotel.
  - "Dai posti salvati" shows only places of the city where you sleep that day, grouped by category and sorted by distance.
  - Items dated outside the trip appear under "Da mettere in calendario".
- **Item detail/editor** (`ItemSheet.tsx`):
  - Flight: layovers, duration, structured bags (personal/cabin/hold with qty and kg, plus extra cost).
  - Stay: board, check-in/out times, tourist tax per person per night with an auto total.
  - Transfer: mode switch chips and a "Percorso" button.
  - Favourite star.
  - Attachments: list with "di chi è?" owner per traveler, plus quick buttons "Carta d'imbarco di X" / "Prenotazione di X" / "Biglietto di X" that open a full-screen viewer. PDFs are rendered to images with pdf.js, which works on iOS.
  - "Cerca posizione e foto" button with toast feedback.
- **Places:**
  - City chips and search.
  - Type chips (Tutto / Da vedere / Mangiare / Esperienze / Negozi). Diet filters (exact match) appear only inside "Mangiare".
  - Status segmented control (Tutti / Da visitare / Visitati / Preferiti) and a "Vicino a me" sort via geolocation.
  - Grid of photo cards on wide screens, list on phones.
- **Shopping:** city chips (city-only items appear in a "Solo a X" section), "per negozio / per tipo" with chips to show a single store or type.
- **Budget:**
  - Totals in the home currency, stacked bar by category and a converter between any two of 166 currencies (open.er-api.com).
  - In-trip expenses.
  - Tourist tax section, which warns about the flat "Tasse di soggiorno" estimate double counting.
- **Profile:** stats including km travelled (flights via layovers using Wikidata airport coords; ground legs >1500 km discarded).
- **Settings:**
  - Home currency, theme (auto/light/dark segmented, fixed this session).
  - Google Places API key field plus a step-by-step guide.
  - Bulk place enrichment, rates refresh, backup export/import (JSON including blobs), wipe.
- **Data:** IndexedDB key `state-v2` with `version` 4 and migrations in `store.ts` `migrate()`. The user's real data lives in their browser, so never change the key; always migrate.
- **Fresh install starts empty.** The Japan trip is NOT in the code (the user asked for this). It lives in the backup file `../viaggi-backup-giappone-2027.json` (outside the repo), loaded via Settings → Ripristina backup. The backup was exported from the user's browser on 2026-10-01 without the two test attachments and with 3 wrong positions reset. `seed.ts` was deleted, and so was the v3 migration that used it.
- **Checks:** `node src/logic.check.ts` passes; `npx tsc -b` and `npm run build` are clean.

**Not working / not verified:**
- **Google Places enrichment** (photos, rating, hours, exact position) is written but **never tested live**: the user has no API key yet. The code is `geo.ts` `googleEnrich()`, which uses Places API (New) `places:searchText` plus photo `media?skipHttpRedirect=true`. CORS behaviour is unverified.
- **"Vicino a me"** is untested: the preview browser gives no geolocation.
- **Not deployed:** the app runs only on `npm run dev`. The repo is private, and GitHub Pages on a private repo requires a paid plan. Consider Cloudflare Pages or Vercel (free, works with private repos) or making the repo public. A PWA needs HTTPS for offline use and Add to Home Screen.
- **No sync:** two travelers cannot share data yet. The planned phase is Firebase Firestore on the free Spark plan; `store.ts` is the single module to swap.
- **Instagram reel recognition** (planned phase 2) is not started. Plan: an iOS Shortcut in the share sheet opens the PWA with the URL, and the Claude API extracts the place from the caption or a screenshot.
- **Places without an address** (e.g. VegOut, Kyoto Bien) are often not found or are misplaced by OpenStreetMap.
- **Hotel names:** the Excel only had Trip.com links, so hotels are titled "Hotel a Tokyo" etc. Stays have no address, so their position falls back to the city centre.

---

## 📁 Relevant Files

| File | Role / Status |
|------|--------------|
| `src/types.ts` | Data model: Trip, Item (one type for all kinds), Doc, Bags, Stop, Settings, Rates |
| `src/store.ts` | State in IndexedDB (idb-keyval) via `useSyncExternalStore`, `migrate()` (v3: Excel data; v4: bags and duration), enrichment queue `enrichTrip`, `enrichOne`, `resolvePlaces`, `resolveTransfers`, photos and files as blobs, backup |
| `src/geo.ts` | Haversine `km`, `nearestOrder`, travel/transfer time estimates, `useMyPosition`, Nominatim (`osmCandidates` with trip bounding box and a 10-minute backoff on 429), Wikidata `airportPos`, `googleEnrich`, `osmEnrich`, `endpointPos` |
| `src/util.ts` | Dates, money/currencies/`convert`, `totals` (includes tourist tax and baggage cost), `stayTax`, `parseBaggage`, labels, maps/route URLs, deadlines and `.ics`, `cmp` |
| `src/ui.tsx` | Components: Sheet (native `<dialog>`), SheetTop, Switch, Segmented, Options, Field, StarBtn, Gallery, FileList/DocCard, Viewer + `useDocOpener`, PdfPages (pdf.js), CurrencyButton, Hosts (`ask()` confirm and `toast()` popover), Top (back via `nav.ts`) |
| `src/nav.ts` | In-app history stack: Back returns to the previous page and its scroll position |
| `src/ItemSheet.tsx` | Detail view and editor for every item kind |
| `src/App.tsx` | Hash router, sidebar, tab bar, theme |
| `src/screens/*.tsx` | Trips, Overview (plus TripSettings for travelers and cities), City, Plan (plus AddChooser), Places, Shopping, Budget (plus TaxSection, Converter), Prep (checklist and docs), Profile, Settings |
| `src/index.css` | Whole design system (tokens with `light-dark()`, glass, layout, components); appended sections per iteration ("Aggiunte v3", "v4") |
| `src/logic.check.ts` | Node self-check of pure logic (`node src/logic.check.ts`) |
| `vite.config.ts` | vite-plugin-pwa; precache up to 5 MB (pdf worker); runtime CacheFirst for Wikimedia and googleusercontent photos |
| `../.claude/launch.json` | Preview config `viaggi`: `npm --prefix app run dev`, port 5173 |

---

## ❌ Failed Attempts

### Native iOS app (SwiftUI)
- **What:** proposed first.
- **Why rejected:** without a paid Apple Developer account the app must be reinstalled every 7 days, which the user refused. The decision is a PWA.

### Opening documents with `window.open(blobURL)` after `await`
- **Why it failed:** browsers block popups that do not come straight from a user gesture, so documents "did not open".
- **Fix:** an in-app viewer, with PDFs rendered by pdf.js.

### Browser `confirm()` / `alert()`
- **Why it failed:** they can be suppressed (e.g. in the embedded preview), so delete "did not work".
- **Fix:** custom `ask()` dialog and `toast()` popover in `ui.tsx`.

### Iframe for PDFs
- **Why it failed:** iOS shows only the first page.
- **Fix:** pdf.js renders pages to images (`PdfPages`).

### Inline-always attachment previews
- **What:** briefly made boarding passes always visible inside the detail.
- **Why reverted:** the user preferred buttons ("Carta d'imbarco di X") that open the viewer. Keep the buttons.

### `localeCompare` for time sort keys with `'~'`
- **Why it failed:** ICU collation puts `'~~'` before digits, so check-in was sorted first.
- **Fix:** `cmp()` code-point compare in `util.ts`.

### Unbounded Nominatim geocoding
- **Why it failed:** "Nara" was found in another country and "Kibune" in the wrong part of Japan, giving durations like 203 h.
- **Fix:** trip bounding box (`tripBox`), candidate closest to the other endpoint (`resolveTransfers`), separate cache key prefix `t:` for transfer endpoints, and `MAX_KM` per mode to self-heal.

### Nominatim rate limit during development
- **Why it failed:** Vite HMR re-executes `store.ts`, which starts new enrichment queues and triggers a 429 without CORS headers (seen as "Failed to fetch").
- **Fix:** global 10-minute backoff (`osmPausedUntil`) and the queue stops on the first error. Avoid many HMR reloads while the queue runs.

### Photon (komoot) geocoder as an alternative
- **Why rejected:** fuzzy and wrong results (Shigetsu was placed in Yawata).

### Grid items overflowing on phones
- **Why it failed:** `.pgrid` was `display: grid` without `minmax(0, 1fr)`, so the star was cut off on iPhone.
- **Fix:** `grid-template-columns: minmax(0, 1fr)`.

### City rail touching the screen edge
- **Why it failed:** scroll-snap ignored the padding.
- **Fix:** `scroll-padding-inline: var(--gutter)`.

### Theme segmented control in Settings
- **Why it failed:** it was inside a flex `.field` and shrank, so the lens was misaligned.
- **Fix:** `.field col` row with `.field .seg { width: 100% }`.

### Wikipedia city images from it.wikipedia
- **Why it failed:** it returns flags.
- **Fix:** en.wikipedia summary first (filter out flag/svg/coat_of_arms), with an it→en langlinks fallback.

---

## ✅ Working Solutions

- **PWA:** Vite + React 19 + TypeScript, no router lib (hash router), no CSS framework; plain CSS tokens with `light-dark()`.
- **Liquid Glass:** web approximation (`.glass`: `backdrop-filter` blur/saturate, specular inset highlight, masked gradient rim). Real refraction needs SVG filters in `backdrop-filter`, which Safari does not support.
- **Fonts and icons:** Bricolage Grotesque Variable (opsz) for display text, SF/system for body; Phosphor icons (duotone for categories).
- **Free services only:**
  - open.er-api.com (rates);
  - Wikipedia REST (city photos);
  - Nominatim (coords, 1 req/s);
  - Wikidata SPARQL (IATA airport coords);
  - Google Maps URLs (directions/search, no key);
  - optional Google Places API key stored on the device.
- **One Item type for every kind** keeps the code small. Budget categories are derived by `budgetCat()`; the tourist tax is computed, not stored as an item.
- **Migrations, not key bumps**, because the user has real data in their browser.

---

## 🔧 Dependencies & Setup

```bash
cd "app viaggi/app"
npm install
npm run dev          # http://localhost:5173 (also on LAN: --host enabled in vite.config)
npm run build        # production build to dist/ (PWA service worker generated)
npx tsc -b           # type-check
node src/logic.check.ts   # logic self-check (Node 24, type stripping)
```

**Important versions:** Node 24, Vite 8, React 19, TypeScript 6, vite-plugin-pwa 1.3, pdfjs-dist 6.3, idb-keyval 6, @phosphor-icons/react 2.1, @fontsource-variable/bricolage-grotesque.
Git identity is set locally in the repo (Edoardo / edoardobirla02@gmail.com). Commit messages end with the Claude co-author line.

---

## ➡️ Next Steps

1. **Deploy** for free with HTTPS so the user can install it on iPhone. Use Cloudflare Pages or Vercel connected to the private repo; `base: './'` is already set. Then test Add to Home Screen, offline use, and the pdf.js worker on iOS Safari.
2. **Google Places key:** guide the user through creating it (the guide text is in Settings), then test `googleEnrich` live. Check CORS on `places:searchText` and the `media?skipHttpRedirect=true` photo URIs, then set quotas and a budget alert.
3. **Sync between the two travelers:** Firebase Firestore (Spark, free) with Google sign-in, replacing persistence in `store.ts`. Store blobs (photos/files) in Firestore docs under 1 MB, or Firebase Storage (needs the Blaze plan with a card; free tier). Keep the JSON backup feature.
4. **Instagram reels (phase 2):** an iOS Shortcut in the share sheet opens the PWA at `#/share?url=…`, then the Claude API extracts the place from the caption, then Places lookup. This needs a small serverless endpoint so the API key is not exposed (e.g. a Cloudflare Worker).
5. **Data cleanup for the user:**
   - rename "Secondo viaggiatore" (trip settings);
   - add real hotel names and addresses (better positions, tax totals);
   - remove the test items "Masaka" (dated 4 May) and "Spostamento Aeroporto → Hotel";
   - the test attachments ("dpi jallow ebrima.pdf", "IMG_0847.JPG") are still in the user's browser on the Roma→Tokyo flight, but excluded from the backup;
   - delete the flat "Tasse di soggiorno" expense once per-stay taxes are entered.
6. **Optional improvements:**
   - a map view (MapLibre with OpenFreeMap tiles, free, no key) using `item.pos`;
   - exact transit times via the Google Routes API when a key is present;
   - a widget or Shortcut for the countdown.

---

## ⚠️ Gotchas / Traps

- **Never put personal trip data in the code** (`seed.ts` was removed on purpose). Old commits in the private repo still contain the seed with trip data; purge the history only if the user asks.
- **Never change the IndexedDB key `state-v2`:** add a `migrate()` step and bump `VERSION` instead.
- **The user's personal data** is in the preview browser's IndexedDB (localhost:5173). Do not wipe it while testing. Revert or cancel test edits; never save fake data into their trip.
- **Respect Nominatim:** max 1 request per second; HMR reloads start parallel queues. If you get 429, wait about 10 minutes.
- **Flight `ref`** holds the airline / flight number (shown as "Compagnia"). The flight `date` is the departure; `endDate` is the arrival.
- **Plan sort keys:** `time ?? '~' + order` (untimed), `'~~'` for check-in (last), check-out uses `endTime ?? '00:00'`. Always sort with `cmp`.
- **Sheets are native `<dialog>`** in the top layer; nested dialogs (currency picker, viewer, confirm) work. The toast uses `popover` so it stays above open dialogs.
- **Screenshots in the preview pane** are often taken mid-animation (blank or blurred); take a second screenshot before assuming a bug.
- **Write UI copy in Italian**, no em dashes, premium tone. The user dislikes visible "AI" defaults and wants Plotline-like polish.
- **The user prefers no questions** when they are away: make sensible defaults and report them.

---

## 💬 Notes

- The orange/blue ambient gradient on the background is intentional (it gives the glass something to blur). The user asked about it; they may want it subtler or removed.
- Travel time estimates are straight-line distance divided by a mode speed, plus overhead. Accurate times come from the "Percorso" Google Maps link.
- Diet flags for some seed restaurants come from general knowledge (T's TanTan, Komeda Is, Shigetsu…); "Da verificare" means unknown.
- Open question for the user: should "Vicino a me" also appear as a section on the city dashboard? Should hotels be geocoded from the Trip.com hotel name once known?
