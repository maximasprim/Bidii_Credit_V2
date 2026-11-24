import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORY_STYLE, type CategoryBand, type GroupSummary, type Heatmap, type MonthRow, type ReportCategory, type ReportKpi, type ReportPerson } from "../../../lib/performanceApi";
import CategoryBadge from "../CategoryBadge";

export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${v.toFixed(1)}%`);
export const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? "–" : new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(v));
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short", year: "2-digit" });

export function Card({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-5">
      <h2 className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
        {title}
      </h2>
      {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Empty({ children = "No data yet for this period." }: { children?: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-mist-200 p-4 text-sm text-ink-500">{children}</p>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-mist-200 bg-surface p-4">
      <p className="text-xs font-semibold text-ink-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

/** Half-circle gauge. The score and the category are written out as text as well. */
export function ScoreGauge({ score, category, max = 150 }: { score: number | null; category: ReportCategory; max?: number }) {
  const frac = score === null ? 0 : Math.max(0, Math.min(1, score / max));
  const angle = Math.PI * (1 - frac);
  const x = 100 + 80 * Math.cos(angle);
  const y = 100 - 80 * Math.sin(angle);
  const colour = category ? CATEGORY_STYLE[category.key].solid : "#9CA3AF";
  return (
    <div className="flex flex-col items-center" role="img" aria-label={score === null ? "No score yet" : `Score ${score.toFixed(1)}, ${category?.label ?? ""}`}>
      <svg viewBox="0 0 200 115" className="w-56">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="14" strokeLinecap="round" />
        {score !== null && <path d={`M20 100 A80 80 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={colour} strokeWidth="14" strokeLinecap="round" />}
        <text x="100" y="92" textAnchor="middle" fontSize="30" fontWeight="700" fill="currentColor">
          {score === null ? "–" : score.toFixed(0)}
        </text>
      </svg>
      {category ? <CategoryBadge categoryKey={category.key} label={category.label} /> : <span className="text-xs text-ink-500">Not scored yet</span>}
    </div>
  );
}

export function KpiBreakdown({ kpis }: { kpis: ReportKpi[] }) {
  if (!kpis.length) return <Empty>No KPIs are set up for this role yet.</Empty>;
  return (
    <ul className="space-y-3">
      {kpis.map((k) => {
        const pct = k.achievement_pct ?? null;
        return (
          <li key={k.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-ink-700">
                {k.label} <span className="text-xs font-normal text-ink-400">weight {k.weight}%</span>
              </span>
              <span className="text-ink-700">
                {k.source === "kpi_entry"
                  ? `${fmtNum(k.actual)} of ${fmtNum(k.target)}${k.unit === "percent" ? "%" : ""} · ${fmtPct(pct)}`
                  : k.rating !== undefined && k.rating !== null
                    ? `Rated ${k.rating} of 5`
                    : "–"}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-mist-100" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((k.pi ?? 0) / 150) * 100)}%`, backgroundColor: "#2563EB" }} />
            </div>
            {k.not_scored_reason && <p className="mt-0.5 text-xs text-ink-500">{k.not_scored_reason}</p>}
            {!!k.months_pending && <p className="mt-0.5 text-xs text-amber-700">{k.months_pending} month(s) waiting to be verified.</p>}
          </li>
        );
      })}
    </ul>
  );
}

function TableAlt({ headers, rows }: { headers: string[]; rows: (string | number | null)[][] }) {
  return (
    <details className="mt-2 text-xs text-ink-600">
      <summary className="cursor-pointer font-semibold">View as a table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col" className="px-2 py-1 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-mist-200">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1">
                    {c ?? "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function TrendChart({ trend }: { trend: ReportPerson["trend"] }) {
  const data = trend.map((t) => ({ month: monthLabel(t.month), pct: t.pct }));
  if (!data.some((d) => d.pct !== null)) return <Empty>No verified results yet, so there is no trend to draw.</Empty>;
  return (
    <>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "–")} />
            <ReferenceLine y={100} stroke="#6B7280" strokeDasharray="4 4" label={{ value: "Target", fontSize: 10, position: "insideTopRight" }} />
            <Line type="monotone" dataKey="pct" name="Achievement" stroke="#2563EB" strokeWidth={2} dot connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TableAlt headers={["Month", "Achievement", "State"]} rows={trend.map((t) => [monthLabel(t.month), fmtPct(t.pct), t.state])} />
    </>
  );
}

export function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => (v === null ? null : { i, v }));
  const nums = pts.filter((p): p is { i: number; v: number } => p !== null);
  if (nums.length < 2) return <span className="text-xs text-ink-400">–</span>;
  const max = Math.max(150, ...nums.map((p) => p.v));
  const w = 64;
  const h = 18;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const d = nums.map((p, k) => `${k ? "L" : "M"}${(p.i * step).toFixed(1)} ${(h - (p.v / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-16" role="img" aria-label={`Recent achievement: ${nums.map((p) => `${p.v.toFixed(0)}%`).join(", ")}`}>
      <path d={d} fill="none" stroke="#2563EB" strokeWidth="1.5" />
    </svg>
  );
}

function heatColour(v: number | null) {
  if (v === null) return { bg: "transparent", text: "inherit" };
  if (v >= 120) return { bg: CATEGORY_STYLE.above_expectation.bg, text: CATEGORY_STYLE.above_expectation.text };
  if (v >= 90) return { bg: CATEGORY_STYLE.meeting_expectation.bg, text: CATEGORY_STYLE.meeting_expectation.text };
  if (v >= 60) return { bg: CATEGORY_STYLE.approaching_expectation.bg, text: CATEGORY_STYLE.approaching_expectation.text };
  return { bg: CATEGORY_STYLE.below_expectation.bg, text: CATEGORY_STYLE.below_expectation.text };
}

/** Rows x months. Every cell carries its number, so colour is never the only signal. */
export function HeatmapGrid({ heatmap, rowLabel, onOpen }: { heatmap: Heatmap; rowLabel: string; onOpen?: (id: string) => void }) {
  if (!heatmap.rows.length || !heatmap.months.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-surface px-2 py-1 text-left font-semibold">
              {rowLabel}
            </th>
            {heatmap.months.map((m) => (
              <th key={m} scope="col" className="px-2 py-1 text-center font-semibold">
                {monthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.rows.map((r) => {
            const open = onOpen && r.profile_id ? () => onOpen(r.profile_id as string) : undefined;
            return (
            <tr key={r.profile_id ?? r.unit_id ?? r.name} onClick={open} className={`group border-t border-mist-200 ${open ? "cursor-pointer" : ""}`}>
              <th scope="row" className={`sticky left-0 bg-surface px-2 py-1 text-left font-medium text-ink-700 ${open ? "group-hover:bg-mist-50" : ""}`}>
                {open ? <button type="button" onClick={open} className="text-left underline">{r.name}</button> : r.name}
              </th>
              {r.cells.map((c, i) => {
                const col = heatColour(c);
                return (
                  <td key={i} className="px-2 py-1 text-center font-semibold" style={{ backgroundColor: col.bg, color: col.text }}>
                    {c === null ? "–" : c.toFixed(0)}
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-ink-500">Achievement % each month. Blank means no verified figure or no target.</p>
    </div>
  );
}

/** Stacked bars: how many people fell in each category, month by month. */
export function DistributionChart({ rows, categories }: { rows: MonthRow[]; categories: CategoryBand[] }) {
  const data = useMemo(() => rows.map((r) => ({ month: monthLabel(r.month), ...r.category_counts })), [rows]);
  if (!rows.length) return <Empty />;
  return (
    <>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {categories.map((c) => (
              <Bar key={c.key} dataKey={c.key} name={c.label} stackId="a" fill={CATEGORY_STYLE[c.key].solid} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableAlt headers={["Month", ...categories.map((c) => c.label)]} rows={rows.map((r) => [monthLabel(r.month), ...categories.map((c) => r.category_counts[c.key] ?? 0)])} />
    </>
  );
}

export function CategoryMix({ summary, categories }: { summary: GroupSummary; categories: CategoryBand[] }) {
  const total = Object.values(summary.category_counts).reduce((a, b) => a + b, 0);
  if (!total) return <Empty>Nobody has a score yet.</Empty>;
  return (
    <ul className="space-y-1.5">
      {categories.map((c) => {
        const n = summary.category_counts[c.key] ?? 0;
        return (
          <li key={c.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_STYLE[c.key].solid }} aria-hidden="true" />
            <span className="w-44 text-ink-700">{c.label}</span>
            <span className="font-semibold text-ink-900">{n}</span>
            <span className="text-xs text-ink-500">({((n / total) * 100).toFixed(0)}%)</span>
          </li>
        );
      })}
      {summary.unscored > 0 && <li className="text-xs text-ink-500">{summary.unscored} not scored yet (no target or no verified figures).</li>}
    </ul>
  );
}

type SortKey = "name" | "score" | "pct";
export function PeopleTable({ people, onOpen }: { people: ReportPerson[]; onOpen?: (id: string) => void }) {
  const [sort, setSort] = useState<SortKey>("score");
  const rows = useMemo(() => {
    const copy = [...people];
    copy.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const av = sort === "score" ? a.score : (a.headline?.pct ?? null);
      const bv = sort === "score" ? b.score : (b.headline?.pct ?? null);
      return (bv ?? -1) - (av ?? -1);
    });
    return copy;
  }, [people, sort]);
  if (!rows.length) return <Empty>No staff in view.</Empty>;
  const th = "px-2 py-1.5 text-left text-xs font-semibold text-ink-600";
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <label htmlFor="people-sort" className="font-semibold text-ink-600">
          Sort by
        </label>
        <select id="people-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-mist-200 bg-surface px-2 py-1">
          <option value="score">Score</option>
          <option value="pct">Achievement %</option>
          <option value="name">Name</option>
        </select>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className={th}>Name</th>
            <th scope="col" className={th}>Score</th>
            <th scope="col" className={th}>Category</th>
            <th scope="col" className={th}>Achievement</th>
            <th scope="col" className={th}>Trend</th>
            <th scope="col" className={th}>Needs attention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.profile_id}
              onClick={onOpen ? () => onOpen(p.profile_id) : undefined}
              className={`border-t border-mist-200 align-top ${onOpen ? "cursor-pointer hover:bg-mist-50" : ""}`}
            >
              <td className="px-2 py-2 font-medium text-ink-800">
                {onOpen ? (
                  <button type="button" onClick={() => onOpen(p.profile_id)} className="text-left underline">
                    {p.name}
                  </button>
                ) : (
                  p.name
                )}
                <span className="block text-xs font-normal text-ink-500">{p.role_name}{p.status === "pip" ? " · PIP" : ""}</span>
              </td>
              <td className="px-2 py-2 font-semibold">{p.score === null ? "–" : p.score.toFixed(0)}</td>
              <td className="px-2 py-2">{p.category ? <CategoryBadge categoryKey={p.category.key} label={p.category.label} /> : <span className="text-xs text-ink-500">Not scored</span>}</td>
              <td className="px-2 py-2">{fmtPct(p.headline?.pct)}</td>
              <td className="px-2 py-2"><Sparkline values={p.spark} /></td>
              <td className="px-2 py-2 text-xs text-ink-600">{p.attention.length ? p.attention.join("; ") : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
