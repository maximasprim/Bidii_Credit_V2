import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import EntryCard from "../../components/admin/EntryCard";
import { decideEntries, getEntryQueue, getStaff, type QueueItem, type StaffProfile } from "../../lib/performanceApi";

const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";

function Queue() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEntryQueue()
      .then((q) => {
        if (!cancelled) {
          setItems(q.items);
          setPicked(new Set());
        }
      })
      .catch((e) => {
        if (!cancelled) setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't load the queue." });
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function decide(approve: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await decideEntries([...picked], approve, reason);
      const failed = res.failed.length;
      setMsg({ ok: failed === 0, text: `${res.updated} ${approve ? "verified" : "sent back"}${failed ? `; ${failed} couldn't be updated (${res.failed[0].reason})` : ""}.` });
      setReason("");
      setTick((t) => t + 1);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't update." });
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => setPicked((p) => {
    const next = new Set(p);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <section className={card}>
      <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Waiting for you to verify</h2>
      <p className="mb-3 text-xs text-ink-500">Only verified figures count towards a score. You never see your own figures, or ones you entered, here.</p>
      {items === null ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing is waiting for you.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Figures waiting for verification</caption>
              <thead>
                <tr className="text-xs text-ink-500">
                  <th scope="col" className="py-2 pr-2"><span className="sr-only">Select</span></th>
                  <th scope="col" className="py-2 pr-3">Name</th><th scope="col" className="py-2 pr-3">Branch / team</th><th scope="col" className="py-2 pr-3">Month</th>
                  <th scope="col" className="py-2 pr-3">Figure</th><th scope="col" className="py-2 pr-3">Value</th><th scope="col" className="py-2">Target</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.entry_id} className="border-t border-mist-200 text-ink-700">
                    <td className="py-2 pr-2"><input type="checkbox" aria-label={`Select ${i.profile_name} ${i.label}`} checked={picked.has(i.entry_id)} onChange={() => toggle(i.entry_id)} /></td>
                    <td className="py-2 pr-3 font-medium">{i.profile_name}</td><td className="py-2 pr-3">{i.unit_name ?? "—"}</td><td className="py-2 pr-3">{i.month.slice(0, 7)}</td>
                    <td className="py-2 pr-3">{i.label}</td><td className="py-2 pr-3 tabular-nums">{i.value.toLocaleString("en-KE")}{i.unit === "percent" ? "%" : ""}</td>
                    <td className="py-2 tabular-nums">{i.target === null ? "no target" : i.target.toLocaleString("en-KE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <button type="button" className={btn} onClick={() => setPicked(new Set(items.map((i) => i.entry_id)))}>Select all</button>
            <button type="button" className={btn} disabled={busy || picked.size === 0} onClick={() => void decide(true)}>Verify selected</button>
            <label className="min-w-[220px] flex-1 text-xs text-ink-500">Reason for sending back
              <input className={`${input} mt-1 block w-full`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button type="button" className={btn} disabled={busy || picked.size === 0 || reason.trim().length < 3} onClick={() => void decide(false)}>Send back</button>
          </div>
        </>
      )}
      {msg && (
        <p role="status" className={`mt-3 flex items-center gap-1.5 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
          {msg.ok ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
        </p>
      )}
    </section>
  );
}

export default function AdminPerformanceEntries() {
  usePageMeta("Monthly figures");
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [ym, setYm] = useState(() => new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStaff()
      .then((s) => {
        if (!cancelled) setStaff(s.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load staff.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
        <h1 className="font-display text-lg font-bold" style={heading}>Monthly figures</h1>
        <p className="text-sm text-ink-500">Verify your team's figures, or enter figures for someone who doesn't have a login.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Queue />
      <section className={card}>
        <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Enter figures for someone</h2>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-500">Person
            <select className={`${input} mt-1 block`} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">Choose…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.unit_name ? ` - ${s.unit_name}` : ""}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-500">Month
            <input type="month" className={`${input} mt-1 block`} value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} />
          </label>
        </div>
        {profileId ? <EntryCard profileId={profileId} ym={ym} /> : <p className="text-sm text-ink-500">Choose a person to see and enter their figures.</p>}
      </section>
    </div>
  );
}
