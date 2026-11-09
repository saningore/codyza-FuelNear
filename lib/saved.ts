import type { SavedStation } from "@/lib/view";

export const SAVED_KEY = "fuelnear.saved.v1";

export function readSaved(): SavedStation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]") as SavedStation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSaved(list: SavedStation[]): void {
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}
