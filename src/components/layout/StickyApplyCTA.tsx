import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function StickyApplyCTA() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-mist-600 bg-transparent p-3 backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Link
        to="/apply"
        className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--color-ember-500)" }}
      >
        Apply for a Loan
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
