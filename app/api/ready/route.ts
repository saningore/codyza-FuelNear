import { placeData, zctaData } from "@/lib/reference";
import { jsonNoStore } from "@/lib/respond";
import { usingFixtures } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (usingFixtures()) {
    return jsonNoStore({ ok: false, error: "Sample stations are not allowed." }, { status: 503 });
  }
  try {
    const zctaCount = Object.keys(zctaData().centroids).length;
    const placeCount = placeData().places.length;
    if (zctaCount < 30_000 || placeCount < 20_000) {
      return jsonNoStore({ ok: false, zctaCount, placeCount }, { status: 503 });
    }
    return jsonNoStore({ ok: true, zctaCount, placeCount });
  } catch {
    return jsonNoStore({ ok: false, error: "Reference data is not loaded." }, { status: 503 });
  }
}
