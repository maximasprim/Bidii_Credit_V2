import { useEffect, useRef, useState } from "react";
import { getMyReport, type PersonReport } from "../../../lib/performanceApi";
import PeriodSelector from "./PeriodSelector";
import PersonView from "./PersonView";

/** The score, KPI breakdown and trend on My Performance, with its own period control. */
export default function MyScoreSection({ initial }: { initial?: PersonReport | null } = {}) {
  const [period, setPeriod] = useState("ytd");
  const [data, setData] = useState<PersonReport | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);
  const seededFor = useRef<string | null>(initial ? "ytd" : null);

  useEffect(() => {
    if (seededFor.current === period) return; // the page already loaded this period
    seededFor.current = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMyReport(period)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load your score."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <section aria-labelledby="my-score-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-score-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
          My score
        </h2>
        <PeriodSelector id="my-period" value={period} onChange={setPeriod} />
      </div>
      {loading && <p role="status" className="text-sm text-ink-500">Loading…</p>}
      {error && !loading && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {data && !loading && <PersonView r={data} />}
    </section>
  );
}
