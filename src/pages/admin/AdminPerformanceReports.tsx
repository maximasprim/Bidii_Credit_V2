import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Download } from "lucide-react";
import {
  downloadReport,
  getCompare,
  getMyReport,
  getOrgReport,
  getRegionOptions,
  getRegionReport,
  getTeamReport,
  getUnitReport,
  getUnits,
  type CompareReport,
  type OrgReport,
  type PersonReport,
  type PerformanceUnit,
  type RegionOption,
  type RegionReport,
  type TeamReport,
  type UnitReport,
} from "../../lib/performanceApi";
import { usePageMeta } from "../../lib/usePageMeta";
import { readReport, reportKey, writeReport } from "../../lib/reportCache";
import PersonView from "../../components/admin/performance/PersonView";
import PersonModal from "../../components/admin/performance/PersonModal";
import LeaversCard, { leaversOf } from "../../components/admin/performance/LeaversCard";
import PeriodSelector from "../../components/admin/performance/PeriodSelector";
import {
  CategoryMix,
  Card,
  DistributionChart,
  Empty,
  HeatmapGrid,
  PeopleTable,
  Stat,
  fmtNum,
  fmtPct,
} from "../../components/admin/performance/ReportCharts";

type Tab = "me" | "team" | "unit" | "region" | "org" | "compare";
const TABS: { key: Tab; label: string }[] = [
  { key: "me", label: "My score" },
  { key: "team", label: "Team" },
  { key: "unit", label: "Branch / unit" },
  { key: "region", label: "Region" },
  { key: "org", label: "Organisation" },
  { key: "compare", label: "Compare" },
];
const field = "rounded-lg border border-mist-200 bg-surface px-2.5 py-1.5 text-sm text-ink-700";

/** Loads one report whenever its inputs change and shows a loading, error or the result state. */
function useReport<T>(load: (() => Promise<T>) | null, deps: unknown[], seed?: { data: T | null; error: string | null }) {
  const [data, setData] = useState<T | null>(seed?.data ?? null);
  const [error, setError] = useState<string | null>(seed?.error ?? null);
  const [loading, setLoading] = useState(false);
  const seeded = useRef(!!seed);
  useEffect(() => {
    if (seeded.current) {
      seeded.current = false; // the page already fetched this report: keep it in the "show what you had" cache too, then wait for the next change
      if (load && seed?.data) writeReport(reportKey(load, deps), seed.data);
      return;
    }
    if (!load) {
      setData(null);
      return;
    }
    let cancelled = false;
    const key = reportKey(load, deps);
    const seen = readReport<T>(key); // what we already had for exactly this report: shown at once, then refreshed below
    if (seen !== null) {
      setData(seen);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    load()
      .then((d) => {
        if (cancelled) return;
        writeReport(key, d);
        setData(d);
      })
      .catch((e) => {
        if (cancelled || seen !== null) return; // a failed refresh keeps showing what we had
        setData(null);
        setError(e instanceof Error ? e.message : "Couldn't load this report.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading };
}

function State({ loading, error, children }: { loading: boolean; error: string | null; children: ReactNode }) {
  if (loading) return <p role="status" className="text-sm text-ink-500">Loading…</p>;
  if (error)
    return (
      <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    );
  return <>{children}</>;
}

function ExportButtons({ kind, period, id }: { kind: "person" | "team" | "unit" | "region" | "org"; period: string; id?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async (format: "xlsx" | "pdf") => {
    setBusy(true);
    setErr(null);
    try {
      await downloadReport(kind, period, id, format);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't export.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {(["xlsx", "pdf"] as const).map((f) => (
        <button key={f} type="button" disabled={busy} onClick={() => go(f)} className="flex items-center gap-1.5 rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50">
          <Download size={12} /> {f === "xlsx" ? "Excel" : "PDF"}
        </button>
      ))}
      {err && <span role="alert" className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

function MeTab({ period, seed }: { period: string; seed?: { data: PersonReport | null; error: string | null } }) {
  const { data, error, loading } = useReport(() => getMyReport(period), [period], seed);
  return <State loading={loading} error={error}>{data && <PersonView r={data} />}</State>;
}

function GroupHeader({ summary, title, extra }: { summary: { achievement_pct: number | null; average_score: number | null; people: number; actual_total: number; target_total: number; leavers_included?: number }; title: string; extra?: ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Achievement" value={fmtPct(summary.achievement_pct)} sub={`KES ${fmtNum(summary.actual_total)} of ${fmtNum(summary.target_total)}${summary.leavers_included ? ` · includes ${summary.leavers_included} who ${summary.leavers_included === 1 ? "has" : "have"} left` : ""}`} />
        <Stat label="Average score" value={summary.average_score === null ? "–" : summary.average_score.toFixed(0)} />
        <Stat label="People" value={summary.people} />
        {extra}
      </div>
    </div>
  );
}

function TeamTab({ period }: { period: string }) {
  const { data, error, loading } = useReport<TeamReport>(() => getTeamReport(period), [period]);
  const [person, setPerson] = useState<string | null>(null);
  return (
    <State loading={loading} error={error}>
      {data && (
        <div className="space-y-5">
          <GroupHeader summary={data.summary} title={`Team of ${data.leader.name}`} extra={<Stat label="Leader vs team" value={data.leader_vs_team.leader_score === null ? "–" : data.leader_vs_team.leader_score.toFixed(0)} sub={`Team average ${data.leader_vs_team.team_average === null ? "–" : data.leader_vs_team.team_average.toFixed(0)}`} />} />
          <div className="flex justify-end"><ExportButtons kind="team" period={period} /></div>
          <Card title="Who needs attention">
            {data.needs_attention.length ? <PeopleTable people={data.needs_attention} onOpen={setPerson} /> : <Empty>Nobody is flagged for this period.</Empty>}
          </Card>
          <Card title="Everyone"><PeopleTable people={data.people} onOpen={setPerson} /></Card>
          <LeaversCard leavers={leaversOf(data.summary)} onOpen={setPerson} />
          <Card title="Category mix"><CategoryMix summary={data.summary} categories={data.scale.categories} /></Card>
          <Card title="Month by month"><HeatmapGrid heatmap={data.heatmap} rowLabel="Name" onOpen={setPerson} /></Card>
          {person && <PersonModal profileId={person} period={period} initial={data.people.find((x) => x.profile_id === person)} onClose={() => setPerson(null)} />}
        </div>
      )}
    </State>
  );
}

function UnitTab({ period, units }: { period: string; units: PerformanceUnit[] }) {
  const [unitId, setUnitId] = useState("");
  useEffect(() => {
    if (!unitId && units.length) setUnitId(units[0].id);
  }, [units, unitId]);
  const { data, error, loading } = useReport<UnitReport>(unitId ? () => getUnitReport(unitId, period) : null, [unitId, period]);
  const [person, setPerson] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="unit-pick" className="text-xs font-semibold text-ink-600">Branch / unit</label>
        <select id="unit-pick" className={field} value={unitId} onChange={(e) => { setUnitId(e.target.value); setPerson(null); }}>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {unitId && <ExportButtons kind="unit" period={period} id={unitId} />}
      </div>
      {!units.length && <Empty>No branches are available to you yet.</Empty>}
      <State loading={loading} error={error}>
        {data && (
          <div className="space-y-5">
            <GroupHeader summary={data.summary} title={data.unit.name} extra={<Stat label="Organisation" value={fmtPct(data.organisation.achievement_pct)} sub={`Average score ${data.organisation.average_score === null ? "–" : data.organisation.average_score.toFixed(0)}`} />} />
            {data.small_unit_note && <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{data.small_unit_note}</p>}
            <Card title="Month by month"><HeatmapGrid heatmap={data.heatmap} rowLabel="Name" onOpen={setPerson} /></Card>
            <Card title="Staff"><PeopleTable people={data.people} onOpen={setPerson} /></Card>
            <LeaversCard leavers={leaversOf(data.summary)} onOpen={setPerson} />
            {person && <PersonModal profileId={person} period={period} initial={data.people.find((x) => x.profile_id === person)} onClose={() => setPerson(null)} />}
            <Card title="Category mix"><CategoryMix summary={data.summary} categories={data.scale.categories} /></Card>
          </div>
        )}
      </State>
    </div>
  );
}

function BranchTable({ rows }: { rows: OrgReport["branches"] }) {
  if (!rows.length) return <Empty />;
  const th = "px-2 py-1.5 text-left text-xs font-semibold text-ink-600";
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr><th scope="col" className={th}>Branch</th><th scope="col" className={th}>People</th><th scope="col" className={th}>Actual (KES)</th><th scope="col" className={th}>Target (KES)</th><th scope="col" className={th}>Achievement</th><th scope="col" className={th}>Category</th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.unit_id} className="border-t border-mist-200">
              <th scope="row" className="px-2 py-1.5 text-left font-medium text-ink-800">{b.name}{b.small_unit ? " (small)" : ""}</th>
              <td className="px-2 py-1.5">{b.people}</td>
              <td className="px-2 py-1.5">{fmtNum(b.actual_total)}</td>
              <td className="px-2 py-1.5">{fmtNum(b.target_total)}</td>
              <td className="px-2 py-1.5 font-semibold">{fmtPct(b.achievement_pct)}</td>
              <td className="px-2 py-1.5">{b.category?.label ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegionTab({ period, regions }: { period: string; regions: RegionOption[] }) {
  const [id, setId] = useState("");
  useEffect(() => {
    if (!id && regions.length) setId(regions[0].id);
  }, [regions, id]);
  const { data, error, loading } = useReport<RegionReport>(id ? () => getRegionReport(id, period) : null, [id, period]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="region-pick" className="text-xs font-semibold text-ink-600">Region</label>
        <select id="region-pick" className={field} value={id} onChange={(e) => setId(e.target.value)}>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {id && <ExportButtons kind="region" period={period} id={id} />}
      </div>
      {!regions.length && <Empty>No regions are available to you.</Empty>}
      <State loading={loading} error={error}>
        {data && (
          <div className="space-y-5">
            <GroupHeader summary={data.summary} title={data.region.name} />
            <Card title="Branches compared" note="Target versus actual for each branch."><BranchTable rows={data.branches} /></Card>
            <LeaversCard leavers={leaversOf(data.summary)} />
            <Card title="Category mix"><CategoryMix summary={data.summary} categories={data.scale.categories} /></Card>
          </div>
        )}
      </State>
    </div>
  );
}

function OrgTab({ period }: { period: string }) {
  const { data, error, loading } = useReport<OrgReport>(() => getOrgReport(period), [period]);
  return (
    <State loading={loading} error={error}>
      {data && (
        <div className="space-y-5">
          <GroupHeader summary={data.summary} title="Organisation" extra={<Stat label="KES vs target" value={fmtPct(data.kes.achievement_pct)} sub={`${fmtNum(data.kes.actual)} of ${fmtNum(data.kes.target)}`} />} />
          <div className="flex justify-end"><ExportButtons kind="org" period={period} /></div>
          <Card title="Category distribution by month" note="Replaces the JAN–OCT and H1 summary sheets."><DistributionChart rows={data.by_month} categories={data.scale.categories} /></Card>
          <Card title="Branch by month"><HeatmapGrid heatmap={data.heatmap} rowLabel="Branch" /></Card>
          <Card title="Target vs actual by branch"><BranchTable rows={data.branches} /></Card>
          <LeaversCard leavers={leaversOf(data.summary)} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top movers" note={`Compared with ${data.previous.label}.`}><Movers rows={data.top_movers} /></Card>
            <Card title="Bottom movers"><Movers rows={data.bottom_movers} /></Card>
          </div>
        </div>
      )}
    </State>
  );
}

function Movers({ rows }: { rows: OrgReport["top_movers"] }) {
  if (!rows.length) return <Empty>Not enough scored people in both periods.</Empty>;
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((m) => (
        <li key={m.profile_id} className="flex justify-between gap-2">
          <span className="text-ink-800">{m.name}<span className="text-xs text-ink-500"> {m.unit_name}</span></span>
          <span className="font-semibold">{m.change > 0 ? "+" : ""}{m.change.toFixed(1)}</span>
        </li>
      ))}
    </ul>
  );
}

function CompareTab({ units }: { units: PerformanceUnit[] }) {
  const year = new Date().getFullYear();
  const [a, setA] = useState(`${year - 1}`);
  const [b, setB] = useState("ytd");
  const [unitId, setUnitId] = useState("");
  const { data, error, loading } = useReport<CompareReport>(() => getCompare(a, b, { unitId: unitId || undefined }), [a, b, unitId]);
  const row = (label: string, x: ReactNode, y: ReactNode, d: ReactNode) => (
    <tr className="border-t border-mist-200"><th scope="row" className="px-2 py-1.5 text-left font-medium">{label}</th><td className="px-2 py-1.5">{x}</td><td className="px-2 py-1.5">{y}</td><td className="px-2 py-1.5 font-semibold">{d}</td></tr>
  );
  const delta = (v: number | null, unit = "") => (v === null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(1)}${unit}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div><p className="mb-1 text-xs font-semibold text-ink-600">Period A</p><PeriodSelector id="cmp-a" value={a} onChange={setA} /></div>
        <div><p className="mb-1 text-xs font-semibold text-ink-600">Period B</p><PeriodSelector id="cmp-b" value={b} onChange={setB} /></div>
        <div>
          <label htmlFor="cmp-unit" className="mb-1 block text-xs font-semibold text-ink-600">Scope</label>
          <select id="cmp-unit" className={field} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">Everyone I can see</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <State loading={loading} error={error}>
        {data && (
          <Card title={`Comparing ${data.a.period.label} with ${data.b.period.label}`} note={`Basis: ${data.basis}`}>
            <table className="min-w-full text-sm">
              <thead><tr><th scope="col" className="px-2 py-1.5 text-left text-xs">Measure</th><th scope="col" className="px-2 py-1.5 text-left text-xs">{data.a.period.label}</th><th scope="col" className="px-2 py-1.5 text-left text-xs">{data.b.period.label}</th><th scope="col" className="px-2 py-1.5 text-left text-xs">Change</th></tr></thead>
              <tbody>
                {row("Achievement", fmtPct(data.a.achievement_pct), fmtPct(data.b.achievement_pct), delta(data.change.achievement_pct, " pts"))}
                {row("Average score", data.a.average_score?.toFixed(1) ?? "–", data.b.average_score?.toFixed(1) ?? "–", delta(data.change.average_score))}
                {row("Actual (KES)", fmtNum(data.a.actual_total), fmtNum(data.b.actual_total), delta(data.change.actual_total))}
                {row("People scored", data.a.people, data.b.people, "")}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-500">Periods of different lengths are not scaled, so compare like with like (quarter with quarter, month with month, year with year).</p>
          </Card>
        )}
      </State>
    </div>
  );
}

type Boot = { units: PerformanceUnit[]; regions: RegionOption[]; me: { data: PersonReport | null; error: string | null } };

/** Fetches the branch and region lists and the default report (My score, year to date) together, and shows the page only when all have arrived. */
export default function AdminPerformanceReports() {
  usePageMeta("Performance reports");
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getUnits(), getRegionOptions(), getMyReport("ytd")]).then(([u, r, m]) => {
      if (cancelled) return;
      setBoot({
        units: u.status === "fulfilled" ? u.value.items : [],
        regions: r.status === "fulfilled" ? r.value.items : [],
        me: m.status === "fulfilled" ? { data: m.value, error: null } : { data: null, error: m.reason instanceof Error ? m.reason.message : "Couldn't load this report." },
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!boot) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Performance reports</h1>
        <p role="status" className="text-sm text-ink-500">Loading…</p>
      </div>
    );
  }
  return <ReportsPage boot={boot} />;
}

function ReportsPage({ boot }: { boot: Boot }) {
  const [tab, setTab] = useState<Tab>("me");
  const [period, setPeriod] = useState("ytd");
  const units = boot.units;
  const regions = boot.regions;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Performance reports</h1>
          <p className="text-sm text-ink-500">Only figures a manager has verified are counted. You see the people you are responsible for.</p>
        </div>
        {tab !== "compare" && <PeriodSelector value={period} onChange={setPeriod} />}
      </div>
      <div role="tablist" aria-label="Report type" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tab === t.key ? "border-ink-900 bg-ink-900 text-white" : "border-mist-200 text-ink-700 hover:bg-mist-50"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "me" && <MeTab period={period} seed={period === "ytd" ? boot.me : undefined} />}
        {tab === "team" && <TeamTab period={period} />}
        {tab === "unit" && <UnitTab period={period} units={units} />}
        {tab === "region" && <RegionTab period={period} regions={regions} />}
        {tab === "org" && <OrgTab period={period} />}
        {tab === "compare" && <CompareTab units={units} />}
      </div>
    </div>
  );
}
