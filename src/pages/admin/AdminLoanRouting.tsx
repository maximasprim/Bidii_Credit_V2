import { useEffect, useState } from "react";
import { AlertCircle, ArrowRightCircle, CheckCircle2, UserRound } from "lucide-react";
import { adminGet, adminPut } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import { roleLabel } from "../../lib/roleAccess";

type ProductRouting = {
  product_slug: string;
  product_name: string;
  suggested_role: string | null;
  assigned_admin_id: string | null;
  assigned_admin_username: string | null;
  assigned_admin_email: string | null;
};

type AdminUserOption = {
  id: string;
  username: string;
  role: string;
  email: string | null;
  is_active: boolean;
};

export default function AdminLoanRouting() {
  usePageMeta("Loan Routing");

  const [items, setItems] = useState<ProductRouting[]>([]);
  const [admins, setAdmins] = useState<AdminUserOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    Promise.all([
      adminGet<{ items: ProductRouting[] }>("/api/admin/product-routing"),
      adminGet<{ items: AdminUserOption[] }>("/api/admin/users"),
    ])
      .then(([routing, users]) => {
        setItems(routing.items);
        setAdmins(users.items.filter((u) => u.is_active));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load loan routing."))
      .finally(() => setLoaded(true));
  }, []);

  async function assignAdmin(productSlug: string, adminId: string | null) {
    setSavingSlug(productSlug);
    setSaveError(null);
    setSavedSlug(null);
    try {
      const response = await adminPut<{ data: ProductRouting }>(`/api/admin/product-routing/${productSlug}`, {
        assigned_admin_id: adminId,
      });
      setItems((prev) => prev.map((item) => (item.product_slug === productSlug ? response.data : item)));
      setSavedSlug(productSlug);
      setTimeout(() => setSavedSlug((current) => (current === productSlug ? null : current)), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't update routing.");
    } finally {
      setSavingSlug(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--color-ink-900)" }}>
          Loan Routing
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Choose to route every new application for an individual product straight to one person instead of the normal
          branch queue. That person is notified in-app and by email as soon as an application comes in. Clear a
          product back to "Normal branch routing" to default to normal branch routing.
        </p>
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} />
          {loadError}
        </div>
      )}
      {saveError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} />
          {saveError}
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const suggestedAdmins = admins.filter((a) => a.role === item.suggested_role);
            const otherAdmins = admins.filter((a) => a.role !== item.suggested_role);
            const isRouted = !!item.assigned_admin_id;
            const isSaving = savingSlug === item.product_slug;

            return (
              <div
                key={item.product_slug}
                className="rounded-2xl border p-5"
                style={{
                  borderColor: isRouted ? "var(--color-ember-400)" : "var(--color-mist-200)",
                  background: isRouted ? "var(--color-ember-100)" : "white",
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                      {item.product_name}
                    </p>
                    {item.suggested_role && (
                      <p className="mt-0.5 text-xs text-ink-500">Usually handled by: {roleLabel(item.suggested_role)}</p>
                    )}
                  </div>
                  {isRouted ? (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                      style={{ background: "var(--color-ember-500)", color: "white" }}
                    >
                      <ArrowRightCircle size={12} />
                      Routed
                    </span>
                  ) : (
                    <span className="rounded-full bg-mist-100 px-2 py-1 text-[11px] font-semibold text-ink-500">
                      Normal
                    </span>
                  )}
                </div>

                <label className="mb-1.5 block text-xs font-semibold text-ink-500">Route new applications to</label>
                <select
                  value={item.assigned_admin_id ?? ""}
                  disabled={isSaving}
                  onChange={(e) => assignAdmin(item.product_slug, e.target.value || null)}
                  className="w-full rounded-xl border border-mist-200 px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">Normal branch routing (no override)</option>
                  {suggestedAdmins.length > 0 && (
                    <optgroup label="Suggested">
                      {suggestedAdmins.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.username} {a.email ? `(${a.email})` : "- no email on file"}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Other admins">
                    {otherAdmins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.username} · {roleLabel(a.role)} {a.email ? `(${a.email})` : "- no email on file"}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {item.assigned_admin_id && !item.assigned_admin_email && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle size={12} />
                    {item.assigned_admin_username} has no email on file - they won't get email notifications until one is added.
                  </p>
                )}
                {savedSlug === item.product_slug && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--color-ember-600)" }}>
                    <CheckCircle2 size={12} />
                    Saved
                  </p>
                )}
                {isRouted && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                    <UserRound size={12} />
                    {item.assigned_admin_username} is emailed and assigned instantly for every new application.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
