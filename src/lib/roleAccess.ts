/**
 * Admin role list + menu registry + access resolution.
 *
 * WHICH ROLE CAN SEE WHICH MENU IS NOW ADMIN-CONFIGURABLE FROM THE
 * DASHBOARD (Roles & Permissions page, admin-only), not fixed in this
 * file — an admin edits it via GET/PUT /api/admin/role-permissions (see
 * AdminRolePermissions.tsx), and AdminAuthContext fetches the current
 * admin's own effective menus (GET /api/admin/role-permissions/mine)
 * right after login and keeps them in context for AdminLayout to read.
 *
 * DEFAULT_MENU_ACCESS below is only the FALLBACK: what's used before
 * that fetch resolves, or if it ever fails (offline, backend briefly
 * down) — so the sidebar always has something sensible to show rather
 * than flashing empty or blocking the whole dashboard on one network
 * request. It mirrors the backend's own DEFAULT_MENU_ACCESS in
 * app/services/role_permissions.py; keep them in sync if you add a
 * page, though a mismatch is only ever a brief fallback-vs-live
 * inconsistency, never a security gap — the backend is what actually
 * decides.
 *
 * "admin" always has every menu, unconditionally, on both sides — never
 * fetched, never stored, never editable via the settings page.
 */

export type AdminRole = "admin" | "loan_officer" | "hr" | "marketing_manager";

export const ADMIN_ROLES: { value: AdminRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "loan_officer", label: "Loan Officer" },
  { value: "hr", label: "HR" },
  { value: "marketing_manager", label: "Marketing Manager" },
];

export function roleLabel(role: string): string {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? role;
}

/** path -> label, same list (and order) as the backend's MENU_REGISTRY. Used
 *  for the Roles & Permissions settings page's checkbox grid as a fallback
 *  if the live fetch of the registry from the backend hasn't landed yet. */
export const MENU_REGISTRY: { path: string; label: string }[] = [
  { path: "/admin", label: "Overview" },
  { path: "/admin/contacts", label: "Contact Messages" },
  { path: "/admin/loan-applications", label: "Loan Applications" },
  { path: "/admin/career-applications", label: "Career Applications" },
  { path: "/admin/ats", label: "Candidate Screening" },
  { path: "/admin/news", label: "News Articles" },
  { path: "/admin/jobs", label: "Job Listings" },
  { path: "/admin/loan-terms", label: "Products" },
  { path: "/admin/users", label: "Admin Users" },
  { path: "/admin/role-permissions", label: "Roles & Permissions" },
];

const ALL_MENU_PATHS = MENU_REGISTRY.map((m) => m.path);

/** Fallback only — see file header. Kept in sync with the backend's
 *  DEFAULT_MENU_ACCESS in app/services/role_permissions.py. */
export const DEFAULT_MENU_ACCESS: Record<Exclude<AdminRole, "admin">, string[]> = {
  loan_officer: ["/admin", "/admin/loan-applications", "/admin/loan-terms"],
  hr: ["/admin", "/admin/career-applications", "/admin/ats", "/admin/jobs"],
  marketing_manager: ["/admin", "/admin/contacts", "/admin/news", "/admin/jobs"],
};

/**
 * Resolves the menu paths a role can actually see right now: "admin"
 * always gets everything; another role gets whatever was fetched from
 * the backend (the true, live answer) if available, else the local
 * fallback default for that role.
 */
export function resolveAllowedMenus(role: string | null, fetchedAllowedMenus: string[] | null): string[] {
  if (!role) return [];
  if (role === "admin") return ALL_MENU_PATHS;
  if (fetchedAllowedMenus) return fetchedAllowedMenus;
  return DEFAULT_MENU_ACCESS[role as Exclude<AdminRole, "admin">] ?? [];
}

/**
 * True if `pathname` is in `allowedMenus`, falling back from an exact
 * match to the longest entry this route lives under (e.g.
 * "/admin/ats/candidates/abc-123" falls under "/admin/ats" — so a
 * per-record sub-page shares its parent menu's access without needing
 * its own entry anywhere).
 */
export function pathAllowed(allowedMenus: string[], pathname: string): boolean {
  if (allowedMenus.includes(pathname)) return true;
  const prefixMatches = allowedMenus
    .filter((p) => p !== "/admin" && (pathname === p || pathname.startsWith(p + "/")))
    .sort((a, b) => b.length - a.length);
  return prefixMatches.length > 0;
}
