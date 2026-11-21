import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  getAnomalies, getCalibration, getDataQuality, getMyReminders, getOpenActions, getStaff, getTimeline, getTrainingThemes, getUnitLeaderboard, updateTrackedAction,
  type AnomalyRow, type Calibration, type QualityIssue, type ReminderItem, type StaffProfile, type TimelineEvent, type TrackedAction, type TrainingThemes, type UnitRank,
} from "../../lib/performanceApi";
import WeeklyViewSection from "../../components/admin/performance/WeeklyView";
import { usePageMeta } from "../../lib/usePageMeta";

const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const input = "rounded-lg border border-mist-200 px-2 py-1.5 text-sm";
const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work.");

/** Loads one section; a section the caller isn't allowed to see simply doesn't render. */
function useSection<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => {
    fn().then(setData).catch(() => setData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);
  return [data, load] as const;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Reminders({ items }: { items: ReminderItem[] }) {
  return (
    <Section id="rem-h" title="Due for me">
      {items.length === 0 ? <p className="text-sm text-ink-600">Nothing is due.</p> : (
        <ul className="list-disc pl-5 text-sm">{items.map((i, k) => <li key={k}><Link className="underline" to={i.link}>{i.message}</Link></li>)}</ul>
      )}
    </Section>
  );
}

function Tracker({ items, reload }: { items: TrackedAction[]; reload: () => void }) {
  const [outcome, setOutcome] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setErr(msg(e));
    }
  };
  return (
    <Section id="trk-h" title="Coaching, PIP and warning tracker">
      <p className="text-xs text-ink-500">Open items you are entitled to see. Warnings and PIPs are visible only to HR, the direct manager and the person.</p>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {items.length === 0 && <p className="text-sm text-ink-600">No open items.</p>}
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="rounded-xl border border-mist-200 p-3 text-sm">
            <p><strong>{a.name}</strong> · {a.action_type.replace(/_/g, " ")}{a.restricted ? " (restricted)" : ""} · since {a.started_on}{a.review_on ? ` · review ${a.review_on}` : ""}{a.overdue ? " · OVERDUE" : ""}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-ink-600"><span className="block font-semibold">Next review</span><input type="date" className={input} value={review[a.id] ?? ""} onChange={(e) => setReview({ ...review, [a.id]: e.target.value })} /></label>
              <button className={btn} disabled={!review[a.id]} onClick={() => run(() => updateTrackedAction(a.id, { review_on: review[a.id] }))}>Move review</button>
              <label className="text-xs text-ink-600"><span className="block font-semibold">Outcome (closes it)</span><input className={`${input} w-64`} maxLength={200} value={outcome[a.id] ?? ""} onChange={(e) => setOutcome({ ...outcome, [a.id]: e.target.value })} /></label>
              <button className={btn} disabled={(outcome[a.id] ?? "").trim().length < 3} onClick={() => run(() => updateTrackedAction(a.id, { outcome: outcome[a.id] }))}>Close</button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Timeline() {
  const [people, setPeople] = useState<StaffProfile[]>([]);
  const [id, setId] = useState("");
  const [ev, setEv] = useState<TimelineEvent[]>([]);
  useEffect(() => {
    getStaff().then((d) => setPeople(d.items)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (id) getTimeline(id).then((d) => setEv(d.items)).catch(() => setEv([]));
    else setEv([]);
  }, [id]);
  if (people.length === 0) return null;
  return (
    <Section id="tl-h" title="Lifecycle timeline">
      <label className="text-xs text-ink-600"><span className="block font-semibold">Person</span>
        <select className={input} value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </label>
      <ol className="space-y-1 border-l border-mist-200 pl-4 text-sm">
        {ev.map((e, i) => <li key={i}><span className="text-xs text-ink-500">{e.date}</span> {e.text}{e.restricted ? " (restricted)" : ""}</li>)}
      </ol>
    </Section>
  );
}

function Leaderboard({ rows }: { rows: UnitRank[] }) {
  if (rows.length === 0) return null;
  return (
    <Section id="lb-h" title="Branches, year to date">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Branches ranked by achievement against target</caption>
        <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-2">#</th><th scope="col" className="py-1 pr-2">Branch</th><th scope="col" className="py-1 pr-2">Achievement</th><th scope="col" className="py-1 pr-2">Average score</th><th scope="col" className="py-1">People</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.unit_id} className="border-t border-mist-100"><td className="py-1 pr-2">{i + 1}</td><td className="py-1 pr-2">{r.name}</td><td className="py-1 pr-2">{r.achievement_pct ?? "–"}%</td><td className="py-1 pr-2">{r.average_score ?? "–"}</td><td className="py-1">{r.people}{r.small_unit ? " (small unit: read with care)" : ""}</td></tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function CalibrationView({ c }: { c: Calibration }) {
  return (
    <Section id="cal-h" title="Calibration across managers">
      <p className="text-xs text-ink-500">{c.period} · company average {c.company_average ?? "–"}. {c.note}</p>
      {c.managers.length === 0 ? <p className="text-sm text-ink-600">No manager has three or more scored reports yet.</p> : (
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Average team score by manager</caption>
          <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-2">Manager</th><th scope="col" className="py-1 pr-2">Team</th><th scope="col" className="py-1 pr-2">Average</th><th scope="col" className="py-1">Gap to company</th></tr></thead>
          <tbody>{c.managers.map((m) => <tr key={m.manager_id} className="border-t border-mist-100"><td className="py-1 pr-2">{m.manager}</td><td className="py-1 pr-2">{m.team_size}</td><td className="py-1 pr-2">{m.average_score}</td><td className="py-1">{m.gap_to_company}{m.flag ? " · worth a conversation" : ""}</td></tr>)}</tbody>
        </table>
      )}
    </Section>
  );
}

function Quality({ issues, anomalies }: { issues: QualityIssue[]; anomalies: AnomalyRow[] }) {
  return (
    <Section id="dq-h" title="Data quality">
      {issues.length === 0 && anomalies.length === 0 && <p className="text-sm text-ink-600">No problems found.</p>}
      <ul className="space-y-2 text-sm">
        {issues.map((i) => (
          <li key={i.kind} className="rounded-xl border border-mist-200 p-3">
            <p><strong>{i.count}</strong> · {i.text}</p>
            <p className="text-xs text-ink-500">{i.items.map((p) => p.name).join(", ")}{i.count > i.items.length ? ` and ${i.count - i.items.length} more` : ""}</p>
          </li>
        ))}
        {anomalies.map((a, k) => <li key={k} className="rounded-xl border border-amber-200 bg-amber-50 p-3"><strong>{a.name}</strong> · {a.kpi_key} {a.month}: {a.why}</li>)}
      </ul>
    </Section>
  );
}

function Training({ t }: { t: TrainingThemes }) {
  return (
    <Section id="tr-h" title="Training themes">
      <p className="text-xs text-ink-500">{t.note}</p>
      {t.overall.length === 0 ? <p className="text-sm text-ink-600">No finalised appraisals with development needs yet.</p> : (
        <p className="text-sm">{t.overall.map((o) => `${o.word} (${o.count})`).join(", ")}</p>
      )}
      <ul className="text-sm">{t.units.map((u) => <li key={u.unit_id}><strong>{u.unit}</strong> ({u.people}): {u.themes.map((x) => x.word).join(", ")}</li>)}</ul>
    </Section>
  );
}

export default function AdminPerformanceOps() {
  usePageMeta("Performance operations");
  const [rem] = useSection(getMyReminders);
  const [trk, reloadTrk] = useSection(getOpenActions);
  const [lb] = useSection(getUnitLeaderboard);
  const [cal] = useSection(getCalibration);
  const [dq] = useSection(getDataQuality);
  const [an] = useSection(getAnomalies);
  const [tr] = useSection(getTrainingThemes);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>Operations</h1>
        <p className="text-sm text-ink-500">What is due, open follow-ups and the checks that keep the numbers trustworthy. You see only what your role allows.</p>
      </div>
      <WeeklyViewSection />
      {rem && <Reminders items={rem.items} />}
      {trk && <Tracker items={trk.items} reload={reloadTrk} />}
      <Timeline />
      {lb && <Leaderboard rows={lb.items} />}
      {cal && <CalibrationView c={cal} />}
      {(dq || an) && <Quality issues={dq?.issues ?? []} anomalies={an?.items ?? []} />}
      {tr && <Training t={tr} />}
    </div>
  );
}
