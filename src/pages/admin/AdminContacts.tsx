import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { adminGet } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";
import Pagination, { type PageMeta } from "../../components/admin/Pagination";

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  created_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

const SUBJECTS = [
  { value: "", label: "All subjects" },
  { value: "loan-inquiry", label: "Loan Inquiry" },
  { value: "existing-loan", label: "Existing Loan" },
  { value: "complaint", label: "Complaint" },
  { value: "other", label: "Other" },
];

export default function AdminContacts() {
  usePageMeta("Contact Messages");
  const [items, setItems] = useState<Contact[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const qs = new URLSearchParams({ page: String(page), page_size: "10" });
  if (subject) qs.set("subject", subject);
  const requestKey = qs.toString();
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    adminGet<{ items: Contact[]; meta: PageMeta }>(`/api/admin/contacts?${requestKey}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setMeta(data.meta);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Couldn't load contact messages.");
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-mist-200 bg-surface px-4 py-2 text-sm text-ink-700 focus:outline-none"
        >
          {SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
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
          <p className="p-6 text-sm text-ink-500">No contact messages match this filter.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink-900)" }}>{c.name}</td>
                  <td className="px-4 py-3 text-ink-500">
                    {c.email}
                    <br />
                    {c.phone}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.subject} /></td>
                  <td className="max-w-xs px-4 py-3 text-ink-700">{c.message}</td>
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
