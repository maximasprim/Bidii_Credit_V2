import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getWeekly, type WeeklyView } from "../../../lib/performanceApi";

const TONE: Record<string, string> = { urgent: "border-red-200 bg-red-50 text-red-700", action: "border-amber-200 bg-amber-50 text-amber-800", info: "border-mist-200 text-ink-700" };

/** This week's conversations, most pressing first. Built from verified figures and open items; changes nothing. */
export type WeeklyInitial = { value: WeeklyView | null };

/** `initial` (optional) is what the page already fetched, so the section shows with the rest of the page. */
export default function WeeklyViewSection({ initial }: { initial?: WeeklyInitial }) {
  const [w, setW] = useState<WeeklyView | null>(initial ? initial.value : null);
  const seeded = useRef(!!initial);
  useEffect(() => {
    if (seeded.current) { seeded.current = false; return; }
    let cancelled = false;
    getWeekly().then((d) => !cancelled && setW(d)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (!w || (w.team_size === 0 && w.to_verify.length === 0)) return null;
  return (
    <section aria-labelledby="week-h" className="space-y-3">
      <h2 id="week-h" className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>This week: who needs me</h2>
      <p className="text-xs text-ink-500">Week of {w.week_of} · {w.team_size} people in your team · {w.needing_attention} need attention{w.needing_attention > w.shown ? ` (showing the top ${w.shown})` : ""}. {w.note}</p>
      {w.to_verify.length > 0 && (
        <p className="rounded-xl border border-mist-200 p-3 text-sm">
          Waiting for you to verify: {w.to_verify.map((v) => `${v.name} (${v.figures})`).join(", ")}. <Link className="underline" to="/admin/performance/entries">Open monthly figures</Link>
        </p>
      )}
      {w.people.length === 0 ? <p className="text-sm text-ink-600">Nobody needs a conversation right now.</p> : (
        <ol className="space-y-2">
          {w.people.map((p) => (
            <li key={p.profile_id} className="rounded-xl border border-mist-200 p-3 text-sm">
              <p className="font-semibold">{p.name} <span className="font-normal text-ink-500">· {p.role}{p.unit ? ` · ${p.unit}` : ""}{p.score != null ? ` · score ${p.score}` : ""}{p.category ? ` (${p.category})` : ""}</span></p>
              {p.trend.length > 0 && <p className="text-xs text-ink-500">Recent months: {p.trend.map((t) => (t == null ? "–" : `${Math.round(t)}%`)).join(" → ")}</p>}
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {p.reasons.map((r, i) => <li key={i} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[r.severity] ?? TONE.info}`}>{r.text}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {w.recognise.length > 0 && <p className="text-sm text-ink-700">Worth recognising: {w.recognise.map((r) => r.name).join(", ")}.</p>}
    </section>
  );
}
