import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AlertCircle } from "lucide-react";
import { adminGet } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";

type ProductBreakdown = {
  product_slug: string;
  product_name: string;
  count: number;
  total_amount_requested: number;
};

type DashboardStats = {
  total_contacts: number;
  total_loan_applications: number;
  total_career_applications: number;
  loan_applications_by_status: Record<string, number>;
  career_applications_by_status: Record<string, number>;
  loan_applications_by_product: ProductBreakdown[];
  contacts_last_7_days: number;
  loan_applications_last_7_days: number;
  career_applications_last_7_days: number;
  total_amount_requested_all_time: number;
};

function formatKes(n: number) {
  return "KES " + Math.round(n).toLocaleString("en-KE");
}

export default function AdminOverview() {
  usePageMeta("Admin Overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminGet<DashboardStats>("/api/admin/stats")
      .then(setStats)
      .catch((err) => setError(err.message ?? "Couldn't load stats."));
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-ink-500">Loading stats…</p>;
  }

  const cards = [
    { label: "Contact Messages", value: stats.total_contacts, recent: stats.contacts_last_7_days },
    { label: "Loan Applications", value: stats.total_loan_applications, recent: stats.loan_applications_last_7_days },
    { label: "Career Applications", value: stats.total_career_applications, recent: stats.career_applications_last_7_days },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-mist-200 bg-surface p-5">
            <p className="text-xs text-ink-500">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold" style={{ color: "var(--color-ink-900)" }}>
              {c.value}
            </p>
            <p className="mt-1 text-xs text-ink-500">{c.recent} in last 7 days</p>
          </div>
        ))}
        <div className="rounded-2xl border border-mist-200 bg-surface p-5">
          <p className="text-xs text-ink-500">Total Amount Requested</p>
          <p className="mt-1 font-display text-lg font-extrabold tabular" style={{ color: "var(--color-ink-900)" }}>
            {formatKes(stats.total_amount_requested_all_time)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          Loan applications by product
        </h2>
        {stats.loan_applications_by_product.length === 0 ? (
          <p className="text-sm text-ink-500">No loan applications yet.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.loan_applications_by_product} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-mist-200)" />
                <XAxis dataKey="product_name" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(((value: unknown, name: unknown) =>
                    name === "count" ? [value, "Applications"] : [formatKes(Number(value) || 0), "Amount"]) as never)}
                />
                <Bar dataKey="count" fill="var(--color-navy-700)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
            Loan applications by status
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.loan_applications_by_status).map(([status, count]) => (
              <StatusBadge key={status} status={status} label={`${status}: ${count}`} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
            Career applications by status
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.career_applications_by_status).map(([status, count]) => (
              <StatusBadge key={status} status={status} label={`${status}: ${count}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
