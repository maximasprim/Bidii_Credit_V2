import { type PersonReport } from "../../../lib/performanceApi";
import { CategoryLegend } from "../CategoryBadge";
import { Card, KpiBreakdown, ScoreGauge, Stat, TrendChart, fmtNum, fmtPct } from "./ReportCharts";

export default function PersonView({ r }: { r: PersonReport }) {
  const p = r.person;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Score">
          <ScoreGauge score={p.score} category={p.category} />
          <p className="mt-3 text-center text-xs text-ink-500">
            {r.period.label} · 1–5 rating {p.rating ?? "–"} · coverage {p.coverage_pct === null ? "–" : `${p.coverage_pct.toFixed(0)}%`}
          </p>
          {p.peer_rank && <p className="mt-1 text-center text-xs text-ink-600">Ranked {p.peer_rank.rank} of {p.peer_rank.of} in the same role and branch.</p>}
        </Card>
        <div className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-2">
          <Stat label={p.headline?.label ?? "Headline"} value={fmtPct(p.headline?.pct)} sub={p.headline ? `${fmtNum(p.headline.actual)} of ${fmtNum(p.headline.target)}` : "No verified figures yet"} />
          <Stat label={`Quarter to date (${r.quarter_to_date.period})`} value={r.quarter_to_date.score === null ? "–" : r.quarter_to_date.score.toFixed(0)} sub={r.quarter_to_date.category?.label} />
          <Stat label="Year to date" value={r.year_to_date.score === null ? "–" : r.year_to_date.score.toFixed(0)} sub={r.year_to_date.category?.label} />
          <Stat label="Legacy band" value={p.legacy_band ?? "–"} sub="As in the old monthly sheets" />
        </div>
      </div>
      {p.attention.length > 0 && (
        <Card title="Worth a conversation">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">{p.attention.map((a) => <li key={a}>{a}</li>)}</ul>
        </Card>
      )}
      <Card title="KPI breakdown" note="The bar is each KPI's performance index (capped).">
        <KpiBreakdown kpis={p.kpis ?? []} />
      </Card>
      <Card title="Monthly trend against target">
        <TrendChart trend={p.trend} />
      </Card>
      <Card title="How this score was calculated">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">{r.explanation.map((l) => <li key={l}>{l}</li>)}</ul>
        <div className="mt-3"><CategoryLegend categories={r.scale.categories} /></div>
      </Card>
    </div>
  );
}
