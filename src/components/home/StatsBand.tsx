import { motion } from "framer-motion";
import { stats } from "../../data/content";
import { useCountUp } from "../../lib/useCountUp";

function Stat({ s }: { s: (typeof stats)[number] }) {
  const decimals = s.value % 1 !== 0 ? 1 : 0;
  const { ref, value } = useCountUp(s.value);

  return (
    <div className="bg-surface px-6 py-8 text-center lg:px-4">
      <p
        className="font-display text-2xl font-extrabold tabular sm:text-3xl"
        style={{ color: "var(--color-ink-900)" }}
      >
        {s.prefix}
        <span ref={ref}>{value.toFixed(decimals)}</span>
        {s.suffix}
      </p>
      <p className="mt-2 text-xs leading-snug text-ink-500 sm:text-sm">{s.label}</p>
    </div>
  );
}

export default function StatsBand() {
  return (
    <section className="relative -mt-10 lg:-mt-14">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-mist-200 shadow-xl shadow-navy-900/5 lg:grid-cols-4"
        >
          {stats.map((s) => (
            <Stat key={s.label} s={s} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
