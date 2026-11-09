import type { Metadata } from "next";
import { SavedExperience } from "@/components/SavedExperience";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return <SavedExperience />;
}
