import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import { getCurrentAdminRole } from "../../lib/adminApi";
import {
  bulkTargets,
  decideTargetRequest,
  getLevels,
  getPerformanceRoles,
  getRoleJD,
  getStaffTargets,
  getTargetRequests,
  getTargetsGrid,
  getUnits,
  requestTargetChange,
  setStaffTarget,
  withdrawTargetRequest,
  type BulkInput,
  type BulkMode,
  type BulkResult,
  type Kpi,
  type PerformanceLevel,
  type PerformanceRole,
  type PerformanceUnit,
  type TargetGridRow,
  type TargetHistoryRow,
  type TargetRequest,
} from "../../lib/performanceApi";

const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none disabled:opacity-60";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";
const fmt = (n: number | null, unit?: string) =>
  n === null ? "no target" : `${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}${unit === "percent" ? "%" : ""}`;
const monthStart = (ym: string) => `${ym}-01`;
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

type Notice = { ok: boolean; text: string } | null;

function Row({
  row, kpi, month, canSet, onDone,
}: { row: TargetGridRow; kpi: Kpi; month: string; canSet: boolean; onDone: (n: Notice) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [from, setFrom] = useState(month);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<TargetHistoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && history === null) {
      try {
        const t = await getStaffTargets(row.profile_id, monthStart(month));
        setHistory(t.history.filter((h) => h.kpi_key === kpi.key));
      } catch (e) {
        onDone({ ok: false, text: message(e, "Couldn't load the history.") });
      }
    }
  }
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    const payload = { kpi_key: kpi.key, effective_from: monthStart(from), value: Number(value), reason };
    try {
      if (canSet) {
        const res = await setStaffTarget(row.profile_id, payload);
        onDone({ ok: true, text: `${row.full_name}: ${res.message}` });
      } else {
        await requestTargetChange(row.profile_id, payload);
        onDone({ ok: true, text: `Request for ${row.full_name} sent for approval.` });
      }
      setOpen(false);
      setHistory(null);
      setValue("");
      setReason("");
    } catch (e) {
      onDone({ ok: false, text: message(e, "Couldn't save.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Fragment>
      <tr className="border-t border-mist-200 text-ink-700">
        <td className="py-2 pr-3 font-medium">{row.full_name}</td>
        <td className="py-2 pr-3">{row.unit_name ?? "—"}</td>
        <td className="py-2 pr-3">{row.level_label ?? "—"}</td>
        <td className="py-2 pr-3 tabular-nums">{row.has_kpi ? fmt(row.value, kpi.unit) : "n/a for this role"}</td>
        <td className="py-2 pr-3 text-xs text-ink-500">{row.value !== null ? `from ${row.effective_from} (${row.source})` : ""}</td>
        <td className="py-2">
          {row.has_kpi && (
            <button type="button" className="text-xs font-semibold text-ink-700 underline" aria-expanded={open} onClick={() => void toggle()}>
              {canSet ? "Change / history" : "Request change / history"}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-mist-50">
          <td colSpan={6} className="px-3 py-3">
            <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-ink-500">
                New target{kpi.unit === "kes" ? " (KES)" : ""}
                <input type="number" min="0" step="any" required className={`${input} mt-1 block w-36`} value={value} onChange={(e) => setValue(e.target.value)} />
              </label>
              <label className="text-xs text-ink-500">
                From month
                <input type="month" required className={`${input} mt-1 block`} value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="min-w-[220px] flex-1 text-xs text-ink-500">
                Reason (required)
                <input required minLength={3} maxLength={300} className={`${input} mt-1 block w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <button type="submit" disabled={busy} className={btn}>{canSet ? "Save target" : "Send for approval"}</button>
            </form>
            {history !== null && (
              <table className="mt-3 w-full text-left text-xs">
                <caption className="sr-only">Target history for {row.full_name}</caption>
                <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-3">From</th><th scope="col" className="py-1 pr-3">Target</th><th scope="col" className="py-1 pr-3">Why</th><th scope="col" className="py-1">By</th></tr></thead>
                <tbody>
                  {history.length === 0 && <tr><td colSpan={4} className="py-1 text-ink-500">No targets recorded yet.</td></tr>}
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-mist-200 text-ink-700">
                      <td className="py-1 pr-3">{h.effective_from}</td><td className="py-1 pr-3 tabular-nums">{fmt(h.value, kpi.unit)}</td><td className="py-1 pr-3">{h.reason}</td><td className="py-1">{h.set_by_username ?? "—"} ({h.source})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function Requests({ canSet, tick, onDone }: { canSet: boolean; tick: number; onDone: (n: Notice) => void }) {
  const [items, setItems] = useState<TargetRequest[]>([]);
  const [note, setNote] = useState("");
  const [local, setLocal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getTargetRequests("pending")
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tick, local]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      onDone({ ok: true, text: ok });
      setLocal((n) => n + 1);
    } catch (e) {
      onDone({ ok: false, text: message(e, "Couldn't update the request.") });
    }
  }

  if (items.length === 0) return null;
  return (
    <section className={card}>
      <h2 className="mb-3 font-display text-sm font-bold" style={heading}>{canSet ? "Target change requests awaiting a decision" : "Your pending requests"}</h2>
      {canSet && (
        <label className="mb-3 block text-xs text-ink-500">
          Note for the requester (optional)
          <input className={`${input} mt-1 block w-full max-w-md`} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-mist-200 p-3 text-sm text-ink-700">
            <span>
              <strong>{r.profile_name}</strong> · {r.kpi_key}: {fmt(r.current_value)} → <strong>{fmt(r.proposed_value)}</strong> from {r.effective_from}
              <span className="block text-xs text-ink-500">“{r.reason}” - requested by {r.requested_by_username}</span>
            </span>
            <span className="flex gap-2">
              {r.can_decide && (
                <>
                  <button type="button" className={btn} onClick={() => void act(() => decideTargetRequest(r.id, true, note), "Approved and applied.")}>Approve</button>
                  <button type="button" className={btn} onClick={() => void act(() => decideTargetRequest(r.id, false, note), "Request rejected.")}>Reject</button>
                </>
              )}
              {r.is_mine && (
                <button type="button" className={btn} onClick={() => void act(() => withdrawTargetRequest(r.id), "Request withdrawn.")}>Withdraw</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminPerformanceTargets() {
  usePageMeta("Targets");
  const adminRole = getCurrentAdminRole();
  const canSet = adminRole === "admin" || adminRole === "hr";

  const [roles, setRoles] = useState<PerformanceRole[]>([]);
  const [units, setUnits] = useState<PerformanceUnit[]>([]);
  const [levels, setLevels] = useState<PerformanceLevel[]>([]);
  const [roleId, setRoleId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [kpiKey, setKpiKey] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [kpiState, setKpiState] = useState<{ roleId: string; kpis: Kpi[] } | null>(null);
  const [rows, setRows] = useState<TargetGridRow[]>([]);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRole = roleId || roles.find((r) => r.key === "loan_officer")?.id || roles[0]?.id || "";
  const kpis = kpiState?.roleId === activeRole ? kpiState.kpis : [];
  const activeKpi = kpis.find((k) => k.key === kpiKey) ?? kpis[0];

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPerformanceRoles(), getUnits(), getLevels()])
      .then(([r, u, l]) => {
        if (cancelled) return;
        setRoles(r.items);
        setUnits(u.items);
        setLevels(l.items);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e, "Couldn't load."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeRole) return;
    let cancelled = false;
    getRoleJD(activeRole)
      .then((v) => {
        if (!cancelled) setKpiState({ roleId: activeRole, kpis: v.kpis.filter((k) => k.source !== "appraisal_rating") });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  const gridKey = activeKpi?.key;
  useEffect(() => {
    if (!gridKey) return;
    let cancelled = false;
    getTargetsGrid({ kpi_key: gridKey, month: monthStart(month), role_id: activeRole, unit_id: unitId, level_id: levelId })
      .then((g) => {
        if (!cancelled) {
          setRows(g.items);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(message(e, "Couldn't load targets."));
      });
    return () => {
      cancelled = true;
    };
  }, [gridKey, month, activeRole, unitId, levelId, tick]);

  const done = (n: Notice) => {
    setNotice(n);
    if (n?.ok) setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
        <h1 className="font-display text-lg font-bold" style={heading}>Targets</h1>
        <p className="text-sm text-ink-500">
          A target applies from the month you choose until it is changed; earlier months are never rewritten. Every change needs a reason{canSet ? "." : ", and is sent to HR for approval."}
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {notice && (
        <p role="status" className={`flex items-center gap-1.5 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>
          {notice.ok ? <Check size={14} /> : <AlertCircle size={14} />} {notice.text}
        </p>
      )}

      <Requests canSet={canSet} tick={tick} onDone={done} />

      <section className={card}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-500">Job role
            <select className={`${input} mt-1 block`} value={activeRole} onChange={(e) => { setRoleId(e.target.value); setLevelId(""); setKpiKey(""); }}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-500">KPI
            <select className={`${input} mt-1 block`} value={activeKpi?.key ?? ""} onChange={(e) => setKpiKey(e.target.value)} disabled={kpis.length === 0}>
              {kpis.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-500">Branch / team
            <select className={`${input} mt-1 block`} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">All</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-500">Level
            <select className={`${input} mt-1 block`} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
              <option value="">All</option>
              {levels.filter((l) => l.role_id === activeRole).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-500">Month
            <input type="month" className={`${input} mt-1 block`} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
        </div>
        {kpis.length === 0 ? (
          <p className="text-sm text-ink-500">This role has no KPI with a numeric target yet. Set its KPIs in Performance settings.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-500">No one to show for these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Targets for {activeKpi?.label} in the chosen month</caption>
              <thead>
                <tr className="text-xs text-ink-500">
                  <th scope="col" className="py-2 pr-3">Name</th><th scope="col" className="py-2 pr-3">Branch / team</th><th scope="col" className="py-2 pr-3">Level</th>
                  <th scope="col" className="py-2 pr-3">Target in force</th><th scope="col" className="py-2 pr-3">Since</th><th scope="col" className="py-2" />
                </tr>
              </thead>
              <tbody>
                {activeKpi && rows.map((r) => <Row key={`${r.profile_id}-${activeKpi.key}-${month}`} row={r} kpi={activeKpi} month={month} canSet={canSet} onDone={done} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canSet && <Bulk roleId={activeRole} unitId={unitId} levelId={levelId} kpi={activeKpi} month={month} onDone={done} />}
    </div>
  );
}

function Bulk({ roleId, unitId, levelId, kpi, month, onDone }: { roleId: string; unitId: string; levelId: string; kpi: Kpi | undefined; month: string; onDone: (n: Notice) => void }) {
  const [mode, setMode] = useState<BulkMode>("level_defaults");
  const [value, setValue] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [source, setSource] = useState(month);
  const [uplift, setUplift] = useState("0");
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<{ key: string; result: BulkResult } | null>(null);
  const [busy, setBusy] = useState(false);

  const body = (dry: boolean): BulkInput => ({
    mode, effective_from: monthStart(month), reason, dry_run: dry, role_id: roleId || null, unit_id: unitId || null, level_id: levelId || null,
    kpi_key: mode === "level_defaults" ? null : kpi?.key ?? null, value: mode === "set_value" ? Number(value) : null,
    overwrite, source_month: mode === "copy_forward" ? monthStart(source) : null, uplift_pct: Number(uplift) || 0,
  });
  const paramsKey = JSON.stringify(body(true));

  async function run(dry: boolean) {
    setBusy(true);
    try {
      const result = await bulkTargets(body(dry));
      if (dry) {
        setPlan({ key: paramsKey, result });
      } else {
        setPlan(null);
        onDone({ ok: true, text: `Applied: ${result.applied} target${result.applied === 1 ? "" : "s"} written.` });
      }
    } catch (e) {
      setPlan(null);
      onDone({ ok: false, text: message(e, "Couldn't run that.") });
    } finally {
      setBusy(false);
    }
  }

  const ready = plan?.key === paramsKey;
  return (
    <section className={card}>
      <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Bulk tools</h2>
      <p className="mb-3 text-xs text-ink-500">Applies to the people matching the role, branch and level filters above, from the month chosen above. You always see a preview first.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-500">What to do
          <select className={`${input} mt-1 block`} value={mode} onChange={(e) => setMode(e.target.value as BulkMode)}>
            <option value="level_defaults">Apply level defaults</option>
            <option value="set_value">Set one value</option>
            <option value="copy_forward">Copy forward from an earlier month</option>
          </select>
        </label>
        {mode === "set_value" && (
          <label className="text-xs text-ink-500">Value for {kpi?.label ?? "the KPI"}
            <input type="number" min="0" step="any" className={`${input} mt-1 block w-36`} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        )}
        {mode === "level_defaults" && (
          <label className="flex items-center gap-2 text-xs text-ink-500">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Replace targets that already exist
          </label>
        )}
        {mode === "copy_forward" && (
          <>
            <label className="text-xs text-ink-500">Copy from
              <input type="month" className={`${input} mt-1 block`} value={source} onChange={(e) => e.target.value && setSource(e.target.value)} />
            </label>
            <label className="text-xs text-ink-500">Uplift %
              <input type="number" step="any" className={`${input} mt-1 block w-24`} value={uplift} onChange={(e) => setUplift(e.target.value)} />
            </label>
          </>
        )}
        <label className="min-w-[220px] flex-1 text-xs text-ink-500">Reason (required)
          <input className={`${input} mt-1 block w-full`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className={btn} disabled={busy || reason.trim().length < 3} onClick={() => void run(true)}>Preview</button>
        <button type="button" className={btn} disabled={busy || !ready || plan.result.summary.create === 0} onClick={() => void run(false)}>Apply</button>
      </div>
      {plan && (
        <div className="mt-4" aria-live="polite">
          <p className="text-sm text-ink-700">
            {plan.result.summary.create} to write · {plan.result.summary.unchanged} unchanged · {plan.result.summary.skip} skipped
            {!ready && <span className="ml-2 text-amber-700">(settings changed - preview again before applying)</span>}
          </p>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Bulk change preview</caption>
              <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-3">Name</th><th scope="col" className="py-1 pr-3">KPI</th><th scope="col" className="py-1 pr-3">Now</th><th scope="col" className="py-1 pr-3">New</th><th scope="col" className="py-1">What happens</th></tr></thead>
              <tbody>
                {plan.result.items.slice(0, 200).map((i, idx) => (
                  <tr key={`${i.profile_id}-${i.kpi_key}-${idx}`} className="border-t border-mist-200 text-ink-700">
                    <td className="py-1 pr-3">{i.full_name}</td><td className="py-1 pr-3">{i.kpi_key ?? "—"}</td><td className="py-1 pr-3 tabular-nums">{i.current ?? "—"}</td><td className="py-1 pr-3 tabular-nums">{i.new ?? "—"}</td>
                    <td className="py-1">{i.action}{i.note ? ` - ${i.note}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.result.items.length > 200 && <p className="mt-1 text-xs text-ink-500">Showing the first 200 of {plan.result.items.length}.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
