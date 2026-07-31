import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Pencil, Trash2, Check, X, Plus, Users } from "lucide-react";
import { adminGet, adminPost, adminPatch, adminDelete } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";

type Job = {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  is_open: boolean;
  application_count: number;
};

const JOB_TYPES = ["Full-time", "Contract"];

type FormState = {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  is_open: boolean;
};

const emptyForm: FormState = { title: "", department: "", location: "", type: JOB_TYPES[0], description: "", is_open: true };

export default function AdminJobs() {
  usePageMeta("Manage Jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [loadedTrigger, setLoadedTrigger] = useState(-1);
  const loading = loadedTrigger !== reloadTrigger;

  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminGet<{ items: Job[] }>("/api/admin/jobs")
      .then((data) => {
        if (cancelled) return;
        setJobs(data.items);
        setError(null);
        setLoadedTrigger(reloadTrigger);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Couldn't load job postings.");
        setLoadedTrigger(reloadTrigger);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTrigger]);

  function reload() {
    setReloadTrigger((n) => n + 1);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await adminPost("/api/admin/jobs", createForm);
      setCreateForm(emptyForm);
      reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create job posting.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(job: Job) {
    setEditingId(job.id);
    setEditForm({
      title: job.title,
      department: job.department,
      location: job.location,
      type: job.type,
      description: job.description,
      is_open: job.is_open,
    });
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      await adminPatch(`/api/admin/jobs/${id}`, editForm);
      setEditingId(null);
      reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleOpen(job: Job) {
    try {
      await adminPatch(`/api/admin/jobs/${job.id}`, { is_open: !job.is_open });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update posting.");
    }
  }

  async function onDelete(job: Job) {
    if (job.application_count > 0) {
      alert(`Can't delete — ${job.application_count} application(s) are on file for this posting. Close it instead.`);
      return;
    }
    if (!confirm("Delete this job posting? This can't be undone.")) return;
    try {
      await adminDelete(`/api/admin/jobs/${job.id}`);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete job posting.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          Add a new job posting
        </h2>
        {createError && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
            <AlertCircle size={16} />
            {createError}
          </div>
        )}
        <form onSubmit={onCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              required
              placeholder="Job title"
              className="rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
            <select
              value={createForm.type}
              onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
              className="rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
            >
              {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={createForm.department}
              onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
              required
              placeholder="Department"
              className="rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
            <input
              value={createForm.location}
              onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
              required
              placeholder="Location"
              className="rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <textarea
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            required
            rows={3}
            placeholder="Description"
            className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={createForm.is_open}
              onChange={(e) => setCreateForm({ ...createForm, is_open: e.target.checked })}
            />
            Open for applications
          </label>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            <Plus size={15} />
            {creating ? "Creating…" : "Create Posting"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          All postings
        </h2>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-ink-500">No job postings yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isEditing = editingId === job.id;
              return (
                <div key={job.id} className="rounded-xl border border-mist-200 p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      {editError && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                          <AlertCircle size={14} />
                          {editError}
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                          placeholder="Title"
                        />
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                          className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none"
                        >
                          {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          value={editForm.department}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                          placeholder="Department"
                        />
                        <input
                          value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                          placeholder="Location"
                        />
                      </div>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                      />
                      <label className="flex items-center gap-2 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          checked={editForm.is_open}
                          onChange={(e) => setEditForm({ ...editForm, is_open: e.target.checked })}
                        />
                        Open for applications
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(job.id)}
                          disabled={savingEdit}
                          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: "var(--color-ember-500)" }}
                        >
                          <Check size={13} />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-700"
                        >
                          <X size={13} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{job.title}</p>
                          <StatusBadge status={job.is_open ? "active" : "inactive"} label={job.is_open ? "open" : "closed"} />
                        </div>
                        <p className="mt-1 text-xs text-ink-500">
                          {job.department} · {job.location} · {job.type}
                        </p>
                        <p className="mt-1.5 max-w-xl text-sm text-ink-700">{job.description}</p>
                        <Link
                          to={`/admin/career-applications?job_id=${job.id}`}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: "var(--color-ember-500)" }}
                        >
                          <Users size={13} />
                          {job.application_count} application{job.application_count === 1 ? "" : "s"} — view &amp; vet
                        </Link>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => startEdit(job)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => toggleOpen(job)}
                          className="rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50"
                        >
                          {job.is_open ? "Close" : "Reopen"}
                        </button>
                        <button
                          onClick={() => onDelete(job)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
