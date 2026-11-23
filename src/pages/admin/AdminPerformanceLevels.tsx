import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import { getCurrentAdminRole } from "../../lib/adminApi";
import {
  createLevel,
  getLevels,
  getPerformanceRoles,
  getRoleJD,
  updateLevel,
  type Kpi,
  type PerformanceLevel,
  type PerformanceRole,
} from "../../lib/performanceApi";

const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none disabled:opacity-60";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const fmt = (n: number | undefined, unit: string) =>
  n === undefined ? "—" : `${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}${unit === "percent" ? "%" : ""}`;

type Notice = { ok: boolean; text: string } | null;
type Draft = { id: string | null; label: string; rank: string; note: string; targets: Record<string, string> };

const blank = (rank: number): Draft => ({ id: null, label: "", rank: String(rank), note: "", targets: {} });
const fromLevel = (l: PerformanceLevel): Draft => ({
  id: l.id,
  label: l.label,
  rank: String(l.rank),
  note: l.note ?? "",
  targets: Object.fromEntries(Object.entries(l.default_targets).map(([k, v]) => [k, String(v)])),
});

export default function AdminPerformanceLevels() {
  usePageMeta("Levels");
  const canEdit = getCurrentAdminRole() === "admin";

  const [roles, setRoles] = useState<PerformanceRole[]>([]);
  const [roleId, setRoleId] = useState("");
  const [levels, setLevels] = useState<PerformanceLevel[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRole = roleId || roles.find((r) => r.key === "loan_officer")?.id || roles[0]?.id || "";

  useEffect(() => {
    let cancelled = false;
    getPerformanceRoles()
      .then((r) => {
        if (!cancelled) setRoles(r.items);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e, "Couldn't load the roles."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeRole) return;
    let cancelled = false;
    Promise.all([getLevels(activeRole, true), getRoleJD(activeRole)])
      .then(([l, v]) => {
        if (cancelled) return;
        setLevels(l.items);
        setKpis(v.kpis.filter((k) => k.source !== "appraisal_rating"));
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e, "Couldn't load the levels."));
      });
    return () => {
      cancelled = true;
    };
  }, [activeRole, tick]);

  function startAdd() {
    setNotice(null);
    setDraft(blank((levels.reduce((m, l) => Math.max(m, l.rank), 0) || 0) + 1));
  }

  async function save() {
    if (!draft) return;
    const rank = Number(draft.rank);
    if (!draft.label.trim()) return setNotice({ ok: false, text: "Give the level a name." });
    if (!Number.isInteger(rank) || rank < 1 || rank > 20) return setNotice({ ok: false, text: "Rank must be a whole number from 1 to 20." });
    const targets: Record<string, number> = {};
    for (const k of kpis) {
      const raw = (draft.targets[k.key] ?? "").trim();
      if (raw === "") continue;
      const n = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) return setNotice({ ok: false, text: `The ${k.label} default must be a number from 0.` });
      targets[k.key] = n;
    }
    setBusy(true);
    setNotice(null);
    try {
      const body = { label: draft.label.trim(), rank, default_targets: targets, note: draft.note.trim() || null };
      const r = draft.id ? await updateLevel(draft.id, body) : await createLevel(activeRole, body);
      setNotice({ ok: true, text: r.message });
      setDraft(null);
      setTick((t) => t + 1);
    } catch (e) {
      setNotice({ ok: false, text: message(e, "Couldn't save the level.") });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(l: PerformanceLevel) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await updateLevel(l.id, { is_active: !l.is_active });
      setNotice({ ok: true, text: r.message });
      setTick((t) => t + 1);
    } catch (e) {
      setNotice({ ok: false, text: message(e, "Couldn't change the level.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
        <h1 className="font-display text-lg font-bold" style={heading}>Levels</h1>
        <p className="text-sm text-ink-500">
          The seniority levels of each job role and their default targets. Changing a default never changes anyone's current target: defaults are
          applied only when you choose "Apply level defaults" on the Targets page, and you see a preview first.
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

      <section className={card}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <label className="text-xs text-ink-500">Job role
            <select className={`${input} mt-1 block`} value={activeRole} onChange={(e) => { setRoleId(e.target.value); setDraft(null); }}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          {canEdit && <button type="button" className={btn} onClick={startAdd} disabled={!activeRole || busy}>Add a level</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-mist-200 text-xs text-ink-500">
                <th scope="col" className="py-2 pr-3">Rank</th>
                <th scope="col" className="py-2 pr-3">Level</th>
                {kpis.map((k) => <th key={k.key} scope="col" className="py-2 pr-3">{k.label}</th>)}
                <th scope="col" className="py-2 pr-3">Staff</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                {canEdit && <th scope="col" className="py-2 pr-3"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.id} className={`border-b border-mist-100 ${l.is_active ? "" : "opacity-60"}`}>
                  <td className="py-2 pr-3">{l.rank}</td>
                  <td className="py-2 pr-3 font-semibold">{l.label}</td>
                  {kpis.map((k) => <td key={k.key} className="py-2 pr-3">{fmt(l.default_targets[k.key], k.unit)}</td>)}
                  <td className="py-2 pr-3">{l.staff_count}</td>
                  <td className="py-2 pr-3">{l.is_active ? "Active" : "Retired"}</td>
                  {canEdit && (
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <button type="button" className="mr-3 text-xs font-semibold text-ink-700 underline" onClick={() => { setNotice(null); setDraft(fromLevel(l)); }} disabled={busy}>Edit</button>
                      <button type="button" className="text-xs font-semibold text-ink-500 underline" onClick={() => toggleActive(l)} disabled={busy}>{l.is_active ? "Retire" : "Restore"}</button>
                    </td>
                  )}
                </tr>
              ))}
              {levels.length === 0 && (
                <tr><td className="py-4 text-ink-500" colSpan={kpis.length + 5}>This role has no levels yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!canEdit && <p className="mt-3 text-xs text-ink-500">Only administrators can change levels.</p>}
      </section>

      {canEdit && draft && (
        <section className={card} aria-label={draft.id ? "Edit level" : "Add a level"}>
          <h2 className="mb-3 text-sm font-bold" style={heading}>{draft.id ? "Edit level" : "Add a level"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-ink-500">Level name
              <input className={`${input} mt-1 block w-full`} value={draft.label} maxLength={80} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </label>
            <label className="text-xs text-ink-500">Rank (1 = most junior)
              <input className={`${input} mt-1 block w-full`} inputMode="numeric" value={draft.rank} onChange={(e) => setDraft({ ...draft, rank: e.target.value })} />
            </label>
            {kpis.map((k) => (
              <label key={k.key} className="text-xs text-ink-500">Default {k.label}{k.unit === "percent" ? " (%)" : ""}
                <input
                  className={`${input} mt-1 block w-full`}
                  inputMode="decimal"
                  placeholder="No default"
                  value={draft.targets[k.key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, targets: { ...draft.targets, [k.key]: e.target.value } })}
                />
              </label>
            ))}
            <label className="text-xs text-ink-500 sm:col-span-2">Note (optional)
              <input className={`${input} mt-1 block w-full`} value={draft.note} maxLength={300} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className={btn} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save level"}</button>
            <button type="button" className={btn} onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
          </div>
        </section>
      )}
    </div>
  );
}
