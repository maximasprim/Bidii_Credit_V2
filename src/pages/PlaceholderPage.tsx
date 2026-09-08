import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { usePageMeta } from "../lib/usePageMeta";

export default function PlaceholderPage({ title }: { title: string }) {
  usePageMeta(title);
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-red-500)" }}>
        404
      </p>
      <h1 className="mt-3 font-display text-3xl font-extrabold" style={{ color: "var(--color-ink-900)" }}>
        {title}
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-500">
        This page is currently unavailable but be on the lookout for updates.
      </p>
      <Link
        to="/"
        className="mt-8 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--color-navy-900)" }}
      >
        <ArrowLeft size={16} />
        Back to Home
      </Link>
    </section>
  );
}
