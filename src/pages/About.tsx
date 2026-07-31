import { motion } from "framer-motion";
import PageHero from "../components/ui/PageHero";
import CTABand from "../components/home/CTABand";
import { usePageMeta } from "../lib/usePageMeta";
import { coreValues, timeline, leadership } from "../data/content";

export default function About() {
  usePageMeta("About Us");
  return (
    <>
      <PageHero
        eyebrow="About Bidii Credit"
        title="Built by lenders who started as traders"
        description="Bidii Credit began as a lending circle for Moi Avenue traders and grew into a licensed institution - without losing the habit of judging a borrower by their business, not just their paperwork."
      />

      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 sm:grid-cols-2">
          <div className="rounded-2xl border border-mist-200 p-5 sm:p-7">
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
              Our Mission
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              To give Kenyan entrepreneurs and salaried professionals fast, transparent access to
              credit that's structured around how their income actually moves.
            </p>
          </div>
          <div className="rounded-2xl border border-mist-200 p-5 sm:p-7">
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
              Our Vision
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              To be the most trusted financing partner for small business owners across East
              Africa, known as much for clarity as for reach.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16" style={{ backgroundColor: "var(--color-mist-100)" }}>
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <h2 className="mb-10 text-center font-display text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--color-ink-900)" }}>
            What we hold ourselves to
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {coreValues.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="rounded-2xl bg-surface p-6"
              >
                <h3 className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{v.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-24">
        <h2 className="mb-10 text-center font-display text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--color-ink-900)" }}>
          Our timeline
        </h2>
        <div className="space-y-8 border-l-2 pl-6" style={{ borderColor: "var(--color-mist-200)" }}>
          {timeline.map((t, i) => (
            <motion.div
              key={t.year}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative"
            >
              <div
                className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: "var(--color-ember-500)" }}
              />
              <p className="font-display text-sm font-bold" style={{ color: "var(--color-ember-500)" }}>
                {t.year}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">{t.event}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-16" style={{ backgroundColor: "var(--color-mist-100)" }}>
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <h2 className="mb-10 text-center font-display text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--color-ink-900)" }}>
            Leadership team
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {leadership.map((l) => (
              <div key={l.name} className="rounded-2xl bg-surface p-6 text-center">
                {l.image ? (
                  <img
                    src={l.image}
                    alt={l.name}
                    className="mx-auto mb-4 h-16 w-16 rounded-full object-cover object-top"
                  />
                ) : (
                  <div
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full font-display text-lg font-extrabold text-white"
                    style={{ backgroundColor: "var(--color-navy-900)" }}
                  >
                    {l.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                )}
                <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {l.name}
                </p>
                <p className="mt-1 text-xs text-ink-500">{l.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </>
  );
}
