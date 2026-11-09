import { fetchJson } from "@/lib/http";
import type { Station } from "@/lib/types";

type TableResponse = {
  code?: string;
  distances?: (number | null)[][];
  durations?: (number | null)[][];
};

type RouteResponse = {
  code?: string;
  routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }[];
};

function coordList(points: { latitude: number; longitude: number }[]): string {
  return points.map((point) => `${point.longitude},${point.latitude}`).join(";");
}

export async function attachDrivingDistances(
  origin: { latitude: number; longitude: number },
  stations: Station[],
): Promise<Station[]> {
  const targets = stations
    .map((station, index) => ({ station, index }))
    .sort((a, b) => a.station.distanceMiles - b.station.distanceMiles)
    .slice(0, 15);
  if (!targets.length) return stations;
  const points = [origin, ...targets.map((item) => item.station)];
  const payload = await fetchJson(
    `https://router.project-osrm.org/table/v1/driving/${coordList(points)}?sources=0&annotations=distance,duration`,
    12_000,
  ) as TableResponse;
  if (payload.code !== "Ok" || !payload.distances?.[0]) return stations;
  const next = stations.map((station) => ({ ...station }));
  targets.forEach((item, offset) => {
    const meters = payload.distances?.[0]?.[offset + 1];
    const seconds = payload.durations?.[0]?.[offset + 1];
    if (typeof meters !== "number" || !Number.isFinite(meters)) return;
    next[item.index] = {
      ...next[item.index],
      drivingMiles: Math.round((meters / 1609.344) * 10) / 10,
      drivingMinutes: typeof seconds === "number" ? Math.max(1, Math.round(seconds / 60)) : null,
    };
  });
  return next;
}

export async function drivingRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): Promise<{ miles: number; minutes: number; geometry: [number, number][] }> {
  const payload = await fetchJson(
    `https://router.project-osrm.org/route/v1/driving/${coordList([from, to])}?overview=full&geometries=geojson`,
    15_000,
  ) as RouteResponse;
  const route = payload.routes?.[0];
  const geometry = route?.geometry?.coordinates;
  if (payload.code !== "Ok" || !route || !geometry?.length || typeof route.distance !== "number") {
    throw new Error("Driving directions are unavailable for that route.");
  }
  return {
    miles: Math.round((route.distance / 1609.344) * 10) / 10,
    minutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
    geometry,
  };
}
