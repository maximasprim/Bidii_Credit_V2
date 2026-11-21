import type { PersonProjection, ProjectionHorizon } from "../../../lib/performanceApi";

const fmt = (n: number | null | undefined, d = 0) => (n == null ? "–" : n.toLocaleString("en-KE", { maximumFractionDigits: d }));

function Horizon({ title, h }: { title: string; h: ProjectionHorizon }) {
  const p = h.projection;
  const rr = h.required_run_rate;
  const cc = h.category_chances;
  return (
    <div className="rounded-xl border border-mist-200 p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-ink-500">{title} <span className="font-normal normal-case">({h.period.label})</span></h4>
      {!p.available ? (
        <p className="mt-2 text-sm text-ink-600">{p.reason ?? "Not enough history yet."}</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold" style={{ color: "var(--color-ink-900)" }}>
            {fmt(p.projected_pct, 1)}% <span className="text-sm font-normal text-ink-500">of target, projected</span>
          </p>
          <p className="text-xs text-ink-500">
            Banked so far {fmt(p.actual_to_date)} of a {fmt(p.target_total)} target; {p.remaining_months} month(s) left.
          </p>
          {rr.available && (
            <p className="mt-2 text-sm text-ink-700">
              {rr.already_met
                ? `Already enough banked for ${rr.goal_pct}% of target.`
                : `To reach ${rr.goal_pct}% of target you need about ${fmt(rr.needed_per_month)} a month (${fmt(rr.needed_vs_monthly_target_pct, 0)}% of the monthly target).`}
            </p>
          )}
          {cc.available && cc.categories && (
            <table className="mt-2 w-full text-left text-xs">
              <caption className="sr-only">Chance of each outcome, as a range</caption>
              <thead>
                <tr className="text-ink-500">
                  <th scope="col" className="py-1 pr-2 font-semibold">Outcome</th>
                  <th scope="col" className="py-1 font-semibold">Chance (range)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cc.categories).map(([k, v]) => (
                  <tr key={k} className="border-t border-mist-100">
                    <td className="py-1 pr-2">{v.label}</td>
                    <td className="py-1">{v.low_pct}–{v.high_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] text-ink-500">{p.method} Based on {p.data_window_months} scored month(s). A range from past results, not a promise.</p>
        </>
      )}
    </div>
  );
}

export default function ProjectionCard({ data }: { data: PersonProjection }) {
  if (!data.available || !data.horizons) {
    return <p className="rounded-xl border border-mist-200 p-3 text-sm text-ink-600">{data.reason ?? "No projection available yet."}</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.horizons.quarter_end && <Horizon title="Quarter end" h={data.horizons.quarter_end} />}
      {data.horizons.year_end && <Horizon title="Year end" h={data.horizons.year_end} />}
    </div>
  );
}
