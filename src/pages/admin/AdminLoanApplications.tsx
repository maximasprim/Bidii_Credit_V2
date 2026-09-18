import { useEffect, useState } from "react";
import { AlertCircle, Download, ExternalLink, Loader2, UserPlus, X } from "lucide-react";
import { adminDownloadFile, adminGet, adminPatch, adminPost } from "../../lib/adminApi";
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
  county: string | null;
  location: string | null;
  assigned_branch_id: string | null;
  assigned_branch_name: string | null;
  branch_assignment_method: string | null;
  assigned_loan_officer_id: string | null;
  assigned_loan_officer_name: string | null;
  status: string;
  created_at: string;
};

type LoanOfficer = { id: string; username: string; role: string };

// Loan applications with no computed branch (rare, but possible on older
// records from before automatic branch assignment existed) are cached
// under this key instead of being skipped - see openAssign below.
const NO_BRANCH_KEY = "__none__";

function formatAgentRole(role: string): string {
  return role.replace(/_/g, " ");
}

const STATUSES = ["pending", "assigned", "contacted", "approved", "declined"];
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

  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingSheets, setExportingSheets] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);

  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [exportColumns, setExportColumns] = useState<{ key: string; label: string }[]>([]);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<Set<string>>(new Set());
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const [loadingColumns, setLoadingColumns] = useState(false);

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
    // Fetches for every branch key, including NO_BRANCH_KEY for the rare
    // application with no computed branch - the "admin" role gets every
    // active agent back regardless of branch_id (see the backend
    // endpoint's docstring), so there's no reason to skip the fetch just
    // because this particular application has no branch of its own.
    const cacheKey = item.assigned_branch_id ?? NO_BRANCH_KEY;
    if (!officersByBranch[cacheKey]) {
      try {
        const officers = await adminGet<LoanOfficer[]>(
          `/api/admin/loan-applications/branch-officers?branch_id=${item.assigned_branch_id ?? ""}`
        );
        setOfficersByBranch((prev) => ({ ...prev, [cacheKey]: officers }));
      } catch {
        // leave the dropdown showing "no officers found" rather than blocking the whole page
      }
    }
  }

  async function assignOfficer(item: LoanApplication, officerId: string) {
    try {
    const res = await adminPatch<LoanApplication>(`/api/admin/loan-applications/${item.id}/assign`, {
        assigned_loan_officer_id: officerId || null,
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? res : i)));
      setAssigningId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't assign loan officer.");
    }
  }

  async function reassignBranch(item: LoanApplication, branchId: string) {
    if (!branchId) return;
    try {
      const res = await adminPatch<LoanApplication>(`/api/admin/loan-applications/${item.id}/assign`, {
        assigned_branch_id: branchId,
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? res : i)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't reassign branch.");
    }
  }

  // Both exports honour the current status/product filters (same ones the
  // table itself uses) - "export what I'm looking at", not always every
  // application this admin can see.
  function buildExportParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (productFilter) params.set("product_slug", productFilter);
    return params;
  }

  async function openColumnsModal() {
    setColumnsError(null);
    setShowColumnsModal(true);
    if (exportColumns.length > 0) return; // already fetched earlier this session
    setLoadingColumns(true);
    try {
      const cols = await adminGet<{ key: string; label: string }[]>(
        "/api/admin/loan-applications/export/columns"
      );
      setExportColumns(cols);
      setSelectedColumnKeys(new Set(cols.map((c) => c.key))); // all included by default
    } catch (err) {
      setColumnsError(err instanceof Error ? err.message : "Couldn't load the column list.");
    } finally {
      setLoadingColumns(false);
    }
  }

  function toggleColumn(key: string) {
    setSelectedColumnKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function confirmExportXlsx() {
    if (selectedColumnKeys.size === 0) {
      setColumnsError("Pick at least one column.");
      return;
    }
    setExportingXlsx(true);
    setColumnsError(null);
    try {
      const params = buildExportParams();
      // Omitting the param entirely when every column is selected keeps this
      // export identical to a plain "everything" request either way.
      if (selectedColumnKeys.size < exportColumns.length) {
        for (const col of exportColumns) {
          if (selectedColumnKeys.has(col.key)) params.append("columns", col.key);
        }
      }
      const qs = params.toString();
      const filename = `bidii-loan-applications-${new Date().toISOString().slice(0, 10)}.xlsx`;
      await adminDownloadFile(`/api/admin/loan-applications/export/xlsx${qs ? `?${qs}` : ""}`, filename);
      setShowColumnsModal(false);
    } catch (err) {
      setColumnsError(err instanceof Error ? err.message : "Couldn't export to Excel.");
    } finally {
      setExportingXlsx(false);
    }
  }

  function openShareModal() {
    setShareError(null);
    setShowShareModal(true);
  }

  async function confirmExportGoogleSheets() {
    // The backend will share the created sheet with the logged-in admin's
    // own email by default, but not every admin account has one on file -
    // asking here works regardless, and lets you share with someone else
    // (e.g. a branch manager) instead of yourself.
    const email = shareEmail.trim();
    if (!email) {
      setShareError("An email address is needed so the sheet can be shared with someone.");
      return;
    }
    setExportingSheets(true);
    setShareError(null);
    try {
      const params = buildExportParams();
      params.set("share_with_email", email);
      const res = await adminPost<{ spreadsheet_url: string; shared_with: string; count: number }>(
        `/api/admin/loan-applications/export/google-sheets?${params.toString()}`,
        {}
      );
      setShowShareModal(false);
      window.open(res.spreadsheet_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Couldn't export to Google Sheets.");
    } finally {
      setExportingSheets(false);
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={openColumnsModal}
            disabled={exportingXlsx}
            title="Choose which columns to include, then download every branch as a sheet in one .xlsx workbook"
            className="flex items-center gap-1.5 rounded-xl border border-mist-200 bg-surface px-3.5 py-2 text-sm text-ink-700 hover:bg-mist-50 disabled:opacity-50"
          >
            {exportingXlsx ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export Excel
          </button>
          <button
            onClick={openShareModal}
            disabled={exportingSheets}
            title="Create a live Google Sheet with a tab per branch, shared to an email you choose"
            className="flex items-center gap-1.5 rounded-xl border border-mist-200 bg-surface px-3.5 py-2 text-sm text-ink-700 hover:bg-mist-50 disabled:opacity-50"
          >
            {exportingSheets ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Export to Google Sheets
          </button>
        </div>
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
                    <p className="text-xs text-ink-500">{l.county ? `${l.county} · ` : ""}{l.location || "-"}</p>
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
                      <span className="text-[10px] uppercase text-ink-400"> via {l.branch_assignment_method}</span>
                    )}
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
                           {officersByBranch[l.assigned_branch_id ?? NO_BRANCH_KEY]?.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.username} - {formatAgentRole(o.role)}
                            </option>
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

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-mist-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-ink-900">Export to Google Sheets</h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded-lg p-1.5 text-ink-500 hover:bg-mist-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Share the new spreadsheet with
                <input
                  autoFocus
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmExportGoogleSheets(); }}
                  placeholder="name@example.com"
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none"
                />
              </label>
              {shareError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{shareError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-mist-200 px-5 py-3.5">
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded-xl px-3.5 py-2 text-sm text-ink-700 hover:bg-mist-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmExportGoogleSheets}
                disabled={exportingSheets}
                className="flex items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
              >
                {exportingSheets && <Loader2 size={14} className="animate-spin" />}
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {showColumnsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-mist-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-ink-900">Export Excel</h2>
              <button
                onClick={() => setShowColumnsModal(false)}
                className="rounded-lg p-1.5 text-ink-500 hover:bg-mist-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingColumns ? (
                <p className="text-sm text-ink-500">Loading columns…</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-ink-500">
                    <span>Columns to include</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedColumnKeys(new Set(exportColumns.map((c) => c.key)))}
                        className="text-ink-700 underline hover:no-underline"
                      >
                        All
                      </button>
                      <button
                        onClick={() => setSelectedColumnKeys(new Set())}
                        className="text-ink-700 underline hover:no-underline"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {exportColumns.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-ink-700 hover:bg-mist-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumnKeys.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded border-mist-300"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                  {columnsError && (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{columnsError}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-mist-200 px-5 py-3.5">
              <button
                onClick={() => setShowColumnsModal(false)}
                className="rounded-xl px-3.5 py-2 text-sm text-ink-700 hover:bg-mist-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmExportXlsx}
                disabled={exportingXlsx || loadingColumns}
                className="flex items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
              >
                {exportingXlsx && <Loader2 size={14} className="animate-spin" />}
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import { useEffect, useState } from "react";
// import { AlertCircle, Download, ExternalLink, Loader2, UserPlus, X } from "lucide-react";
// import { adminDownloadFile, adminGet, adminPatch, adminPost } from "../../lib/adminApi";
// import { usePageMeta } from "../../lib/usePageMeta";
// import { useAdminAuth } from "../../lib/AdminAuthContext";
// import { getAllBranches } from "../../lib/branchesApi";
// import type { Branch } from "../../lib/useBranches";
// import Pagination, { type PageMeta } from "../../components/admin/Pagination";

// type LoanApplication = {
//   id: string;
//   product_slug: string;
//   product_name: string;
//   tier_label: string;
//   amount: number;
//   term_value: number;
//   term_unit: string;
//   estimated_installment: number;
//   full_name: string;
//   phone: string;
//   email: string;
//   county: string | null;
//   location: string | null;
//   assigned_branch_id: string | null;
//   assigned_branch_name: string | null;
//   branch_assignment_method: string | null;
//   assigned_loan_officer_id: string | null;
//   assigned_loan_officer_name: string | null;
//   status: string;
//   created_at: string;
// };

// type LoanOfficer = { id: string; username: string; role: string };

// // Loan applications with no computed branch (rare, but possible on older
// // records from before automatic branch assignment existed) are cached
// // under this key instead of being skipped - see openAssign below.
// const NO_BRANCH_KEY = "__none__";

// function formatAgentRole(role: string): string {
//   return role.replace(/_/g, " ");
// }

// const STATUSES = ["pending", "assigned", "contacted", "approved", "declined"];
// const PRODUCTS = [
//   { value: "", label: "All products" },
//   { value: "sme-loans", label: "SME Loans" },
//   { value: "mobile-loans", label: "Mobile Loans" },
//   { value: "logbook-loans", label: "Logbook Loans" },
//   { value: "rental-income-loans", label: "Rental Income Loans" },
//   { value: "check-off-loans", label: "Check Off Loans" },
// ];

// function fmtKes(n: number) {
//   return "KES " + Math.round(n).toLocaleString("en-KE");
// }
// function fmtDate(iso: string) {
//   return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
// }

// export default function AdminLoanApplications() {
//   usePageMeta("Loan Applications");
//   const { role } = useAdminAuth();
//   const canAssign = role === "admin" || role === "branch_office_admin";

//   const [items, setItems] = useState<LoanApplication[]>([]);
//   const [meta, setMeta] = useState<PageMeta | null>(null);
//   const [page, setPage] = useState(1);
//   const [statusFilter, setStatusFilter] = useState("");
//   const [productFilter, setProductFilter] = useState("");
//   const [error, setError] = useState<string | null>(null);
//   const [loadedKey, setLoadedKey] = useState<string | null>(null);
//   const [updatingId, setUpdatingId] = useState<string | null>(null);

//   const [branches, setBranches] = useState<Branch[]>([]);
//   const [assigningId, setAssigningId] = useState<string | null>(null);
//   const [officersByBranch, setOfficersByBranch] = useState<Record<string, LoanOfficer[]>>({});

//   const [exportingXlsx, setExportingXlsx] = useState(false);
//   const [exportingSheets, setExportingSheets] = useState(false);
//   const [showShareModal, setShowShareModal] = useState(false);
//   const [shareEmail, setShareEmail] = useState("");
//   const [shareError, setShareError] = useState<string | null>(null);

//   const qs = new URLSearchParams({ page: String(page), page_size: "10" });
//   if (statusFilter) qs.set("status", statusFilter);
//   if (productFilter) qs.set("product_slug", productFilter);
//   const requestKey = qs.toString();
//   const loading = loadedKey !== requestKey;

//   useEffect(() => {
//     if (canAssign) getAllBranches().then((d) => setBranches(d.items)).catch(() => {});
//   }, [canAssign]);

//   useEffect(() => {
//     let cancelled = false;
//     adminGet<{ items: LoanApplication[]; meta: PageMeta }>(`/api/admin/loan-applications?${requestKey}`)
//       .then((data) => {
//         if (cancelled) return;
//         setItems(data.items);
//         setMeta(data.meta);
//         setError(null);
//         setLoadedKey(requestKey);
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         setError(err.message ?? "Couldn't load loan applications.");
//         setLoadedKey(requestKey);
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [requestKey]);

//   async function updateStatus(id: string, status: string) {
//     setUpdatingId(id);
//     try {
//       await adminPatch(`/api/admin/loan-applications/${id}`, { status });
//       setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't update status.");
//     } finally {
//       setUpdatingId(null);
//     }
//   }

//   async function openAssign(item: LoanApplication) {
//     setAssigningId(item.id);
//     // Fetches for every branch key, including NO_BRANCH_KEY for the rare
//     // application with no computed branch - the "admin" role gets every
//     // active agent back regardless of branch_id (see the backend
//     // endpoint's docstring), so there's no reason to skip the fetch just
//     // because this particular application has no branch of its own.
//     const cacheKey = item.assigned_branch_id ?? NO_BRANCH_KEY;
//     if (!officersByBranch[cacheKey]) {
//       try {
//         const officers = await adminGet<LoanOfficer[]>(
//           `/api/admin/loan-applications/branch-officers?branch_id=${item.assigned_branch_id ?? ""}`
//         );
//         setOfficersByBranch((prev) => ({ ...prev, [cacheKey]: officers }));
//       } catch {
//         // leave the dropdown showing "no officers found" rather than blocking the whole page
//       }
//     }
//   }

//   async function assignOfficer(item: LoanApplication, officerId: string) {
//     try {
//     const res = await adminPatch<LoanApplication>(`/api/admin/loan-applications/${item.id}/assign`, {
//         assigned_loan_officer_id: officerId || null,
//       });
//       setItems((prev) => prev.map((i) => (i.id === item.id ? res : i)));
//       setAssigningId(null);
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't assign loan officer.");
//     }
//   }

//   async function reassignBranch(item: LoanApplication, branchId: string) {
//     if (!branchId) return;
//     try {
//       const res = await adminPatch<LoanApplication>(`/api/admin/loan-applications/${item.id}/assign`, {
//         assigned_branch_id: branchId,
//       });
//       setItems((prev) => prev.map((i) => (i.id === item.id ? res : i)));
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't reassign branch.");
//     }
//   }

//   // Both exports honour the current status/product filters (same ones the
//   // table itself uses) - "export what I'm looking at", not always every
//   // application this admin can see.
//   function buildExportParams(): URLSearchParams {
//     const params = new URLSearchParams();
//     if (statusFilter) params.set("status", statusFilter);
//     if (productFilter) params.set("product_slug", productFilter);
//     return params;
//   }

//   async function exportXlsx() {
//     setExportingXlsx(true);
//     try {
//       const qs = buildExportParams().toString();
//       const filename = `bidii-loan-applications-${new Date().toISOString().slice(0, 10)}.xlsx`;
//       await adminDownloadFile(`/api/admin/loan-applications/export/xlsx${qs ? `?${qs}` : ""}`, filename);
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't export to Excel.");
//     } finally {
//       setExportingXlsx(false);
//     }
//   }

//   function openShareModal() {
//     setShareError(null);
//     setShowShareModal(true);
//   }

//   async function confirmExportGoogleSheets() {
//     // The backend will share the created sheet with the logged-in admin's
//     // own email by default, but not every admin account has one on file -
//     // asking here works regardless, and lets you share with someone else
//     // (e.g. a branch manager) instead of yourself.
//     const email = shareEmail.trim();
//     if (!email) {
//       setShareError("An email address is needed so the sheet can be shared with someone.");
//       return;
//     }
//     setExportingSheets(true);
//     setShareError(null);
//     try {
//       const params = buildExportParams();
//       params.set("share_with_email", email);
//       const res = await adminPost<{ spreadsheet_url: string; shared_with: string; count: number }>(
//         `/api/admin/loan-applications/export/google-sheets?${params.toString()}`,
//         {}
//       );
//       setShowShareModal(false);
//       window.open(res.spreadsheet_url, "_blank", "noopener,noreferrer");
//     } catch (err) {
//       setShareError(err instanceof Error ? err.message : "Couldn't export to Google Sheets.");
//     } finally {
//       setExportingSheets(false);
//     }
//   }

//   return (
//     <div>
//       <div className="mb-5 flex flex-wrap items-center gap-3">
//         <select
//           value={statusFilter}
//           onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
//           className="rounded-xl border border-mist-200 bg-surface px-4 py-2 text-sm text-ink-700 focus:outline-none"
//         >
//           <option value="">All statuses</option>
//           {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
//         </select>
//         <select
//           value={productFilter}
//           onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}
//           className="rounded-xl border border-mist-200 bg-surface px-4 py-2 text-sm text-ink-700 focus:outline-none"
//         >
//           {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
//         </select>

//         <div className="ml-auto flex flex-wrap items-center gap-2">
//           <button
//             onClick={exportXlsx}
//             disabled={exportingXlsx}
//             title="Download every branch as a sheet in one .xlsx workbook"
//             className="flex items-center gap-1.5 rounded-xl border border-mist-200 bg-surface px-3.5 py-2 text-sm text-ink-700 hover:bg-mist-50 disabled:opacity-50"
//           >
//             {exportingXlsx ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
//             Export Excel
//           </button>
//           <button
//             onClick={openShareModal}
//             disabled={exportingSheets}
//             title="Create a live Google Sheet with a tab per branch, shared to an email you choose"
//             className="flex items-center gap-1.5 rounded-xl border border-mist-200 bg-surface px-3.5 py-2 text-sm text-ink-700 hover:bg-mist-50 disabled:opacity-50"
//           >
//             {exportingSheets ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
//             Export to Google Sheets
//           </button>
//         </div>
//       </div>

//       {error && (
//         <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
//           <AlertCircle size={16} />
//           {error}
//         </div>
//       )}

//       <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-surface">
//         {loading ? (
//           <p className="p-6 text-sm text-ink-500">Loading…</p>
//         ) : items.length === 0 ? (
//           <p className="p-6 text-sm text-ink-500">No loan applications match this filter.</p>
//         ) : (
//           <table className="w-full min-w-[960px] text-left text-sm">
//             <thead className="text-xs text-ink-500">
//               <tr>
//                 <th className="px-4 py-3 font-medium">Applicant</th>
//                 <th className="px-4 py-3 font-medium">Location / Branch</th>
//                 <th className="px-4 py-3 font-medium">Product</th>
//                 <th className="px-4 py-3 font-medium">Amount / Term</th>
//                 <th className="px-4 py-3 font-medium">Status</th>
//                 {canAssign && <th className="px-4 py-3 font-medium">Loan Officer</th>}
//                 <th className="px-4 py-3 font-medium">Date</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-mist-200">
//               {items.map((l) => (
//                 <tr key={l.id}>
//                   <td className="px-4 py-3">
//                     <p className="font-semibold" style={{ color: "var(--color-ink-900)" }}>{l.full_name}</p>
//                     <p className="text-xs text-ink-500">{l.phone}</p>
//                   </td>
//                   <td className="px-4 py-3">
//                     <p className="text-xs text-ink-500">{l.county ? `${l.county} · ` : ""}{l.location || "-"}</p>
//                     {canAssign ? (
//                       <select
//                         value={l.assigned_branch_id ?? ""}
//                         onChange={(e) => reassignBranch(l, e.target.value)}
//                         className="mt-1 rounded-lg border border-mist-200 bg-surface px-2 py-1 text-xs text-ink-700 focus:outline-none"
//                       >
//                         {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
//                       </select>
//                     ) : (
//                       <p className="font-medium">{l.assigned_branch_name || "Unassigned"}</p>
//                     )}
//                     {l.branch_assignment_method && (
//                       <span className="text-[10px] uppercase text-ink-400"> via {l.branch_assignment_method}</span>
//                     )}
//                   </td>
//                   <td className="px-4 py-3">
//                     {l.product_name}
//                     <br />
//                     <span className="text-xs text-ink-500">{l.tier_label}</span>
//                   </td>
//                   <td className="px-4 py-3 tabular">
//                     {fmtKes(l.amount)}
//                     <br />
//                     <span className="text-xs text-ink-500">{l.term_value} {l.term_unit}</span>
//                   </td>
//                   <td className="px-4 py-3">
//                     <select
//                       value={l.status}
//                       disabled={updatingId === l.id}
//                       onChange={(e) => updateStatus(l.id, e.target.value)}
//                       className="rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-xs text-ink-700 focus:outline-none disabled:opacity-50"
//                     >
//                       {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
//                     </select>
//                   </td>
//                   {canAssign && (
//                     <td className="px-4 py-3">
//                       {assigningId === l.id ? (
//                         <select
//                           autoFocus
//                           value={l.assigned_loan_officer_id ?? ""}
//                           onChange={(e) => assignOfficer(l, e.target.value)}
//                           onBlur={() => setAssigningId(null)}
//                           className="rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-xs text-ink-700 focus:outline-none"
//                         >
//                           <option value="">Unassigned</option>
//                            {officersByBranch[l.assigned_branch_id ?? NO_BRANCH_KEY]?.map((o) => (
//                             <option key={o.id} value={o.id}>
//                               {o.username} - {formatAgentRole(o.role)}
//                             </option>
//                           ))}
//                         </select>
//                       ) : (
//                         <button
//                           onClick={() => openAssign(l)}
//                           className="flex items-center gap-1 rounded-lg border border-mist-200 px-2 py-1.5 text-xs text-ink-700 hover:bg-mist-50"
//                         >
//                           <UserPlus size={12} />
//                           {l.assigned_loan_officer_name || "Assign"}
//                         </button>
//                       )}
//                     </td>
//                   )}
//                   <td className="px-4 py-3 whitespace-nowrap text-ink-500">{fmtDate(l.created_at)}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>

//       {meta && <Pagination meta={meta} onPageChange={setPage} />}

//       {showShareModal && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//           <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
//             <div className="flex items-center justify-between border-b border-mist-200 px-5 py-3.5">
//               <h2 className="text-sm font-semibold text-ink-900">Export to Google Sheets</h2>
//               <button
//                 onClick={() => setShowShareModal(false)}
//                 className="rounded-lg p-1.5 text-ink-500 hover:bg-mist-100"
//               >
//                 <X size={16} />
//               </button>
//             </div>
//             <div className="flex flex-col gap-3 px-5 py-4">
//               <label className="flex flex-col gap-1 text-xs text-ink-500">
//                 Share the new spreadsheet with
//                 <input
//                   autoFocus
//                   type="email"
//                   value={shareEmail}
//                   onChange={(e) => setShareEmail(e.target.value)}
//                   onKeyDown={(e) => { if (e.key === "Enter") confirmExportGoogleSheets(); }}
//                   placeholder="name@example.com"
//                   className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none"
//                 />
//               </label>
//               {shareError && (
//                 <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{shareError}</p>
//               )}
//             </div>
//             <div className="flex items-center justify-end gap-2 border-t border-mist-200 px-5 py-3.5">
//               <button
//                 onClick={() => setShowShareModal(false)}
//                 className="rounded-xl px-3.5 py-2 text-sm text-ink-700 hover:bg-mist-50"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={confirmExportGoogleSheets}
//                 disabled={exportingSheets}
//                 className="flex items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 py-2 text-sm text-white hover:bg-ink-800 disabled:opacity-50"
//               >
//                 {exportingSheets && <Loader2 size={14} className="animate-spin" />}
//                 Export
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }