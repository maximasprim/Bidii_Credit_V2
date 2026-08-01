import { useMemo, useState, lazy, Suspense } from "react";
import { MapPin, Phone, Clock, Search, Navigation } from "lucide-react";
import PageHero from "../components/ui/PageHero";
import { branches } from "../data/content";
import { usePageMeta } from "../lib/usePageMeta";

const BranchMap = lazy(() => import("../components/ui/BranchMap"));

export default function Branches() {
  usePageMeta("Branch Locator");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => branches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <>
      <PageHero
        eyebrow="Branch Locator"
        title="14 branches, one relationship"
        description="Find the nearest Bidii Credit branch, its opening hours, and a direct line to speak with someone."
      >
        <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full bg-white/10 px-5 py-3">
          <Search size={16} className="text-white/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by town or branch name"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
      </PageHero>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4 lg:h-screen lg:overflow-y-auto lg:border border-gray-200 border-r lg:rounded-2xl">
            {filtered.length === 0 && (
              <p className="rounded-xl border border-mist-200 p-6 text-sm text-ink-500">
                No branches match "{query}". Try a different town.
              </p>
            )}
            {filtered.map((b) => (
              <div key={b.name} className="rounded-2xl border border-mist-200 bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-base font-bold" style={{ color: "var(--color-navy-900)" }}>
                    {b.name}
                  </h3>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + " " + b.address + " Kenya")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold"
                    style={{ color: "var(--color-ember-500)" }}
                  >
                    <Navigation size={13} />
                    Directions
                  </a>
                </div>
                <div className="mt-4 space-y-2.5 text-sm text-ink-500">
                  <div className="flex items-start gap-2">
                    <MapPin size={15} className="mt-0.5 shrink-0" />
                    {b.address}
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock size={15} className="mt-0.5 shrink-0" />
                    {b.hours}
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone size={15} className="mt-0.5 shrink-0" />
                    {b.phone}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* <div
            className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-mist-200 p-10 text-center"
            style={{ backgroundColor: "var(--color-mist-100)" }}
          >
            <MapPin size={32} style={{ color: "var(--color-navy-700)" }} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500">
              An interactive map connects here once a Google Maps API key is added — each branch
              card's "Directions" link already opens live directions in the meantime.
            </p>
          </div> */}
          <div className="overflow-hidden rounded-3xl border border-mist-200" style={{ minHeight: 420 }}>
            <Suspense
              fallback={
                <div
                  className="flex min-h-[420px] items-center justify-center"
                  style={{ backgroundColor: "var(--color-mist-100)" }}
                >
                  <p className="text-sm text-ink-500">Loading map…</p>
                </div>
              }
            >
              <BranchMap branches={filtered.length > 0 ? filtered : branches} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}