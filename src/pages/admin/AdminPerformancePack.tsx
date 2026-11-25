import { useCallback, useEffect, useRef, useState } from "react";
import { downloadPack, packGenerate, packList, packPreview, type BoardPackData, type BoardPackRow } from "../../lib/performanceApi";
import { getCurrentAdminRole } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";

const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const pct = (v: number | null | undefined) => (v == null ? "n/a" : `${v.toFixed(1)}%`);
const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work.");

type Boot = { rows: BoardPackRow[]; data: BoardPackData | null; error: string | null };

/** Fetches the generated-packs list and the preview together and shows the page only when both have arrived. */
export default function AdminPerformancePack() {
  usePageMeta("Board pack");
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([packList(), packPreview(undefined)]).then(([l, d]) => {
      if (cancelled) return;
      setBoot({
        rows: l.status === "fulfilled" ? l.value : [],
        data: d.status === "fulfilled" ? d.value : null,
        error: d.status === "rejected" ? msg(d.reason) : l.status === "rejected" ? msg(l.reason) : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!boot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Monthly board pack</h1>
        </div>
        <p role="status" className="text-sm text-ink-500">Loading…</p>
      </div>
    );
  }
  return <PackPage boot={boot} />;
}

function PackPage({ boot }: { boot: Boot }) {
  const canGenerate = ["admin", "hr"].includes(getCurrentAdminRole() ?? "");
  const [month, setMonth] = useState("");
  const [data, setData] = useState<BoardPackData | null>(boot.data);
  const [rows, setRows] = useState<BoardPackRow[]>(boot.rows);
  const [err, setErr] = useState<string | null>(boot.error);
  const haveMonth = useRef<string | null>(""); // the preview for "last complete month" is already held
  const listSeeded = useRef(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadList = useCallback(() => { packList().then(setRows).catch((e) => setErr(msg(e))); }, []);
  useEffect(() => {
    if (listSeeded.current) { listSeeded.current = false; return; } // the page already supplied the first list
    loadList();
  }, [loadList]);
  useEffect(() => {
    if (haveMonth.current === month) return;
    haveMonth.current = null;
    packPreview(month || undefined).then((d) => { setData(d); setErr(null); }).catch((e) => { setData(null); setErr(msg(e)); });
  }, [month]);
  const generate = async () => {
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await packGenerate(month || undefined);
      setNote(`The ${r.label} pack is ready.`);
      loadList();
    } catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-8xl space-y-6 p-2">
      <header>
        <h1 className="text-xl font-bold text-ink-900">Monthly board pack</h1>
        <p className="text-sm text-ink-600">One page for the board or CEO: company, region and branch figures only. No individual is named.</p>
      </header>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {note && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{note}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-ink-700">Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="ml-1 rounded-lg border border-mist-200 px-2 py-1.5 text-sm" /></label>
        {canGenerate && <button className={btn} disabled={busy} onClick={generate}>{busy ? "Generating…" : "Generate PDF"}</button>}
        <span className="text-xs text-ink-500">Left empty, this is the last complete month. A pack is also built automatically at the start of each month.</span>
      </div>
      {data && (
        <section aria-label="Preview" className="space-y-3 rounded-xl border border-mist-200 p-4">
          <h2 className="font-semibold text-ink-900">{data.label}</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            <div><dt className="text-ink-500">Achievement</dt><dd className="text-lg font-bold">{pct(data.month_result.achievement_pct)}</dd></div>
            <div><dt className="text-ink-500">Year to date</dt><dd className="text-lg font-bold">{pct(data.ytd.achievement_pct)}</dd></div>
            <div><dt className="text-ink-500">Year-end projection</dt><dd className="text-lg font-bold">{data.year_end.available ? pct(data.year_end.projected_pct) : "n/a"}</dd></div>
            <div><dt className="text-ink-500">Results reported</dt><dd className="text-lg font-bold">{pct(data.completeness.pct)}</dd></div>
          </dl>
          <table className="w-full text-sm">
            <caption className="sr-only">Regions</caption>
            <thead><tr className="text-left text-ink-500"><th className="py-1">Region</th><th>Achievement</th><th>People</th></tr></thead>
            <tbody>{data.regions.map((r) => <tr key={r.name} className="border-t border-mist-100"><td className="py-1">{r.name}</td><td>{pct(r.achievement_pct)}</td><td>{r.people}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      <section aria-label="Generated packs">
        <h2 className="mb-2 font-semibold text-ink-900">Generated packs</h2>
        {rows.length === 0 ? <p className="text-sm text-ink-500">None yet.</p> : (
          <ul className="divide-y divide-mist-100 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span>{r.label} <span className="text-ink-500">· {pct(r.summary.achievement_pct)} · by {r.generated_by}</span></span>
                <button className={btn} onClick={() => downloadPack(r.id, r.month).catch((e) => setErr(msg(e)))}>Download PDF</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
