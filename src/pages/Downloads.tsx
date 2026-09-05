import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Search, Download } from "lucide-react";
import PageHero from "../components/ui/PageHero";
import { usePageMeta } from "../lib/usePageMeta";
import { downloads, type DownloadCategory } from "../data/content";
import { cn } from "../lib/utils";

const categories: (DownloadCategory | "All")[] = [
  "All",
  "Application Forms",
  "Product Brochures",
  "Statements & Guides",
  // "Legal & Compliance",
];

export default function Downloads() {
  usePageMeta("Downloads");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");

  const filtered = useMemo(
    () =>
      downloads.filter(
        (d) =>
          (category === "All" || d.category === category) &&
          d.title.toLowerCase().includes(query.toLowerCase())
      ),
    [query, category]
  );

  return (
    <>
      <PageHero
        eyebrow="Downloads"
        title="Forms, brochures, and guides"
        description="Everything you need before or during an application - download, fill offline, and bring it to a branch or upload it with your application."
      >
        <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full bg-white/10 px-5 py-3">
          <Search size={16} className="text-white/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-sm",
                category === c ? "text-white" : "border border-mist-200 text-ink-700 hover:bg-mist-50"
              )}
              style={category === c ? { backgroundColor: "var(--color-navy-900)" } : undefined}
            >
              {c}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="rounded-xl border border-mist-200 p-6 text-center text-sm text-ink-500">
            No documents match "{query}" in {category === "All" ? "any category" : category}.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d, i) => (
            <motion.div
              key={d.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: (i % 6) * 0.05 }}
              className="flex flex-col rounded-2xl border border-mist-200 bg-surface p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "var(--color-ember-100)" }}
                >
                  <FileText size={20} style={{ color: "var(--color-ember-600)" }} />
                </div>
                <span className="whitespace-nowrap rounded-full border border-mist-200 px-2.5 py-1 text-[11px] font-semibold text-ink-500">
                  {d.fileType} · {d.size}
                </span>
              </div>
              <h2 className="mt-4 font-display text-sm font-bold leading-snug" style={{ color: "var(--color-ink-900)" }}>
                {d.title}
              </h2>
              <p className="mt-1.5 text-xs text-ink-500">{d.category}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-700">{d.description}</p>
              {/* <button
                className="mt-5 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-navy-900)" }}
              >
                <Download size={15} />
                Download
              </button> */}
              <a
                href={d.url}
                download
                className="mt-5 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-navy-900)" }}
              >
                <Download size={15} />
                Download
              </a>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
