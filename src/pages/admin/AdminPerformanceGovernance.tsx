import { useCallback, useEffect, useState } from "react";
import {
  anonymiseLeaver, getDeliveryReport, getLocks, getNoticeOutstanding, getRetentionCandidates, lockPeriod, reopenPeriod,
  type DeliveryReport, type PeriodLockRow, type RetentionCandidates,
} from "../../lib/performanceApi";
import { usePageMeta } from "../../lib/usePageMeta";
import { getCurrentAdminRole } from "../../lib/adminApi";

const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const input = "rounded-lg border border-mist-200 px-2 py-1.5 text-sm";

function msg(e: unknown) {
  return e instanceof Error ? e.message : "That didn't work.";
}

function Locks() {
  const [rows, setRows] = useState<PeriodLockRow[]>([]);
  const [period, setPeriod] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => getLocks().then((d) => setRows(d.items)).catch((e) => setErr(msg(e))), []);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (fn: () => Promise<string>) => {
    setErr(null);
    setNote(null);
    try {
      setNote(await fn());
      load();
    } catch (e) {
      setErr(msg(e));
    }
  };
  return (
    <section aria-labelledby="locks-h" className="space-y-3">
      <h2 id="locks-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>Period locks</h2>
      <p className="text-sm text-ink-600">Lock finished months once they are checked. Entries, verification and imports for a locked month are refused until you reopen it with a reason.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-ink-600"><span className="block font-semibold">Period (2026-03, 2026-Q1 …)</span><input value={period} onChange={(e) => setPeriod(e.target.value)} className={input} maxLength={30} /></label>
        <label className="text-xs text-ink-600"><span className="block font-semibold">Reason (to reopen)</span><input value={reason} onChange={(e) => setReason(e.target.value)} className={`${input} w-64`} maxLength={300} /></label>
        <button className={btn} disabled={!period} onClick={() => run(async () => `Locked: ${(await lockPeriod(period)).locked.join(", ") || "already locked"}`)}>Lock</button>
        <button className={btn} disabled={!period || reason.trim().length < 5} onClick={() => run(async () => `Reopened: ${(await reopenPeriod(period, reason)).reopened.join(", ") || "nothing was locked"}`)}>Reopen</button>
      </div>
      {note && <p role="status" className="text-sm text-ink-600">{note}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Month locks</caption>
        <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-2">Month</th><th scope="col" className="py-1 pr-2">Status</th><th scope="col" className="py-1 pr-2">By</th><th scope="col" className="py-1">Reopen reason</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-t border-mist-100"><td className="py-1 pr-2">{r.month}</td><td className="py-1 pr-2">{r.status}</td><td className="py-1 pr-2">{r.status === "locked" ? r.locked_by : r.reopened_by}</td><td className="py-1">{r.reopen_reason ?? ""}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Retention({ isAdmin }: { isAdmin: boolean }) {
  const [data, setData] = useState<RetentionCandidates | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => getRetentionCandidates().then(setData).catch((e) => setErr(msg(e))), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <section aria-labelledby="ret-h" className="space-y-3">
      <h2 id="ret-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>Retention</h2>
      <p className="text-sm text-ink-600">
        Records are kept for {data?.retention_years ?? 7} years after a person leaves. Nothing is removed automatically. {isAdmin ? "An administrator can anonymise one person: name, employee number, login link, notes, comments and uploaded files are removed; the figures stay as statistics. This can't be undone." : "Only an administrator can anonymise."}
      </p>
      {note && <p role="status" className="text-sm text-ink-600">{note}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {data && data.items.length === 0 && <p className="text-sm text-ink-600">Nobody is past the retention period.</p>}
      <ul className="space-y-2">
        {data?.items.map((p) => (
          <li key={p.profile_id} className="flex flex-wrap items-end gap-2 rounded-xl border border-mist-200 p-3 text-sm">
            <span className="mr-auto">{p.name} <span className="text-xs text-ink-500">left {p.exit_date}</span></span>
            {isAdmin && (
              <>
                <label className="text-xs text-ink-600"><span className="block font-semibold">Type ANONYMISE</span><input value={typed[p.profile_id] ?? ""} onChange={(e) => setTyped({ ...typed, [p.profile_id]: e.target.value })} className={input} maxLength={20} /></label>
                <button className={btn} disabled={typed[p.profile_id] !== "ANONYMISE"} onClick={async () => {
                  setErr(null);
                  try {
                    const r = await anonymiseLeaver(p.profile_id, "ANONYMISE");
                    setNote(`Anonymised: ${r.files} file(s) and ${r.text_fields} text field(s) removed.`);
                    load();
                  } catch (e) {
                    setErr(msg(e));
                  }
                }}>Anonymise</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Delivery() {
  const [d, setD] = useState<DeliveryReport | null>(null);
  useEffect(() => {
    getDeliveryReport().then(setD).catch(() => undefined);
  }, []);
  if (!d) return null;
  return (
    <section aria-labelledby="deliv-h" className="space-y-2">
      <h2 id="deliv-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>Email and SMS reminders</h2>
      <p className="text-sm text-ink-600">Email: {d.email_configured ? "set up" : "not set up"} · SMS: {d.sms_configured ? "set up" : "not set up"} · last 14 days (since {d.since})</p>
      {d.counts.length === 0 ? <p className="text-sm text-ink-600">Nothing has been sent yet.</p> : (
        <ul className="text-sm">{d.counts.map((c) => <li key={`${c.channel}-${c.status}`}>{c.channel}: {c.count} {c.status}</li>)}</ul>
      )}
    </section>
  );
}

function Notice() {
  const [d, setD] = useState<{ version: string; items: { profile_id: string; name: string }[] } | null>(null);
  useEffect(() => {
    getNoticeOutstanding().then(setD).catch(() => undefined);
  }, []);
  if (!d) return null;
  return (
    <section aria-labelledby="notice-out-h" className="space-y-2">
      <h2 id="notice-out-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>Data-use notice (version {d.version})</h2>
      {d.items.length === 0 ? <p className="text-sm text-ink-600">Everyone with a login has acknowledged it.</p> : (
        <p className="text-sm text-ink-600">{d.items.length} not yet acknowledged: {d.items.map((i) => i.name).join(", ")}</p>
      )}
    </section>
  );
}

export default function AdminPerformanceGovernance() {
  usePageMeta("Performance governance");
  const isAdmin = getCurrentAdminRole() === "admin";
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Governance</h1>
        <p className="text-sm text-ink-500">Period locks, the staff data-use notice and the retention period. HR and administrators only.</p>
      </div>
      <Locks />
      <Notice />
      <Delivery />
      <Retention isAdmin={isAdmin} />
    </div>
  );
}
