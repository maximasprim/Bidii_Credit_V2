import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Settings2, RefreshCw, ChevronRight } from "lucide-react";
import { adminGet } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import Pagination, { type PageMeta } from "../../components/admin/Pagination";
import StatusBadge from "../../components/admin/StatusBadge";
import ATSRecommendationBadge, { ATSScorePill } from "../../components/admin/ats/ATSScoreBadge";
import {
  finalRecommendation,
  getATSStats,
  listATSApplications,
  screenAllForJob,
  screenApplication,
  type ATSRecommendation,
  type ATSStats,
  type CareerApplicationWithATS,
} from "../../lib/atsApi";

type JobOption = { id: string; title: string; is_open: boolean; application_count: number };

const APPLICATION_STATUSES = ["received", "reviewing", "shortlisted", "rejected", "hired"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminATS() {
  usePageMeta("Candidate Screening (ATS)");

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobId, setJobId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [recommendation, setRecommendation] = useState<ATSRecommendation | "">("");
  const [mandatoryFailed, setMandatoryFailed] = useState<"" | "true" | "false">("");
  const [minScore, setMinScore] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<CareerApplicationWithATS[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [stats, setStats] = useState<ATSStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [batchScreening, setBatchScreening] = useState(false);

  useEffect(() => {
    adminGet<{ items: JobOption[] }>("/api/admin/jobs")
      .then((data) => setJobs(data.items))
      .catch(() => {});
  }, []);

  const requestKey = JSON.stringify({ page, jobId, statusFilter, recommendation, mandatoryFailed, minScore, sortBy, sortDir });
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    listATSApplications({
      page,
      page_size: 10,
      job_id: jobId || undefined,
      status: statusFilter || undefined,
      recommendation: recommendation || undefined,
      mandatory_failed: mandatoryFailed === "" ? undefined : mandatoryFailed === "true",
      min_score: minScore ? Number(minScore) : undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
    })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setMeta(data.meta);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Couldn't load candidates.");
        setLoadedKey(requestKey);
      });

    getATSStats(jobId || undefined)
      .then((s) => !cancelled && setStats(s))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  function reload() {
    setLoadedKey(null);
  }

  async function runScreen(applicationId: string) {
    setScreeningId(applicationId);
    try {
      await screenApplication(applicationId);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't screen this application.");
    } finally {
      setScreeningId(null);
    }
  }

  async function runScreenAll() {
    if (!jobId) return;
    setBatchScreening(true);
    try {
      const res = await screenAllForJob(jobId, false);
      reload();
      alert(`Screened ${res.screened_count} application(s).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't run batch screening.");
    } finally {
      setBatchScreening(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
            Candidate Screening
          </h1>
          <p className="text-sm text-ink-500">ATS scoring and vetting for career applications.</p>
        </div>
        {jobId && (
          <button
            onClick={runScreenAll}
            disabled={batchScreening}
            className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            <RefreshCw size={14} className={batchScreening ? "animate-spin" : ""} />
            Screen unscored candidates for this job
          </button>
        )}
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Applications" value={stats.total_applications} />
          <StatCard label="Screened" value={stats.total_screened} />
          <StatCard label="Recommended" value={stats.recommended_count} accent="#16A34A" />
          <StatCard label="Review" value={stats.review_count} accent="#2563EB" />
          <StatCard label="Not Recommended" value={stats.not_recommended_count} accent="#DC2626" />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={jobId}
          onChange={(e) => { setJobId(e.target.value); setPage(1); }}
          className="rounded-xl border border-mist-200 bg-surface px-4 py-2 text-sm text-ink-700 focus:outline-none"
        >
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} ({j.application_count})
            </option>
          ))}
        </select>

        {jobId && (
          <Link
            to={`/admin/ats/config/${jobId}`}
            className="flex items-center gap-1.5 rounded-xl border border-mist-200 px-3 py-2 text-xs font-semibold text-ink-700"
          >
            <Settings2 size={13} />
            ATS Configuration
          </Link>
        )}

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={recommendation}
          onChange={(e) => { setRecommendation(e.target.value as ATSRecommendation | ""); setPage(1); }}
          className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
        >
          <option value="">All recommendations</option>
          <option value="recommended">Recommended</option>
          <option value="review">Needs Review</option>
          <option value="not_recommended">Not Recommended</option>
        </select>

        <select
          value={mandatoryFailed}
          onChange={(e) => { setMandatoryFailed(e.target.value as "" | "true" | "false"); setPage(1); }}
          className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
        >
          <option value="">Mandatory criteria: any</option>
          <option value="true">Failed a mandatory criterion</option>
          <option value="false">Met all mandatory criteria</option>
        </select>

        <input
          type="number"
          min={0}
          max={100}
          placeholder="Min score %"
          value={minScore}
          onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
          className="w-28 rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
        />

        <select
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split("-") as ["date" | "score", "asc" | "desc"];
            setSortBy(by);
            setSortDir(dir);
          }}
          className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
        >
          <option value="score-desc">Highest score first</option>
          <option value="score-asc">Lowest score first</option>
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
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
          <p className="p-6 text-sm text-ink-500">No candidates match this filter.</p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Recommendation</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-200">
              {items.map((c) => {
                const rec = finalRecommendation(c.screening);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: "var(--color-ink-900)" }}>{c.full_name}</p>
                      <p className="text-xs text-ink-500">{c.email}</p>
                    </td>
                    <td className="px-4 py-3">{c.role}</td>
                    <td className="px-4 py-3">
                      {c.screening ? <ATSScorePill percentage={c.screening.score_percentage} /> : <span className="text-xs text-ink-400">Not screened</span>}
                    </td>
                    <td className="px-4 py-3">
                      {rec ? (
                        <ATSRecommendationBadge recommendation={rec} overridden={!!c.screening?.override_recommendation} />
                      ) : (
                        <button
                          onClick={() => runScreen(c.id)}
                          disabled={screeningId === c.id || !c.job_id}
                          className="text-xs font-semibold disabled:opacity-50"
                          style={{ color: "var(--color-ember-500)" }}
                          title={!c.job_id ? "General applications have no job criteria to screen against" : undefined}
                        >
                          {screeningId === c.id ? "Screening…" : "Run screening"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-500">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/ats/candidates/${c.id}`}
                        className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "var(--color-ember-500)" }}
                      >
                        Vet
                        <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {meta && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-mist-200 bg-surface p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-bold" style={{ color: accent ?? "var(--color-ink-900)" }}>{value}</p>
    </div>
  );
}
