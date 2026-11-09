import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StationDetail } from "@/components/StationDetail";
import { loadStation } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const station = await loadStation(id);
  return { title: station?.name ?? "Station" };
}

export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const station = await loadStation(id);
  if (!station) notFound();
  return <StationDetail station={station} />;
}
