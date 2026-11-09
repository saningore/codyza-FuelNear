import { readFileSync } from "node:fs";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 18)) {
  console.error(`Node.js 20.18 or newer is required. This process is ${process.versions.node}.`);
  process.exit(1);
}

if (process.env.FUELNEAR_USE_FIXTURES === "1") {
  console.error("FuelNear refuses sample stations. Unset FUELNEAR_USE_FIXTURES.");
  process.exit(1);
}

const zcta = JSON.parse(readFileSync(new URL("../data/zcta.json", import.meta.url), "utf8"));
const places = JSON.parse(readFileSync(new URL("../data/places.json", import.meta.url), "utf8"));
const zctaCount = Object.keys(zcta.centroids ?? {}).length;
const placeCount = (places.places ?? []).length;
if (zctaCount < 30000 || placeCount < 20000) {
  console.error(`Gazetteer is incomplete: ${zctaCount} ZIP centers, ${placeCount} places.`);
  process.exit(1);
}
const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const query = '[out:json][timeout:20];node["amenity"="fuel"](around:500,40.7506,-73.9973);out tags 1;';
let liveError = null;
for (const endpoint of endpoints) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "FuelNear/1.0 (https://codyza.com)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${endpoint}`);
    const body = await response.json();
    if (!Array.isArray(body.elements)) throw new Error(`OpenStreetMap did not return a station list from ${endpoint}.`);
    console.log(`Live OpenStreetMap read succeeded (${body.elements.length} sample station node${body.elements.length === 1 ? "" : "s"}).`);
    liveError = null;
    break;
  } catch (error) {
    liveError = error;
  }
}
if (liveError) {
  console.error(liveError instanceof Error ? liveError.message : liveError);
  process.exit(1);
}
console.log(`Ready: ${zctaCount} ZIP centers, ${placeCount} places. Stations are read live from OpenStreetMap.`);
process.exit(0);
