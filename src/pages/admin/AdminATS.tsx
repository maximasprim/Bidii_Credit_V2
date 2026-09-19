import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Settings2, RefreshCw, ChevronRight, Search, Sparkles, StopCircle } from "lucide-react";
import { adminGet } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import Pagination, { type PageMeta } from "../../components/admin/Pagination";
import StatusBadge from "../../components/admin/StatusBadge";
import ATSRecommendationBadge, { ATSScorePill } from "../../components/admin/ats/ATSScoreBadge";
import AdminInterviewPrepModal from "./AdminInterviewPrepModal";
import {
  cancelBatchScreening,
  finalRecommendation,
  getActiveBatchScreening,
  getATSStats,
  getBatchScreeningStatus,
  listATSApplications,
  screenAllForJobAsync,
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
  // job + page are read from the URL on first load and kept in sync with
  // it (see the effect below) - so browser back navigation from a
  // candidate's vetting page lands back on this exact page/job, instead
  // of resetting to page 1 / "All jobs" the way a fresh component mount
  // otherwise would.
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobId, setJobId] = useState(() => searchParams.get("job") ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [recommendation, setRecommendation] = useState<ATSRecommendation | "">("");
  const [mandatoryFailed, setMandatoryFailed] = useState<"" | "true" | "false">("");
  const [minScore, setMinScore] = useState("");
  // Free-text search (name / email / phone) - synced into the URL like
  // job/page, and debounced separately so it only triggers a fetch once
  // typing pauses, not on every keystroke.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [refrestTick, setRefreshTick] = useState(0);

  const [items, setItems] = useState<CareerApplicationWithATS[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [stats, setStats] = useState<ATSStats | null>(null);
  const [interviewPrepApplication, setInterviewPrepApplication] = useState<CareerApplicationWithATS | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [batchScreening, setBatchScreening] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number; failed: number } | null>(
    null
  );
  const [activeBatchJobId, setActiveBatchJobId] = useState<string | null>(null);
  const [cancellingBatch, setCancellingBatch] = useState(false);

  useEffect(() => {
    adminGet<{ items: JobOption[] }>("/api/admin/jobs")
      .then((data) => setJobs(data.items))
      .catch(() => {});
  }, []);

  // Mirrors job + page + search into the URL (replacing, not pushing, so
  // filter changes don't spam the browser history) - so that when someone
  // opens a candidate's vetting page and then navigates back, the URL
  // they land back on still has the job/page/search they had, and the
  // lazy useState initializers above restore them on remount. Only these
  // three are synced, matching what "go back" needs to restore - the
  // rest of the filters (status, recommendation, etc.) are unaffected.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (jobId) next.set("job", jobId);
        else next.delete("job");
        if (page > 1) next.set("page", String(page));
        else next.delete("page");
        if (search) next.set("q", search);
        else next.delete("q");
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, page, search]);

  // Debounces the search box into a separate value that actually drives
  // the fetch below, so typing doesn't fire a request on every keystroke -
  // only once typing pauses for 400ms.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  // Resumes watching an in-progress batch after a page refresh (or if this
  // page is opened in a second tab) - the backend, not this component's
  // state, is the source of truth for "is a batch running right now".
  useEffect(() => {
    if (!jobId) {
      setBatchScreening(false);
      setBatchProgress(null);
      setActiveBatchJobId(null);
      return;
    }
    let cancelled = false;
    getActiveBatchScreening(jobId)
      .then((active) => {
        if (cancelled || !active) return;
        setActiveBatchJobId(active.id);
        setBatchScreening(true);
        setBatchProgress({ completed: active.completed, total: active.total, failed: active.failed_count });
        void pollBatchScreening(jobId, active.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const requestKey = JSON.stringify({ page, jobId, statusFilter, recommendation, mandatoryFailed, minScore, debouncedSearch, sortBy, sortDir, refrestTick });
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    // Both requests fire together (same as before - this doesn't add
    // latency), but now `loadedKey` only flips once BOTH have settled, so
    // the stat cards and the table appear in the same paint instead of
    // stats popping in a moment after the table's already showing. A
    // stats failure still doesn't block the table from showing (same
    // silent-failure behavior as before - it just leaves stats blank).
    Promise.allSettled([
      listATSApplications({
        page,
        page_size: 10,
        job_id: jobId || undefined,
        status: statusFilter || undefined,
        recommendation: recommendation || undefined,
        mandatory_failed: mandatoryFailed === "" ? undefined : mandatoryFailed === "true",
        min_score: minScore ? Number(minScore) : undefined,
        q: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
      getATSStats(jobId || undefined),
    ]).then(([applicationsResult, statsResult]) => {
      if (cancelled) return;

      if (applicationsResult.status === "fulfilled") {
        setItems(applicationsResult.value.items);
        setMeta(applicationsResult.value.meta);
        setError(null);
      } else {
        const reason = applicationsResult.reason;
        setError(reason instanceof Error ? reason.message : "Couldn't load candidates.");
      }

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }

      setLoadedKey(requestKey);
    });

    return () => {

      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  function reload() {
    setLoadedKey(null);
    setRefreshTick((t) => t + 1);
  }

  // Same fetch as the effect above, but never touches loadedKey - so
  // `loading` never flips true and the table/stats update in place
  // instead of the whole page flashing to a "Loading…" placeholder and
  // back. Used while a batch is running, where a refresh happens every
  // 1.5s and a full-page flicker that often would be unusable.
  function silentReload() {
    listATSApplications({
      page,
      page_size: 10,
      job_id: jobId || undefined,
      status: statusFilter || undefined,
      recommendation: recommendation || undefined,
      mandatory_failed: mandatoryFailed === "" ? undefined : mandatoryFailed === "true",
      min_score: minScore ? Number(minScore) : undefined,
      q: debouncedSearch || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
    })
      .then((data) => {
        setItems(data.items);
        setMeta(data.meta);
      })
      .catch(() => {
        // A missed background refresh isn't worth surfacing mid-batch -
        // the next poll tick (1.5s later) just tries again.
      });
    getATSStats(jobId || undefined)
      .then(setStats)
      .catch(() => {});
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

 // Runs the batch in the background and polls for progress, instead of
  // blocking on one request for the whole run - see screenAllForJobAsync /
  // getBatchScreeningStatus in atsApi.ts. This is what makes scores appear
  // live as each candidate finishes, and keeps working reliably at
  // hundreds-to-1000+ candidates where a single blocking request would be
  // likely to time out.
  //
  // rescoreAll=true is "batch rescreening" - re-runs every application
  // for this job, including ones already screened, instead of only the
  // unscored ones. The confirm() before it (in the button below) exists
  // because this can be a much bigger/costlier run than the default.
  async function runScreenAll(rescoreAll: boolean) {
    if (!jobId) return;
    setBatchScreening(true);
    setBatchProgress(null);
    try {
      const start = await screenAllForJobAsync(jobId, rescoreAll);
      if (start.total === 0) {
        alert(start.message);
        setBatchScreening(false);
        return;
      }
      setActiveBatchJobId(start.batch_job_id);
      setBatchProgress({ completed: 0, total: start.total, failed: 0 });
      await pollBatchScreening(jobId, start.batch_job_id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't start batch screening.");
      setBatchScreening(false);
    }
  }

  // Graceful stop - candidates already mid-screening still finish and get
  // recorded; only ones that haven't started yet are skipped. The next
  // poll tick picks up the "cancelled" status and ends the run itself, so
  // this just requests it rather than tearing anything down here.
  async function cancelRunningBatch() {
    if (!jobId || !activeBatchJobId) return;
    setCancellingBatch(true);
    try {
      await cancelBatchScreening(jobId, activeBatchJobId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't cancel batch screening.");
    } finally {
      setCancellingBatch(false);
    }
  }

  function pollBatchScreening(currentJobId: string, batchJobId: string): Promise<void> {
    const POLL_INTERVAL_MS = 1500;
    return new Promise((resolve) => {
      const tick = async () => {
        try {
          const status = await getBatchScreeningStatus(currentJobId, batchJobId);
          setBatchProgress({ completed: status.completed, total: status.total, failed: status.failed_count });
          // Updates the table + stats cards in place each tick, so scores
          // appear as they land rather than only once the whole batch
          // finishes - silentReload (not reload) so this doesn't flash
          // the table to a loading placeholder every 1.5s.
          silentReload();

          if (status.status !== "running") {
            const parts = [
              status.status === "cancelled"
                ? `Cancelled - ${status.completed} of ${status.total} application(s) were screened before stopping.`
                : `Screened ${status.completed} of ${status.total} application(s).`,
            ];
            if (status.failed_count) parts.push(`${status.failed_count} couldn't be screened.`);
            if (status.stopped_reason && status.status !== "cancelled") parts.push(status.stopped_reason);
            if (status.model_fallback_note) parts.push(status.model_fallback_note);
            alert(parts.join(" "));
            setBatchScreening(false);
            setActiveBatchJobId(null);
            reload(); // one proper reload now the batch is done, in case total/page counts shifted
            resolve();
            return;
          }
        } catch {
          // A single missed poll (e.g. a dropped request) shouldn't end the
          // batch tracking - the backend keeps running regardless; just
          // try again on the next tick.
        }
        setTimeout(tick, POLL_INTERVAL_MS);
      };
      tick();
    });
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
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
             <button
              onClick={batchScreening ? cancelRunningBatch : () => runScreenAll(false)}
              disabled={batchScreening ? cancellingBatch || !activeBatchJobId : false}
              className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: batchScreening ? "var(--color-red-500, #ff0000)" : "var(--color-ember-500)" }}
            >
              {batchScreening ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <StopCircle size={14} />
                  {cancellingBatch ? "Stopping…" : "Stop batch screening"}
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Batch Screen Unscored Candidates
                </>
              )}
            </button>
                          {!batchScreening && (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Re-screen every application for this job, including ones already screened? This can take a while and cost more in AI usage than screening just the unscored ones."
                      )
                    ) {
                      runScreenAll(true);
                    }
                  }}
                  title="Re-run screening for every application, including ones already screened"
                  className="flex items-center gap-1.5 rounded-xl border border-mist-200 px-2 py-2 text-sm font-semibold text-ink-700 hover:bg-mist-100"
                  // style={{ backgroundColor: "var(--color-green-400)"}}
                >
                  <RefreshCw size={14} />
                  Batch Rescreen All
                </button>
              )}
            </div>
            {batchScreening && batchProgress && (
              <div className="w-56 text-right">
                <div className="text-xs text-ink-500">
                  {batchProgress.completed + batchProgress.failed} / {batchProgress.total} screened
                  {batchProgress.failed > 0 ? ` (${batchProgress.failed} failed)` : ""}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-mist-200">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: "var(--color-ember-500)",
                      width: `${batchProgress.total ? ((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
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
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, or phone"
            className="w-56 rounded-xl border border-mist-200 bg-surface py-2 pl-8 pr-3 text-sm text-ink-700 focus:outline-none"
          />
        </div>

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
                      <div className="flex items-center gap-3">
                        {c.status === "shortlisted" && (
                          <button
                            onClick={() => setInterviewPrepApplication(c)}
                            className="flex items-center gap-1 text-xs font-semibold text-ember-500"
                            title="Prep for Interview"
                          >
                            <Sparkles size={13} />
                          </button>
                        )}
                      <Link
                        to={`/admin/ats/candidates/${c.id}`}
                        className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "var(--color-ember-500)" }}
                      >
                        Vet
                        <ChevronRight size={13} />
                      </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

            {interviewPrepApplication && (
        <AdminInterviewPrepModal
          applicationId={interviewPrepApplication.id}
          candidateName={interviewPrepApplication.full_name}
          roleTitle={interviewPrepApplication.role}
          onClose={() => setInterviewPrepApplication(null)}
        />
      )}
      
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


// import { useEffect, useState } from "react";
// import { Link } from "react-router-dom";
// import { AlertCircle, Settings2, RefreshCw, ChevronRight, Sparkles, StopCircle } from "lucide-react";
// import { adminGet } from "../../lib/adminApi";
// import { usePageMeta } from "../../lib/usePageMeta";
// import Pagination, { type PageMeta } from "../../components/admin/Pagination";
// import StatusBadge from "../../components/admin/StatusBadge";
// import ATSRecommendationBadge, { ATSScorePill } from "../../components/admin/ats/ATSScoreBadge";
// import AdminInterviewPrepModal from "./AdminInterviewPrepModal";
// import {
//   cancelBatchScreening,
//   finalRecommendation,
//   getActiveBatchScreening,
//   getATSStats,
//   getBatchScreeningStatus,
//   listATSApplications,
//   screenAllForJobAsync,
//   screenApplication,
//   type ATSRecommendation,
//   type ATSStats,
//   type CareerApplicationWithATS,
// } from "../../lib/atsApi";

// type JobOption = { id: string; title: string; is_open: boolean; application_count: number };

// const APPLICATION_STATUSES = ["received", "reviewing", "shortlisted", "rejected", "hired"];

// function fmtDate(iso: string) {
//   return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
// }

// export default function AdminATS() {
//   usePageMeta("Candidate Screening (ATS)");

//   const [jobs, setJobs] = useState<JobOption[]>([]);
//   const [jobId, setJobId] = useState("");
//   const [statusFilter, setStatusFilter] = useState("");
//   const [recommendation, setRecommendation] = useState<ATSRecommendation | "">("");
//   const [mandatoryFailed, setMandatoryFailed] = useState<"" | "true" | "false">("");
//   const [minScore, setMinScore] = useState("");
//   const [sortBy, setSortBy] = useState<"date" | "score">("date");
//   const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
//   const [page, setPage] = useState(1);
//   const [refrestTick, setRefreshTick] = useState(0);

//   const [items, setItems] = useState<CareerApplicationWithATS[]>([]);
//   const [meta, setMeta] = useState<PageMeta | null>(null);
//   const [stats, setStats] = useState<ATSStats | null>(null);
//   const [interviewPrepApplication, setInterviewPrepApplication] = useState<CareerApplicationWithATS | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loadedKey, setLoadedKey] = useState<string | null>(null);
//   const [screeningId, setScreeningId] = useState<string | null>(null);
//   const [batchScreening, setBatchScreening] = useState(false);
//   const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number; failed: number } | null>(
//     null
//   );
//   const [activeBatchJobId, setActiveBatchJobId] = useState<string | null>(null);
//   const [cancellingBatch, setCancellingBatch] = useState(false);

//   useEffect(() => {
//     adminGet<{ items: JobOption[] }>("/api/admin/jobs")
//       .then((data) => setJobs(data.items))
//       .catch(() => {});
//   }, []);

//   // Resumes watching an in-progress batch after a page refresh (or if this
//   // page is opened in a second tab) - the backend, not this component's
//   // state, is the source of truth for "is a batch running right now".
//   useEffect(() => {
//     if (!jobId) {
//       setBatchScreening(false);
//       setBatchProgress(null);
//       setActiveBatchJobId(null);
//       return;
//     }
//     let cancelled = false;
//     getActiveBatchScreening(jobId)
//       .then((active) => {
//         if (cancelled || !active) return;
//         setActiveBatchJobId(active.id);
//         setBatchScreening(true);
//         setBatchProgress({ completed: active.completed, total: active.total, failed: active.failed_count });
//         void pollBatchScreening(jobId, active.id);
//       })
//       .catch(() => {});
//     return () => {
//       cancelled = true;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [jobId]);

//   const requestKey = JSON.stringify({ page, jobId, statusFilter, recommendation, mandatoryFailed, minScore, sortBy, sortDir, refrestTick });
//   const loading = loadedKey !== requestKey;

//   useEffect(() => {
//     let cancelled = false;
//     listATSApplications({
//       page,
//       page_size: 10,
//       job_id: jobId || undefined,
//       status: statusFilter || undefined,
//       recommendation: recommendation || undefined,
//       mandatory_failed: mandatoryFailed === "" ? undefined : mandatoryFailed === "true",
//       min_score: minScore ? Number(minScore) : undefined,
//       sort_by: sortBy,
//       sort_dir: sortDir,
//     })
//       .then((data) => {
//         if (cancelled) return;
//         setItems(data.items);
//         setMeta(data.meta);
//         setError(null);
//         setLoadedKey(requestKey);
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         setError(err.message ?? "Couldn't load candidates.");
//         setLoadedKey(requestKey);
//       });

//     getATSStats(jobId || undefined)
//       .then((s) => !cancelled && setStats(s))
//       .catch(() => {});

//     return () => {
//       cancelled = true;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [requestKey]);

//   function reload() {
//     setLoadedKey(null);
//     setRefreshTick((t) => t + 1);
//   }

//   // Same fetch as the effect above, but never touches loadedKey - so
//   // `loading` never flips true and the table/stats update in place
//   // instead of the whole page flashing to a "Loading…" placeholder and
//   // back. Used while a batch is running, where a refresh happens every
//   // 1.5s and a full-page flicker that often would be unusable.
//   function silentReload() {
//     listATSApplications({
//       page,
//       page_size: 10,
//       job_id: jobId || undefined,
//       status: statusFilter || undefined,
//       recommendation: recommendation || undefined,
//       mandatory_failed: mandatoryFailed === "" ? undefined : mandatoryFailed === "true",
//       min_score: minScore ? Number(minScore) : undefined,
//       sort_by: sortBy,
//       sort_dir: sortDir,
//     })
//       .then((data) => {
//         setItems(data.items);
//         setMeta(data.meta);
//       })
//       .catch(() => {
//         // A missed background refresh isn't worth surfacing mid-batch -
//         // the next poll tick (1.5s later) just tries again.
//       });
//     getATSStats(jobId || undefined)
//       .then(setStats)
//       .catch(() => {});
//   }

//   async function runScreen(applicationId: string) {
//     setScreeningId(applicationId);
//     try {
//       await screenApplication(applicationId);
//       reload();
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't screen this application.");
//     } finally {
//       setScreeningId(null);
//     }
//   }

//   // Runs the batch in the background and polls for progress, instead of
//   // blocking on one request for the whole run - see screenAllForJobAsync /
//   // getBatchScreeningStatus in atsApi.ts. This is what makes scores appear
//   // live as each candidate finishes, and keeps working reliably at
//   // hundreds-to-1000+ candidates where a single blocking request would be
//   // likely to time out.
//   async function runScreenAll() {
//     if (!jobId) return;
//     setBatchScreening(true);
//     setBatchProgress(null);
//     try {
//       const start = await screenAllForJobAsync(jobId, false);
//       if (start.total === 0) {
//         alert(start.message);
//         setBatchScreening(false);
//         return;
//       }
//       setActiveBatchJobId(start.batch_job_id);
//       setBatchProgress({ completed: 0, total: start.total, failed: 0 });
//       await pollBatchScreening(jobId, start.batch_job_id);
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't start batch screening.");
//       setBatchScreening(false);
//     }
//   }

//   // Graceful stop - candidates already mid-screening still finish and get
//   // recorded; only ones that haven't started yet are skipped. The next
//   // poll tick picks up the "cancelled" status and ends the run itself, so
//   // this just requests it rather than tearing anything down here.
//   async function cancelRunningBatch() {
//     if (!jobId || !activeBatchJobId) return;
//     setCancellingBatch(true);
//     try {
//       await cancelBatchScreening(jobId, activeBatchJobId);
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't cancel batch screening.");
//     } finally {
//       setCancellingBatch(false);
//     }
//   }

//   function pollBatchScreening(currentJobId: string, batchJobId: string): Promise<void> {
//     const POLL_INTERVAL_MS = 1500;
//     return new Promise((resolve) => {
//       const tick = async () => {
//         try {
//           const status = await getBatchScreeningStatus(currentJobId, batchJobId);
//           setBatchProgress({ completed: status.completed, total: status.total, failed: status.failed_count });
//           // Updates the table + stats cards in place each tick, so scores
//           // appear as they land rather than only once the whole batch
//           // finishes - silentReload (not reload) so this doesn't flash
//           // the table to a loading placeholder every 1.5s.
//           silentReload();

//           if (status.status !== "running") {
//             const parts = [
//               status.status === "cancelled"
//                 ? `Cancelled - ${status.completed} of ${status.total} application(s) were screened before stopping.`
//                 : `Screened ${status.completed} of ${status.total} application(s).`,
//             ];
//             if (status.failed_count) parts.push(`${status.failed_count} couldn't be screened.`);
//             if (status.stopped_reason && status.status !== "cancelled") parts.push(status.stopped_reason);
//             alert(parts.join(" "));
//             setBatchScreening(false);
//             setActiveBatchJobId(null);
//             reload(); // one proper reload now the batch is done, in case total/page counts shifted
//             resolve();
//             return;
//           }
//         } catch {
//           // A single missed poll (e.g. a dropped request) shouldn't end the
//           // batch tracking - the backend keeps running regardless; just
//           // try again on the next tick.
//         }
//         setTimeout(tick, POLL_INTERVAL_MS);
//       };
//       tick();
//     });
//   }

//   return (
//     <div>
//       <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
//         <div>
//           <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
//             Candidate Screening
//           </h1>
//           <p className="text-sm text-ink-500">ATS scoring and vetting for career applications.</p>
//         </div>
//         {jobId && (
//           <div className="flex flex-col items-end gap-1.5">
//             <button
//               onClick={batchScreening ? cancelRunningBatch : runScreenAll}
//               disabled={batchScreening ? cancellingBatch || !activeBatchJobId : false}
//               className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-white disabled:opacity-50"
//               style={{ backgroundColor: batchScreening ? "var(--color-red-500, #ff0000)" : "var(--color-ember-500)" }}
//             >
//               {batchScreening ? (
//                 <>
//                   <RefreshCw size={14} className="animate-spin" />
//                   <StopCircle size={14} />
//                   {cancellingBatch ? "Stopping…" : "Stop batch screening"}
//                 </>
//               ) : (
//                 <>
//                   <RefreshCw size={14} />
//                   Batch Screen Unscored Candidates
//                 </>
//               )}
//             </button>
//             {batchScreening && batchProgress && (
//               <div className="w-56 text-right">
//                 <div className="text-xs text-ink-500">
//                   {batchProgress.completed + batchProgress.failed} / {batchProgress.total} screened
//                   {batchProgress.failed > 0 ? ` (${batchProgress.failed} failed)` : ""}
//                 </div>
//                 <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-mist-200">
//                   <div
//                     className="h-full rounded-full transition-all"
//                     style={{
//                       backgroundColor: "var(--color-ember-500)",
//                       width: `${batchProgress.total ? ((batchProgress.completed + batchProgress.failed) / batchProgress.total) * 100 : 0}%`,
//                     }}
//                   />
//                 </div>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {stats && (
//         <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
//           <StatCard label="Applications" value={stats.total_applications} />
//           <StatCard label="Screened" value={stats.total_screened} />
//           <StatCard label="Recommended" value={stats.recommended_count} accent="#16A34A" />
//           <StatCard label="Review" value={stats.review_count} accent="#2563EB" />
//           <StatCard label="Not Recommended" value={stats.not_recommended_count} accent="#DC2626" />
//         </div>
//       )}

//       <div className="mb-5 flex flex-wrap items-center gap-3">
//         <select
//           value={jobId}
//           onChange={(e) => { setJobId(e.target.value); setPage(1); }}
//           className="rounded-xl border border-mist-200 bg-surface px-4 py-2 text-sm text-ink-700 focus:outline-none"
//         >
//           <option value="">All jobs</option>
//           {jobs.map((j) => (
//             <option key={j.id} value={j.id}>
//               {j.title} ({j.application_count})
//             </option>
//           ))}
//         </select>

//         {jobId && (
//           <Link
//             to={`/admin/ats/config/${jobId}`}
//             className="flex items-center gap-1.5 rounded-xl border border-mist-200 px-3 py-2 text-xs font-semibold text-ink-700"
//           >
//             <Settings2 size={13} />
//             ATS Configuration
//           </Link>
//         )}

//         <select
//           value={statusFilter}
//           onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
//           className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
//         >
//           <option value="">All statuses</option>
//           {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
//         </select>

//         <select
//           value={recommendation}
//           onChange={(e) => { setRecommendation(e.target.value as ATSRecommendation | ""); setPage(1); }}
//           className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
//         >
//           <option value="">All recommendations</option>
//           <option value="recommended">Recommended</option>
//           <option value="review">Needs Review</option>
//           <option value="not_recommended">Not Recommended</option>
//         </select>

//         <select
//           value={mandatoryFailed}
//           onChange={(e) => { setMandatoryFailed(e.target.value as "" | "true" | "false"); setPage(1); }}
//           className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
//         >
//           <option value="">Mandatory criteria: any</option>
//           <option value="true">Failed a mandatory criterion</option>
//           <option value="false">Met all mandatory criteria</option>
//         </select>

//         <input
//           type="number"
//           min={0}
//           max={100}
//           placeholder="Min score %"
//           value={minScore}
//           onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
//           className="w-28 rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
//         />

//         <select
//           value={`${sortBy}-${sortDir}`}
//           onChange={(e) => {
//             const [by, dir] = e.target.value.split("-") as ["date" | "score", "asc" | "desc"];
//             setSortBy(by);
//             setSortDir(dir);
//           }}
//           className="rounded-xl border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none"
//         >
//           <option value="score-desc">Highest score first</option>
//           <option value="score-asc">Lowest score first</option>
//           <option value="date-desc">Newest first</option>
//           <option value="date-asc">Oldest first</option>
//         </select>
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
//           <p className="p-6 text-sm text-ink-500">No candidates match this filter.</p>
//         ) : (
//           <table className="w-full min-w-[900px] text-left text-sm">
//             <thead className="text-xs text-ink-500">
//               <tr>
//                 <th className="px-4 py-3 font-medium">Applicant</th>
//                 <th className="px-4 py-3 font-medium">Role</th>
//                 <th className="px-4 py-3 font-medium">Score</th>
//                 <th className="px-4 py-3 font-medium">Recommendation</th>
//                 <th className="px-4 py-3 font-medium">Status</th>
//                 <th className="px-4 py-3 font-medium">Date</th>
//                 <th className="px-4 py-3 font-medium" />
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-mist-200">
//               {items.map((c) => {
//                 const rec = finalRecommendation(c.screening);
//                 return (
//                   <tr key={c.id}>
//                     <td className="px-4 py-3">
//                       <p className="font-semibold" style={{ color: "var(--color-ink-900)" }}>{c.full_name}</p>
//                       <p className="text-xs text-ink-500">{c.email}</p>
//                     </td>
//                     <td className="px-4 py-3">{c.role}</td>
//                     <td className="px-4 py-3">
//                       {c.screening ? <ATSScorePill percentage={c.screening.score_percentage} /> : <span className="text-xs text-ink-400">Not screened</span>}
//                     </td>
//                     <td className="px-4 py-3">
//                       {rec ? (
//                         <ATSRecommendationBadge recommendation={rec} overridden={!!c.screening?.override_recommendation} />
//                       ) : (
//                         <button
//                           onClick={() => runScreen(c.id)}
//                           disabled={screeningId === c.id || !c.job_id}
//                           className="text-xs font-semibold disabled:opacity-50"
//                           style={{ color: "var(--color-ember-500)" }}
//                           title={!c.job_id ? "General applications have no job criteria to screen against" : undefined}
//                         >
//                           {screeningId === c.id ? "Screening…" : "Run screening"}
//                         </button>
//                       )}
//                     </td>
//                     <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
//                     <td className="px-4 py-3 whitespace-nowrap text-ink-500">{fmtDate(c.created_at)}</td>
//                     <td className="px-4 py-3">
//                       <div className="flex items-center gap-3">
//                         {c.status === "shortlisted" && (
//                           <button
//                             onClick={() => setInterviewPrepApplication(c)}
//                             className="flex items-center gap-1 text-xs font-semibold text-ember-500"
//                             title="Prep for Interview"
//                           >
//                             <Sparkles size={13} />
//                           </button>
//                         )}
//                       <Link
//                         to={`/admin/ats/candidates/${c.id}`}
//                         className="flex items-center gap-1 text-xs font-semibold"
//                         style={{ color: "var(--color-ember-500)" }}
//                       >
//                         Vet
//                         <ChevronRight size={13} />
//                       </Link>
//                       </div>
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         )}
//       </div>

//             {interviewPrepApplication && (
//         <AdminInterviewPrepModal
//           applicationId={interviewPrepApplication.id}
//           candidateName={interviewPrepApplication.full_name}
//           roleTitle={interviewPrepApplication.role}
//           onClose={() => setInterviewPrepApplication(null)}
//         />
//       )}
      
//       {meta && <Pagination meta={meta} onPageChange={setPage} />}
//     </div>
//   );
// }

// function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
//   return (
//     <div className="rounded-2xl border border-mist-200 bg-surface p-4">
//       <p className="text-xs text-ink-500">{label}</p>
//       <p className="mt-1 text-xl font-bold" style={{ color: accent ?? "var(--color-ink-900)" }}>{value}</p>
//     </div>
//   );
// }
