import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";
import { loanProducts } from "../../data/content";

export default function FeaturedProducts() {
  return (
    <section className="py-20" style={{ backgroundColor: "var(--color-mist-100)" }}>
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mb-14 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-500)" }}>
              Loan Products
            </p>
            <h2 className="mt-3 max-w-lg font-display text-3xl font-extrabold lg:text-4xl" style={{ color: "var(--color-ink-900)" }}>
              Six ways to fund what's next
            </h2>
          </div>
          <Link
            to="/products"
             className="flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-orange-400/90"
          >
            View all products
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {loanProducts.map((p, i) => (
            <motion.div
              key={p.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="flex flex-col rounded-2xl bg-surface p-6"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {p.name}
                </h3>
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
                <span>{p.termLabel}</span>
                <Link
                  to={`/products/${p.slug}`}
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-ember-500)" }}
                >
                  Learn more →
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
