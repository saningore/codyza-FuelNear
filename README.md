# FuelNear

FuelNear finds real U.S. gas stations and shows a pump price only when Google Places publishes one.

Search uses:

- OpenStreetMap `amenity=fuel` records for the station name, address, phone, hours, and fuel tags
- The U.S. Census Bureau geocoder and 2025 Gazetteer for addresses, cities, and ZIP code centers
- Google Places `fuelOptions`, when `GOOGLE_MAPS_API_KEY` is set, for a price with its update time
- The U.S. Energy Information Administration weekly retail average, when `EIA_API_KEY` is set, labeled as an area average
- The Department of Energy Alternative Fuel Stations API, when `NREL_API_KEY` is set, in the separate Alternative fuels search
- OSRM for driving distance and a route

If a current station price is not returned, the page says `Current fuel price unavailable.` FuelNear does not estimate a price. OpenStreetMap price tags are not shown. An empty result means no station was returned for that point and radius. It is not a claim that no station exists farther away.

A ZIP search uses the Census center of the ZIP code. The gazetteer files are centers, not ZIP boundaries, so FuelNear does not draw a ZIP shape it does not have. A station inside that ZIP but farther than the selected radius from the center is not listed. A station outside the ZIP can appear when it is inside the radius. City searches use the Census place center and say so. Raise the radius to 10 or 25 miles when a center-only search is too small.

Up to five locations can be saved in this browser. You can ask this browser to notify you when Google Places returns a pump price that was not already shown for a saved gasoline search. The notification repeats the station name, the amount, the fuel, and the update time. A missing price does not send a notification.

## Requirements

- Node.js 20.18 or newer
- npm

Optional keys belong in `.env.local`, which is not committed:

```
GOOGLE_MAPS_API_KEY=
EIA_API_KEY=
NREL_API_KEY=
```

Without `GOOGLE_MAPS_API_KEY`, station search still works and every pump price says it is unavailable. Without `EIA_API_KEY`, the area average is omitted. Without `NREL_API_KEY`, the Alternative fuels search says that source is not configured. The server calls OpenStreetMap, Census, OSRM, and any configured provider with the User-Agent `FuelNear/1.0 (https://codyza.com)`.

`FUELNEAR_USE_FIXTURES=1` is refused. The server will not start with sample stations. `FUELNEAR_CACHE=0` turns off the on-disk copy of upstream responses.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and search `10001`, `60601`, or `77002`.

The Census ZIP and place files already live in `data/zcta.json` and `data/places.json`. `npm run geography` rebuilds them.

## Rate limits

Limits are counted in memory on one server process, per client address (`x-forwarded-for`, otherwise `local`):

- Geocoding: 30 requests per minute
- Station searches: 20 requests per minute
- Driving routes: 12 requests per minute

A limit that is reached returns HTTP 429 and does not invent a station or a price. The count does not carry across separate server instances or a restart.

## Caching

- OpenStreetMap station lists and a single station record can be reused on that server for 6 hours. A Google Places price list can be reused for 30 minutes. An EIA area average can be reused for 12 hours. A station price is dropped when the stored station record is older than 6 hours, so an old Google price is not shown as current.
- NREL and OSRM responses are not given a FuelNear cache lifetime.
- Disk cache files live in `data/cache/` and are not used under Vitest or when `FUELNEAR_CACHE=0`.
- Responses from `/api/geocode`, `/api/stations`, `/api/drive`, `/api/area-price`, `/api/health`, and `/api/ready` use `Cache-Control: no-store`, so the browser does not treat them as a fresh lookup.
- After a search, the page keeps that result for 20 seconds in `sessionStorage`. Opening the same shared link again in that window does not send a second station request.
- The last successful search is also stored in `localStorage` and in the service worker cache. If the network fails, the page shows that copy with the time it was retrieved and says the sources were not contacted again.
- The service worker caches the app shell for offline opening. It does not answer `/api/*` from cache, so a cached payload is never returned as a new search.

## Notifications and offline

The web app manifest and service worker are served at `/manifest.webmanifest` and `/sw.js`. The worker caches the shell and the last station search. Background checks use Periodic Background Sync when the browser grants it, about every 15 minutes, for saved gasoline searches you turned on. While the page is open, those saved searches are checked about every 10 minutes.

Notifications are sent only for a Google Places price whose station, fuel, amount, and update time were not already marked as seen. Prices on screen when you turn notifications on are marked as seen, so the page does not notify you about a price that is already listed. Area averages and alternative-fuel sites do not send notifications.

## Checks

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run check:ready
npm run build
```

`npm test` covers the price rule, distance, hours, price notifications, and the local gazetteer. The integration test also reads live OpenStreetMap stations near ZIP 10001. `npm run test:e2e` searches that ZIP in a browser. `npm run check:ready` confirms the gazetteer files and one live OpenStreetMap read.

Powered by Codyza.
