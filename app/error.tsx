"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-semibold">FuelNear could not load this page</h1>
      <p className="mt-3 text-lg">Something went wrong while reading station records. Try again.</p>
      <button type="button" className="mt-6 rounded-full bg-asphalt px-5 py-3 font-bold text-card" onClick={reset}>Try again</button>
    </article>
  );
}
