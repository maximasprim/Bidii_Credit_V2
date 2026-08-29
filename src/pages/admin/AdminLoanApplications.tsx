import { useEffect, useState } from "react";
import { AlertCircle, UserPlus } from "lucide-react";
import { adminGet, adminPatch } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { getAllBranches } from "../../lib/branchesApi";
import type { Branch } from "../../lib/useBranches";
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
  location: string | null;
  assigned_branch_id: string | null;
  assigned_branch_name: string | null;
  branch_assignment_method: string | null;
  assigned_loan_officer_id: string | null;
  assigned_loan_officer_name: string | null;
  status: string;
  created_at: string;
};

type LoanOfficer = { id: string; username: string };

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
  const { role } = useAdminAuth();
  const canAssign = role === "admin" || role === "branch_office_admin";

  const [items, setItems] = useState<LoanApplication[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [officersByBranch, setOfficersByBranch] = useState<Record<string, LoanOfficer[]>>({});

  const qs = new URLSearchParams({ page: String(page), page_size: "10" });
  if (statusFilter) qs.set("status", statusFilter);
  if (productFilter) qs.set("product_slug", productFilter);
  const requestKey = qs.toString();
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (canAssign) getAllBranches().then((d) => setBranches(d.items)).catch(() => {});
  }, [canAssign]);

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

  async function openAssign(item: LoanApplication) {
    setAssigningId(item.id);
    if (item.assigned_branch_id && !officersByBranch[item.assigned_branch_id]) {
      try {
        const officers = await adminGet<LoanOfficer[]>(`/api/admin/loan-applications/branch-officers?branch_id=${item.assigned_branch_id}`);
        setOfficersByBranch((prev) => ({ ...prev, [item.assigned_branch_id!]: officers }));
      } catch {
        // leave the dropdown showing "no officers found" rather than blocking the whole page
      }
    }
  }

  async function assignOfficer(item: LoanApplication, officerId: string) {
    try {
      const res = await adminPatch<{ data: LoanApplication }>(`/api/admin/loan-applications/${item.id}/assign`, {
        assigned_loan_officer_id: officerId || null,
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data : i)));
      setAssigningId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't assign loan officer.");
    }
  }

  async function reassignBranch(item: LoanApplication, branchId: string) {
    if (!branchId) return;
    try {
      const res = await adminPatch<{ data: LoanApplication }>(`/api/admin/loan-applications/${item.id}/assign`, {
        assigned_branch_id: branchId,
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data : i)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't reassign branch.");
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
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Location / Branch</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Amount / Term</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canAssign && <th className="px-4 py-3 font-medium">Loan Officer</th>}
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
                    <p className="text-xs text-ink-500">{l.location || "-"}</p>
                    <div className="flex flex-col gap-1">
                    {canAssign ? (
                      <select
                        value={l.assigned_branch_id ?? ""}
                        onChange={(e) => reassignBranch(l, e.target.value)}
                        className="mt-1 rounded-lg border border-mist-200 bg-surface px-2 py-1 text-xs text-ink-700 focus:outline-none"
                      >
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : (
                      <p className="font-medium">{l.assigned_branch_name || "Unassigned"}</p>
                    )}
                    {l.branch_assignment_method && (
                      <span className="text-[10px] text-ink-400 italic">Matched Via - {l.branch_assignment_method}</span>
                    )}
                    </div>
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
                  {canAssign && (
                    <td className="px-4 py-3">
                      {assigningId === l.id ? (
                        <select
                          autoFocus
                          value={l.assigned_loan_officer_id ?? ""}
                          onChange={(e) => assignOfficer(l, e.target.value)}
                          onBlur={() => setAssigningId(null)}
                          className="rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-xs text-ink-700 focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {(l.assigned_branch_id ? officersByBranch[l.assigned_branch_id] : [])?.map((o) => (
                            <option key={o.id} value={o.id}>{o.username}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => openAssign(l)}
                          className="flex items-center gap-1 rounded-lg border border-mist-200 px-2 py-1.5 text-xs text-ink-700 hover:bg-mist-50"
                        >
                          <UserPlus size={12} />
                          {l.assigned_loan_officer_name || "Assign"}
                        </button>
                      )}
                    </td>
                  )}
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
