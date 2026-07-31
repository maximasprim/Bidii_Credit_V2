import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Download, X } from "lucide-react";
import { adminGet, adminPatch, adminDownloadFile } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import Pagination, { type PageMeta } from "../../components/admin/Pagination";

type CareerApplication = {
  id: string;
  job_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  cover_note: string;
  cv_original_filename: string;
  status: string;
  created_at: string;
};

const STATUSES = ["received", "reviewing", "shortlisted", "rejected", "hired"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminCareerApplications() {
  usePageMeta("Career Applications");
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdFilter = searchParams.get("job_id") ?? "";

  const [items, setItems] = useState<CareerApplication[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const qs = new URLSearchParams({ page: String(page), page_size: "10" });
  if (statusFilter) qs.set("status", statusFilter);
  if (jobIdFilter) qs.set("job_id", jobIdFilter);
  const requestKey = qs.toString();
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    adminGet<{ items: CareerApplication[]; meta: PageMeta }>(`/api/admin/career-applications?${requestKey}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setMeta(data.meta);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Couldn't load career applications.");
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      await adminPatch(`/api/admin/career-applications/${id}`, { status });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function downloadCv(app: CareerApplication) {
    setDownloadError(null);
    try {
      await adminDownloadFile(`/api/admin/career-applications/${app.id}/cv`, app.cv_original_filename);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Couldn't download CV.");
    }
  }

  function clearJobFilter() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("job_id");
      return next;
    });
    setPage(1);
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

        {jobIdFilter && (
          <button
            onClick={clearJobFilter}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
          >
            Filtered to one job posting
            <X size={13} />
          </button>
        )}
      </div>

      {(error || downloadError) && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} />
          {error ?? downloadError}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-surface">
        {loading ? (
          <p className="p-6 text-sm text-ink-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No career applications match this filter.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Cover Note</th>
                <th className="px-4 py-3 font-medium">CV</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: "var(--color-ink-900)" }}>{c.full_name}</p>
                    <p className="text-xs text-ink-500">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">{c.role}</td>
                  <td className="max-w-xs px-4 py-3 text-ink-700">{c.cover_note}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => downloadCv(c)}
                      className="flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: "var(--color-ember-500)" }}
                    >
                      <Download size={13} />
                      Download
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={c.status}
                      disabled={updatingId === c.id}
                      onChange={(e) => updateStatus(c.id, e.target.value)}
                      className="rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-xs text-ink-700 focus:outline-none disabled:opacity-50"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-500">{fmtDate(c.created_at)}</td>
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
