import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import GrowthLine from "../ui/GrowthLine";

export default function CTABand() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-8 lg:py-20"
        style={{
          background: "linear-gradient(135deg, var(--color-navy-900) 0%, var(--color-navy-950) 100%)",
        }}
      >
        <GrowthLine
          className="pointer-events-none absolute -bottom-6 left-1/2 h-28 w-[80%] -translate-x-1/2 opacity-15"
          stroke="var(--color-ember-400)"
          animate={false}
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
            Your next step deserves financing that keeps up
          </h2>
          <p className="mt-4 text-white/60">
            Apply in minutes and know your repayment before you commit to anything.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/apply"
              className="flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: "var(--color-ember-500)" }}
            >
              Apply Now
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Talk to Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
