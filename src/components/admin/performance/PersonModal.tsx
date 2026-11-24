import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getPersonReport, type PersonReport, type ReportPerson } from "../../../lib/performanceApi";
import CategoryBadge from "../CategoryBadge";
import OutlookChart from "./OutlookChart";
import PersonView from "./PersonView";
import { fmtNum, fmtPct } from "./ReportCharts";

type Tab = "outlook" | "report";

const FOCUSABLE = 'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

function Tile({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-xl border border-mist-200 bg-surface p-3">
      <p className="text-xs font-semibold text-ink-500">{label}</p>
      <p className="mt-0.5 font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

function KeyLine({ stroke, dash, width = 2, children }: { stroke: string; dash?: string; width?: number; children: string }) {
  return (
    <li className="flex items-start gap-2">
      <svg width="28" height="10" aria-hidden="true" className="mt-1 shrink-0">
        <line x1="1" x2="27" y1="5" y2="5" stroke={stroke} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

/**
 * A person's story in one place: who they are and how they're doing at a glance, then (tab 1) where results are heading and the plan,
 * or (tab 2) the full report. Opens from a row in the staff tables. Esc, the close button or a click outside closes it.
 */
export default function PersonModal({ profileId, period, initial, onClose }: { profileId: string; period: string; initial?: ReportPerson; onClose: () => void }) {
  const [report, setReport] = useState<PersonReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("outlook");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    getPersonReport(profileId, period)
      .then((r) => !cancelled && setReport(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "This person's report couldn't be loaded."));
    return () => {
      cancelled = true;
    };
  }, [profileId, period]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (before && document.contains(before)) before.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const p: ReportPerson | null = report?.person ?? initial ?? null;
  const first = p?.name.split(" ")[0] ?? "";
  const plain = !p
    ? ""
    : p.score === null
      ? `Nothing has been scored for ${report?.period.label ?? "this period"} yet.`
      : `${first} is at ${fmtPct(p.headline?.pct)} of target${p.category ? `, which is ${p.category.label}` : ""}.`;

  const tabCls = (t: Tab) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold ${tab === t ? "border-ink-900 bg-ink-900 text-white" : "border-mist-200 text-ink-700 hover:bg-mist-50"}`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6 lg:pl-64 lg:pt-20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="person-modal-title" onKeyDown={onKeyDown} className="flex max-h-[87vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-mist-200 p-4 sm:p-5">
          <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-mist-200 bg-mist-50 text-sm font-bold text-ink-700">
            {p ? initials(p.name) : ""}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="person-modal-title" className="truncate font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>{p?.name ?? "Loading…"}</h2>
            <p className="text-xs text-ink-500">{[p?.role_name, p?.unit_name, report?.period.label].filter(Boolean).join(" · ")}{p?.status === "pip" ? " · PIP" : ""}</p>
            {p?.category && <div className="mt-1.5"><CategoryBadge categoryKey={p.category.key} label={p.category.label} /></div>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-full border border-mist-200 p-1.5 text-ink-700 hover:bg-mist-50">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {p && (
            <>
              <p className="text-sm text-ink-800">{plain}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Tile label="Score" value={p.score === null ? "–" : p.score.toFixed(0)} sub={p.category?.label ?? "Not scored"} />
                <Tile label={p.headline?.label ?? "Achievement"} value={fmtPct(p.headline?.pct)} sub={p.headline ? `${fmtNum(p.headline.actual)} of ${fmtNum(p.headline.target)}` : "No verified figures yet"} />
                <Tile label="Year to date" value={report ? (report.year_to_date.score === null ? "–" : report.year_to_date.score.toFixed(0)) : "…"} sub={report?.year_to_date.category?.label ?? null} />
              </div>
              {p.attention.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-semibold">Worth a conversation</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">{p.attention.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
              )}

              <div role="tablist" aria-label="Person details" className="flex gap-1.5">
                <button role="tab" id="pm-tab-outlook" aria-selected={tab === "outlook"} aria-controls="pm-panel" type="button" onClick={() => setTab("outlook")} className={tabCls("outlook")}>Where this is heading</button>
                <button role="tab" id="pm-tab-report" aria-selected={tab === "report"} aria-controls="pm-panel" type="button" onClick={() => setTab("report")} className={tabCls("report")}>Full report</button>
              </div>

              <div role="tabpanel" id="pm-panel" aria-labelledby={tab === "outlook" ? "pm-tab-outlook" : "pm-tab-report"}>
                {tab === "outlook" ? (
                  <div className="space-y-4">
                    <OutlookChart profileId={profileId} />
                    <div className="rounded-xl border border-mist-200 bg-mist-50 p-3">
                      <p className="text-xs font-semibold text-ink-700">How to read this chart</p>
                      <ul className="mt-2 grid gap-2 text-xs text-ink-600 sm:grid-cols-2">
                        <KeyLine stroke="#2563EB">What the person actually achieved each month, as a percentage of target.</KeyLine>
                        <KeyLine stroke="#7C3AED" dash="6 4">Where results are heading if nothing changes. The shaded band is the likely range.</KeyLine>
                        <KeyLine stroke="#059669" dash="2 4">The path needed each month to reach the chosen goal. It shows what has to happen, not what will.</KeyLine>
                        <KeyLine stroke="#D97706" dash="10 3 2 3" width={2.5}>The plan a manager saved, frozen on the day it was agreed, so later months can be compared with it.</KeyLine>
                      </ul>
                    </div>
                  </div>
                ) : report ? (
                  <PersonView r={report} showOutlook={false} />
                ) : (
                  <p role="status" className="text-sm text-ink-500">Loading the full report…</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
