import { Link } from "react-router-dom";
import { MapPin, Phone, Clock, ArrowUpRight } from "lucide-react";
import { useBranches } from  "../../lib/useBranches";

export default function BranchesPreview() {
const { branches } = useBranches();

  return (
    <section className="py-10" style={{ backgroundColor: "var(--color-mist-100)" }}>
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mb-14 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-500)" }}>
              Branches
            </p>
            <h2 className="mt-3 font-display text-3xl font-extrabold lg:text-4xl" style={{ color: "var(--color-ink-900)" }}>
              11 branches, one relationship
            </h2>
          </div>
          <Link to="/branches"  className="flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-orange-400/90">
            Find a branch near you
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {branches.map((b) => (
            <div key={b.name} className="rounded-2xl bg-surface p-6">
              <h3 className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
                {b.name}
              </h3>
              <div className="mt-4 space-y-2.5 text-sm text-ink-500">
                <div className="flex items-start gap-2">
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  {b.address}
                </div>
                <div className="flex items-start gap-2">
                  <Clock size={15} className="mt-0.5 shrink-0" />
                  {b.hours}
                </div>
                <div className="flex items-start gap-2">
                  <Phone size={15} className="mt-0.5 shrink-0" />
                  {b.phone}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
