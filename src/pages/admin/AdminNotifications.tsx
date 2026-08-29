import { useEffect, useState } from "react";
import { Mail, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import {
  listNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  listAutomationRules,
  updateAutomationRule,
  NOTIFICATION_TRIGGER_LABELS,
  type NotificationTemplate,
  type NotificationAutomationRule,
  type NotificationTrigger,
} from "../../lib/notificationsApi";

const AUTOMATABLE_TRIGGERS: NotificationTrigger[] = ["received", "reviewing", "shortlisted", "rejected", "hired"];

type FormState = {
  name: string;
  trigger: NotificationTrigger;
  subject: string;
  body: string;
  is_active: boolean;
};

const emptyForm: FormState = { name: "", trigger: "manual", subject: "", body: "", is_active: true };

export default function AdminNotifications() {
  usePageMeta("Candidate Notifications");

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [rules, setRules] = useState<NotificationAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  function load() {
    setLoading(true);
    Promise.all([listNotificationTemplates(), listAutomationRules()])
      .then(([t, r]) => {
        setTemplates(t.items);
        setRules(r.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load notifications."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function submitCreate() {
    setCreating(true);
    setError(null);
    try {
      await createNotificationTemplate(createForm);
      setCreateForm(emptyForm);
      setShowCreateForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create template.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t: NotificationTemplate) {
    setEditingId(t.id);
    setEditForm({ name: t.name, trigger: t.trigger, subject: t.subject, body: t.body, is_active: t.is_active });
  }

  async function saveEdit(id: string) {
    setError(null);
    try {
      await updateNotificationTemplate(id, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save template.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template? This can't be undone.")) return;
    setError(null);
    try {
      await deleteNotificationTemplate(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete template.");
    }
  }

  async function toggleRule(trigger: NotificationTrigger, patch: Partial<{ is_enabled: boolean; template_id: string | null }>) {
    const current = rules.find((r) => r.trigger === trigger);
    setError(null);
    try {
      await updateAutomationRule(trigger, {
        is_enabled: patch.is_enabled ?? current?.is_enabled ?? false,
        template_id: patch.template_id !== undefined ? patch.template_id : current?.template_id ?? null,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update automation rule.");
    }
  }

  const activeTemplates = templates.filter((t) => t.is_active);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Mail size={20} className="text-brand-600" />
        <h1 className="font-display text-xl font-bold text-ink-900">Candidate Notifications</h1>
      </div>
      <p className="mb-6 text-sm text-ink-500">
        Configure reusable email templates, and optionally have one sent automatically whenever a candidate's
        application moves into a given stage. You can also send any template — or a fully custom message — to a
        specific candidate at any time from their application or screening detail page.
      </p>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Automation — send automatically on status change</h2>
            <div className="overflow-hidden rounded-xl border border-mist-200">
              {AUTOMATABLE_TRIGGERS.map((trigger, i) => {
                const rule = rules.find((r) => r.trigger === trigger);
                return (
                  <div
                    key={trigger}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-mist-200" : ""}`}
                  >
                    <label className="flex w-56 shrink-0 items-center gap-2 text-sm font-medium text-ink-700">
                      <input
                        type="checkbox"
                        checked={rule?.is_enabled ?? false}
                        onChange={(e) => toggleRule(trigger, { is_enabled: e.target.checked })}
                      />
                      {NOTIFICATION_TRIGGER_LABELS[trigger]}
                    </label>
                    <select
                      value={rule?.template_id ?? ""}
                      onChange={(e) => toggleRule(trigger, { template_id: e.target.value || null })}
                      className="flex-1 rounded-lg border border-mist-200 px-3 py-1.5 text-sm text-ink-700"
                    >
                      <option value="">No template selected</option>
                      {activeTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-400">
              Only active templates appear here. A rule with no template selected is enabled but has nothing to send.
            </p>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">Templates</h2>
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                <Plus size={13} /> New template
              </button>
            </div>

            {showCreateForm && (
              <div className="mb-4 rounded-xl border border-mist-200 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Template name"
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={createForm.trigger}
                    onChange={(e) => setCreateForm({ ...createForm, trigger: e.target.value as NotificationTrigger })}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
                  >
                    {(["manual", ...AUTOMATABLE_TRIGGERS] as NotificationTrigger[]).map((t) => (
                      <option key={t} value={t}>
                        {NOTIFICATION_TRIGGER_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  placeholder="Subject — supports {{candidate_name}}, {{job_title}}, {{company_name}}, {{status}}"
                  className="mt-3 w-full rounded-lg border border-mist-200 px-3 py-2 text-sm"
                />
                <textarea
                  value={createForm.body}
                  onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
                  placeholder="Body — same placeholders supported"
                  rows={5}
                  className="mt-3 w-full rounded-lg border border-mist-200 px-3 py-2 text-sm"
                />
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-ink-600">
                    <input
                      type="checkbox"
                      checked={createForm.is_active}
                      onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                    />
                    Active (selectable in automation & manual send)
                  </label>
                  <button
                    onClick={submitCreate}
                    disabled={creating || !createForm.name || !createForm.subject || !createForm.body}
                    className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {creating ? "Creating…" : "Create template"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {templates.map((t) =>
                editingId === t.id ? (
                  <div key={t.id} className="rounded-xl border border-mist-200 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
                      />
                      <select
                        value={editForm.trigger}
                        onChange={(e) => setEditForm({ ...editForm, trigger: e.target.value as NotificationTrigger })}
                        className="rounded-lg border border-mist-200 px-3 py-2 text-sm"
                      >
                        {(["manual", ...AUTOMATABLE_TRIGGERS] as NotificationTrigger[]).map((tr) => (
                          <option key={tr} value={tr}>
                            {NOTIFICATION_TRIGGER_LABELS[tr]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={editForm.subject}
                      onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                      className="mt-3 w-full rounded-lg border border-mist-200 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={editForm.body}
                      onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                      rows={5}
                      className="mt-3 w-full rounded-lg border border-mist-200 px-3 py-2 text-sm"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-ink-600">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                        />
                        Active
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 rounded-lg border border-mist-200 px-3 py-1.5 text-xs font-medium"
                        >
                          <X size={13} /> Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(t.id)}
                          className="flex items-center gap-1 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          <Check size={13} /> Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="flex items-start justify-between gap-4 rounded-xl border border-mist-200 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink-900">{t.name}</p>
                        {!t.is_active && (
                          <span className="rounded-full bg-mist-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                            inactive
                          </span>
                        )}
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                          {NOTIFICATION_TRIGGER_LABELS[t.trigger]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">{t.subject}</p>
                      <p className="mt-1 whitespace-pre-line text-xs text-ink-400">{t.body}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => startEdit(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              )}
              {templates.length === 0 && !showCreateForm && (
                <p className="text-sm text-ink-400">No templates yet — create one to get started.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
