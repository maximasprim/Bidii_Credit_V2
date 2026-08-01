import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, ArrowRight, Calendar, Info } from "lucide-react";
import PageHero from "../components/ui/PageHero";
import { usePageMeta } from "../lib/usePageMeta";
import { apiGet } from "../lib/api";
import { cn } from "../lib/utils";
import { articles as staticArticles } from "../data/content";

type NewsCategory = "Financial Literacy" | "Product Updates" | "Company News" | "Customer Stories";

type Article = {
  id: string;
  slug: string
  title: string;
  category: string;
  excerpt: string;
  published_at: string;
};

const categories: (NewsCategory | "All")[] = [
  "All",
  "Financial Literacy",
  "Product Updates",
  "Company News",
  "Customer Stories",
];

const PAGE_SIZE = 4;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });
}

export default function News() {
  usePageMeta("News & Insights");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [page, setPage] = useState(1);

  const [articles, setArticles] = useState<Article[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = category;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ page: "1", page_size: "100" });
    if (category !== "All") qs.set("category", category);

    apiGet<{ items: Article[] }>(`/api/news?${qs}`)
      .then((data) => {
        if (cancelled) return;
        setArticles(data.items);
        setIsFallback(false);
        setLoadedKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = staticArticles
          .filter((a) => category === "All" || a.category === category)
          .map((a) => ({
            id: a.slug,
            slug: a.slug,
            title: a.title,
            category: a.category,
            excerpt: a.excerpt,
            published_at: a.date,
          }));
        setArticles(fallback);
        setIsFallback(true);
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, category]);

  const filtered = useMemo(
    () => articles.filter((a) => a.title.toLowerCase().includes(query.toLowerCase())),
    [articles, query]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function selectCategory(c: (typeof categories)[number]) {
    setCategory(c);
    setPage(1);
  }

  return (
    <>
      <PageHero
        eyebrow="News & Insights"
        title="What we're seeing, building, and learning"
        description="Financial literacy explainers, product updates, and stories from borrowers putting financing to work."
      >
        <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full bg-white/10 px-5 py-3">
          <Search size={16} className="text-white/60" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search articles"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>
      </PageHero>

      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => selectCategory(c)}
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

        {isFallback && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
            <Info size={14} className="shrink-0" />
            Showing saved articles - we couldn't reach the server for the latest ones.
          </div>
        )}

        {loading && <p className="text-sm text-ink-500">Loading articles…</p>}

        {!loading && paged.length === 0 && (
          <p className="rounded-xl border border-mist-200 p-6 text-center text-sm text-ink-500">
            No articles match "{query}" in {category === "All" ? "any category" : category}.
          </p>
        )}

        <div className="space-y-5">
          {paged.map((a, i) => (
            <motion.div
              key={a.slug}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <Link
                to={`/news/${a.slug}`}
                className="flex flex-col gap-4 rounded-2xl border border-mist-200 bg-surface p-6 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
              >
                <div
                  className="h-14 w-14 shrink-0 rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, var(--color-navy-700), var(--color-navy-950))",
                  }}
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                    <span
                      className="rounded-full px-2.5 py-1 font-semibold"
                      style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
                    >
                      {a.category}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      {formatDate(a.published_at)}
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
                    {a.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{a.excerpt}</p>
                </div>
                <ArrowRight size={18} className="hidden shrink-0 sm:block" style={{ color: "var(--color-ember-500)" }} />
              </Link>
            </motion.div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  p === page ? "text-white" : "border border-mist-200 text-ink-700 hover:bg-mist-50"
                )}
                style={p === page ? { backgroundColor: "var(--color-navy-900)" } : undefined}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
