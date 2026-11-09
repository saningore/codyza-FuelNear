export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earth = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function metersBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return milesBetween(lat1, lon1, lat2, lon2) * 1609.344;
}

export function inSearchableArea(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  const statesAndCaribbean = latitude >= 17 && latitude <= 72 && longitude >= -180 && longitude <= -64;
  const hawaii = latitude >= 18.5 && latitude <= 22.5 && longitude >= -161 && longitude <= -154;
  const pacific = latitude >= 13 && latitude <= 21 && longitude >= 144 && longitude <= 147;
  const samoa = latitude >= -15.5 && latitude <= -13.5 && longitude >= -171.5 && longitude <= -168;
  return statesAndCaribbean || hawaii || pacific || samoa;
}

export function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.min(25, Math.max(1, value));
}

export function pointToSegmentMiles(
  lat: number,
  lon: number,
  start: [number, number],
  end: [number, number],
): number {
  const ax = start[0];
  const ay = start[1];
  const bx = end[0];
  const by = end[1];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / len2));
  return milesBetween(lat, lon, ay + t * dy, ax + t * dx);
}

export function distanceToRouteMiles(lat: number, lon: number, line: [number, number][]): number {
  if (!line.length) return Number.POSITIVE_INFINITY;
  if (line.length === 1) return milesBetween(lat, lon, line[0][1], line[0][0]);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    best = Math.min(best, pointToSegmentMiles(lat, lon, line[index - 1], line[index]));
  }
  return best;
}

export function sampleLine(line: [number, number][], count: number): [number, number][] {
  if (line.length <= count) return line;
  const picked: [number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    const at = Math.round((index * (line.length - 1)) / (count - 1));
    picked.push(line[at]);
  }
  return picked;
}
