import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRightCircle, CheckCircle2, UserRound } from "lucide-react";
import { adminGet, adminPut } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import { roleLabel } from "../../lib/roleAccess";

type RoutedAgent = { id: string; username: string; email: string | null; is_active: boolean };

type ProductRouting = {
  product_slug: string;
  product_name: string;
  suggested_role: string | null;
  assigned_admin_id: string | null;
  assigned_admin_username: string | null;
  assigned_admin_email: string | null;
  // Every agent the product is routed to (assigned_admin_* above = the first one).
  assigned_admins: RoutedAgent[];
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
  // Latest items, readable inside quick successive clicks (state alone would be one render behind),
  // and a per-product counter so only the newest save's response is applied.
  const itemsRef = useRef<ProductRouting[]>([]);
  const saveSeq = useRef<Record<string, number>>({});
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
        itemsRef.current = routing.items;
        setAdmins(users.items.filter((u) => u.is_active));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load loan routing."))
      .finally(() => setLoaded(true));
  }, []);

  function applyItems(updater: (prev: ProductRouting[]) => ProductRouting[]) {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }

  // Saves the full list of agents for a product. Empty list = normal branch routing.
  // The card updates straight away (so ticking feels instant and several people can be ticked
  // in a row); the server's answer then replaces it, unless a newer click has been made since.
  async function saveAgents(productSlug: string, adminIds: string[]) {
    const seq = (saveSeq.current[productSlug] ?? 0) + 1;
    saveSeq.current[productSlug] = seq;
    setSaveError(null);
    setSavedSlug(null);
    setSavingSlug(productSlug);

    const known = new Map<string, RoutedAgent>();
    for (const it of itemsRef.current) for (const a of it.assigned_admins) known.set(a.id, a);
    for (const a of admins) known.set(a.id, { id: a.id, username: a.username, email: a.email, is_active: a.is_active });
    const optimistic = adminIds.map((id) => known.get(id)).filter((a): a is RoutedAgent => !!a);
    applyItems((prev) =>
      prev.map((item) =>
        item.product_slug === productSlug
          ? {
              ...item,
              assigned_admins: optimistic,
              assigned_admin_id: optimistic[0]?.id ?? null,
              assigned_admin_username: optimistic[0]?.username ?? null,
              assigned_admin_email: optimistic[0]?.email ?? null,
            }
          : item
      )
    );

    try {
      const response = await adminPut<{ data: ProductRouting }>(`/api/admin/product-routing/${productSlug}`, {
        assigned_admin_ids: adminIds,
      });
      if (saveSeq.current[productSlug] !== seq) return; // a newer click is already in flight
      applyItems((prev) => prev.map((item) => (item.product_slug === productSlug ? response.data : item)));
      setSavedSlug(productSlug);
      setTimeout(() => setSavedSlug((current) => (current === productSlug ? null : current)), 2500);
    } catch (err) {
      if (saveSeq.current[productSlug] !== seq) return;
      setSaveError(err instanceof Error ? err.message : "Couldn't update routing.");
      // Put the card back to what the server actually has.
      try {
        const fresh = await adminGet<{ items: ProductRouting[] }>("/api/admin/product-routing");
        applyItems(() => fresh.items);
      } catch {
        /* leave the card as is; the error above is already showing */
      }
    } finally {
      if (saveSeq.current[productSlug] === seq) setSavingSlug(null);
    }
  }

  // Ticks/unticks one person. Agents who have since been deactivated are dropped from the
  // saved list (the server refuses deactivated accounts), which also clears them from the card.
  function toggleAgent(productSlug: string, adminId: string, checked: boolean) {
    const item = itemsRef.current.find((i) => i.product_slug === productSlug);
    if (!item) return;
    const activeIds = new Set(admins.map((a) => a.id));
    const current = item.assigned_admins.map((a) => a.id).filter((id) => activeIds.has(id));
    const next = checked ? [...current.filter((id) => id !== adminId), adminId] : current.filter((id) => id !== adminId);
    saveAgents(productSlug, next);
  }

  function renderAgentOption(item: ProductRouting, a: { id: string; username: string; email: string | null; role?: string }) {
    const checked = item.assigned_admins.some((x) => x.id === a.id);
    return (
      <label
        key={a.id}
        className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/5"
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => toggleAgent(item.product_slug, a.id, e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ember-500)]"
        />
        <span className="min-w-0">
          <span className="block truncate font-medium" style={{ color: "var(--color-ink-900)" }}>
            {a.username}
            {a.role ? <span className="font-normal text-ink-500"> · {roleLabel(a.role)}</span> : null}
          </span>
          <span className="block truncate text-xs text-ink-500">{a.email ?? "no email on file"}</span>
        </span>
      </label>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--color-ink-900)" }}>
          Loan Routing
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Choose to route every new application for an individual product straight to one or more people instead of the
          normal branch queue. Everyone ticked is notified in-app and by email as soon as an application comes in. It is assigned to
          one of them, in turn, so each application has one owner. Untick everyone to go back to normal branch
          routing.
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
            const agentCount = item.assigned_admins.length;
            const isRouted = agentCount > 0;
            // Anyone already routed but no longer in the active-admins list (deactivated) stays visible so they can be removed.
            const activeIds = new Set(admins.map((a) => a.id));
            const staleAgents = item.assigned_admins.filter((a) => !activeIds.has(a.id));
            const otherHasSelection = otherAdmins.some((a) => item.assigned_admins.some((x) => x.id === a.id));
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
                      Routed{agentCount > 1 ? ` · ${agentCount}` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-mist-100 px-2 py-1 text-[11px] font-semibold text-ink-500">
                      Normal
                    </span>
                  )}
                </div>

                <div className="mb-1.5 flex items-center justify-between">
                  <span className="block text-xs font-semibold text-ink-500">
                    Route new applications to (tick one or more)
                  </span>
                  {isRouted && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => saveAgents(item.product_slug, [])}
                      className="text-xs text-ink-500 underline hover:text-ink-900 disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-mist-200 bg-white/70 p-1.5">
                  {suggestedAdmins.length > 0 && (
                    <>
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Suggested</p>
                      {suggestedAdmins.map((a) => renderAgentOption(item, a))}
                    </>
                  )}
                  {staleAgents.length > 0 && (
                    <>
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                        Deactivated (won't receive applications)
                      </p>
                      {staleAgents.map((a) => renderAgentOption(item, a))}
                    </>
                  )}
                  {otherAdmins.length > 0 && (
                    <details open={otherHasSelection || suggestedAdmins.length === 0}>
                      <summary className="cursor-pointer select-none px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        Other admins ({otherAdmins.length})
                      </summary>
                      {otherAdmins.map((a) => renderAgentOption(item, a))}
                    </details>
                  )}
                  {admins.length === 0 && <p className="px-2 py-1 text-xs text-ink-500">No active admin users found.</p>}
                </div>

                {item.assigned_admins.some((a) => a.is_active && !a.email) && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle size={12} />
                    {item.assigned_admins
                      .filter((a) => a.is_active && !a.email)
                      .map((a) => a.username)
                      .join(", ")}{" "}
                    {item.assigned_admins.filter((a) => a.is_active && !a.email).length === 1 ? "has" : "have"} no email on
                    file - no email notifications until one is added.
                  </p>
                )}
                {isSaving && <p className="mt-2 text-xs text-ink-500">Saving…</p>}
                {savedSlug === item.product_slug && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--color-ember-600)" }}>
                    <CheckCircle2 size={12} />
                    Saved
                  </p>
                )}
                {isRouted && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                    <UserRound size={12} />
                    {agentCount === 1
                      ? `${item.assigned_admins[0].username} is emailed and assigned instantly for every new application.`
                      : `All ${agentCount} people are emailed about every new application; it is assigned to one of them in turn.`}
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
