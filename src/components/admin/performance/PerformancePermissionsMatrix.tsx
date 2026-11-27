import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Lock, RotateCcw } from "lucide-react";
import { getPermissionMatrix, resetPermissions, setPermission, type PermissionCapability, type PermissionMatrix } from "../../../lib/performancePermissionsApi";
import { roleLabel } from "../../../lib/roleAccess";

const labelOf = (role: string) => (role === "line_manager" ? "Line managers" : roleLabel(role));
const errText = (e: unknown) => (e instanceof Error ? e.message : "That didn't work. Please try again.");

/**
 * Who may do what in Staff Performance. One row per action, one column per role. A tick is "allowed". Only changes from the built-in
 * defaults are stored; a dot marks a cell that has been changed, and the arrow resets a whole role. Administrators always have
 * everything. This sits under the menus table on Roles & Permissions and hides itself when the Staff Performance module is off.
 */
export default function PerformancePermissionsMatrix({ initial }: { initial: PermissionMatrix }) {
  // The page loads this together with the menus table and hands it over, so both appear at once.
  const [data, setData] = useState<PermissionMatrix>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const byGroup = useMemo(() => {
    const out: { group: string; items: PermissionCapability[] }[] = [];
    for (const g of data.groups) out.push({ group: g, items: data.capabilities.filter((c) => c.group === g) });
    return out;
  }, [data]);

  async function toggle(role: string, cap: PermissionCapability) {
    const cell = cap.cells[role];
    const next = !cell.allowed;
    let confirm_sensitive = false;
    if (next && cap.sensitive && !cell.default) {
      const who = role === "line_manager" ? "Every line manager will be able to do this for their own team" : `Every person with the ${labelOf(role)} role will be able to do this across the whole organisation`;
      const ok = window.confirm(`"${cap.label}" is a sensitive permission.\n\n${who}. Grant it?`);
      if (!ok) return;
      confirm_sensitive = true;
    }
    const id = `${role}:${cap.key}`;
    setBusy(id);
    setError(null);
    try {
      const r = await setPermission({ role, capability: cap.key, allowed: next, confirm_sensitive });
      setData((d) => ({ ...d, capabilities: d.capabilities.map((c) => (c.key === cap.key ? { ...c, cells: { ...c.cells, [role]: r.cell } } : c)) }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  async function reset(role: string | null) {
    const who = role ? (role === "line_manager" ? "the line managers column" : `the ${labelOf(role)} role`) : "every role";
    if (!window.confirm(`Put ${who} back to the built-in defaults?`)) return;
    setBusy(role ?? "all");
    setError(null);
    try {
      await resetPermissions(role);
      setData(await getPermissionMatrix());
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  const changed = (role: string) => data.capabilities.some((c) => c.cells[role]?.overridden);
  const anyChanged = data.roles.some(changed);

  return (
    <section aria-labelledby="perm-matrix-h" className="space-y-3">
      <div>
        <h2 id="perm-matrix-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
          What each role can do in Staff Performance
        </h2>
        <p className="text-sm text-ink-500">
          Tick what each role may do. This is separate from the menus above: a role also needs the menu to open the page, and what a person can
          see (their team, their branch) still comes from the reporting structure. A tick for a role applies to everyone with that role, across
          the whole organisation. The <strong>Line managers</strong> column is different: a tick there lets anyone who manages people or a branch do
          it for their own team only, never anyone else and never themselves. Only actions that make sense for one person at a time can be
          given to line managers; the rest are locked. Changes take effect on the next action. Administrators always have every permission.
        </p>
        <p className="mt-1 text-xs text-ink-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" aria-hidden="true" /> Changed from the default.{" "}
          <AlertTriangle size={12} className="inline align-text-bottom text-amber-600" aria-hidden="true" /> The role lacks the menu needed to open the page.
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </p>
      )}

      {(
        <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-surface p-5">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">Permission</th>
                <th scope="col" className="px-3 py-2.5 text-center font-medium">Administrator</th>
                {data.roles.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2.5 text-center font-medium">
                    <div>{labelOf(r)}</div>
                    {r === "line_manager" && <div className="text-[10px] font-normal text-ink-500">own team only</div>}
                    {changed(r) && (
                      <button type="button" disabled={busy !== null} onClick={() => reset(r)} aria-label={`Reset ${labelOf(r)} to defaults`} title="Reset to defaults" className="mt-1 rounded-full border border-mist-200 p-1 text-ink-500 hover:bg-mist-50 disabled:opacity-50">
                        <RotateCcw size={11} aria-hidden="true" />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            {byGroup.map(({ group, items }) => (
              <tbody key={group}>
                <tr>
                  <th colSpan={data.roles.length + 2} scope="colgroup" className="bg-mist-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">{group}</th>
                </tr>
                {items.map((cap) => (
                  <tr key={cap.key} className="border-t border-mist-200 align-top">
                    <th scope="row" className="px-3 py-2.5 font-medium text-ink-800">
                      {cap.label}
                      {cap.sensitive && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">sensitive</span>}
                      <span className="block text-xs font-normal text-ink-500">{cap.description}</span>
                    </th>
                    <td className="px-3 py-2.5 text-center">
                      <Lock size={13} className="inline text-ink-500" aria-label="Administrators always have this" />
                    </td>
                    {data.roles.map((r) => {
                      const cell = cap.cells[r];
                      const id = `${r}:${cap.key}`;
                      if (cell.locked) {
                        return (
                          <td key={r} className="px-3 py-2.5 text-center">
                            <span title="This covers the whole organisation, so it can't be limited to a team.">
                              <Lock size={13} className="inline text-ink-500" aria-label="Organisation-wide: can't be limited to a team" />
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={r} className="px-3 py-2.5 text-center">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={cell.allowed}
                              disabled={busy !== null}
                              onChange={() => toggle(r, cap)}
                              aria-label={`${labelOf(r)}: ${cap.label}`}
                              className="h-4 w-4 cursor-pointer"
                              aria-busy={busy === id}
                            />
                            {cell.overridden && <span className="inline-block h-2 w-2 rounded-full bg-amber-500" title="Changed from the default" aria-label="Changed from the default" />}
                            {cell.menu_missing && (
                              <span title={`${labelOf(r)} doesn't have the menu "${cap.menu}", so it can't open the page for this. Add it in the menus table above.`}>
                                <AlertTriangle size={13} className="text-amber-600" aria-label="This role lacks the menu needed to open the page" />
                              </span>
                            )}
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          {anyChanged && (
            <button type="button" disabled={busy !== null} onClick={() => reset(null)} className="mt-4 rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50">
              Reset every role to the defaults
            </button>
          )}
        </div>
      )}
    </section>
  );
}
