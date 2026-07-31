import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import PageHero from "../components/ui/PageHero";
import { usePageMeta } from "../lib/usePageMeta";
import { faqs } from "../data/content";
import { cn } from "../lib/utils";

export default function Faq() {
  usePageMeta("FAQs");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(0);

  const filtered = useMemo(
    () =>
      faqs.filter(
        (f) =>
          f.q.toLowerCase().includes(query.toLowerCase()) ||
          f.a.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  return (
    <>
      <PageHero eyebrow="FAQs" title="Questions borrowers ask us most">
        <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full bg-white/10 px-5 py-3">
          <Search size={16} className="text-white/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a question"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
      </PageHero>

      <section className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
        {filtered.length === 0 && (
          <p className="rounded-xl border border-mist-200 p-6 text-center text-sm text-ink-500">
            No FAQs match "{query}".
          </p>
        )}
        <div className="divide-y divide-mist-200 rounded-2xl border border-mist-200 bg-surface">
          {filtered.map((f, i) => {
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
                  <Plus size={18} className={cn("shrink-0 transition-transform", isOpen && "rotate-45")} style={{ color: "var(--color-ember-500)" }} />
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
    </>
  );
}
