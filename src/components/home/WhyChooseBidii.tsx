import { motion } from "framer-motion";
import { Eye, Clock, HandCoins, Users2 } from "lucide-react";

const reasons = [
  {
    icon: Eye,
    title: "See your number first",
    detail: "Every offer shows the full repayment schedule before you accept - no surprise deductions.",
  },
  {
    icon: Clock,
    title: "Decisions in hours, not weeks",
    detail: "Most applications are reviewed within 6 hours, with emergency loans cleared same-day.",
  },
  {
    icon: HandCoins,
    title: "Repayments that fit your income",
    detail: "Weekly, monthly, or seasonal schedules - matched to how your business actually earns.",
  },
  {
    icon: Users2,
    title: "A loan officer who knows your file",
    detail: "SME and business borrowers get a named relationship manager, not a call centre queue.",
  },
];

export default function WhyChooseBidii() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-500)" }}>
          Why Bidii
        </p>
        <h2 className="mt-3 font-display text-3xl font-extrabold lg:text-4xl" style={{ color: "var(--color-ink-900)" }}>
          Lending built around how you actually work
        </h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {reasons.map((r, i) => (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="rounded-2xl border border-mist-200 bg-surface p-6 transition-shadow hover:shadow-lg hover:shadow-navy-900/5"
          >
            <div
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--color-navy-900)" }}
            >
              <r.icon size={20} color="var(--color-ember-400)" />
            </div>
            <h3 className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
              {r.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{r.detail}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
