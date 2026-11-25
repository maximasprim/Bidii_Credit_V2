import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Users, Building2, UserCog } from "lucide-react";
import {
  getAccessLog,
  getEntries,
  getMyPerformance,
  getMyProjection,
  getMyReport,
  getNotice,
  getNotifyPrefs,
  type AccessLogRow,
  type EntryMonth,
  type MyPerformance,
  type NoticeState,
  type NotifyPrefs,
  type PersonProjection,
  type PersonReport,
} from "../../lib/performanceApi";
import { usePageMeta } from "../../lib/usePageMeta";
import { CategoryLegend } from "../../components/admin/CategoryBadge";
import StatusBadge from "../../components/admin/StatusBadge";
import EntryCard from "../../components/admin/EntryCard";
import MyScoreSection from "../../components/admin/performance/MyScoreSection";
import NoticeBanner from "../../components/admin/performance/NoticeBanner";
import ReminderPrefs from "../../components/admin/performance/ReminderPrefs";
import AccessLog from "../../components/admin/performance/AccessLog";
import MyProjectionSection from "../../components/admin/performance/MyProjectionSection";

type Boot = {
  data: MyPerformance;
  report: PersonReport | null;
  projection: PersonProjection | null;
  notice: NoticeState | null;
  prefs: NotifyPrefs | null;
  access: AccessLogRow[] | null;
  entries: EntryMonth | null;
};

const thisMonth = () => new Date().toISOString().slice(0, 7);
const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);

/** Loads everything the page shows first, then draws it in one go (parts that fail fall back to their old behaviour). */
export default function AdminMyPerformance() {
  usePageMeta("My Performance");
  const [boot, setBoot] = useState<Boot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [perf, report, projection, notice, prefs] = await Promise.allSettled([
        getMyPerformance(),
        getMyReport("ytd"),
        getMyProjection(),
        getNotice(),
        getNotifyPrefs(),
      ]);
      if (cancelled) return;
      if (perf.status === "rejected") {
        setError(perf.reason instanceof Error ? perf.reason.message : "Couldn't load your performance profile.");
        return;
      }
      const id = perf.value.profile?.id;
      const [access, entries] = id
        ? await Promise.allSettled([getAccessLog(id), getEntries(id, `${thisMonth()}-01`)])
        : [null, null];
      if (cancelled) return;
      setBoot({
        data: perf.value,
        report: ok(report),
        projection: ok(projection),
        notice: ok(notice),
        prefs: ok(prefs),
        access: access && access.status === "fulfilled" ? access.value.items : null,
        entries: entries ? ok(entries) : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error)
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  if (!boot) return <p className="text-sm text-ink-500">Loading…</p>;
  return <MyPerformancePage boot={boot} />;
}

function MyPerformancePage({ boot }: { boot: Boot }) {
  const data = boot.data;

  const p = data.profile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
          My Performance
        </h1>
        <p className="text-sm text-ink-500">Your personal performance dashboard.</p>
      </div>

      {!p ? (
        <div className="rounded-2xl border border-mist-200 bg-surface p-6">
          <p className="text-sm font-semibold text-ink-700">Your performance profile hasn't been set up yet.</p>
          <p className="mt-1 text-sm text-ink-500">
            Ask an administrator or HR to link your login to a staff profile (job role, branch or team and line manager). Once that's done your scores,
            targets and appraisals will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-mist-200 bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
                {p.full_name}
              </h2>
              <p className="text-sm text-ink-500">{p.performance_role_name}</p>
            </div>
            <StatusBadge status={p.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2 text-ink-700">
              <Building2 size={15} className="text-ink-400" />
              <span>{p.unit_name ?? "No branch or team set"}</span>
            </div>
            <div className="flex items-center gap-2 text-ink-700">
              <UserCog size={15} className="text-ink-400" />
              <span>{p.manager_name ? `Reports to ${p.manager_name}` : "No line manager set"}</span>
            </div>
            <div className="flex items-center gap-2 text-ink-700">
              <Users size={15} className="text-ink-400" />
              <span>{data.team_size > 0 ? `${data.team_size} on your team` : "No direct reports"}</span>
            </div>
          </dl>
        </div>
      )}

      {p && <EntryCard profileId={p.id} ym={thisMonth()} title="This month's figures" initial={boot.entries} />}

      {p && (
        <div className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>Appraisals</h2>
          <p className="text-sm text-ink-500">
            Your quarterly appraisals, self-assessment and sign-off.{" "}
            <Link to="/admin/performance/appraisals" className="font-semibold text-ink-700 underline">Open my appraisals</Link>
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-1 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          How performance is categorised
        </h2>
        <p className="mb-3 text-xs text-ink-500">Your overall weighted score against target falls into one of these four categories.</p>
        <CategoryLegend categories={data.categories} />
      </div>

      {p && <NoticeBanner initial={boot.notice} />}
      {p && <MyScoreSection initial={boot.report} />}
      {p && <MyProjectionSection initial={boot.projection} />}
      {p && <AccessLog profileId={p.id} initial={boot.access} />}
      <ReminderPrefs initial={boot.prefs} />
      {data.team_size !== 0 && (
        <p className="text-sm text-ink-500">
          Looking after a team or branch? <Link to="/admin/performance/reports" className="font-semibold text-ink-700 underline">Open the reports</Link>
        </p>
      )}
    </div>
  );
}
