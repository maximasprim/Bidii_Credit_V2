import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import PageHero from "../components/ui/PageHero";
import CTABand from "../components/home/CTABand";
import { loanProducts } from "../data/content";
import { usePageMeta } from "../lib/usePageMeta";

export default function Products() {
  usePageMeta("Loan Products");
  return (
    <>
      <PageHero
        eyebrow="Loan Products"
        title="Financing shaped to how you earn"
        description="Six products covering business working capital, asset ownership, salaried income, and the unplanned moments in between."
      />

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loanProducts.map((p) => (
            <div key={p.slug} className="flex flex-col rounded-2xl border border-mist-200 bg-surface p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {p.name}
                </h2>
                <span
                  className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
                >
                  {p.rateFrom}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{p.tagline}</p>

              <ul className="mt-4 space-y-2">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-ink-700">
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-ink-700)" }} />
                    {b}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between border-t border-mist-200 pt-4 text-xs text-ink-500">
                <span>Up to {p.maxAmount}</span>
                <Link to={`/products/${p.slug}`} className="text-sm font-semibold" style={{ color: "var(--color-ember-500)" }}>
                  View details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CTABand />
    </>
  );
}
