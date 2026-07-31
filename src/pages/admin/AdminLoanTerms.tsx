import { useEffect, useState } from "react";
import { AlertCircle, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { adminGet, adminPost, adminPatch, adminDelete } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";

type Tier = {
  id: string;
  product_slug: string;
  tier_key: string;
  label: string;
  min_amount: number;
  max_amount: number;
  term_unit: string;
  min_term: number;
  max_term: number;
  repayment_frequency: string;
  interest_rate: number;
  interest_basis: string;
  registration_fee: number;
  processing_fee_rate: number;
  life_insurance_fee_rate: number;
  chattel_fee: number;
  incharge_fee: number;
  tracking_fee_per_month: number;
  excise_duty_on_fees_rate: number;
  guarantors: number | null;
  display_order: number;
  is_active: boolean;
};

const PRODUCTS = [
  { slug: "sme-loans", name: "SME Loans" },
  { slug: "mobile-loans", name: "Mobile Loans" },
  { slug: "logbook-loans", name: "Logbook Loans" },
  { slug: "rental-income-loans", name: "Rental Income Loans" },
  { slug: "check-off-loans", name: "Check Off Loans" },
];

type TierForm = {
  tier_key: string;
  label: string;
  min_amount: string;
  max_amount: string;
  term_unit: string;
  min_term: string;
  max_term: string;
  repayment_frequency: string;
  interest_rate: string;
  interest_basis: string;
  registration_fee: string;
  processing_fee_rate: string;
  life_insurance_fee_rate: string;
  chattel_fee: string;
  incharge_fee: string;
  tracking_fee_per_month: string;
  excise_duty_on_fees_rate: string;
  guarantors: string;
};

const emptyForm: TierForm = {
  tier_key: "", label: "", min_amount: "", max_amount: "", term_unit: "months", min_term: "", max_term: "",
  repayment_frequency: "monthly", interest_rate: "", interest_basis: "per_month", registration_fee: "0",
  processing_fee_rate: "0", life_insurance_fee_rate: "0", chattel_fee: "0", incharge_fee: "0",
  tracking_fee_per_month: "0", excise_duty_on_fees_rate: "0", guarantors: "",
};

function tierToForm(t: Tier): TierForm {
  return {
    tier_key: t.tier_key,
    label: t.label,
    min_amount: String(t.min_amount),
    max_amount: String(t.max_amount),
    term_unit: t.term_unit,
    min_term: String(t.min_term),
    max_term: String(t.max_term),
    repayment_frequency: t.repayment_frequency,
    interest_rate: String(t.interest_rate),
    interest_basis: t.interest_basis,
    registration_fee: String(t.registration_fee),
    processing_fee_rate: String(t.processing_fee_rate),
    life_insurance_fee_rate: String(t.life_insurance_fee_rate),
    chattel_fee: String(t.chattel_fee),
    incharge_fee: String(t.incharge_fee),
    tracking_fee_per_month: String(t.tracking_fee_per_month),
    excise_duty_on_fees_rate: String(t.excise_duty_on_fees_rate),
    guarantors: t.guarantors === null ? "" : String(t.guarantors),
  };
}

function formToPayload(f: TierForm) {
  return {
    tier_key: f.tier_key,
    label: f.label,
    min_amount: Number(f.min_amount),
    max_amount: Number(f.max_amount),
    term_unit: f.term_unit,
    min_term: Number(f.min_term),
    max_term: Number(f.max_term),
    repayment_frequency: f.repayment_frequency,
    interest_rate: Number(f.interest_rate),
    interest_basis: f.interest_basis,
    registration_fee: Number(f.registration_fee || 0),
    processing_fee_rate: Number(f.processing_fee_rate || 0),
    life_insurance_fee_rate: Number(f.life_insurance_fee_rate || 0),
    chattel_fee: Number(f.chattel_fee || 0),
    incharge_fee: Number(f.incharge_fee || 0),
    tracking_fee_per_month: Number(f.tracking_fee_per_month || 0),
    excise_duty_on_fees_rate: Number(f.excise_duty_on_fees_rate || 0),
    guarantors: f.guarantors === "" ? null : Number(f.guarantors),
  };
}

function TierFieldsGrid({ form, onChange }: { form: TierForm; onChange: (f: TierForm) => void }) {
  const set = (key: keyof TierForm, value: string) => onChange({ ...form, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <input value={form.tier_key} onChange={(e) => set("tier_key", e.target.value)} placeholder="Tier key (e.g. hustle-yangu)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Display label" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <select value={form.repayment_frequency} onChange={(e) => set("repayment_frequency", e.target.value)} className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none">
        <option value="weekly">Weekly repayment</option>
        <option value="monthly">Monthly repayment</option>
      </select>

      <input type="number" value={form.min_amount} onChange={(e) => set("min_amount", e.target.value)} placeholder="Min amount (KES)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" value={form.max_amount} onChange={(e) => set("max_amount", e.target.value)} placeholder="Max amount (KES)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <select value={form.term_unit} onChange={(e) => set("term_unit", e.target.value)} className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none">
        <option value="weeks">Weeks</option>
        <option value="months">Months</option>
      </select>

      <input type="number" value={form.min_term} onChange={(e) => set("min_term", e.target.value)} placeholder="Min term" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" value={form.max_term} onChange={(e) => set("max_term", e.target.value)} placeholder="Max term" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <select value={form.interest_basis} onChange={(e) => set("interest_basis", e.target.value)} className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none">
        <option value="flat_over_term">Flat over term</option>
        <option value="per_month">Per month (compounding)</option>
      </select>

      <input type="number" step="0.001" value={form.interest_rate} onChange={(e) => set("interest_rate", e.target.value)} placeholder="Interest rate (e.g. 0.15 = 15%)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" value={form.registration_fee} onChange={(e) => set("registration_fee", e.target.value)} placeholder="Registration fee (KES)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" step="0.001" value={form.processing_fee_rate} onChange={(e) => set("processing_fee_rate", e.target.value)} placeholder="Processing fee rate" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />

      <input type="number" step="0.001" value={form.life_insurance_fee_rate} onChange={(e) => set("life_insurance_fee_rate", e.target.value)} placeholder="Life insurance fee rate" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" value={form.chattel_fee} onChange={(e) => set("chattel_fee", e.target.value)} placeholder="Chattel fee (KES)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" value={form.incharge_fee} onChange={(e) => set("incharge_fee", e.target.value)} placeholder="Incharge fee (KES)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />

      <input type="number" value={form.tracking_fee_per_month} onChange={(e) => set("tracking_fee_per_month", e.target.value)} placeholder="Tracking fee / month (KES)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" step="0.01" value={form.excise_duty_on_fees_rate} onChange={(e) => set("excise_duty_on_fees_rate", e.target.value)} placeholder="Excise duty rate on fees" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
      <input type="number" value={form.guarantors} onChange={(e) => set("guarantors", e.target.value)} placeholder="Guarantors (blank = none/collateral)" className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none" />
    </div>
  );
}

export default function AdminLoanTerms() {
  usePageMeta("Loan Terms");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [loadedTrigger, setLoadedTrigger] = useState(-1);
  const loading = loadedTrigger !== reloadTrigger;

  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<TierForm>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TierForm>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminGet<{ items: Tier[] }>("/api/admin/loan-tiers")
      .then((data) => {
        if (cancelled) return;
        setTiers(data.items);
        setError(null);
        setLoadedTrigger(reloadTrigger);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Couldn't load loan terms.");
        setLoadedTrigger(reloadTrigger);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTrigger]);

  function reload() {
    setReloadTrigger((n) => n + 1);
  }

  async function onCreate(e: React.FormEvent, productSlug: string) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await adminPost("/api/admin/loan-tiers", { product_slug: productSlug, ...formToPayload(createForm) });
      setCreatingFor(null);
      setCreateForm(emptyForm);
      reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create tier.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(tier: Tier) {
    setEditingId(tier.id);
    setEditForm(tierToForm(tier));
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      const { tier_key: _omit, ...updatable } = formToPayload(editForm);
      void _omit; // tier_key is set at creation and isn't part of the update schema
      await adminPatch(`/api/admin/loan-tiers/${id}`, updatable);
      setEditingId(null);
      reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(tier: Tier) {
    try {
      await adminPatch(`/api/admin/loan-tiers/${tier.id}`, { is_active: !tier.is_active });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update tier.");
    }
  }

  async function onDelete(tier: Tier) {
    if (!confirm(`Delete "${tier.label}"? Existing applications keep their own record of these terms, but this removes it from the calculator and application form.`)) return;
    try {
      await adminDelete(`/api/admin/loan-tiers/${tier.id}`);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete tier.");
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading loan terms…</p>;

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {PRODUCTS.map((product) => {
        const productTiers = tiers.filter((t) => t.product_slug === product.slug);
        return (
          <div key={product.slug} className="rounded-2xl border border-mist-200 bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{product.name}</h2>
              <button
                onClick={() => {
                  setCreatingFor(creatingFor === product.slug ? null : product.slug);
                  setCreateForm(emptyForm);
                  setCreateError(null);
                }}
                className="flex items-center gap-1.5 rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50"
              >
                <Plus size={13} />
                Add plan
              </button>
            </div>

            {creatingFor === product.slug && (
              <form onSubmit={(e) => onCreate(e, product.slug)} className="mb-4 space-y-3 rounded-xl bg-mist-50 p-4">
                {createError && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    <AlertCircle size={14} />
                    {createError}
                  </div>
                )}
                <TierFieldsGrid form={createForm} onChange={setCreateForm} />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: "var(--color-ember-500)" }}
                  >
                    <Check size={13} />
                    {creating ? "Creating…" : "Create Plan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingFor(null)}
                    className="flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-700"
                  >
                    <X size={13} />
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {productTiers.length === 0 ? (
              <p className="text-sm text-ink-500">No plans configured for this product yet.</p>
            ) : (
              <div className="space-y-3">
                {productTiers.map((tier) => {
                  const isEditing = editingId === tier.id;
                  return (
                    <div key={tier.id} className="rounded-xl border border-mist-200 p-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          {editError && (
                            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                              <AlertCircle size={14} />
                              {editError}
                            </div>
                          )}
                          <TierFieldsGrid form={editForm} onChange={setEditForm} />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(tier.id)}
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
                              <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{tier.label}</p>
                              <StatusBadge status={tier.is_active ? "active" : "inactive"} />
                            </div>
                            <p className="mt-1 text-xs text-ink-500">
                              KES {tier.min_amount.toLocaleString()} – {tier.max_amount.toLocaleString()} · {tier.min_term}-{tier.max_term} {tier.term_unit} · {(tier.interest_rate * 100).toFixed(1)}%{tier.interest_basis === "per_month" ? "/mo" : " flat"}
                            </p>
                            <p className="mt-1 text-xs text-ink-500">
                              Reg {tier.registration_fee} · Processing {(tier.processing_fee_rate * 100).toFixed(0)}% · Life {(tier.life_insurance_fee_rate * 100).toFixed(0)}%
                              {tier.chattel_fee > 0 && ` · Chattel ${tier.chattel_fee}`}
                              {tier.guarantors !== null && ` · ${tier.guarantors} guarantor(s)`}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => startEdit(tier)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => toggleActive(tier)}
                              className="rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50"
                            >
                              {tier.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => onDelete(tier)}
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
        );
      })}
    </div>
  );
}
