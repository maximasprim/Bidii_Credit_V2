import { adminGet, adminPost, adminPatch, adminPut, adminDelete } from "./adminApi";

export type NotificationTrigger = "received" | "reviewing" | "shortlisted" | "rejected" | "hired" | "manual";
export type NotificationLogStatus = "sent" | "failed" | "skipped_not_configured";

export type NotificationTemplate = {
  id: string;
  name: string;
  trigger: NotificationTrigger;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationAutomationRule = {
  trigger: NotificationTrigger;
  template_id: string | null;
  is_enabled: boolean;
  updated_at: string;
};

export type NotificationLog = {
  id: string;
  application_id: string;
  template_id: string | null;
  trigger: NotificationTrigger;
  recipient_email: string;
  subject: string;
  body: string;
  status: NotificationLogStatus;
  error_message: string | null;
  sent_by_admin_id: string | null;
  created_at: string;
};

export function listNotificationTemplates() {
  return adminGet<{ items: NotificationTemplate[] }>("/api/admin/notifications/templates");
}

export function createNotificationTemplate(payload: {
  name: string;
  trigger: NotificationTrigger;
  subject: string;
  body: string;
  is_active: boolean;
}) {
  return adminPost<{ data: NotificationTemplate }>("/api/admin/notifications/templates", payload);
}

export function updateNotificationTemplate(id: string, payload: Partial<Omit<NotificationTemplate, "id" | "created_at" | "updated_at">>) {
  return adminPatch<{ data: NotificationTemplate }>(`/api/admin/notifications/templates/${id}`, payload);
}

export function deleteNotificationTemplate(id: string) {
  return adminDelete<void>(`/api/admin/notifications/templates/${id}`);
}

export function listAutomationRules() {
  return adminGet<{ items: NotificationAutomationRule[] }>("/api/admin/notifications/automation");
}

export function updateAutomationRule(trigger: NotificationTrigger, payload: { template_id: string | null; is_enabled: boolean }) {
  return adminPut<NotificationAutomationRule>(`/api/admin/notifications/automation/${trigger}`, payload);
}

export function sendManualNotification(payload: { application_id: string; template_id?: string | null; subject: string; body: string }) {
  return adminPost<{ data: NotificationLog }>("/api/admin/notifications/send", payload);
}

export function listNotificationLogs(applicationId?: string) {
  const query = applicationId ? `?application_id=${applicationId}` : "";
  return adminGet<{ items: NotificationLog[] }>(`/api/admin/notifications/logs${query}`);
}

export const NOTIFICATION_TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  received: "Application received",
  reviewing: "Moved to reviewing",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  hired: "Hired",
  manual: "Manual only (not automated)",
};
