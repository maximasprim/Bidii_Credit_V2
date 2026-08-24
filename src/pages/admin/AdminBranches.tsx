import { useEffect, useState } from "react";
import { AlertCircle, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { getAllBranches, createBranch, updateBranch, deleteBranch, type BranchInput } from "../../lib/branchesApi";
import type { Branch } from "../../lib/useBranches";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";

type BranchForm = {
  name: string;
  address: string;
  hours: string;
  phone: string;
  lat: string;
  lng: string;
  display_order: string;
};

const emptyForm: BranchForm = { name: "", address: "", hours: "Mon–Fri 8:00–17:00", phone: "", lat: "", lng: "", display_order: "0" };

function branchToForm(b: Branch): BranchForm {
  return {
    name: b.name,
    address: b.address,
    hours: b.hours,
    phone: b.phone,
    lat: String(b.lat),
    lng: String(b.lng),
    display_order: String(b.display_order),
  };
}

function formToPayload(f: BranchForm): BranchInput {
  return {
    name: f.name,
    address: f.address,
    hours: f.hours,
    phone: f.phone,
    lat: Number(f.lat),
    lng: Number(f.lng),
    display_order: Number(f.display_order || 0),
    is_active: true,
  };
}

function BranchFieldsGrid({ form, onChange }: { form: BranchForm; onChange: (f: BranchForm) => void }) {
  const set = (key: keyof BranchForm, value: string) => onChange({ ...form, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Branch name" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none sm:col-span-2" />
      <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone (e.g. +254 700 000 000)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />

      <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Address" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none sm:col-span-2" />
      <input value={form.hours} onChange={(e) => set("hours", e.target.value)} placeholder="Hours (e.g. Mon–Fri 8:00–17:00)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />

      <input type="number" step="any" value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="Latitude" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" step="any" value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="Longitude" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" value={form.display_order} onChange={(e) => set("display_order", e.target.value)} placeholder="Display order" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
    </div>
  );
}

export default function AdminBranches() {
  usePageMeta("Branches");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [loadedTrigger, setLoadedTrigger] = useState(-1);
  const loading = loadedTrigger !== reloadTrigger;

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<BranchForm>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingBusy, setCreatingBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BranchForm>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllBranches()
      .then((data) => {
        if (cancelled) return;
        setBranches([...data.items].sort((a, b) => a.display_order - b.display_order));
        setError(null);
        setLoadedTrigger(reloadTrigger);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load branches.");
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
    setCreatingBusy(true);
    try {
      await createBranch(formToPayload(createForm));
      setCreating(false);
      setCreateForm(emptyForm);
      reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create branch.");
    } finally {
      setCreatingBusy(false);
    }
  }

  function startEdit(branch: Branch) {
    setEditingId(branch.id);
    setEditForm(branchToForm(branch));
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateBranch(id, formToPayload(editForm));
      setEditingId(null);
      reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(branch: Branch) {
    try {
      await updateBranch(branch.id, { is_active: !branch.is_active });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update branch.");
    }
  }

  async function onDelete(branch: Branch) {
    if (!confirm(`Delete "${branch.name}"? This removes it from the site immediately.`)) return;
    try {
      await deleteBranch(branch.id);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete branch.");
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading branches…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
          Branches
        </h1>
        <p className="text-sm text-ink-500">
          {branches.length} branch{branches.length === 1 ? "" : "es"}, one relationship. Add, edit, or remove a
          location - changes show up on the public Branch Locator and homepage immediately.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
            All branches
          </h2>
          <button
            onClick={() => {
              setCreating((v) => !v);
              setCreateForm(emptyForm);
              setCreateError(null);
            }}
            className="flex items-center gap-1.5 rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50"
          >
            <Plus size={13} />
            Add branch
          </button>
        </div>

        {creating && (
          <form onSubmit={onCreate} className="mb-4 space-y-3 rounded-xl bg-mist-50 p-4">
            {createError && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                <AlertCircle size={14} />
                {createError}
              </div>
            )}
            <BranchFieldsGrid form={createForm} onChange={setCreateForm} />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creatingBusy}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--color-ember-500)" }}
              >
                <Check size={13} />
                {creatingBusy ? "Creating…" : "Create Branch"}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-700"
              >
                <X size={13} />
                Cancel
              </button>
            </div>
          </form>
        )}

        {branches.length === 0 ? (
          <p className="text-sm text-ink-500">No branches configured yet.</p>
        ) : (
          <div className="space-y-3">
            {branches.map((branch) => {
              const isEditing = editingId === branch.id;
              return (
                <div key={branch.id} className="rounded-xl border border-mist-200 p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      {editError && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                          <AlertCircle size={14} />
                          {editError}
                        </div>
                      )}
                      <BranchFieldsGrid form={editForm} onChange={setEditForm} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(branch.id)}
                          disabled={savingEdit}
                          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: "var(--color-ember-500)" }}
                        >
                          <Check size={13} />
                          {savingEdit ? "Saving…" : "Save"}
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
                          <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{branch.name}</p>
                          <StatusBadge status={branch.is_active ? "active" : "inactive"} />
                        </div>
                        <p className="mt-1 text-xs text-ink-500">{branch.address}</p>
                        <p className="mt-1 text-xs text-ink-500">{branch.hours} · {branch.phone}</p>
                        <p className="mt-1 text-xs text-ink-500">
                          {branch.lat.toFixed(5)}, {branch.lng.toFixed(5)} · order {branch.display_order}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => startEdit(branch)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => toggleActive(branch)}
                          className="rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50"
                        >
                          {branch.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => onDelete(branch)}
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
