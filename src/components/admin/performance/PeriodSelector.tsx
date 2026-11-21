import { useState } from "react";

type Kind = "ytd" | "month" | "quarter" | "half" | "year" | "custom";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const field = "rounded-lg border border-mist-200 bg-surface px-2.5 py-1.5 text-sm text-ink-700";

function parse(key: string): { kind: Kind; year: number; sub: number; from: string; to: string } {
  const now = new Date();
  const base = { kind: "ytd" as Kind, year: now.getFullYear(), sub: 1, from: "", to: "" };
  let m: RegExpMatchArray | null;
  if (key === "ytd") return base;
  if ((m = key.match(/^(\d{4})-(\d{2})\.\.(\d{4})-(\d{2})$/))) return { ...base, kind: "custom", from: `${m[1]}-${m[2]}`, to: `${m[3]}-${m[4]}` };
  if ((m = key.match(/^(\d{4})-Q([1-4])$/i))) return { ...base, kind: "quarter", year: +m[1], sub: +m[2] };
  if ((m = key.match(/^(\d{4})-H([12])$/i))) return { ...base, kind: "half", year: +m[1], sub: +m[2] };
  if ((m = key.match(/^(\d{4})-(\d{2})$/))) return { ...base, kind: "month", year: +m[1], sub: +m[2] };
  if ((m = key.match(/^(\d{4})$/))) return { ...base, kind: "year", year: +m[1] };
  return base;
}

/** One control for every period the API understands: month, Q1-Q4, H1/H2, full year, YTD or a custom range. */
export default function PeriodSelector({ value, onChange, id = "period" }: { value: string; onChange: (key: string) => void; id?: string }) {
  const [state, setState] = useState(() => parse(value));
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3];

  const emit = (next: typeof state) => {
    setState(next);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (next.kind === "ytd") onChange("ytd");
    else if (next.kind === "year") onChange(String(next.year));
    else if (next.kind === "quarter") onChange(`${next.year}-Q${next.sub}`);
    else if (next.kind === "half") onChange(`${next.year}-H${next.sub}`);
    else if (next.kind === "month") onChange(`${next.year}-${pad(next.sub)}`);
    else if (next.from && next.to) onChange(`${next.from}..${next.to}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`${id}-kind`} className="sr-only">Period type</label>
      <select id={`${id}-kind`} className={field} value={state.kind} onChange={(e) => emit({ ...state, kind: e.target.value as Kind, sub: 1 })}>
        <option value="ytd">Year to date</option>
        <option value="month">Month</option>
        <option value="quarter">Quarter</option>
        <option value="half">Half-year</option>
        <option value="year">Full year</option>
        <option value="custom">Custom range</option>
      </select>
      {["month", "quarter", "half", "year"].includes(state.kind) && (
        <>
          <label htmlFor={`${id}-year`} className="sr-only">Year</label>
          <select id={`${id}-year`} className={field} value={state.year} onChange={(e) => emit({ ...state, year: +e.target.value })}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </>
      )}
      {state.kind === "month" && (
        <>
          <label htmlFor={`${id}-month`} className="sr-only">Month</label>
          <select id={`${id}-month`} className={field} value={state.sub} onChange={(e) => emit({ ...state, sub: +e.target.value })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </>
      )}
      {state.kind === "quarter" && (
        <>
          <label htmlFor={`${id}-q`} className="sr-only">Quarter</label>
          <select id={`${id}-q`} className={field} value={state.sub} onChange={(e) => emit({ ...state, sub: +e.target.value })}>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </>
      )}
      {state.kind === "half" && (
        <>
          <label htmlFor={`${id}-h`} className="sr-only">Half</label>
          <select id={`${id}-h`} className={field} value={state.sub} onChange={(e) => emit({ ...state, sub: +e.target.value })}>
            <option value={1}>H1</option>
            <option value={2}>H2</option>
          </select>
        </>
      )}
      {state.kind === "custom" && (
        <>
          <label htmlFor={`${id}-from`} className="text-xs font-semibold text-ink-600">From</label>
          <input id={`${id}-from`} type="month" className={field} value={state.from} onChange={(e) => emit({ ...state, from: e.target.value })} />
          <label htmlFor={`${id}-to`} className="text-xs font-semibold text-ink-600">To</label>
          <input id={`${id}-to`} type="month" className={field} value={state.to} onChange={(e) => emit({ ...state, to: e.target.value })} />
        </>
      )}
    </div>
  );
}
