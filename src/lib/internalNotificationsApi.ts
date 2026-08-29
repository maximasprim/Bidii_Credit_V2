import { adminGet, adminPost } from "./adminApi";

export type InternalNotification = {
  id: string;
  message: string;
  link_path: string | null;
  related_loan_application_id: string | null;
  is_read: boolean;
  created_at: string;
};

export function listMyNotifications() {
  return adminGet<{ items: InternalNotification[]; unread_count: number }>("/api/admin/internal-notifications");
}

export function markNotificationRead(id: string) {
  return adminPost<InternalNotification>(`/api/admin/internal-notifications/${id}/read`, {});
}

export function markAllNotificationsRead() {
  return adminPost<void>("/api/admin/internal-notifications/read-all", {});
}
