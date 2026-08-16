import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Calendar, ArrowLeft, Info } from "lucide-react";
import { usePageMeta } from "../lib/usePageMeta";
import { apiGet, ApiError, newsImageUrl } from "../lib/api";
import { articles as staticArticles } from "../data/content";
import CTABand from "../components/home/CTABand";

type Article = {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string[];
  image_urls: string[];
  published_at: string;
};

function toArticle(a: (typeof staticArticles)[number]): Article {
  return {
    id: a.slug,
    slug: a.slug,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
    body: a.body,
    // The offline fallback list predates article images — the API is the only source for those.
    image_urls: [],
    published_at: a.date,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });
}

export default function NewsArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  usePageMeta(article?.title ?? "News & Insights");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    apiGet<Article>(`/api/news/${slug}`)
      .then((data) => {
        if (cancelled) return;
        setArticle(data);
        setIsFallback(false);
        return apiGet<{ items: Article[] }>(
          `/api/news?category=${encodeURIComponent(data.category)}&page_size=10`
        );
      })
      .then((relatedData) => {
        if (cancelled || !relatedData) return;
        setRelated(relatedData.items.filter((a) => a.slug !== slug).slice(0, 2));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        // Server unreachable - fall back to the saved copy of this article.
        const staticMatch = staticArticles.find((a) => a.slug === slug);
        if (!staticMatch) {
          setNotFound(true);
          return;
        }
        setArticle(toArticle(staticMatch));
        setIsFallback(true);
        setRelated(
          staticArticles
            .filter((a) => a.slug !== slug && a.category === staticMatch.category)
            .slice(0, 2)
            .map(toArticle)
        );
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) return <Navigate to="/news" replace />;

  if (!article) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-24">
        <p className="text-sm text-ink-500">Loading article…</p>
      </section>
    );
  }

  return (
    <>
      <section
        className="px-5 py-16 lg:px-8 lg:py-20"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
        }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs text-white/50">
            <Link to="/news" className="hover:text-white/80">News &amp; Insights</Link> / {article.category}
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">{article.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/60">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
            >
              {article.category}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              {formatDate(article.published_at)}
            </span>
          </div>
        </div>
      </section>

      {isFallback && (
        <div className="mx-auto mt-6 max-w-3xl px-5">
          <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
            <Info size={14} className="shrink-0" />
            Showing a saved copy of this article - we couldn't reach the server.
          </div>
        </div>
      )}

      <section className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
        {article.image_urls[0] && (
          <img
            src={newsImageUrl(article.image_urls[0])}
            alt={article.title}
            className="mb-10 h-auto w-full rounded-3xl border border-mist-200 object-cover"
          />
        )}

        <div className="space-y-5">
          {article.body.map((p, i) => (
            <p key={i} className="text-base leading-relaxed text-ink-700">
              {p}
            </p>
          ))}
        </div>

        {article.image_urls.length > 1 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {article.image_urls.slice(1).map((url, i) => (
              <img
                key={url}
                src={newsImageUrl(url)}
                alt={`${article.title} — image ${i + 2}`}
                className="h-56 w-full rounded-2xl border border-mist-200 object-cover"
              />
            ))}
          </div>
        )}

        <Link
          to="/news"
          className="mt-10 inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--color-ember-500)" }}
        >
          <ArrowLeft size={15} />
          Back to News &amp; Insights
        </Link>

        {related.length > 0 && (
          <div className="mt-16 border-t border-mist-200 pt-10">
            <h2 className="mb-6 font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
              More on {article.category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/news/${r.slug}`}
                  className="rounded-2xl border border-mist-200 p-5 transition-shadow hover:shadow-md"
                >
                  <p className="text-xs text-ink-500">{formatDate(r.published_at)}</p>
                  <p className="mt-1.5 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                    {r.title}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{r.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <CTABand />
    </>
  );
}


// import { useEffect, useState } from "react";
// import { Link, useParams, Navigate } from "react-router-dom";
// import { Calendar, ArrowLeft, Info } from "lucide-react";
// import { usePageMeta } from "../lib/usePageMeta";
// import { apiGet, ApiError } from "../lib/api";
// import { articles as staticArticles } from "../data/content";
// import CTABand from "../components/home/CTABand";

// type Article = {
//   id: string;
//   slug: string;
//   title: string;
//   category: string;
//   excerpt: string;
//   body: string[];
//   published_at: string;
// };

// function toArticle(a: (typeof staticArticles)[number]): Article {
//   return { id: a.slug, slug: a.slug, title: a.title, category: a.category, excerpt: a.excerpt, body: a.body, published_at: a.date };
// }

// function formatDate(iso: string) {
//   return new Date(iso).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });
// }

// export default function NewsArticle() {
//   const { slug } = useParams();
//   const [article, setArticle] = useState<Article | null>(null);
//   const [related, setRelated] = useState<Article[]>([]);
//   const [notFound, setNotFound] = useState(false);
//   const [isFallback, setIsFallback] = useState(false);

//   usePageMeta(article?.title ?? "News & Insights");

//   useEffect(() => {
//     if (!slug) return;
//     let cancelled = false;

//     apiGet<Article>(`/api/news/${slug}`)
//       .then((data) => {
//         if (cancelled) return;
//         setArticle(data);
//         setIsFallback(false);
//         return apiGet<{ items: Article[] }>(
//           `/api/news?category=${encodeURIComponent(data.category)}&page_size=10`
//         );
//       })
//       .then((relatedData) => {
//         if (cancelled || !relatedData) return;
//         setRelated(relatedData.items.filter((a) => a.slug !== slug).slice(0, 2));
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         if (err instanceof ApiError && err.status === 404) {
//           setNotFound(true);
//           return;
//         }
//         // Server unreachable - fall back to the saved copy of this article.
//         const staticMatch = staticArticles.find((a) => a.slug === slug);
//         if (!staticMatch) {
//           setNotFound(true);
//           return;
//         }
//         setArticle(toArticle(staticMatch));
//         setIsFallback(true);
//         setRelated(
//           staticArticles
//             .filter((a) => a.slug !== slug && a.category === staticMatch.category)
//             .slice(0, 2)
//             .map(toArticle)
//         );
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [slug]);

//   if (notFound) return <Navigate to="/news" replace />;

//   if (!article) {
//     return (
//       <section className="mx-auto max-w-3xl px-5 py-24">
//         <p className="text-sm text-ink-500">Loading article…</p>
//       </section>
//     );
//   }

//   return (
//     <>
//       <section
//         className="px-5 py-16 lg:px-8 lg:py-20"
//         style={{
//           background:
//             "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
//         }}
//       >
//         <div className="mx-auto max-w-3xl">
//           <p className="text-xs text-white/50">
//             <Link to="/news" className="hover:text-white/80">News &amp; Insights</Link> / {article.category}
//           </p>
//           <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">{article.title}</h1>
//           <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/60">
//             <span
//               className="rounded-full px-2.5 py-1 text-xs font-semibold"
//               style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
//             >
//               {article.category}
//             </span>
//             <span className="flex items-center gap-1.5">
//               <Calendar size={13} />
//               {formatDate(article.published_at)}
//             </span>
//           </div>
//         </div>
//       </section>

//       {isFallback && (
//         <div className="mx-auto mt-6 max-w-3xl px-5">
//           <div className="flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
//             <Info size={14} className="shrink-0" />
//             Showing a saved copy of this article - we couldn't reach the server.
//           </div>
//         </div>
//       )}

//       <section className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
//         <div className="space-y-5">
//           {article.body.map((p, i) => (
//             <p key={i} className="text-base leading-relaxed text-ink-700">
//               {p}
//             </p>
//           ))}
//         </div>

//         <Link
//           to="/news"
//           className="mt-10 inline-flex items-center gap-2 text-sm font-semibold"
//           style={{ color: "var(--color-ember-500)" }}
//         >
//           <ArrowLeft size={15} />
//           Back to News &amp; Insights
//         </Link>

//         {related.length > 0 && (
//           <div className="mt-16 border-t border-mist-200 pt-10">
//             <h2 className="mb-6 font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
//               More on {article.category}
//             </h2>
//             <div className="grid gap-4 sm:grid-cols-2">
//               {related.map((r) => (
//                 <Link
//                   key={r.slug}
//                   to={`/news/${r.slug}`}
//                   className="rounded-2xl border border-mist-200 p-5 transition-shadow hover:shadow-md"
//                 >
//                   <p className="text-xs text-ink-500">{formatDate(r.published_at)}</p>
//                   <p className="mt-1.5 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//                     {r.title}
//                   </p>
//                   <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{r.excerpt}</p>
//                 </Link>
//               ))}
//             </div>
//           </div>
//         )}
//       </section>

//       <CTABand />
//     </>
//   );
// }
