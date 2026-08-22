import { useEffect, useState } from "react";
import { AlertCircle, Check, RotateCcw, Save } from "lucide-react";
import { getAllRolePermissions, updateRolePermissions, type RolePermissionsData } from "../../lib/rolePermissionsApi";
import { roleLabel, DEFAULT_MENU_ACCESS, type AdminRole } from "../../lib/roleAccess";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { usePageMeta } from "../../lib/usePageMeta";

export default function AdminRolePermissions() {
  usePageMeta("Roles & Permissions");
  const { role: myRole, refreshPermissions } = useAdminAuth();

  const [data, setData] = useState<RolePermissionsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Local, per-role editable selection - keyed by role, value is a Set of
  // menu paths currently checked in that role's column. Seeded from
  // `data` once it loads, then edited freely before Save.
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [savedRole, setSavedRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllRolePermissions()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const seeded: Record<string, Set<string>> = {};
        for (const item of res.items) seeded[item.role] = new Set(item.allowed_menus);
        setSelections(seeded);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Couldn't load role permissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(role: string, path: string) {
    setSelections((prev) => {
      const next = new Set(prev[role] ?? []);
      if (path === "/admin") return prev; // Overview is always on - see the save-time guarantee below
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { ...prev, [role]: next };
    });
  }

  function resetToDefault(role: string) {
    const fallback = DEFAULT_MENU_ACCESS[role as Exclude<AdminRole, "admin">] ?? [];
    setSelections((prev) => ({ ...prev, [role]: new Set(fallback) }));
  }

  async function save(role: string) {
    setSavingRole(role);
    setSaveError((prev) => ({ ...prev, [role]: "" }));
    setSavedRole(null);
    try {
      const allowedMenus = Array.from(selections[role] ?? []);
      const res = await updateRolePermissions(role, allowedMenus);
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.role === role ? res.data : i)) }
          : prev
      );
      setSelections((prev) => ({ ...prev, [role]: new Set(res.data.allowed_menus) }));
      setSavedRole(role);
      setTimeout(() => setSavedRole((r) => (r === role ? null : r)), 2000);
      // If I just changed my own role's permissions (shouldn't normally
      // happen since "admin" can't be edited here, but harmless either
      // way) or another admin session is affected, this only refreshes
      // MY OWN sidebar - everyone else picks up the change on their next
      // page load / login, since allowedMenus is fetched once per session.
      refreshPermissions();
    } catch (err) {
      setSaveError((prev) => ({ ...prev, [role]: err instanceof Error ? err.message : "Couldn't save changes." }));
    } finally {
      setSavingRole(null);
    }
  }

  if (myRole !== "admin") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} />
        Only Admin accounts can manage roles & permissions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
          Roles & Permissions
        </h1>
        <p className="text-sm text-ink-500">
          Choose which dashboard menus each role can see. Changes take effect the next time that admin loads a page -
          no need for them to log out and back in.
        </p>
      </div>

      {loadError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
          <AlertCircle size={16} />
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : data ? (
        <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-surface p-5">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Menu</th>
                {data.items.map((item) => (
                  <th key={item.role} className="px-3 py-2.5 text-center font-medium">
                    {roleLabel(item.role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {data.menus.map((menu) => (
                <tr key={menu.path}>
                  <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--color-ink-900)" }}>
                    {menu.label}
                    {menu.path === "/admin" && (
                      <span className="ml-1.5 text-xs font-normal text-ink-500">(always on)</span>
                    )}
                    {menu.path === "/admin/role-permissions" && (
                      <span className="ml-1.5 text-xs font-normal text-ink-500">(admin only, not configurable)</span>
                    )}
                  </td>
                  {data.items.map((item) => {
                    const checked = selections[item.role]?.has(menu.path) ?? false;
                    const disabled = menu.path === "/admin" || menu.path === "/admin/role-permissions";
                    return (
                      <td key={item.role} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={menu.path === "/admin" ? true : checked}
                          disabled={disabled}
                          onChange={() => toggle(item.role, menu.path)}
                          className="h-4 w-4 accent-[var(--color-ember-500)] disabled:opacity-50"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="px-3 py-3"></td>
                {data.items.map((item) => (
                  <td key={item.role} className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => save(item.role)}
                          disabled={savingRole === item.role}
                          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: "var(--color-ember-500)" }}
                        >
                          {savedRole === item.role ? (
                            <>
                              <Check size={12} /> Saved
                            </>
                          ) : (
                            <>
                              <Save size={12} /> {savingRole === item.role ? "Saving…" : "Save"}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => resetToDefault(item.role)}
                          title="Reset to default"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                      {saveError[item.role] && (
                        <p className="max-w-[140px] text-xs text-red-500">{saveError[item.role]}</p>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
