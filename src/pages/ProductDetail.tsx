import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, FileText, ShieldQuestion } from "lucide-react";
import { loanProducts } from "../data/content";
import { usePageMeta } from "../lib/usePageMeta";
import CTABand from "../components/home/CTABand";
import heroBackground from "../assets/Hero_Bg2.jpg";
import GrowthLine from "../components/ui/GrowthLine";

export default function ProductDetail() {
  const { slug } = useParams();
  const product = loanProducts.find((p) => p.slug === slug);
  usePageMeta(product?.name ?? "Loan Products");

  if (!product) return <Navigate to="/products" replace />;

  const related = loanProducts.filter((p) => p.slug !== product.slug).slice(0, 3);

  return (
    <>
      <section
        // className="px-5 py-16 lg:px-8 lg:py-20"
        className="relative overflow-hidden bg-top bg-no-repeat bg-cover bg-center sm:bg-center px-5 py-20 lg:px-8 lg:py-28"
        style={{
          backgroundImage: `url(${heroBackground})`,
          // background:
          //   "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
        }}
      >
              <div className="absolute inset-0" 
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
        opacity: 0.75,
       }} 
       />
  
      <GrowthLine
        className="pointer-events-none absolute -top-2 right-0 h-32 w-[55%] opacity-20 lg:h-44 lg:w-[35%]"
        stroke="var(--color-ember-400)"
        animate={false}
      />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs text-white/50">
            <Link to="/products" className="hover:text-white/80">Products</Link> / {product.name}
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">{product.name}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">{product.tagline}</p>

          <div className="mt-8 flex flex-wrap gap-4">
            <div className="rounded-2xl bg-white/10 px-5 py-3">
              <p className="text-[11px] text-white/50">Rate</p>
              <p className="font-display font-bold text-white">{product.rateFrom}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-3">
              <p className="text-[11px] text-white/50">Term</p>
              <p className="font-display font-bold text-white">{product.termLabel}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-3">
              <p className="text-[11px] text-white/50">Maximum amount</p>
              <p className="font-display font-bold text-white">{product.maxAmount}</p>
            </div>
          </div>

          <Link
            to="/apply"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            Apply for {product.name}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
              Features
            </h2>
            <ul className="mt-4 space-y-3">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-ink-700)" }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
              Who is it for
            </h2>
            <ul className="mt-4 space-y-3">
              {product.eligibility.map((e) => (
                <li key={e} className="flex items-start gap-2.5 text-sm text-ink-700">
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--color-ember-500)" }} />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 rounded-3xl p-8" style={{ backgroundColor: "var(--color-mist-100)" }}>
          <div className="mb-6 flex items-center gap-2">
            <FileText size={18} style={{ color: "var(--color-ink-900)" }} />
            <h2 className="font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
              What you'll need
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {product.requirements.map((r) => (
              <div key={r} className="rounded-xl bg-surface px-4 py-3 text-sm text-ink-700">
                {r}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="mb-6 font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
            Application process
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {product.process.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-2xl border border-mist-200 p-5"
              >
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-extrabold text-white"
                  style={{ backgroundColor: "var(--color-navy-900)" }}
                >
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed text-ink-700">{step}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <div className="mb-6 flex items-center gap-2">
            <ShieldQuestion size={18} style={{ color: "var(--color-ink-900)" }} />
            <h2 className="font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
              Product FAQs
            </h2>
          </div>
          <div className="divide-y divide-mist-200 rounded-2xl border border-mist-200">
            {product.faqs.map((f) => (
              <div key={f.q} className="px-6 py-5">
                <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {f.q}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="mb-6 font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
            Related products
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/products/${r.slug}`}
                className="rounded-2xl border border-mist-200 p-5 transition-shadow hover:shadow-md"
              >
                <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {r.name}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{r.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTABand />
    </>
  );
}
