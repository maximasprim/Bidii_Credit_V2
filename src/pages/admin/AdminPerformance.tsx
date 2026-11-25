import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Plus, Pencil, Check, X } from "lucide-react";
import {
  createStaff,
  getLevels,
  getLinkableUsers,
  getPerformanceRoles,
  getStaff,
  getUnits,
  updateStaff,
  type LinkableUser,
  type PerformanceLevel,
  type PerformanceRole,
  type PerformanceUnit,
  type StaffInput,
  type StaffProfile,
  type StaffStatus,
} from "../../lib/performanceApi";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";
import StaffCoverageEditor from "../../components/admin/performance/StaffCoverageEditor";

const STATUSES: StaffStatus[] = ["active", "probation", "pip", "exited"];
const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none";

type Form = {
  full_name: string;
  performance_role_id: string;
  admin_user_id: string;
  employee_no: string;
  unit_id: string;
  manager_id: string;
  level_id: string;
  hire_date: string;
  probation_end_date: string;
  status: StaffStatus;
};

const emptyForm: Form = {
  full_name: "",
  performance_role_id: "",
  admin_user_id: "",
  employee_no: "",
  unit_id: "",
  manager_id: "",
  level_id: "",
  hire_date: "",
  probation_end_date: "",
  status: "active",
};

const toForm = (p: StaffProfile): Form => ({
  full_name: p.full_name,
  performance_role_id: p.performance_role_id,
  admin_user_id: p.admin_user_id ?? "",
  employee_no: p.employee_no ?? "",
  unit_id: p.unit_id ?? "",
  manager_id: p.manager_id ?? "",
  level_id: p.level_id ?? "",
  hire_date: p.hire_date ?? "",
  probation_end_date: p.probation_end_date ?? "",
  status: p.status,
});

const toPayload = (f: Form): StaffInput => ({
  full_name: f.full_name.trim(),
  performance_role_id: f.performance_role_id,
  admin_user_id: f.admin_user_id || null,
  employee_no: f.employee_no.trim() || null,
  unit_id: f.unit_id || null,
  manager_id: f.manager_id || null,
  level_id: f.level_id || null,
  hire_date: f.hire_date || null,
  probation_end_date: f.probation_end_date || null,
  status: f.status,
});

export default function AdminPerformance() {
  usePageMeta("Staff Performance");
  const { role } = useAdminAuth();
  const canEdit = role === "admin" || role === "hr";
  const [makeLogin, setMakeLogin] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [managers, setManagers] = useState<StaffProfile[]>([]); // unfiltered, so filters never hide a valid manager
  const [roles, setRoles] = useState<PerformanceRole[]>([]);
  const [units, setUnits] = useState<PerformanceUnit[]>([]);
  const [levels, setLevels] = useState<PerformanceLevel[]>([]);
  const [linkable, setLinkable] = useState<LinkableUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState(""); // what is searched for (follows the box 300 ms after you stop typing)
  const [qInput, setQInput] = useState(""); // what is in the box
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);
  // True when the list loaded without a search term held everyone (fewer than the server's page size). Then typing just filters that
  // list in the browser, so results follow every keystroke with no wait and no request. If there are more people than one page,
  // the server search (q, after the 300 ms pause) is used as before.
  const [listComplete, setListComplete] = useState(false);
  const serverQ = listComplete ? "" : q;
  const [roleFilter, setRoleFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((t) => t + 1);

  // Everything the page shows (staff, managers, roles, branches/teams, levels) is fetched together and set together, so the
  // filters and the table appear at once instead of filling in one after another. Units and levels are fetched on the first
  // load only; later filter changes refresh just the staff.
  const lookupsLoaded = useRef(false);
  const lastTick = useRef(reloadTick);
  useEffect(() => {
    let cancelled = false;
    // Typing in the search box or changing a filter only needs the staff list again. The roles and the manager list are fetched on the
    // first load and after a save (reloadTick), not on every keystroke.
    const full = !lookupsLoaded.current || lastTick.current !== reloadTick;
    Promise.all([
      getStaff({ q: serverQ, role_id: roleFilter, unit_id: unitFilter, include_inactive: showInactive }),
      full ? getPerformanceRoles() : Promise.resolve(null),
      full ? getStaff().then((all) => all.items).catch(() => null) : Promise.resolve(null),
      lookupsLoaded.current ? Promise.resolve(null) : getUnits().then((d) => d.items).catch(() => null),
      lookupsLoaded.current ? Promise.resolve(null) : getLevels().then((d) => d.items).catch(() => null),
    ])
      .then(([s, r, all, u, l]) => {
        if (cancelled) return;
        if (full) lastTick.current = reloadTick; // only once the fresh lookups have actually landed
        setStaff(s.items);
        if (!serverQ) setListComplete(s.items.length >= s.total);
        if (r) setRoles(r.items);
        if (all) setManagers(all);
        if (u) setUnits(u);
        if (l) setLevels(l);
        if (u || l) lookupsLoaded.current = true;
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load staff.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverQ, roleFilter, unitFilter, showInactive, reloadTick]);

  // What the table shows: the loaded list narrowed by what is in the box right now (same match as the server: part of the name, any case).
  const needle = qInput.trim().toLowerCase();
  const shown = useMemo(() => (needle ? staff.filter((s) => s.full_name.toLowerCase().includes(needle)) : staff), [staff, needle]);

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setEditingId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, saving]);

  async function openForm(target: StaffProfile | "new") {
    setFormError(null);
    if (target === "new") {
      setForm(emptyForm);
      setEditingId("new");
    } else {
      setForm(toForm(target));
      setEditingId(target.id);
    }
    if (canEdit) {
      getLinkableUsers().then((d) => setLinkable(d.items)).catch(() => setLinkable([]));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.performance_role_id) {
      setFormError("Name and performance role are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId === "new") {
        const login = makeLogin && role === "admin" ? { username: loginName.trim(), password: loginPass, role: "staff" } : null;
        await createStaff({ ...toPayload(form), ...(login ? { admin_user_id: null, login } : {}) });
      }
      else if (editingId) await updateStaff(editingId, toPayload(form));
      setEditingId(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const currentLinked = editingId && editingId !== "new" ? staff.find((s) => s.id === editingId) : undefined;
  const linkOptions = [
    ...(currentLinked?.admin_user_id ? [{ id: currentLinked.admin_user_id, username: currentLinked.username ?? "(current login)", role: "", branch_id: null }] : []),
    ...linkable,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
            Staff Performance
          </h1>
          <p className="text-sm text-ink-500">
            {canEdit ? "Manage the people being measured. " : "Staff in your scope. "}
            Scores, charts and projections build on these profiles.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => openForm("new")}
            className="flex items-center gap-1.5 rounded-xl bg-ember-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ember-500)]"
          >
            <Plus size={15} aria-hidden="true" /> Add staff
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {editingId && canEdit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-form-title"
            className="my-auto w-full max-w-3xl space-y-4 rounded-2xl border border-mist-200 bg-surface p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="staff-form-title" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {editingId === "new" ? "New staff profile" : "Edit staff profile"}
                </h2>
                {currentLinked && <p className="text-xs text-ink-500">{currentLinked.full_name}</p>}
              </div>
              <button type="button" onClick={() => setEditingId(null)} disabled={saving} aria-label="Close" className="rounded-full p-1.5 text-ink-500 hover:bg-mist-100 disabled:opacity-50">
                <X size={16} />
              </button>
            </div>
            {formError && <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">{formError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} autoFocus placeholder="Full name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
              <select className={input} value={form.performance_role_id} onChange={(e) => setForm((f) => ({ ...f, performance_role_id: e.target.value, level_id: "" }))}>
                <option value="">Performance role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select className={input} aria-label="Level" value={form.level_id} onChange={(e) => set("level_id", e.target.value)} disabled={!levels.some((l) => l.role_id === form.performance_role_id)}>
                <option value="">Level (none)</option>
                {levels.filter((l) => l.role_id === form.performance_role_id).map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
              <input className={input} placeholder="Employee no. (optional)" value={form.employee_no} onChange={(e) => set("employee_no", e.target.value)} />
              <select className={input} value={form.unit_id} onChange={(e) => set("unit_id", e.target.value)}>
                <option value="">Branch / team (none)</option>
                {units.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select className={input} value={form.manager_id} onChange={(e) => set("manager_id", e.target.value)}>
                <option value="">Line manager (none)</option>
                {managers.filter((s) => s.id !== editingId).map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
              <select className={input} value={form.admin_user_id} onChange={(e) => set("admin_user_id", e.target.value)}>
                <option value="">Dashboard login (not linked)</option>
                {linkOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}{u.role ? ` (${u.role})` : ""}</option>
                ))}
              </select>
              {editingId === "new" && role === "admin" && !form.admin_user_id && (
                <div className="sm:col-span-2 space-y-2 rounded-xl border border-mist-200 p-3">
                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input type="checkbox" checked={makeLogin} onChange={(e) => setMakeLogin(e.target.checked)} />
                    Also create a dashboard login for this person
                  </label>
                  {makeLogin && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className={input} placeholder="Username" autoComplete="off" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
                      <input className={input} type="password" placeholder="Temporary password (8+ characters)" autoComplete="new-password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
              <label className="text-xs text-ink-500">
                Hire date
                <input type="date" className={`${input} mt-1 w-full`} value={form.hire_date} onChange={(e) => set("hire_date", e.target.value)} />
              </label>
              <label className="text-xs text-ink-500">
                Probation ends
                <input type="date" className={`${input} mt-1 w-full`} value={form.probation_end_date} onChange={(e) => set("probation_end_date", e.target.value)} />
              </label>
              <label className="text-xs text-ink-500">
                Status
                <select className={`${input} mt-1 w-full`} value={form.status} onChange={(e) => set("status", e.target.value as StaffStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            {editingId && editingId !== "new" && (
              <StaffCoverageEditor profileId={editingId} mainUnitId={form.unit_id} units={units} collector={roles.find((r) => r.id === form.performance_role_id)?.key === "debt_recovery"} />
            )}
            <div className="flex justify-end gap-2 border-t border-mist-100 pt-3">
              <button disabled={saving} className="flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                <Check size={13} /> {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-1.5 text-xs font-semibold text-ink-700">
                <X size={13} /> Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        {!loading && (
          <div className="mb-4 flex flex-wrap gap-2">
            <input className={input} placeholder="Search name…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
            <select className={input} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select className={input} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="">All branches and teams</option>
              {units.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-ink-500">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show exited / inactive
            </label>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-ink-500">
            {needle ? `No one matches “${qInput.trim()}”.` : <>No staff profiles yet.{canEdit ? " Use “Add staff” to create the first one." : ""}</>}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-mist-200 text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Branch / team</th>
                  <th className="py-2 pr-3">Level</th>
                  <th className="py-2 pr-3">Reports to</th>
                  <th className="py-2 pr-3">Login</th>
                  <th className="py-2 pr-3">Status</th>
                  {canEdit && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className="border-b border-mist-100 text-ink-700">
                    <td className="py-2.5 pr-3 font-medium">{s.full_name}</td>
                    <td className="py-2.5 pr-3">{s.performance_role_name}</td>
                    <td className="py-2.5 pr-3">{s.unit_name ?? "—"}</td>
                    <td className="py-2.5 pr-3">{s.level_label ?? "—"}</td>
                    <td className="py-2.5 pr-3">{s.manager_name ?? "—"}</td>
                    <td className="py-2.5 pr-3">{s.username ?? <span className="text-ink-400">not linked</span>}</td>
                    <td className="py-2.5 pr-3"><StatusBadge status={s.status} /></td>
                    {canEdit && (
                      <td className="py-2.5 text-right">
                        <button onClick={() => openForm(s)} aria-label={`Edit ${s.full_name}`} className="rounded-full p-1.5 text-ink-500 hover:bg-mist-100">
                          <Pencil size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}