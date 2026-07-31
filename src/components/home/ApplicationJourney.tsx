import { motion } from "framer-motion";
import { applicationSteps } from "../../data/content";

export default function ApplicationJourney() {
  return (
    <section className="py-20 lg:py-28" style={{ backgroundColor: "var(--color-navy-950)" }}>
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-400)" }}>
            From application to disbursement
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-white lg:text-4xl">
            Four steps, most of it done in one sitting
          </h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-white/10 md:block" />
          {applicationSteps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative"
            >
              <div
                className="relative z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-full font-display text-sm font-extrabold text-white"
                style={{ backgroundColor: "var(--color-ember-500)" }}
              >
                {String(s.step).padStart(2, "0")}
              </div>
              <h3 className="font-display text-base font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{s.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
