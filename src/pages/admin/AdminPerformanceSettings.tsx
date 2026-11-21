import { useEffect, useState } from "react";
import { AlertCircle, Check, Plus, Trash2 } from "lucide-react";
import {
  createPerformanceRole,
  deletePerformanceRole,
  getPerformanceConfig,
  getPerformanceRoles,
  savePerformanceConfig,
  updatePerformanceRole,
  type PerformanceConfig,
  type PerformanceRole,
  type RoleKind,
} from "../../lib/performanceApi";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { usePageMeta } from "../../lib/usePageMeta";
import { Link } from "react-router-dom";
import RatingScaleEditor from "../../components/admin/RatingScaleEditor";

const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const KIND_LABEL: Record<RoleKind, string> = {
  sales: "Sales (monthly figures vs target)",
  appraisal: "Appraisal (quarterly, against JD)",
  hybrid: "Hybrid (both)",
};

export default function AdminPerformanceSettings() {
  usePageMeta("Performance Settings");
  const { role } = useAdminAuth();
  const isAdmin = role === "admin";

  const [cfg, setCfg] = useState<PerformanceConfig | null>(null);
  const [version, setVersion] = useState(0);
  const [roles, setRoles] = useState<PerformanceRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cfgMsg, setCfgMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<RoleKind>("appraisal");
  const [newDept, setNewDept] = useState("");

  const [tick, setTick] = useState(0);
  const loadAll = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPerformanceConfig(), getPerformanceRoles(true)])
      .then(([c, r]) => {
        if (cancelled) return;
        setCfg(c.config);
        setVersion(c.version);
        setRoles(r.items);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (!isAdmin) return <p className="text-sm text-ink-500">Only administrators can change performance settings.</p>;
  if (error)
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    );
  if (!cfg) return <p className="text-sm text-ink-500">Loading…</p>;

  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function saveConfig() {
    if (!cfg) return;
    setSaving(true);
    setCfgMsg(null);
    try {
      const res = await savePerformanceConfig(cfg);
      setCfg(res.data.config);
      setVersion(res.data.version);
      setCfgMsg({ ok: true, text: "Settings saved." });
    } catch (e) {
      setCfgMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  }

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim().length < 2) return;
    try {
      await createPerformanceRole({ name: newName.trim(), kind: newKind, department: newDept.trim() || null });
      setNewName("");
      setNewDept("");
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't add role.");
    }
  }

  async function toggleRole(r: PerformanceRole) {
    try {
      await updatePerformanceRole(r.id, { is_active: !r.is_active });
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update role.");
    }
  }

  async function removeRole(r: PerformanceRole) {
    if (!confirm(`Delete the role "${r.name}"? This can't be undone.`)) return;
    try {
      await deletePerformanceRole(r.id);
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete role.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
          Performance Settings
        </h1>
        <p className="text-sm text-ink-500">Configure job roles, scoring settings and how scores are categorised. Settings version {version}.</p>
      </div>

      <RatingScaleEditor />

      <section className={card}>
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>General</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-ink-500">
            Financial year starts in month (1-12)
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.fiscal_year_start_month} onChange={(e) => setCfg({ ...cfg, fiscal_year_start_month: num(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            Days after month end sales can still be entered
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.sales_entry_window_days} onChange={(e) => setCfg({ ...cfg, sales_entry_window_days: num(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            New-hire ramp-up months (pro-rated target)
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.ramp_up_months} onChange={(e) => setCfg({ ...cfg, ramp_up_months: num(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            Final appraisal rating
            <select className={`${input} mt-1 w-full`} value={cfg.rating_authority} onChange={(e) => setCfg({ ...cfg, rating_authority: e.target.value as "manager" | "average" })}>
              <option value="manager">Manager's rating is final</option>
              <option value="average">Average of self and manager</option>
            </select>
          </label>
          <label className="text-xs text-ink-500">
            Achievement cap per KPI (%)
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.achievement_cap_pct} onChange={(e) => setCfg({ ...cfg, achievement_cap_pct: num(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            Share of score from behavioural competencies (%)
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.competency_share_pct} onChange={(e) => setCfg({ ...cfg, competency_share_pct: num(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            Keep performance records for (years)
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.retention_years} onChange={(e) => setCfg({ ...cfg, retention_years: num(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            Early warning: consecutive months below
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.early_warning.consecutive_months_below} onChange={(e) => setCfg({ ...cfg, early_warning: { ...cfg.early_warning, consecutive_months_below: num(e.target.value) } })} />
          </label>
          <label className="text-xs text-ink-500">
            Early warning: "below" means under (% of target)
            <input type="number" className={`${input} mt-1 w-full`} value={cfg.early_warning.below_threshold_pct} onChange={(e) => setCfg({ ...cfg, early_warning: { ...cfg.early_warning, below_threshold_pct: num(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-500 sm:col-span-2">
            <input type="checkbox" checked={cfg.show_peer_rankings} onChange={(e) => setCfg({ ...cfg, show_peer_rankings: e.target.checked })} />
            Let staff see how they rank against peers
          </label>
        </div>
        {cfgMsg && (
          <p className={`mt-4 rounded-lg border p-2.5 text-xs ${cfgMsg.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-600"}`}>{cfgMsg.text}</p>
        )}
        <button onClick={saveConfig} disabled={saving} className="mt-4 flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          <Check size={13} /> {saving ? "Saving…" : "Save settings"}
        </button>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>Job roles being measured</h2>
        <p className="mb-4 text-xs text-ink-500">
          These are job families (e.g. Credit Risk Analyst), separate from dashboard login roles. Each gets its own job description and KPIs in the next phase.
        </p>
        <form onSubmit={addRole} className="mb-4 flex flex-wrap gap-2">
          <input className={input} placeholder="New role name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className={input} placeholder="Department (optional)" value={newDept} onChange={(e) => setNewDept(e.target.value)} />
          <select className={input} value={newKind} onChange={(e) => setNewKind(e.target.value as RoleKind)}>
            {(Object.keys(KIND_LABEL) as RoleKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <button className="flex items-center gap-1.5 rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50">
            <Plus size={13} /> Add role
          </button>
        </form>
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-mist-200 p-3">
              <div>
                <p className={`text-sm font-semibold ${r.is_active ? "text-ink-700" : "text-ink-400 line-through"}`}>
                  {r.name} {r.is_system && <span className="ml-1 text-[10px] font-medium uppercase text-ink-400">built-in</span>}
                </p>
                <p className="text-xs text-ink-500">
                  {KIND_LABEL[r.kind]} · {r.department ?? "No department"} · {r.staff_count} staff · {r.configured ? `JD v${r.current_version}` : "Needs JD / KPIs"}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/performance-settings/roles/${r.id}`} className="rounded-lg border border-mist-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700">
                  JD &amp; KPIs
                </Link>
                <button onClick={() => toggleRole(r)} className="rounded-full border border-mist-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-mist-50">
                  {r.is_active ? "Deactivate" : "Reactivate"}
                </button>
                {!r.is_system && (
                  <button onClick={() => removeRole(r)} aria-label={`Delete ${r.name}`} className="rounded-full p-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
