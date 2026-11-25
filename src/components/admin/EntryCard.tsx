import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { getCurrentAdminRole } from "../../lib/adminApi";
import { downloadEvidence, getEntries, saveEntry, submitEntries, uploadEvidence, type EntryMonth, type EntryRow } from "../../lib/performanceApi";

const input = "w-32 rounded-lg border border-mist-200 bg-surface px-2.5 py-1.5 text-sm text-ink-700 focus:outline-none disabled:opacity-60";
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";
const STATUS_TEXT: Record<string, string> = {
  draft: "Draft - not submitted yet",
  submitted: "Waiting for verification",
  verified: "Verified",
  rejected: "Sent back",
  locked: "Locked",
};

const fmt = (n: number | null, unit: string) =>
  n === null ? "-" : `${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}${unit === "percent" ? "%" : ""}`;

/** `ym` is "YYYY-MM". Entering figures for a month, with the target and (verified-only) achievement beside each. */
export default function EntryCard({ profileId, ym, title, initial }: { profileId: string; ym: string; title?: string; initial?: EntryMonth | null }) {
  const [data, setData] = useState<EntryMonth | null>(initial ?? null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const adminRole = getCurrentAdminRole();
  const canOverrideWindow = adminRole === "admin" || adminRole === "hr";
  const seededKey = useRef<string | null>(initial ? `${profileId}|${ym}|0` : null);

  useEffect(() => {
    if (seededKey.current === `${profileId}|${ym}|${tick}`) return; // the page already loaded this month
    seededKey.current = null;
    let cancelled = false;
    getEntries(profileId, `${ym}-01`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setDraft({});
        setMsg(null);
      })
      .catch((e) => {
        if (!cancelled) setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't load the figures." });
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, ym, tick]);

  if (!data) return msg ? <p role="alert" className="text-sm text-red-600">{msg.text}</p> : <p className="text-sm text-ink-500">Loading…</p>;
  if (data.rows.length === 0) return null; // this job role has no monthly figures to enter

  const windowClosed = data.window.state === "closed" && !canOverrideWindow;
  const locked = (r: EntryRow) => r.status === "submitted" || r.status === "verified" || r.status === "locked";
  const editable = (r: EntryRow) => data.can_enter && data.window.state !== "future" && !windowClosed && !locked(r);
  const changed = data.rows.filter((r) => draft[r.kpi_key] !== undefined && draft[r.kpi_key] !== "" && Number(draft[r.kpi_key]) !== r.value);
  const hasDrafts = data.rows.some((r) => r.status === "draft") || changed.length > 0;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      for (const r of changed) await saveEntry(profileId, { kpi_key: r.kpi_key, month: `${ym}-01`, value: Number(draft[r.kpi_key]) });
      setMsg({ ok: true, text: "Saved as a draft. Submit the month when you're done." });
      setTick((t) => t + 1);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      for (const r of changed) await saveEntry(profileId, { kpi_key: r.kpi_key, month: `${ym}-01`, value: Number(draft[r.kpi_key]) });
      await submitEntries(profileId, `${ym}-01`);
      setMsg({ ok: true, text: "Submitted for verification by your manager." });
      setTick((t) => t + 1);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't submit." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-5">
      <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{title ?? "Monthly figures"}</h2>
      <p className="mb-3 text-xs text-ink-500">
        {data.window.state === "future" && "This month hasn't started yet."}
        {data.window.state === "open" && `Open for entry until ${data.window.closes_on}. Only figures your manager verifies count towards your score.`}
        {data.window.state === "closed" && (canOverrideWindow ? "The entry window has closed; as HR you can still enter or amend figures." : `The entry window closed on ${data.window.closes_on}. Ask HR to enter or amend figures.`)}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Figures for the month</caption>
          <thead>
            <tr className="text-xs text-ink-500">
              <th scope="col" className="py-2 pr-3">Figure</th><th scope="col" className="py-2 pr-3">Target</th><th scope="col" className="py-2 pr-3">Your figure</th>
              <th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2 pr-3">Achievement</th><th scope="col" className="py-2">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.kpi_key} className="border-t border-mist-200 align-top text-ink-700">
                <td className="py-2 pr-3 font-medium">{r.label}</td>
                <td className="py-2 pr-3 tabular-nums">{fmt(r.target, r.unit)}</td>
                <td className="py-2 pr-3">
                  <input
                    aria-label={`${r.label} for the month`}
                    type="number"
                    min="0"
                    step="any"
                    className={input}
                    disabled={!editable(r)}
                    value={draft[r.kpi_key] ?? (r.value ?? "")}
                    onChange={(e) => setDraft({ ...draft, [r.kpi_key]: e.target.value })}
                  />
                  {r.suggestion && editable(r) && (
                    <span className="mt-1 block text-xs text-ink-500">
                      {r.suggestion.count} approved applications, KES {r.suggestion.total_amount.toLocaleString("en-KE")} (a rough guide, not disbursement).{" "}
                      <button type="button" className="font-semibold underline" onClick={() => setDraft({ ...draft, [r.kpi_key]: String(r.suggestion?.total_amount ?? "") })}>Use as a starting value</button>
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {r.status ? STATUS_TEXT[r.status] : "Not entered"}
                  {r.status === "rejected" && r.rejection_reason && <span className="block text-red-600">Sent back: {r.rejection_reason}</span>}
                </td>
                <td className="py-2 tabular-nums">
                  {r.pending_verification ? <span className="text-xs text-amber-700">Pending verification</span> : r.achievement_pct !== null ? `${r.achievement_pct.toFixed(1)}%` : r.target === null && r.verified_value !== null ? "No target set" : "-"}
                </td>
                <td className="py-2 text-xs">
                  {r.evidence_name && r.entry_id && (
                    <button type="button" className="block font-semibold underline" onClick={() => void downloadEvidence(r.entry_id as string, r.evidence_name as string).catch(() => setMsg({ ok: false, text: "Couldn't download the evidence." }))}>{r.evidence_name}</button>
                  )}
                  {r.entry_id && editable(r) && (
                    <label className="cursor-pointer font-semibold text-ink-700 underline">
                      {r.evidence_name ? "Replace" : "Attach"}
                      <span className="sr-only"> evidence for {r.label}</span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="sr-only"
                        onChange={(ev) => {
                          const f = ev.target.files?.[0];
                          ev.target.value = "";
                          if (f && r.entry_id) uploadEvidence(r.entry_id, f).then(() => { setMsg({ ok: true, text: "Evidence attached." }); setTick((t) => t + 1); }).catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't attach that file." }));
                        }}
                      />
                    </label>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.can_enter && data.window.state !== "future" && !windowClosed && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={busy || changed.length === 0} onClick={() => void save()}>Save draft</button>
          <button type="button" className={btn} disabled={busy || !hasDrafts} onClick={() => void submit()}>Submit for verification</button>
        </div>
      )}
      {msg && (
        <p role="status" className={`mt-3 flex items-center gap-1.5 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
          {msg.ok ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
        </p>
      )}
    </section>
  );
}
