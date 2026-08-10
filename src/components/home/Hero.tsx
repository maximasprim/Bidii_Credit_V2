import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import GrowthLine from "../ui/GrowthLine";
import heroBackground from "../../assets/Hero_Bg.jpg";

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-top bg-no-repeat bg-cover bg-center sm:bg-center pb-24 pt-16 lg:pb-32 lg:pt-20"
      style={{
        backgroundImage: `url(${heroBackground})`,
        backgroundColor: "var(--color-navy-900)",
      }}
    >
      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
          opacity: 0.7,
        }}
      />
      {/* signature staircase motif, faint, drifting across the upper hero */}
      <GrowthLine className="pointer-events-none absolute -top-4 right-0 h-40 w-[70%] opacity-25 lg:h-56 lg:w-[45%]" stroke="var(--color-ember-400)" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:px-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80"
          >
            <ShieldCheck size={14} style={{ color: "var(--color-ember-400)" }} />
            Licensed &amp; regulated microfinance institution
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-[3.4rem]"
          >
            Financing for businesses that show up{" "}
            <span style={{ color: "var(--color-ember-400)" }}>every day</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-5 max-w-lg text-base leading-relaxed text-white/70 lg:text-lg"
          >
            Bidii Credit funds the stock, the equipment, and the slow weeks in between -
            with a repayment number you see before you sign, not after.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-row items-center gap-4"
          >
            <Link
              to="/apply"
              className="flex items-center gap-2 rounded-full px-2 md:px-4 lg:px-6 py-2.5 md:py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: "var(--color-ember-500)" }}
            >
              Apply Now
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/calculator"
              className="rounded-full border border-white/25 px-2 md:px-4 lg:px-6 py-2.5 md:py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Calculate Your Loan
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60"
          >
            {["No hidden charges", "Approval in < 6 hours", "38,000+ loans processed"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 size={14} style={{ color: "var(--color-ember-400)" }} />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Loan snapshot card — the product itself, not a decorative illustration */}
        <motion.div
          initial={{ opacity: 0, y: 24, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-sm"
        >
          <div className="rounded-3xl bg-surface p-6 shadow-2xl shadow-black/30">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Sample business loan</p>
            <p className="mt-2 font-display text-3xl font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
              KES 150,000
            </p>
            <div className="mt-5 space-y-3 border-t border-mist-200 pt-5">
              {[
                ["Interest rate", "1.5% per month"],
                ["Repayment term", "12 months"],
                ["Monthly repayment", "KES 14,125"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">{label}</span>
                  <span className="font-semibold tabular" style={{ color: "var(--color-ink-900)" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-5 rounded-xl px-4 py-3 text-xs leading-relaxed"
              style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
            >
              This is the exact number you'd see before signing - no revisions after approval.
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="absolute -right-4 -top-4 hidden rounded-2xl bg-surface px-4 py-3 shadow-xl sm:block lg:-right-8"
          >
            <p className="text-[11px] font-medium text-ink-500">Approval time</p>
            <p className="font-display text-lg font-extrabold" style={{ color: "var(--color-ember-500)" }}>
              &lt; 6 hrs
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
