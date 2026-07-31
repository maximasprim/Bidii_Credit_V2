import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { faqs } from "../../data/content";
import { cn } from "../../lib/utils";

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="mx-auto max-w-4xl px-5 py-20 lg:py-28">
      <div className="mb-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-500)" }}>
          FAQs
        </p>
        <h2 className="mt-3 font-display text-3xl font-extrabold lg:text-4xl" style={{ color: "var(--color-ink-900)" }}>
          Questions borrowers ask us most
        </h2>
      </div>

      <div className="divide-y divide-mist-200 rounded-2xl border border-mist-200 bg-surface">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-display text-sm font-bold sm:text-base" style={{ color: "var(--color-ink-900)" }}>
                  {f.q}
                </span>
                <Plus
                  size={18}
                  className={cn("shrink-0 transition-transform", isOpen && "rotate-45")}
                  style={{ color: "var(--color-ember-500)" }}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-ink-500">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
