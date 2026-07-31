import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  Lightbulb,
  PiggyBank,
  ShieldCheck,
  Smartphone,
  Laptop,
  Check,
  ArrowRight,
} from "lucide-react";
import PageHero from "../components/ui/PageHero";
import CTABand from "../components/home/CTABand";
import { services } from "../data/content";
import { usePageMeta } from "../lib/usePageMeta";

const icons = [FileCheck2, Lightbulb, PiggyBank, ShieldCheck, Smartphone, Laptop];

export default function Services() {
  usePageMeta("Services");
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="What happens around the loan itself"
        description="Financing is the headline, but the services around it - advisory, insurance, digital tools - are what make a loan easy to live with."
      />

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => {
            const Icon = icons[i % icons.length];
            return (
              <motion.div
                key={s.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                className="flex flex-col rounded-2xl border border-mist-200 bg-surface p-6"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "var(--color-navy-900)" }}
                >
                  <Icon size={20} color="var(--color-ember-400)" />
                </div>
                <h2 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {s.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-700">{s.detail}</p>

                <ul className="mt-4 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-ink-700">
                      <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-ink-700)" }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-6 rounded-3xl border border-mist-200 p-8 sm:flex-row" style={{ backgroundColor: "var(--color-mist-100)" }}>
          <div>
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
              Not sure which service fits your situation?
            </h2>
            <p className="mt-1.5 text-sm text-ink-500">A loan officer can walk you through the options in one call.</p>
          </div>
          <Link
            to="/contact"
            className="flex shrink-0 items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: "var(--color-navy-900)" }}
          >
            Talk to Us
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <CTABand />
    </>
  );
}
