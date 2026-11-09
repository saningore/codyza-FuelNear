"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { AreaPrice } from "@/components/AreaPrice";
import ResultsMap from "@/components/ResultsMap";
import { RoutePlanner } from "@/components/RoutePlanner";
import { StationCard } from "@/components/StationCard";
import { readOfflineSearch, readPlaces, readRecentByLabel, readSeenPrices, storeSearch, writePlaces, writeSeenPrices } from "@/lib/browser-store";
import { formatGallonPrice, formatUpdated } from "@/lib/format";
import { stationAddress } from "@/lib/normalize";
import { readSaved, writeSaved } from "@/lib/saved";
import { RADII, type SearchOrigin, type SearchResponse, type SortKey, type Station } from "@/lib/types";
import { EMPTY_FILTERS, filterStations, hiddenBecause, rememberSaved, sortStations, type StationFilters } from "@/lib/view";
import { listedPriceSnaps, placeKey, priceFingerprint, rememberPlace, rememberSeen, samePoint, unseenPriceChanges, type ListedPriceSnap, type SavedPlace } from "@/lib/watch";

type Suggestion = SearchOrigin;

const FUELS = ["Regular unleaded", "Midgrade", "Premium", "Diesel", "E85", "Truck diesel"];
const AMENITIES = ["Convenience store", "Car wash", "Truck diesel", "Wheelchair access", "Truck access"];
const OFFLINE_COPY = "This is a saved search, not a new search. OpenStreetMap, Google Places, and the other sources were not contacted again.";
const NOTIFY_NOTE = "A notification repeats a Google Places pump price that was not already shown: station, amount, fuel, and update time. A missing price does not send one, and FuelNear does not estimate a price.";

export default function SearchExperience() {
  const listId = useId();
  const requestId = useRef(0);
  const started = useRef(false);
  const resultRef = useRef<SearchResponse | null>(null);
  const placesRef = useRef<SavedPlace[]>([]);
  const seenRef = useRef<string[]>([]);
  const initialized = useRef(new Set<string>());
  const searchAtRef = useRef<(next: SearchOrigin, nextRadius: number, nextMode: "gasoline" | "alternative", reason: "search" | "refresh") => Promise<void>>(async () => undefined);
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(5);
  const [mode, setMode] = useState<"gasoline" | "alternative">("gasoline");
  const [sort, setSort] = useState<SortKey>("distance");
  const [filters, setFilters] = useState<StationFilters>(EMPTY_FILTERS);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [origin, setOrigin] = useState<SearchOrigin | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [phase, setPhase] = useState<"idle" | "searching">("idle");
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const [notifyNote, setNotifyNote] = useState("");

  function applyResult(payload: SearchResponse, nextRadius: number, nextMode: "gasoline" | "alternative", cached: boolean) {
    setResult(payload);
    resultRef.current = payload;
    setOrigin(payload.origin);
    setFromCache(cached);
    setFrameKey(`${payload.origin.latitude.toFixed(4)}:${payload.origin.longitude.toFixed(4)}:${nextRadius}:${nextMode}:${payload.retrievedAt}`);
  }

  async function searchAt(next: SearchOrigin, nextRadius = radius, nextMode = mode, reason: "search" | "refresh" = "search") {
    const id = ++requestId.current;
    if (reason === "search") {
      setPhase("searching");
      setError("");
      setFromCache(false);
      setRefreshNote("");
      setActiveId(null);
      setOpen(false);
    }
    setOrigin(next);
    const params = new URLSearchParams({
      lat: String(next.latitude),
      lon: String(next.longitude),
      radius: String(nextRadius),
      precision: next.precision,
      label: next.label,
      mode: nextMode,
    });
    if (next.state) params.set("state", next.state);
    if (next.accuracyMeters) params.set("accuracy", String(next.accuracyMeters));
    try {
      const response = await fetch(`/api/stations?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(payload.error || "Gas station records could not be loaded. Try again in a few minutes.");
      const body = payload as SearchResponse;
      applyResult(body, nextRadius, nextMode, false);
      storeSearch(body, nextRadius, nextMode);
      observe(body, nextRadius, nextMode);
      if (reason === "search") {
        const url = new URLSearchParams({ q: next.label, radius: String(nextRadius), mode: nextMode, sort });
        window.history.replaceState(null, "", `/?${url}`);
      }
      setRefreshNote("");
    } catch (caught) {
      if (id !== requestId.current) return;
      const message = caught instanceof Error ? caught.message : "Gas station records could not be loaded. Try again in a few minutes.";
      const cached = readOfflineSearch(next, nextRadius, nextMode);
      if (reason === "refresh" && resultRef.current) {
        setFromCache(true);
        setRefreshNote(`Could not refresh. Showing results retrieved at ${formatUpdated(resultRef.current.retrievedAt, null)} UTC. ${OFFLINE_COPY}`);
      } else if (cached) {
        applyResult(cached, nextRadius, nextMode, true);
        setError("");
      } else if (reason === "search") {
        setResult(null);
        resultRef.current = null;
        setError(message);
      }
    } finally {
      if (id === requestId.current && reason === "search") setPhase("idle");
    }
  }
  searchAtRef.current = searchAt;

  async function searchText(text: string, nextRadius = radius, nextMode = mode) {
    setPhase("searching");
    setError("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "That location could not be found. Try a street address or another ZIP code.");
      setQuery(payload.label);
      await searchAt(payload as SearchOrigin, nextRadius, nextMode);
    } catch (caught) {
      setPhase("idle");
      setResult(null);
      resultRef.current = null;
      setError(caught instanceof Error ? caught.message : "That location could not be found. Try a street address or another ZIP code.");
    }
  }

  function observe(body: SearchResponse, nextRadius: number, nextMode: "gasoline" | "alternative") {
    const watched = placesRef.current.some((item) => item.notify && samePoint(item, body.origin) && item.radius === nextRadius && item.mode === nextMode);
    if (!watched) return;
    const key = placeKey(body.origin, nextRadius, nextMode);
    const snaps = listedPriceSnaps(body.stations);
    if (!initialized.current.has(key)) {
      initialized.current.add(key);
      seenRef.current = rememberSeen(seenRef.current, snaps);
      writeSeenPrices(seenRef.current);
      postWatch();
      return;
    }
    const fresh = unseenPriceChanges(snaps, seenRef.current);
    seenRef.current = rememberSeen(seenRef.current, snaps);
    writeSeenPrices(seenRef.current);
    postWatch();
    for (const snap of fresh) showPriceNotification(snap);
  }

  function postWatch(list = placesRef.current) {
    navigator.serviceWorker?.controller?.postMessage({
      type: "watch",
      locations: list.filter((item) => item.notify).slice(0, 5),
      seen: seenRef.current.slice(-200),
    });
  }

  function persistPlaces(next: SavedPlace[]) {
    const stored = next.slice(0, 5);
    setPlaces(stored);
    placesRef.current = stored;
    writePlaces(stored);
    postWatch(stored);
  }

  useEffect(() => {
    seenRef.current = readSeenPrices();
    const stored = readPlaces();
    placesRef.current = stored;
    setPlaces(stored);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    if (!initial) return;
    setQuery(initial);
    const initialRadius = Number(params.get("radius"));
    const radiusMiles = RADII.includes(initialRadius as (typeof RADII)[number]) ? initialRadius : 5;
    if (RADII.includes(initialRadius as (typeof RADII)[number])) setRadius(initialRadius);
    const initialMode = params.get("mode") === "alternative" ? "alternative" : "gasoline";
    setMode(initialMode);
    const recent = readRecentByLabel(initial, radiusMiles, initialMode);
    if (recent) {
      applyResult(recent, radiusMiles, initialMode, false);
      setPhase("idle");
      return;
    }
    void searchText(initial, radiusMiles, initialMode);
    // The shared link should search once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const current = resultRef.current;
      const watched = placesRef.current.filter((item) => item.notify);
      for (const place of watched) {
        const originForPlace: SearchOrigin = {
          label: place.label,
          latitude: place.latitude,
          longitude: place.longitude,
          precision: place.precision,
          state: place.state,
        };
        const showingThisPlace = current && samePoint(current.origin, place) && place.radius === radius && place.mode === mode;
        if (showingThisPlace) {
          void searchAtRef.current(current.origin, place.radius, place.mode, "refresh");
          continue;
        }
        void fetchQuiet(originForPlace, place.radius, place.mode);
      }
    }, 600_000);
    return () => window.clearInterval(timer);
    // The interval reads the latest result and saved places from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, mode]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?suggest=1&q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!controller.signal.aborted) setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  async function fetchQuiet(next: SearchOrigin, nextRadius: number, nextMode: "gasoline" | "alternative") {
    const params = new URLSearchParams({
      lat: String(next.latitude),
      lon: String(next.longitude),
      radius: String(nextRadius),
      precision: next.precision,
      label: next.label,
      mode: nextMode,
    });
    if (next.state) params.set("state", next.state);
    try {
      const response = await fetch(`/api/stations?${params}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as SearchResponse;
      if (!body?.origin || !Array.isArray(body.stations)) return;
      observe(body, nextRadius, nextMode);
    } catch {
      return;
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      const suggestion = suggestions[activeSuggestion];
      setQuery(suggestion.label);
      await searchAt(suggestion);
      return;
    }
    await searchText(query);
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("Location permission was not granted. Enter a ZIP code or street address.");
      return;
    }
    setPhase("searching");
    setError("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const params = new URLSearchParams({
          lat: String(position.coords.latitude),
          lon: String(position.coords.longitude),
          accuracy: String(position.coords.accuracy),
        });
        const response = await fetch(`/api/geocode?${params}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "That location could not be found. Try a street address or another ZIP code.");
        setQuery(payload.label);
        await searchAt(payload as SearchOrigin);
      } catch (caught) {
        setPhase("idle");
        setError(caught instanceof Error ? caught.message : "That location could not be found. Try a street address or another ZIP code.");
      }
    }, () => {
      setPhase("idle");
      setError("Location permission was not granted. Enter a ZIP code or street address.");
    }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 });
  }

  function save(station: Station) {
    const next = rememberSaved(readSaved(), {
      id: station.id,
      name: station.name,
      address: stationAddress(station),
      phone: station.phone,
      latitude: station.latitude,
      longitude: station.longitude,
      prices: station.prices,
      savedAt: new Date().toISOString(),
    });
    writeSaved(next);
    setSavedNote(`${station.name} saved on this device.`);
  }

  function saveLocation() {
    if (!result) return;
    persistPlaces(rememberPlace(placesRef.current, {
      label: result.origin.label,
      latitude: result.origin.latitude,
      longitude: result.origin.longitude,
      precision: result.origin.precision,
      state: result.origin.state,
      radius,
      mode,
    }));
    setSavedNote("Location saved on this device.");
  }

  async function toggleNotify() {
    if (!result || mode !== "gasoline") return;
    const current = placesRef.current.find((item) => samePoint(item, result.origin) && item.radius === radius && item.mode === mode);
    if (current?.notify) {
      persistPlaces(placesRef.current.map((item) => samePoint(item, result.origin) && item.radius === radius && item.mode === mode ? { ...item, notify: false } : item));
      setNotifyNote("Notifications are off for this location.");
      return;
    }
    if (!("Notification" in window)) {
      setNotifyNote("This browser does not support notifications. You can still save the location on this device.");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      setNotifyNote("Notification permission was denied. FuelNear will not send a browser notification.");
      return;
    }
    const nextPlace: SavedPlace = {
      label: result.origin.label,
      latitude: result.origin.latitude,
      longitude: result.origin.longitude,
      precision: result.origin.precision,
      state: result.origin.state,
      radius,
      mode,
      notify: true,
    };
    const key = placeKey(result.origin, radius, mode);
    initialized.current.add(key);
    seenRef.current = rememberSeen(seenRef.current, listedPriceSnaps(result.stations));
    writeSeenPrices(seenRef.current);
    persistPlaces(rememberPlace(placesRef.current, nextPlace));
    const background = await registerPeriodic();
    setNotifyNote(background
      ? "Notifications are on. Prices already on screen are marked as seen. A new Google Places price can notify this browser while the page is open, and in the background when the browser allows it."
      : "Notifications are on while this page is open. Prices already on screen are marked as seen. This browser did not allow a background check.");
  }

  const stations = result?.stations ?? [];
  const visible = useMemo(() => sortStations(filterStations(stations, filters), sort), [stations, filters, sort]);
  const notes = result ? hiddenBecause(stations, filters) : [];
  const brands = [...new Set(stations.map((station) => station.brand).filter((brand): brand is string => Boolean(brand)))].sort();
  const watching = Boolean(result && places.some((item) => item.notify && samePoint(item, result.origin) && item.radius === radius && item.mode === mode));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="max-w-3xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Find gas stations near a real U.S. location.</h1>
        <p className="mt-3 text-lg text-ink/80">Stations come from OpenStreetMap. A pump price is shown only when Google Places publishes the amount, the fuel, and the time it was updated.</p>
      </section>
      <form className="mt-6 rounded-3xl border border-line bg-card p-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`rounded-full px-4 py-2 font-bold ${mode === "gasoline" ? "bg-asphalt text-card" : "bg-mist"}`} aria-pressed={mode === "gasoline"} onClick={() => { setMode("gasoline"); if (origin) void searchAt(origin, radius, "gasoline"); }}>Gasoline and diesel</button>
          <button type="button" className={`rounded-full px-4 py-2 font-bold ${mode === "alternative" ? "bg-asphalt text-card" : "bg-mist"}`} aria-pressed={mode === "alternative"} onClick={() => { setMode("alternative"); if (origin) void searchAt(origin, radius, "alternative"); }}>Alternative fuels</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_9rem_auto]">
          <label className="relative">
            <span className="mb-1 block text-sm font-bold">ZIP code, city, or street address</span>
            <input
              className="w-full rounded-2xl border border-line bg-paper px-3 py-3"
              value={query}
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveSuggestion(-1); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveSuggestion((current) => Math.max(current - 1, 0));
                } else if (event.key === "Escape") setOpen(false);
              }}
            />
            {open && suggestions.length > 0 ? (
              <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-line bg-card shadow">
                {suggestions.map((suggestion, index) => (
                  <li key={`${suggestion.label}-${suggestion.latitude}`} role="option" aria-selected={index === activeSuggestion}>
                    <button type="button" className={`block w-full px-3 py-2 text-left ${index === activeSuggestion ? "bg-mist" : ""}`} onMouseDown={(event) => { event.preventDefault(); setQuery(suggestion.label); setOpen(false); void searchAt(suggestion); }}>
                      {suggestion.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Search radius</span>
            <select className="w-full rounded-2xl border border-line bg-paper px-3 py-3" value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
              {RADII.map((miles) => <option key={miles} value={miles}>{miles} miles</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded-full bg-pump px-4 py-3 font-bold text-card disabled:opacity-60" type="submit" disabled={phase === "searching"}>Search</button>
            <button className="rounded-full border border-line px-4 py-3 font-bold" type="button" onClick={locate}>Use my location</button>
          </div>
        </div>
      </form>
      {error ? <p className="mt-4 rounded-2xl bg-mist px-4 py-3 font-bold" role="alert">{error}</p> : null}
      {savedNote ? <p className="mt-3 text-sm" role="status">{savedNote}</p> : null}
      {places.length ? (
        <div className="mt-4">
          <h2 className="text-sm font-bold">Saved on this device</h2>
          <p className="text-sm text-ink/70">Saved in this browser only. This is not an account. The last successful search can stay on this device and is labeled with the time it was retrieved.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {places.map((item) => (
              <li key={placeKey(item, item.radius, item.mode)} className="flex items-center gap-1 rounded-full bg-mist px-2 py-1">
                <button type="button" className="min-h-11 px-2 font-bold" onClick={() => { setRadius(item.radius); setMode(item.mode); void searchAt(item, item.radius, item.mode); }}>{item.label}{item.notify ? " · notifications on" : ""}</button>
                <button type="button" className="min-h-11 px-2 text-sm" onClick={() => persistPlaces(placesRef.current.filter((savedItem) => placeKey(savedItem, savedItem.radius, savedItem.mode) !== placeKey(item, item.radius, item.mode)))} aria-label={`Remove ${item.label}`}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {phase === "searching" ? <p className="mt-4 font-bold" role="status">Searching for gas stations…</p> : null}

      {!result && phase === "idle" && !error ? (
        <p className="mt-8 text-lg">Search a place to see gas stations. The map stays empty until you do.</p>
      ) : null}

      {result ? (
        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl font-semibold">{visible.length} {mode === "alternative" ? "alternative-fuel sites" : "gas stations"} within {radius} miles of {result.origin.label}</h2>
              <p className="mt-1 text-sm">{result.directoryNote}</p>
              {result.origin.precision === "zip-center" ? <p className="mt-1">Distances are measured from the center of this ZIP code.</p> : null}
              {result.origin.precision === "zip-center" ? <p className="mt-1">The Census files used here are ZIP centers, not ZIP boundaries. A station inside this ZIP but farther than {radius} miles from the center is not listed. A station outside the ZIP can appear when it is inside that radius.</p> : null}
              {result.origin.precision === "place" ? <p className="mt-1">Distances are measured from the center of this place. A station inside the place but farther than {radius} miles from that center is not listed.</p> : null}
              {result.origin.precision === "device" && (result.origin.accuracyMeters ?? 0) > 1000 ? <p className="mt-1">Your device location is approximate (±{Math.round(result.origin.accuracyMeters ?? 0)} m). Distance is measured from that point.</p> : null}
              {result.priceSource === "unavailable" && mode === "gasoline" ? <p className="mt-1">Pump prices appear when Google Places returns them.</p> : null}
              {result.capped ? <p className="mt-1">Showing the 50 nearest records.</p> : null}
              <p className="mt-2 text-sm">{NOTIFY_NOTE}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-full border border-line px-4 font-bold" onClick={saveLocation}>Save this location</button>
              {mode === "gasoline" ? (
                <button type="button" className="min-h-11 max-w-full whitespace-normal rounded-full border border-pump px-4 text-left font-bold" onClick={() => void toggleNotify()}>
                  {watching ? "Stop price notifications" : "Notify me when a published pump price changes"}
                </button>
              ) : null}
              <div className="flex gap-2 lg:hidden" role="group" aria-label="Results view">
                <button type="button" className="rounded-full bg-mist px-3 py-2 font-bold" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
                <button type="button" className="rounded-full bg-mist px-3 py-2 font-bold" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
              </div>
            </div>
          </div>
          {notifyNote ? <p className="mt-3 text-sm font-bold">{notifyNote}</p> : null}
          {refreshNote ? <p className="mt-3 rounded-2xl bg-[#fff6e8] px-4 py-3 font-bold" role="status">{refreshNote}</p> : null}
          {fromCache ? <p className="mt-3 rounded-2xl bg-[#fff6e8] px-4 py-3 font-bold" role="status">Retrieved {formatUpdated(result.retrievedAt, null)} UTC. {OFFLINE_COPY}</p> : null}
          {result.warnings.map((warning) => <p key={warning.source} className="mt-3 rounded-2xl bg-mist px-4 py-3" role="status">{warning.message}</p>)}
          {result.areaPrice ? <div className="mt-4"><AreaPrice area={result.areaPrice} /></div> : null}
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label>
              <span className="mb-1 block text-sm font-bold">Sort</span>
              <select className="w-full rounded-2xl border border-line bg-card px-3 py-3" value={sort} aria-label="Sort" onChange={(event) => setSort(event.target.value as SortKey)}>
                <option value="distance">Nearest driving distance</option>
                <option value="straight">Straight-line distance</option>
                <option value="price">Lowest listed price</option>
                <option value="brand">Name</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold">Fuel</span>
              <select className="w-full rounded-2xl border border-line bg-card px-3 py-3" value={filters.fuel} aria-label="Fuel" onChange={(event) => setFilters({ ...filters, fuel: event.target.value })}>
                <option value="">All listed fuels</option>
                {FUELS.map((fuel) => <option key={fuel}>{fuel}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold">Brand</span>
              <select className="w-full rounded-2xl border border-line bg-card px-3 py-3" value={filters.brand} aria-label="Brand" onChange={(event) => setFilters({ ...filters, brand: event.target.value })}>
                <option value="">All brands</option>
                {brands.map((brand) => <option key={brand}>{brand}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold">Amenity</span>
              <select className="w-full rounded-2xl border border-line bg-card px-3 py-3" value={filters.amenity} aria-label="Amenity" onChange={(event) => setFilters({ ...filters, amenity: event.target.value })}>
                <option value="">Any listed amenity</option>
                {AMENITIES.map((amenity) => <option key={amenity}>{amenity}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
            <label className="flex items-center gap-2"><input type="checkbox" checked={filters.openNow} onChange={(event) => setFilters({ ...filters, openNow: event.target.checked })} /> Open now</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={filters.pricedOnly} onChange={(event) => setFilters({ ...filters, pricedOnly: event.target.checked })} /> Has a listed price</label>
          </div>
          {sort === "price" ? <p className="mt-2 text-sm">Stations without a listed price stay at the bottom.</p> : null}
          {notes.map((note) => <p key={note} className="mt-1 text-sm">{note}</p>)}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className={view === "map" ? "hidden lg:block" : "block"}>
              {visible.length === 0 ? <p className="rounded-3xl border border-line bg-card p-5">{stations.length === 0 ? `No gas stations were found within ${radius} miles of ${result.origin.label}.` : "No stations match these filters."}</p> : null}
              <ul className="space-y-3" aria-label="Nearby stations">
                {visible.map((station) => (
                  <li key={station.id}>
                    <StationCard station={station} area={result.areaPrice} active={station.id === activeId} onActive={setActiveId} onSave={save} />
                  </li>
                ))}
              </ul>
            </div>
            <div className={view === "list" ? "hidden lg:block" : "block"}>
              <ResultsMap origin={result.origin} stations={visible} activeId={activeId} frameKey={frameKey} onActiveId={setActiveId} />
              {result.stations.some((station) => station.googlePlaceId) ? <p className="mt-2 text-sm">Place details and fuel prices © Google.</p> : null}
            </div>
          </div>
          {mode === "gasoline" ? <RoutePlanner origin={result.origin} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function showPriceNotification(snap: ListedPriceSnap) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const body = `${formatGallonPrice(snap.amount)}, ${snap.label}. Updated ${snap.updateTime}. Source: Google Places.`;
  new Notification(`${snap.name}: listed price`, { body: body.slice(0, 240), tag: priceFingerprint(snap) });
}

async function registerPeriodic(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const periodic = (registration as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
    }).periodicSync;
    if (!periodic) return false;
    await periodic.register("fuelnear-prices", { minInterval: 15 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}
