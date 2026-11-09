import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { inflateRawSync } from "node:zlib";

const root = process.cwd();
const rawDir = path.join(root, "data", "raw");
const dataDir = path.join(root, "data");
const ZCTA_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip";
const PLACE_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip";

await mkdir(rawDir, { recursive: true });

async function download(url, destination) {
  console.log("Downloading", url);
  const response = await fetch(url, { headers: { "User-Agent": "FuelNear/1.0 (https://codyza.com)" } });
  if (!response.ok || !response.body) throw new Error(`Download failed ${response.status} ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

function parsePipe(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split("|").map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split("|");
    const record = {};
    header.forEach((name, index) => { record[name] = (cells[index] ?? "").trim(); });
    return record;
  });
}

async function ensureZip(name, url) {
  const zipPath = path.join(rawDir, name);
  try {
    const info = await stat(zipPath);
    if (info.size > 1000) return zipPath;
  } catch { /* download below */ }
  await download(url, zipPath);
  return zipPath;
}

async function unzip(zipPath) {
  const zip = await readFile(zipPath);
  if (zip.length < 22 || zip.readUInt32LE(0) !== 0x04034b50) throw new Error(`Downloaded file is not a ZIP archive: ${zipPath}`);
  let directory = -1;
  const scanFrom = Math.max(0, zip.length - 22 - 65535);
  for (let index = zip.length - 22; index >= scanFrom; index -= 1) {
    if (zip.readUInt32LE(index) === 0x06054b50) { directory = index; break; }
  }
  if (directory < 0) throw new Error(`ZIP directory is missing: ${zipPath}`);
  const count = zip.readUInt16LE(directory + 10);
  let cursor = zip.readUInt32LE(directory + 16);
  for (let entry = 0; entry < count; entry += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Unexpected ZIP entry in ${zipPath}`);
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/")) continue;
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const bytes = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (!bytes) throw new Error(`Unsupported ZIP compression for ${name}`);
    await writeFile(path.join(rawDir, path.basename(name)), bytes);
  }
}

const zctaZip = await ensureZip("zcta.zip", ZCTA_URL);
const placeZip = await ensureZip("places.zip", PLACE_URL);
await unzip(zctaZip);
await unzip(placeZip);

const zctaRows = parsePipe(await readFile(path.join(rawDir, "2025_Gaz_zcta_national.txt"), "utf8"));
const zcta = {};
for (const row of zctaRows) {
  const lat = Number(row.INTPTLAT);
  const lon = Number(row.INTPTLONG);
  if (/^\d{5}$/.test(row.GEOID) && Number.isFinite(lat) && Number.isFinite(lon)) {
    zcta[row.GEOID] = [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5];
  }
}
await writeFile(path.join(dataDir, "zcta.json"), JSON.stringify({
  source: "U.S. Census Bureau 2025 Gazetteer ZIP Code Tabulation Areas",
  url: "https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html",
  retrievedAt: new Date().toISOString(),
  centroids: zcta,
}));
console.log("ZCTA centroids", Object.keys(zcta).length);

const placeRows = parsePipe(await readFile(path.join(rawDir, "2025_Gaz_place_national.txt"), "utf8"));
const best = new Map();
for (const row of placeRows) {
  if (row.FUNCSTAT === "I") continue;
  const lat = Number(row.INTPTLAT);
  const lon = Number(row.INTPTLONG);
  const sqmi = Number(row.ALAND_SQMI);
  if (!row.USPS || !row.NAME || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const base = row.NAME.replace(/\s+(city|town|village|cdp|borough|municipality|comunidad|zona urbana|urbanizacion|barrio-pueblo|unified government)$/i, "").trim();
  const key = `${row.USPS}|${base.toUpperCase()}`;
  const candidate = { s: row.USPS, n: base, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, a: Number.isFinite(sqmi) ? Math.round(sqmi * 10) / 10 : 0, cdp: /cdp/i.test(row.NAME) || row.LSAD === "57" };
  const current = best.get(key);
  if (!current || candidate.a > current.a) best.set(key, candidate);
}
const places = [...best.values()].sort((a, b) => a.s.localeCompare(b.s) || a.n.localeCompare(b.n));
await writeFile(path.join(dataDir, "places.json"), JSON.stringify({
  source: "U.S. Census Bureau 2025 Gazetteer Places",
  url: "https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html",
  retrievedAt: new Date().toISOString(),
  places,
}));
console.log("Places", places.length);
