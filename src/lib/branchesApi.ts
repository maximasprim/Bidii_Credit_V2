import { adminGet, adminPost, adminPatch, adminDelete } from "./adminApi";
import type { Branch } from "./useBranches";

export function getAllBranches() {
  return adminGet<{ items: Branch[] }>("/api/admin/branches");
}

export type BranchInput = {
  name: string;
  address: string;
  hours: string;
  phone: string;
  lat: number;
  lng: number;
  display_order: number;
  is_active: boolean;
};

export function createBranch(payload: BranchInput) {
  return adminPost<{ data: Branch }>("/api/admin/branches", payload);
}

export function updateBranch(id: string, payload: Partial<BranchInput>) {
  return adminPatch<{ data: Branch }>(`/api/admin/branches/${id}`, payload);
}

export function deleteBranch(id: string) {
  return adminDelete<void>(`/api/admin/branches/${id}`);
}
