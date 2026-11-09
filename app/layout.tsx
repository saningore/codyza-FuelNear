import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import Link from "next/link";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const sans = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});

const serif = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: { default: "FuelNear", template: "%s · FuelNear" },
  description: "Find real U.S. gas stations and compare fuel prices only when a provider publishes them.",
  manifest: "/manifest.webmanifest",
  applicationName: "FuelNear",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <ServiceWorkerRegister />
        <a className="skip-link" href="#main">Skip to content</a>
        <div className="bg-asphalt px-4 py-2 text-center text-sm font-bold text-card">
          Confirm the price on the pump before you buy. Listed prices can be hours or days old.
        </div>
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pump text-card" aria-hidden="true">
                <svg viewBox="0 0 32 32" className="h-7 w-7">
                  <path fill="currentColor" d="M9 4h9a3 3 0 0 1 3 3v7h1.2a2.8 2.8 0 0 1 2.8 2.8V22a2 2 0 1 1-4 0v-4.2H21V25a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm1.5 4.5V11H17V8.5h-6.5z" />
                </svg>
              </span>
              <span>
                <span className="block font-serif text-2xl font-semibold leading-none tracking-tight">FuelNear</span>
                <span className="text-sm text-ink/70">Find gas stations and compare listed prices</span>
              </span>
            </Link>
            <nav className="flex flex-wrap gap-2 text-sm font-bold" aria-label="Primary">
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pump" href="/">Find fuel</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pump" href="/saved">Saved</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pump" href="/sources">Sources</Link>
              <Link className="rounded-full px-3 py-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pump" href="/about">About</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="mt-16 border-t border-line px-4 py-8 text-center text-sm">
          <p className="font-bold">
            Powered by <a className="text-pump underline underline-offset-2" href="https://codyza.com" target="_blank" rel="noopener noreferrer">Codyza</a>
          </p>
          <p className="mt-2 text-ink/70">Real stations. A pump price appears only when Google Places publishes one.</p>
        </footer>
      </body>
    </html>
  );
}
