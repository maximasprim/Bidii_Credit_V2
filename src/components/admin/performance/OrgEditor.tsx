import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  addDebtCollectionUnits, applyPlacement, applySetup, closeUnit, cleanUpDuplicates, getUnitDuplicates, linkUnitToBranch, removeEmptyUnit, createRegion, createUnit, getOrgLayout, getPlacement, getStaff, moveUnitToRegion, renameRegion, retireRegion,
  setRegionManager, setUnitManager,
  type DuplicatePair, type LayoutUnit, type OrgLayout, type PlacementPreview,
} from "../../../lib/performanceApi";

const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const sel = "rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-xs text-ink-700";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work.");

// Unit rows share one column template so the controls line up down the whole list. On phones the row stacks and each control shows its own label.
const COLS = "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_4.5rem]";
const field = "w-full rounded-lg border border-mist-200 bg-surface px-2.5 py-2 text-sm text-ink-700 focus:border-ember-500 focus:outline-none focus:ring-2 focus:ring-ember-500/30 disabled:opacity-60";
const KIND = {
  branch: { label: "Branch", cls: "border border-mist-200 bg-mist-50 text-ink-700" },
  team: { label: "Team", cls: "bg-ember-100 text-ember-600" },
  head_office: { label: "Head office", cls: "bg-navy-900 text-white" },
} as const;
function FieldLabel({ children }: { children: string }) {
  return <span className="mb-1 block text-xs text-ink-500 md:hidden">{children}</span>;
}

export type OrgEditorInitial = { layout: OrgLayout | null; staff: { id: string; full_name: string }[] | null; dups: DuplicatePair[] | null };

/** `initial` (optional) is what the page already fetched, so the editor shows at once instead of appearing after its own requests. */
export default function OrgEditor({ canWrite, canPlace, onChanged, initial }: { canWrite: boolean; canPlace: boolean; onChanged: () => void; initial?: OrgEditorInitial }) {
  const [layout, setLayout] = useState<OrgLayout | null>(initial?.layout ?? null);
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>(initial?.staff ?? []);
  const [plan, setPlan] = useState<PlacementPreview | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [newRegion, setNewRegion] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState<LayoutUnit | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [dups, setDups] = useState<DuplicatePair[]>(initial?.dups ?? []);
  const [dupOff, setDupOff] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    getOrgLayout().then(setLayout).catch((e) => toast.error(msg(e)));
    if (canWrite) getUnitDuplicates().then((r) => { setDups(r.pairs); setDupOff(new Set()); }).catch(() => undefined);
    getStaff().then((r) => setStaff(r.items.map((s) => ({ id: s.id, full_name: s.full_name })))).catch(() => undefined);
  }, [canWrite]);
  const preloaded = useRef(!!initial?.layout);
  useEffect(() => {
    if (preloaded.current) { preloaded.current = false; return; } // the page already supplied the first load
    load();
  }, [load]);

  const allRegions = useMemo(() => layout?.regions ?? [], [layout]);
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); load(); onChanged(); } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  function UnitRow({ u, regionId }: { u: LayoutUnit; regionId: string | null }) {
    const kind = KIND[u.kind] ?? KIND.head_office;
    return (
      <li>
        <div className={`flex flex-col gap-3 px-4 py-3 md:grid md:items-center ${COLS}`}>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-900">{u.name}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${kind.cls}`}>{kind.label}</span>
            <span>{u.staff} staff</span>
          </div>
        </div>
        {canWrite && (
          <>
            <label className="block">
              <FieldLabel>Unit manager</FieldLabel>
              <select aria-label={`Manager of ${u.name}`} className={field} value={u.manager_profile_id ?? ""} disabled={busy} onChange={(e) => void run(() => setUnitManager(u.id, e.target.value || null), "Manager saved.")}>
                <option value="">No unit manager</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </label>
            {u.kind === "branch" ? (
              <label className="block">
                <FieldLabel>Website branch</FieldLabel>
                <select aria-label={`Website branch for ${u.name}`} className={field} value={u.branch_id ?? ""} disabled={busy}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const b = layout?.all_branches.find((x) => x.id === id);
                    if (id && b?.unit_id && b.unit_id !== u.id && !window.confirm(`"${b.name}" already has an empty unit. It will be removed and "${u.name}" linked to the branch instead.`)) return;
                    void run(() => linkUnitToBranch(u.id, id, false), id ? "Linked to the branch." : "Unlinked.");
                  }}>
                  <option value="">Not linked to a website branch</option>
                  {(layout?.all_branches ?? []).filter((b) => b.id === u.branch_id || b.unit_id === null || b.unit_empty).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            ) : (
              <div className="hidden md:block" aria-hidden="true" />
            )}
            <label className="block">
              <FieldLabel>Region</FieldLabel>
              <select aria-label={`Region of ${u.name}`} className={field} value={regionId ?? ""} disabled={busy} onChange={(e) => void run(() => moveUnitToRegion(u.id, e.target.value || null), "Region saved.")}>
                <option value="">No region</option>
                {allRegions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <div className="md:text-right">
              {u.staff > 0 ? (
                <button type="button" className={btn} disabled={busy} onClick={() => { setClosing(u); setMoveTo(""); }}>Close</button>
              ) : (
                <button type="button" className={btn} disabled={busy} onClick={() => { if (window.confirm(`Remove the empty unit "${u.name}"?`)) void run(() => removeEmptyUnit(u.id), "Removed."); }}>Remove</button>
              )}
            </div>
          </>
        )}
        </div>
        {u.children.map((c) => (
          <div key={c.id} className={`flex flex-col gap-2 pb-3 pl-8 pr-4 md:grid md:items-center ${COLS}`}>
            <div className="min-w-0 border-l-2 border-mist-200 pl-3">
              <div className="truncate text-sm font-medium text-ink-900">{c.name}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND.team.cls}`}>Under {u.name}</span>
                <span>{c.staff} staff</span>
              </div>
            </div>
            {canWrite && (
              <label className="block">
                <FieldLabel>Unit manager</FieldLabel>
                <select aria-label={`Manager of ${c.name}`} className={field} value={c.manager_profile_id ?? ""} disabled={busy} onChange={(e) => void run(() => setUnitManager(c.id, e.target.value || null), "Manager saved.")}>
                  <option value="">No unit manager</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </label>
            )}
          </div>
        ))}
      </li>
    );
  }

  async function loadPlan() {
    setBusy(true);
    try { setPlan(await getPlacement()); setSkip(new Set()); } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }
  async function accept() {
    if (!plan) return;
    const items = plan.proposals.filter((p) => !skip.has(p.profile_id)).map((p) => ({ profile_id: p.profile_id, unit_id: p.unit_id, manager_id: p.manager_id }));
    if (items.length === 0) return;
    if (!window.confirm(`Place ${items.length} ${items.length === 1 ? "person" : "people"} as shown? Each change is recorded in their history.`)) return;
    setBusy(true);
    try {
      const r = await applyPlacement(items);
      toast.success(`${r.units_set} placed in a unit, ${r.managers_set} given a line manager.`);
      setPlan(null); load(); onChanged();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  if (!layout) return null;
  return (
    <>
      {canWrite && dups.length > 0 && (
        <section className={card} aria-label="Duplicate units">
          <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>Possible duplicates</h2>
          <p className="mb-3 text-xs text-ink-500">These look like the same place twice: one unit has people (usually from the Excel import) and an empty copy was made next to it. Cleaning up keeps the unit with people and removes only the empty copy. Nobody is moved or lost.</p>
          <ul className="space-y-2 text-sm text-ink-700">
            {dups.map((d) => (
              <li key={d.remove_id} className="flex items-start gap-2 border-t border-mist-100 pt-2">
                <input type="checkbox" className="mt-1" aria-label={`Clean up ${d.keep_name}`} checked={!dupOff.has(d.remove_id)} onChange={() => setDupOff((o) => { const n = new Set(o); if (n.has(d.remove_id)) n.delete(d.remove_id); else n.add(d.remove_id); return n; })} />
                <span>Keep <strong>{d.keep_name}</strong> ({d.keep_staff} people), remove the empty <strong>{d.remove_name}</strong>.
                  {d.link_branch_name ? <span className="block text-xs text-ink-500">{d.keep_name} will also be linked to the website branch "{d.link_branch_name}" and renamed to "{d.use_name}".</span> : d.keep_name !== d.use_name ? <span className="block text-xs text-ink-500">{d.keep_name} will be renamed to "{d.use_name}".</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className={`${btn} mt-3`} disabled={busy || dups.length - dupOff.size <= 0}
            onClick={() => { const items = dups.filter((d) => !dupOff.has(d.remove_id)).map((d) => ({ keep_id: d.keep_id, remove_id: d.remove_id, link: !!d.link_branch_id, use_name: d.keep_name !== d.use_name }));
              if (window.confirm(`Clean up ${items.length} duplicate${items.length === 1 ? "" : "s"}?`)) void run(() => cleanUpDuplicates(items), "Duplicates cleaned up."); }}>
            Clean up {Math.max(0, dups.length - dupOff.size)} selected
          </button>
        </section>
      )}

      <section className={card} aria-label="Branches and regions">
        <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>Branches and regions</h2>
        <p className="mb-3 text-xs text-ink-500">
          This is the structure reports and targets use. Branches come from the website's branch list (that list is never changed here). Create regions, move each branch or team to a region, and set who manages each.
        </p>
        {layout.debt_units_missing > 0 && canWrite && (
          <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-mist-200 bg-mist-50 p-2.5 text-xs text-ink-700">
            <p>{layout.debt_units_missing} branch{layout.debt_units_missing === 1 ? "" : "es"} {layout.debt_units_missing === 1 ? "doesn't" : "don't"} have a Debt Collection unit yet. Each branch gets its own, under the branch and in its region.</p>
            <button type="button" className={btn} disabled={busy} onClick={() => void run(() => addDebtCollectionUnits(), "Debt Collection added to every branch.")}>Add Debt Collection to every branch</button>
          </div>
        )}
        {layout.branches_without_unit.length > 0 && canWrite && (
          <div role="status" className="mb-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <p>{layout.branches_without_unit.length} branch{layout.branches_without_unit.length === 1 ? "" : "es"} on the website list {layout.branches_without_unit.length === 1 ? "isn't" : "aren't"} linked to a performance unit yet. If the branch was brought in by the Excel import, link it to that unit rather than creating a new one.</p>
            <ul className="space-y-1">
              {layout.branches_without_unit.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{b.name}</span>
                  {b.suggested_unit_id ? (
                    <>
                      <span>looks like the imported unit "{b.suggested_unit_name}" ({b.suggested_unit_staff} people)</span>
                      <button type="button" className="font-semibold underline" disabled={busy} onClick={() => void run(() => linkUnitToBranch(b.suggested_unit_id as string, b.id, false), "Linked.")}>Link them</button>
                    </>
                  ) : <span>no matching unit found</span>}
                </li>
              ))}
            </ul>
            <button type="button" className="font-semibold underline" disabled={busy} onClick={() => { if (window.confirm("Create a NEW empty unit for every branch that is still unlinked? Do this only for branches that have no imported unit.")) void run(() => applySetup([]), "Units created for the remaining branches."); }}>Create new units for the remaining branches</button>
          </div>
        )}
        {canWrite && (
          <div className={`mb-1 hidden gap-3 px-4 text-xs font-medium text-ink-500 md:grid ${COLS}`} aria-hidden="true">
            <span>Unit</span><span>Unit manager</span><span>Website branch</span><span>Region</span><span />
          </div>
        )}
        <div className="space-y-5">
          {layout.regions.map((r) => (
            <section key={r.id} aria-label={`Region ${r.name}`} className="overflow-hidden rounded-xl border border-mist-200">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-200 bg-mist-100 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-6 w-1 shrink-0 rounded-full bg-navy-600" aria-hidden="true" />
                  {renaming?.id === r.id ? (
                    <form className="flex items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); const n = renaming.name.trim(); setRenaming(null); if (n.length >= 2 && n !== r.name) void run(() => renameRegion(r.id, n), "Renamed."); }}>
                      <input autoFocus className={`${field} w-56`} aria-label={`New name for ${r.name}`} value={renaming.name} onChange={(ev) => setRenaming({ id: r.id, name: ev.target.value })} onKeyDown={(ev) => { if (ev.key === "Escape") setRenaming(null); }} />
                      <button type="submit" className={btn} disabled={busy || renaming.name.trim().length < 2}>Save</button>
                      <button type="button" className={btn} onClick={() => setRenaming(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <h3 className="truncate font-display text-base font-bold text-ink-900">{r.name}</h3>
                      <span className="shrink-0 rounded-full border border-mist-200 bg-surface px-2 py-0.5 text-xs text-ink-500">{r.units.length} {r.units.length === 1 ? "unit" : "units"}</span>
                    </>
                  )}
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-ink-500">Regional manager
                      <select aria-label={`Manager of region ${r.name}`} className={`${field} w-52`} value={r.manager_profile_id ?? ""} disabled={busy} onChange={(ev) => void run(() => setRegionManager(r.id, ev.target.value || null), "Regional manager saved.")}>
                        <option value="">No regional manager</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                      </select>
                    </label>
                    {renaming?.id !== r.id && <button type="button" className={btn} disabled={busy} onClick={() => setRenaming({ id: r.id, name: r.name })}>Rename</button>}
                    {r.units.length === 0 && <button type="button" className={btn} disabled={busy} onClick={() => void run(() => retireRegion(r.id), "Region removed.")}>Remove</button>}
                  </div>
                ) : r.manager_name ? (
                  <span className="text-xs text-ink-500">Regional manager: <span className="font-medium text-ink-700">{r.manager_name}</span></span>
                ) : null}
              </header>
              {r.units.length === 0 ? (
                <p className="px-4 py-3 text-sm text-ink-500">No branches yet. Move one here from "Not in a region".</p>
              ) : (
                <ul className="divide-y divide-mist-100">{r.units.map((u) => <UnitRow key={u.id} u={u} regionId={r.id} />)}</ul>
              )}
            </section>
          ))}
          {layout.units_without_region.length > 0 && (
            <section aria-label="Units not in a region" className="overflow-hidden rounded-xl border border-dashed border-ember-400">
              <header className="flex flex-wrap items-center gap-3 border-b border-dashed border-ember-400 bg-ember-100 px-4 py-3">
                <h3 className="font-display text-base font-bold text-ink-900">Not in a region</h3>
                <span className="rounded-full border border-ember-400 bg-surface px-2 py-0.5 text-xs text-ink-500">{layout.units_without_region.length}</span>
                <span className="text-xs text-ink-700">Pick a region for each so they count in reports.</span>
              </header>
              <ul className="divide-y divide-mist-100">{layout.units_without_region.map((u) => <UnitRow key={u.id} u={u} regionId={null} />)}</ul>
            </section>
          )}
        </div>
        {canWrite && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-mist-200 pt-3">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = newRegion.trim(); if (n.length >= 2) void run(() => createRegion(n), "Region created.").then(() => setNewRegion("")); }}>
              <input className={sel} placeholder="New region name" aria-label="New region name" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} />
              <button type="submit" className={btn} disabled={busy || newRegion.trim().length < 2}>Add region</button>
            </form>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = newTeam.trim(); if (n.length >= 2) void run(() => createUnit({ name: n, kind: "team" }), "Team created.").then(() => setNewTeam("")); }}>
              <input className={sel} placeholder="New team name (for example Check-off)" aria-label="New team name" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} />
              <button type="submit" className={btn} disabled={busy || newTeam.trim().length < 2}>Add team</button>
            </form>
          </div>
        )}
      </section>

      {closing && canWrite && (
        <section className={card} aria-label="Close a unit" role="dialog" aria-modal="false">
          <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>Close {closing.name}</h2>
          <p className="mb-3 text-xs text-ink-500">Use this for a branch or team that no longer operates. Everything already reported for it stays on record under its name. From today it takes no new work: its {closing.staff} people move to the unit you choose (each move is recorded in their history), and it leaves the active lists.</p>
          <label className="text-xs text-ink-500">Move its people to
            <select className={`${sel} ml-2`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Leave them without a unit for now</option>
              {[...allRegions.flatMap((r) => r.units), ...(layout?.units_without_region ?? [])].filter((x) => x.id !== closing.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() => { const c = closing; setClosing(null); void run(() => closeUnit(c.id, moveTo || null), `${c.name} closed.`); }}>Close {closing.name}</button>
            <button type="button" className={btn} disabled={busy} onClick={() => setClosing(null)}>Cancel</button>
          </div>
        </section>
      )}

      <section className={card} aria-label="Place people in the structure">
        <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>Place people in the structure</h2>
        <p className="mb-3 text-xs text-ink-500">
          {layout.people_without_unit} people have no unit and {layout.people_without_manager} have no line manager. The suggestions use the branch on a person's login, their role, and each unit's or region's manager. Nothing changes until you accept; untick anyone you want to leave.
        </p>
        {!plan && <button type="button" className={btn} disabled={busy || !canPlace} onClick={() => void loadPlan()}>Suggest placements</button>}
        {plan && (
          <div className="space-y-3">
            {plan.proposals.length === 0 ? <p className="text-sm text-ink-500">Nothing to suggest: everyone who can be placed already is.</p> : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-ink-500"><th className="py-1 pr-2" scope="col">Apply</th><th className="pr-2" scope="col">Person</th><th className="pr-2" scope="col">Unit</th><th scope="col">Line manager</th></tr></thead>
                  <tbody>
                    {plan.proposals.map((p) => (
                      <tr key={p.profile_id} className="border-t border-mist-100 align-top">
                        <td className="py-1 pr-2"><input type="checkbox" aria-label={`Apply for ${p.name}`} checked={!skip.has(p.profile_id)} onChange={() => setSkip((s) => { const n = new Set(s); if (n.has(p.profile_id)) n.delete(p.profile_id); else n.add(p.profile_id); return n; })} /></td>
                        <td className="pr-2"><span className="font-medium">{p.name}</span><br /><span className="text-ink-500">{p.role}</span></td>
                        <td className="pr-2">{p.unit_name ? <>{p.unit_name}<br /><span className="text-ink-500">{p.unit_reason}</span></> : <span className="text-ink-400">{p.current_unit ?? "none"}</span>}</td>
                        <td>{p.manager_name ? <>{p.manager_name}<br /><span className="text-ink-500">{p.manager_reason}</span></> : <span className="text-ink-400">{p.current_manager ?? "none"}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {plan.unplaced.length > 0 && (
              <p className="text-xs text-ink-500">Could not place automatically ({plan.unplaced.length}): {plan.unplaced.slice(0, 15).map((u) => u.name).join(", ")}{plan.unplaced.length > 15 ? "…" : ""}. Set their unit on their staff profile.</p>
            )}
            <div className="flex gap-2">
              <button type="button" className={btn} disabled={busy || plan.proposals.length - skip.size <= 0} onClick={() => void accept()}>Accept {Math.max(0, plan.proposals.length - skip.size)} selected</button>
              <button type="button" className={btn} disabled={busy} onClick={() => setPlan(null)}>Close</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
