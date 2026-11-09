import { NextRequest } from "next/server";
import { originFromDevice, resolveQuery, suggestionsFor, GeocodeError } from "@/lib/geocode";
import { clientKey, rateLimit } from "@/lib/http";
import { jsonNoStore } from "@/lib/respond";
import { assertLiveData } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertLiveData();
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "FuelNear is unavailable." }, { status: 503 });
  }
  if (!rateLimit(`geocode:${clientKey(request.headers.get("x-forwarded-for"))}`)) {
    return jsonNoStore({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
  }
  const params = request.nextUrl.searchParams;
  try {
    const lat = params.get("lat");
    const lon = params.get("lon");
    if (lat !== null && lon !== null && params.get("q") === null) {
      const accuracy = Number(params.get("accuracy"));
      const origin = await originFromDevice(Number(lat), Number(lon), Number.isFinite(accuracy) ? accuracy : null);
      return jsonNoStore(origin);
    }
    const query = params.get("q") ?? "";
    if (params.get("suggest") === "1") {
      const suggestions = await suggestionsFor(query);
      return jsonNoStore({ suggestions });
    }
    const origin = await resolveQuery(query);
    return jsonNoStore(origin);
  } catch (error) {
    const message = error instanceof GeocodeError
      ? error.message
      : "That location could not be found. Try a street address or another ZIP code.";
    return jsonNoStore({ error: message }, { status: 400 });
  }
}
