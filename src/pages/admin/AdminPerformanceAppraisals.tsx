import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import { createAppraisal, getStaff, listAppraisals, type AppraisalSummary, type StaffProfile } from "../../lib/performanceApi";

const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";
const STATUS: Record<string, string> = { draft: "Staff member filling in", in_review: "In review", finalised: "Finalised" };

const thisQuarter = () => {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
};

export default function AdminPerformanceAppraisals() {
  usePageMeta("Appraisals");
  const navigate = useNavigate();
  const [items, setItems] = useState<AppraisalSummary[] | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [awaiting, setAwaiting] = useState(false);
  const [status, setStatus] = useState("all");
  const [profileId, setProfileId] = useState("");
  const [period, setPeriod] = useState(thisQuarter);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAppraisals({ status, awaiting_me: awaiting })
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load appraisals.");
      });
    return () => {
      cancelled = true;
    };
  }, [status, awaiting]);

  useEffect(() => {
    let cancelled = false;
    getStaff()
      .then((s) => {
        if (!cancelled) setStaff(s.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await createAppraisal(profileId, period);
      navigate(`/admin/performance/appraisals/${res.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the appraisal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
        <h1 className="font-display text-lg font-bold" style={heading}>Appraisals</h1>
        <p className="text-sm text-ink-500">Self-assessment, manager rating and sign-off for each quarter.</p>
      </div>
      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <section className={card}>
        <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Start an appraisal</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-500">Person
            <select className={`${input} mt-1 block`} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">Choose…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-500">Period (e.g. 2026-Q1, 2026-H1 or 2026)
            <input className={`${input} mt-1 block w-40`} maxLength={10} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
          <button type="button" className={btn} disabled={busy || !profileId || period.trim().length < 4} onClick={() => void start()}>Start</button>
        </div>
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={awaiting} onChange={(e) => setAwaiting(e.target.checked)} /> Only those waiting for me
          </label>
          <label className="text-xs text-ink-500">Status
            <select className={`${input} ml-2`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option><option value="draft">Staff member filling in</option><option value="in_review">In review</option><option value="finalised">Finalised</option>
            </select>
          </label>
        </div>
        {items === null ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-500">No appraisals to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Appraisals</caption>
              <thead>
                <tr className="text-xs text-ink-500">
                  <th scope="col" className="py-2 pr-3">Name</th><th scope="col" className="py-2 pr-3">Period</th><th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">With</th><th scope="col" className="py-2 pr-3">Disputes</th><th scope="col" className="py-2 pr-3">Rating</th><th scope="col" className="py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-t border-mist-200 text-ink-700">
                    <td className="py-2 pr-3 font-medium">{a.profile_name}</td><td className="py-2 pr-3">{a.period_label}</td><td className="py-2 pr-3">{STATUS[a.status]}</td>
                    <td className="py-2 pr-3">{a.current_step_label ?? "—"}{a.awaiting_me && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Your turn</span>}</td>
                    <td className="py-2 pr-3">{a.open_disputes > 0 ? `${a.open_disputes} open` : "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{a.final_weighted_rating !== null ? `${a.final_weighted_rating.toFixed(2)} / 5` : "—"}</td>
                    <td className="py-2"><Link to={`/admin/performance/appraisals/${a.id}`} className="text-xs font-semibold text-ink-700 underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
