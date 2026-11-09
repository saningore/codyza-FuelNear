const SHELL = "fuelnear-shell-v1";
const DATA = "fuelnear-data-v1";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(["/", "/sources", "/about", "/saved", "/manifest.webmanifest"].map(async (path) => {
      try {
        await cache.add(path);
      } catch {
        // A missing shell page should not block the worker.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== SHELL && key !== DATA).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (event.request.mode !== "navigate") return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      const cache = await caches.open(SHELL);
      cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await caches.match(event.request);
      return cached || caches.match("/") || Response.error();
    }
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "cache-search" && data.result && typeof data.result === "object") {
    event.waitUntil(caches.open(DATA).then((cache) => cache.put(
      new Request("/offline-station-search"),
      new Response(JSON.stringify(data.result), { headers: { "Content-Type": "application/json" } }),
    )));
  }
  if (data.type === "watch" && Array.isArray(data.locations)) {
    const seen = Array.isArray(data.seen) ? data.seen.filter((item) => typeof item === "string").slice(-200) : [];
    event.waitUntil(writeValue("watch", { locations: data.locations.slice(0, 5), seen }));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "fuelnear-prices") event.waitUntil(checkWatched());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";
  event.waitUntil(self.clients.openWindow(target));
});

async function checkWatched() {
  const watch = await readValue("watch");
  if (!watch || !Array.isArray(watch.locations)) return;
  const seen = new Set(Array.isArray(watch.seen) ? watch.seen : []);
  const nextSeen = [...seen];
  let seeded = seen.size === 0;
  for (const location of watch.locations.slice(0, 5)) {
    if (!location || location.notify !== true || location.mode === "alternative") continue;
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    const radius = Number(location.radius);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius)) continue;
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      radius: String(radius),
      precision: typeof location.precision === "string" ? location.precision : "address",
      label: typeof location.label === "string" ? location.label : "Saved location",
      mode: "gasoline",
    });
    if (typeof location.state === "string" && location.state) params.set("state", location.state);
    let response;
    try {
      response = await fetch(`/api/stations?${params.toString()}`, { cache: "no-store" });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const report = await response.json();
    const snaps = listedSnaps(report.stations);
    for (const snap of snaps) {
      const id = fingerprint(snap);
      if (seen.has(id)) continue;
      seen.add(id);
      nextSeen.push(id);
      if (seeded) continue;
      const dollars = `$${snap.amount.toFixed(3)} / gallon`;
      await self.registration.showNotification(`${snap.name}: listed price`, {
        body: `${dollars}, ${snap.label}. Updated ${snap.updateTime}. Source: Google Places.`.slice(0, 240),
        tag: id,
        data: { url: `/?${new URLSearchParams({ q: params.get("label") || "", radius: String(radius), mode: "gasoline" }).toString()}` },
      });
    }
  }
  await writeValue("watch", { locations: watch.locations, seen: nextSeen.slice(-200) });
}

function listedSnaps(stations) {
  if (!Array.isArray(stations)) return [];
  const snaps = [];
  for (const station of stations) {
    if (!station || typeof station.id !== "string" || typeof station.name !== "string" || !Array.isArray(station.prices)) continue;
    for (const price of station.prices) {
      const amount = Number(price?.amount);
      if (!price || price.source !== "Google Places" || price.currency !== "USD") continue;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (typeof price.updateTime !== "string" || !price.updateTime.trim()) continue;
      if (typeof price.label !== "string" || !price.label.trim()) continue;
      snaps.push({
        stationId: station.id,
        name: station.name,
        label: price.label,
        amount,
        updateTime: price.updateTime,
      });
    }
  }
  return snaps;
}

function fingerprint(snap) {
  return `${snap.stationId}|${snap.label}|${snap.amount}|${snap.updateTime}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fuelnear", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("kv")) request.result.createObjectStore("kv");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readValue(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("kv", "readonly");
    const request = transaction.objectStore("kv").get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeValue(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("kv", "readwrite");
    transaction.objectStore("kv").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
