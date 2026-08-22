import { adminGet, adminPut } from "./adminApi";

export type MenuItem = { path: string; label: string };

export type MyPermissions = { role: string; allowed_menus: string[] };

export function getMyPermissions() {
  return adminGet<MyPermissions>("/api/admin/role-permissions/mine");
}

export type RolePermissionItem = { role: string; allowed_menus: string[]; is_default: boolean };

export type RolePermissionsData = { menus: MenuItem[]; items: RolePermissionItem[] };

export function getAllRolePermissions() {
  return adminGet<RolePermissionsData>("/api/admin/role-permissions");
}

export function updateRolePermissions(role: string, allowedMenus: string[]) {
  return adminPut<{ data: RolePermissionItem }>(`/api/admin/role-permissions/${role}`, {
    allowed_menus: allowedMenus,
  });
}
