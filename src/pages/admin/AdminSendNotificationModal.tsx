import { useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import {
  listNotificationTemplates,
  sendManualNotification,
  listNotificationLogs,
  type NotificationTemplate,
  type NotificationLog,
} from "../../lib/notificationsApi";

export default function AdminSendNotificationModal({
  applicationId,
  candidateName,
  onClose,
}: {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentJustNow, setSentJustNow] = useState<NotificationLog | null>(null);

  useEffect(() => {
    Promise.all([listNotificationTemplates(), listNotificationLogs(applicationId)])
      .then(([t, l]) => {
        setTemplates(t.items.filter((tpl) => tpl.is_active));
        setLogs(l.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load."))
      .finally(() => setLoading(false));
  }, [applicationId]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await sendManualNotification({
        application_id: applicationId,
        template_id: templateId || null,
        subject,
        body,
      });
      setSentJustNow(res.data);
      setLogs((prev) => [res.data, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-mist-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Send Email</h2>
            <p className="text-xs text-ink-500">To {candidateName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-mist-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-ink-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              {sentJustNow && (
                <p
                  className={`rounded-lg px-3 py-2 text-xs ${
                    sentJustNow.status === "sent"
                      ? "bg-emerald-50 text-emerald-700"
                      : sentJustNow.status === "skipped_not_configured"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {sentJustNow.status === "sent" && "Sent."}
                  {sentJustNow.status === "skipped_not_configured" &&
                    "Not sent — no SMTP server is configured on the backend yet."}
                  {sentJustNow.status === "failed" && `Failed to send: ${sentJustNow.error_message}`}
                </p>
              )}

              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Template (optional — pre-fills subject & body below, still editable)
                <select
                  value={templateId}
                  onChange={(e) => pickTemplate(e.target.value)}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                >
                  <option value="">Custom message</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Subject
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Body
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
              </label>

              {logs.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-700">Previous emails to this candidate</p>
                  <div className="flex flex-col gap-1.5">
                    {logs.slice(0, 5).map((log) => (
                      <div key={log.id} className="rounded-lg border border-mist-200 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-ink-700">{log.subject}</span>
                          <span
                            className={
                              log.status === "sent"
                                ? "text-emerald-600"
                                : log.status === "skipped_not_configured"
                                  ? "text-amber-600"
                                  : "text-rose-600"
                            }
                          >
                            {log.status}
                          </span>
                        </div>
                        <span className="text-ink-400">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-mist-200 px-5 py-3.5">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-mist-100">
            Close
          </button>
          <button
            onClick={send}
            disabled={sending || loading || !subject || !body}
            className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Send size={14} />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
