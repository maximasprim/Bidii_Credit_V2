import { useEffect, useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { closePlan, getPersonOutlook, savePlan, type Outlook, type PlanEvaluation } from "../../../lib/performanceOutlookApi";

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short", year: "2-digit" });
const dayLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "–" : `${v.toFixed(1)}%`);
const points = (v: number) => `${Math.abs(v).toFixed(1)} point${Math.abs(v) === 1 ? "" : "s"}`;
const selectCls = "rounded-lg border border-mist-200 bg-white px-2 py-1 text-xs";
const btnCls = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";

/** One plain sentence for where a saved plan stands. The wording carries the status, never colour alone. */
function planStatus(ev: PlanEvaluation | undefined): string {
  if (!ev) return "";
  const l = ev.latest;
  switch (ev.state) {
    case "awaiting":
      return "No month since the plan was saved has been scored yet.";
    case "reached":
      return l ? `Goal reached: ${monthLabel(l.month)} was ${pct(l.actual)} against a ${pct(ev.goal_pct)} goal.` : "Goal reached.";
    case "on_track":
      return l ? `On track: ${monthLabel(l.month)} was ${pct(l.actual)} against ${pct(l.planned)} planned (${points(l.gap)} ahead).` : "On track.";
    case "behind":
      return l ? `Behind the plan: ${monthLabel(l.month)} was ${pct(l.actual)} against ${pct(l.planned)} planned (${points(l.gap)} short).` : "Behind the plan.";
    case "ended_not_reached":
      return l ? `The plan period has ended without reaching the goal: ${monthLabel(l.month)} was ${pct(l.actual)} against ${pct(ev.goal_pct)}.` : "The plan period has ended without reaching the goal.";
  }
}

/**
 * Actual achievement, the projection (with its likely range), the path needed to reach a goal, and - once a manager saves one - the SAVED
 * plan that later months are compared with. The needed path is arithmetic, not a prediction, and is labelled that way.
 */
export default function OutlookChart({ profileId, recommendationId }: { profileId: string; recommendationId?: string }) {
  const [data, setData] = useState<Outlook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalPct, setGoalPct] = useState<number | null>(null);
  const [months, setMonths] = useState(3);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPersonOutlook(profileId, { goalPct, months })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "The outlook couldn't be loaded."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profileId, goalPct, months, reloadKey]);

  const rows = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        key: p.month,
        month: monthLabel(p.month),
        actual: p.actual,
        projected: p.projected,
        plan: p.plan,
        saved: p.saved_plan,
        bandBase: p.low,
        bandSize: p.low !== null && p.high !== null ? Math.max(0, p.high - p.low) : null,
        low: p.low,
        high: p.high,
      })),
    [data],
  );

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setActionError(null);
    setActionMsg(null);
    try {
      setActionMsg(await fn());
      setReloadKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <p className="text-sm text-ink-500">{error}</p>;
  if (!data) return <p role="status" className="text-sm text-ink-500">Loading…</p>;
  if (!data.available) return <p className="text-sm text-ink-600">{data.reason ?? "No outlook to show yet."}</p>;

  const lastActual = [...data.points].reverse().find((p) => p.actual !== null);
  const lastProjected = [...data.points].reverse().find((p) => p.projected !== null && p.actual === null);
  const goalNow = data.plan.goal_pct ?? null;
  const tracked = data.tracked_plan;
  const summary: string[] = [];
  if (lastActual) summary.push(`Latest scored month (${monthLabel(lastActual.month)}): ${pct(lastActual.actual)} of target.`);
  if (data.projection.available && lastProjected) {
    summary.push(`If the recent pattern continues, about ${pct(lastProjected.projected)} by ${monthLabel(lastProjected.month)} (likely range ${pct(lastProjected.low)} to ${pct(lastProjected.high)}).`);
  } else if (data.projection.reason) {
    summary.push(data.projection.reason);
  }
  if (data.plan.available) {
    summary.push(`Reaching ${pct(data.plan.goal_pct)}${data.plan.goal_label ? ` (${data.plan.goal_label})` : ""} in ${data.plan.months} months means improving about ${data.plan.step_pct_points?.toFixed(1)} points a month from here.`);
  } else if (data.plan.reason) {
    summary.push(data.plan.reason);
  }
  if (tracked?.evaluation) summary.push(`Saved plan: ${planStatus(tracked.evaluation)}`);

  return (
    <div className="space-y-3" aria-busy={loading || busy}>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-600">
        <label className="flex items-center gap-1.5">
          <span className="font-semibold">Goal</span>
          <select className={selectCls} value={String(goalPct ?? goalNow ?? "")} onChange={(e) => setGoalPct(Number(e.target.value))} disabled={loading || busy}>
            {data.goal_options.map((o) => (
              <option key={o.key} value={String(o.pct)}>{o.label} ({o.pct}%)</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="font-semibold">Reach it in</span>
          <select className={selectCls} value={months} onChange={(e) => setMonths(Number(e.target.value))} disabled={loading || busy}>
            {[3, 4, 5, 6].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </label>
      </div>

      <div className="h-64 w-full" role="img" aria-label={summary.join(" ")}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, (dataMax: number) => Math.max(110, Math.ceil(dataMax / 10) * 10)]} />
            <Tooltip formatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "–")} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={100} stroke="#6B7280" strokeDasharray="4 4" label={{ value: "Target", fontSize: 10, position: "insideTopRight" }} />
            <Area dataKey="bandBase" stackId="range" stroke="none" fill="none" legendType="none" tooltipType="none" isAnimationActive={false} />
            <Area dataKey="bandSize" stackId="range" name="Likely range (90%)" stroke="none" fill="#7C3AED" fillOpacity={0.15} tooltipType="none" isAnimationActive={false} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563EB" strokeWidth={2} dot connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="projected" name="Projection" stroke="#7C3AED" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="plan" name="Path needed to reach goal" stroke="#059669" strokeWidth={2} strokeDasharray="2 4" dot={false} isAnimationActive={false} />
            {tracked && <Line type="monotone" dataKey="saved" name="Saved plan" stroke="#D97706" strokeWidth={2.5} strokeDasharray="10 3 2 3" dot={{ r: 2 }} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
        {summary.map((s) => <li key={s}>{s}</li>)}
      </ul>

      {data.plans_unavailable && <p className="text-xs text-ink-500">Saved plans couldn't be loaded just now. The chart above is unaffected.</p>}

      {tracked && (
        <section aria-label="Saved plan" className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ink-600">Saved plan</h4>
          <p className="mt-1 text-ink-800">
            Reach {pct(tracked.goal_pct)}{tracked.goal_label ? ` (${tracked.goal_label})` : ""} by {monthLabel(tracked.path[tracked.path.length - 1]?.month ?? tracked.start_month)}, starting from {pct(tracked.start_pct)} in {monthLabel(tracked.start_month)}.
            <span className="text-ink-500"> Saved {dayLabel(tracked.created_at)}{tracked.created_by ? ` by ${tracked.created_by}` : ""}.</span>
          </p>
          <p className="mt-1 text-ink-800">{planStatus(tracked.evaluation)}</p>
          {tracked.note && <p className="mt-1 text-xs text-ink-600">Note: {tracked.note}</p>}
          {data.can_manage_plan && !closing && (
            <button type="button" disabled={busy} onClick={() => setClosing(true)} className={`${btnCls} mt-2`}>End this plan</button>
          )}
          {data.can_manage_plan && closing && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-ink-600">
                <span className="block font-semibold">Why is it ending? (optional)</span>
                <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} maxLength={500} className="w-64 rounded-lg border border-mist-200 px-2 py-1 text-sm" />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(async () => { await closePlan(tracked.id, closeNote); setClosing(false); setCloseNote(""); return "The plan was ended. Its history is kept."; })}
                className={btnCls}
              >
                Confirm end plan
              </button>
              <button type="button" disabled={busy} onClick={() => setClosing(false)} className={btnCls}>Keep it</button>
            </div>
          )}
        </section>
      )}

      {data.can_manage_plan && data.plan.available && (
        <section aria-label="Save as a plan" className="rounded-xl border border-mist-200 p-3">
          <p className="text-xs text-ink-600">
            {tracked
              ? "Saving this goal and path replaces the saved plan above (it stays in the history)."
              : `Save this goal (${pct(data.plan.goal_pct)}) and path as a plan, so later months are compared with it.`}{" "}
            Saving doesn't change any score, rating or status.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-ink-600">
              <span className="block font-semibold">Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="w-64 rounded-lg border border-mist-200 px-2 py-1 text-sm" />
            </label>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() =>
                run(async () => {
                  const r = await savePlan({ profile_id: profileId, goal_pct: data.plan.goal_pct ?? null, months: data.plan.months ?? months, recommendation_id: recommendationId ?? null, note: note || null });
                  setNote("");
                  return r.created ? "Plan saved." : "That exact plan is already saved.";
                })
              }
              className={btnCls}
            >
              {tracked ? "Replace saved plan" : "Save as a plan"}
            </button>
          </div>
        </section>
      )}
      {actionMsg && <p role="status" className="text-xs text-ink-600">{actionMsg}</p>}
      {actionError && <p role="alert" className="text-xs text-red-600">{actionError}</p>}

      <p className="text-[11px] text-ink-500">
        {data.projection.method ?? ""} A projection is a range from past results, not a promise. {data.plan.available ? data.plan.note : ""}
      </p>

      <details className="text-xs text-ink-600">
        <summary className="cursor-pointer font-semibold">View as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                {["Month", "Actual", "Projection (range)", "Path needed", "Saved plan"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-1 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-mist-200">
                  <td className="px-2 py-1">{r.month}</td>
                  <td className="px-2 py-1">{pct(r.actual)}</td>
                  <td className="px-2 py-1">{r.projected === null ? "–" : `${pct(r.projected)} (${pct(r.low)} to ${pct(r.high)})`}</td>
                  <td className="px-2 py-1">{pct(r.plan)}</td>
                  <td className="px-2 py-1">{pct(r.saved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
