import { NextResponse } from "next/server";

export function jsonNoStore(body: unknown, init?: { status?: number } | number) {
  const status = typeof init === "number" ? init : init?.status ?? 200;
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
