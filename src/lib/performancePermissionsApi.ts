import { adminGet, adminPost, adminPut } from "./adminApi";

const BASE = `/api/admin/performance/permissions`;

export interface PermissionCell {
  allowed: boolean;
  default: boolean;
  overridden: boolean; // changed from the built-in default
  menu_missing: boolean; // allowed, but the role can't open the page this belongs to
  locked: boolean;
}
export interface PermissionCapability {
  key: string;
  label: string;
  description: string;
  group: string;
  sensitive: boolean;
  menu: string;
  default_roles: string[];
  cells: Record<string, PermissionCell>;
}
export interface PermissionMatrix {
  roles: string[];
  groups: string[];
  capabilities: PermissionCapability[];
}

/** What the signed-in person may do right now. The pages use it to show or hide buttons; the server still checks every request. */
export const getMyCapabilities = () => adminGet<{ role: string; capabilities: string[] }>(`${BASE}/me`);

export const getPermissionMatrix = () => adminGet<PermissionMatrix>(BASE);

export const setPermission = (body: { role: string; capability: string; allowed: boolean; confirm_sensitive?: boolean }) =>
  adminPut<{ role: string; capability: string; cell: PermissionCell }>(BASE, body);

export const resetPermissions = (role?: string | null) => adminPost<{ removed: number }>(`${BASE}/reset`, { role: role ?? null });
