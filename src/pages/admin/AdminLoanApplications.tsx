import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { adminGet, adminPatch } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import Pagination, { type PageMeta } from "../../components/admin/Pagination";

type LoanApplication = {
  id: string;
  product_slug: string;
  product_name: string;
  tier_label: string;
  amount: number;
  term_value: number;
  term_unit: string;
  estimated_installment: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
};

const STATUSES = ["pending", "contacted", "approved", "declined"];
const PRODUCTS = [
  { value: "", label: "All products" },
  { value: "sme-loans", label: "SME Loans" },
  { value: "mobile-loans", label: "Mobile Loans" },
  { value: "logbook-loans", label: "Logbook Loans" },
  { value: "rental-income-loans", label: "Rental Income Loans" },
  { value: "check-off-loans", label: "Check Off Loans" },
];

function fmtKes(n: number) {
  return "KES " + Math.round(n).toLocaleString("en-KE");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminLoanApplications() {
  usePageMeta("Loan Applications");
  const [items, setItems] = useState<LoanApplication[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const qs = new URLSearchParams({ page: String(page), page_size: "10" });
  if (statusFilter) qs.set("status", statusFilter);
  if (productFilter) qs.set("product_slug", productFilter);
  const requestKey = qs.toString();
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    adminGet<{ items: LoanApplication[]; meta: PageMeta }>(`/api/admin/loan-applications?${requestKey}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setMeta(data.meta);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Couldn't load loan applications.");
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      await adminPatch(`/api/admin/loan-applications/${id}`, { status });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-mist-200 bg-surface px-4 py-2 text-sm text-ink-700 focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={productFilter}
          onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-mist-200 bg-surface px-4 py-2 text-sm text-ink-700 focus:outline-none"
        >
          {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-surface">
        {loading ? (
          <p className="p-6 text-sm text-ink-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No loan applications match this filter.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Amount / Term</th>
                <th className="px-4 py-3 font-medium">Est. Installment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {items.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: "var(--color-ink-900)" }}>{l.full_name}</p>
                    <p className="text-xs text-ink-500">{l.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    {l.product_name}
                    <br />
                    <span className="text-xs text-ink-500">{l.tier_label}</span>
                  </td>
                  <td className="px-4 py-3 tabular">
                    {fmtKes(l.amount)}
                    <br />
                    <span className="text-xs text-ink-500">{l.term_value} {l.term_unit}</span>
                  </td>
                  <td className="px-4 py-3 tabular">{fmtKes(l.estimated_installment)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={l.status}
                      disabled={updatingId === l.id}
                      onChange={(e) => updateStatus(l.id, e.target.value)}
                      className="rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-xs text-ink-700 focus:outline-none disabled:opacity-50"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-500">{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}
