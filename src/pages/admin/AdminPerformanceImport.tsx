import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, Check, Download, Info, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { usePageMeta } from "../../lib/usePageMeta";
import ImportVersions from "../../components/admin/performance/ImportVersions";
import {
  commitImport,
  discardImport,
  downloadImportTemplate,
  dryRunImport,
  getImport,
  getPerformanceRoles,
  getUnits,
  listImports,
  listImportVersions,
  saveImportDecisions,
  undoImport,
  uploadImportWorkbook,
  type ImportDecisionsBody,
  type ImportIssue,
  type ImportListItem,
  type ImportName,
  type ImportOptionsState,
  type ImportVersionRow,
  type ImportPreview,
  type ImportRunResult,
  type PerformanceRole,
  type PerformanceUnit,
} from "../../lib/performanceApi";

const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";
const primary = "rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";

const COUNT_LABELS: [string, string][] = [
  ["units_created", "New branches/teams"],
  ["profiles_created", "New people"],
  ["entries_created", "Monthly figures added"],
  ["entries_updated", "Figures updated"],
  ["entries_unchanged", "Figures already there"],
  ["entries_kept", "System figures kept (differ from the workbook)"],
  ["targets_created", "Targets set"],
  ["targets_kept", "Existing targets kept"],
  ["actions_created", "Notes recorded as actions"],
  ["actions_restricted_skipped", "Restricted notes not imported (HR only)"],
  ["notes_unclassified", "Notes that aren't actions"],
  ["people_skipped", "Rows skipped (team rows etc.)"],
  ["people_without_target", "People with no target (not scored)"],
  ["months_excluded", "Figures left out (excluded months)"],
];

const OPTION_LABELS: [keyof ImportOptionsState, string][] = [
  ["include_par", "Import the unlabelled PAR % numbers as each officer's PAR"],
  ["import_targets", "Set each person's target from the TARGET column"],
  ["import_actions", "Record notes (talk, PIP, promote...) as actions"],
  ["create_missing_staff", "Create people who aren't in the system yet"],
  ["overwrite_manual", "Overwrite figures someone already entered in the system"],
  ["overwrite_targets", "Replace targets that are already set"],
];

const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleString("en-KE", { month: "short", year: "numeric" });
const kes = (n: number) => n.toLocaleString("en-KE");

function SeverityIcon({ severity }: { severity: ImportIssue["severity"] }) {
  if (severity === "error") return <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" aria-label="Error" />;
  if (severity === "warning") return <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" aria-label="Warning" />;
  return <Info size={14} className="mt-0.5 shrink-0 text-ink-500" aria-label="Note" />;
}

function Issues({ issues, counts, dropped }: { issues: ImportIssue[]; counts: Record<string, number>; dropped: number }) {
  const groups = useMemo(() => {
    const map = new Map<string, ImportIssue[]>();
    for (const i of issues) map.set(i.code, [...(map.get(i.code) ?? []), i]);
    return [...map.entries()].sort((a, b) => (a[1][0].severity === "warning" ? 0 : 1) - (b[1][0].severity === "warning" ? 0 : 1));
  }, [issues]);
  if (groups.length === 0) return <p className="text-sm text-ink-500">No data-quality problems found.</p>;
  return (
    <div className="space-y-2">
      {groups.map(([code, list]) => (
        <details key={code} className="rounded-lg border border-mist-200 px-3 py-2" open={list[0].severity !== "info"}>
          <summary className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-ink-700">
            <SeverityIcon severity={list[0].severity} />
            <span>{(counts[code] ?? list.length).toLocaleString("en-KE")} × {code.replace(/_/g, " ")}</span>
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-600">
            {list.slice(0, 40).map((i, n) => <li key={n}>{i.sheet ? <span className="font-semibold">{i.sheet}{i.row ? ` row ${i.row}` : ""}: </span> : null}{i.message}</li>)}
            {list.length > 40 && <li>…and {list.length - 40} more.</li>}
          </ul>
        </details>
      ))}
      {dropped > 0 && <p className="text-xs text-ink-500">{dropped} more notes were left out of this list to keep it readable.</p>}
    </div>
  );
}

function NameRow({ n, onDecide }: { n: ImportName; onDecide: (key: string, d: NonNullable<ImportDecisionsBody["staff"]>[string]) => void }) {
  const label = n.state === "ambiguous" ? "Needs a decision" : n.state === "matched" ? `Matches ${n.matched_name ?? "an existing person"}` : n.state === "team_row" ? "Team row (skipped)" : n.state === "new" ? "New person" : "Decided";
  const value = n.action === "match" && n.profile_id ? `match:${n.profile_id}` : (n.action ?? "");
  return (
    <tr className="border-t border-mist-200 align-top text-ink-700">
      <td className="py-2 pr-3 font-medium">{n.name}<span className="block text-xs font-normal text-ink-500">{n.sheets.join(", ")}</span></td>
      <td className="py-2 pr-3 text-xs">{label}</td>
      <td className="py-2">
        <select
          aria-label={`What to do with ${n.name}`}
          className={`${input} w-full min-w-[220px]`}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("match:")) onDecide(n.key, { action: "match", profile_id: v.slice(6) });
            else if (v === "create" || v === "skip") onDecide(n.key, { action: v });
          }}
        >
          <option value="" disabled>Choose…</option>
          {n.candidates.map((c) => <option key={c.profile_id} value={`match:${c.profile_id}`}>Same person as {c.full_name} ({Math.round(c.score * 100)}%)</option>)}
          {n.matched_name && n.profile_id && !n.candidates.some((c) => c.profile_id === n.profile_id) && <option value={`match:${n.profile_id}`}>Matches {n.matched_name}</option>}
          <option value="create">Create as a new person</option>
          <option value="skip">Skip this person</option>
        </select>
      </td>
    </tr>
  );
}

function Review({ preview, units, roles, onChange, onDone }: { preview: ImportPreview; units: PerformanceUnit[]; roles: PerformanceRole[]; onChange: (p: ImportPreview) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<ImportRunResult | null>(null);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const months = useMemo(() => [...new Set(preview.sheets.flatMap((s) => (s.months ?? []).map((m) => `${preview.year}-${m}`)))].sort(), [preview]);

  async function save(body: ImportDecisionsBody) {
    setError(null);
    setDry(null);
    try {
      onChange(await saveImportDecisions(preview.id, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that choice.");
    }
  }

  async function run(kind: "dry" | "commit") {
    setBusy(true);
    setError(null);
    try {
      if (kind === "dry") setDry(await dryRunImport(preview.id));
      else {
        const res = await commitImport(preview.id);
        setResult(res);
        toast.success("Import complete.");
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const decideable = preview.names.filter((n) => n.state === "ambiguous");
  const others = preview.names.filter((n) => n.state !== "ambiguous");
  const mismatches = preview.reconciliation.company_total_differences.filter((d) => d.status === "mismatch");
  const shown = showAll ? others : others.slice(0, 15);

  if (result) {
    return (
      <section className={card}>
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold" style={heading}><Check size={15} className="text-green-700" /> Imported</h2>
        <CountTable counts={result.counts} />
        <p className="mt-3 text-xs text-ink-500">Imported figures are marked verified, entered by "import". You can undo this run from the list of past imports.</p>
        <Link to="/admin/performance" className={`${btn} mt-3 inline-block`}>Back to Staff Performance</Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>1. Which sheet is which branch or team?</h2>
        <p className="mb-3 text-xs text-ink-500">Workbook {preview.original_name} · year {preview.year}. Sheets that aren't staff sheets are ignored.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Sheets in the workbook and what each will be imported as</caption>
            <thead><tr className="text-xs text-ink-500"><th scope="col" className="py-2 pr-3">Sheet</th><th scope="col" className="py-2 pr-3">Rows</th><th scope="col" className="py-2 pr-3">Import as</th><th scope="col" className="py-2">Job role for new people</th></tr></thead>
            <tbody>
              {preview.sheets.filter((s) => s.kind === "staff" && s.mapping).map((s) => {
                const m = s.mapping!;
                const value = m.action === "use" && m.unit_id ? `unit:${m.unit_id}` : m.action;
                return (
                  <tr key={s.name} className="border-t border-mist-200 align-top text-ink-700">
                    <td className="py-2 pr-3 font-medium">{s.name}{s.hidden && <span className="ml-1 rounded bg-mist-100 px-1.5 py-0.5 text-[10px] font-semibold">hidden in Excel</span>}</td>
                    <td className="py-2 pr-3 tabular-nums">{s.rows}</td>
                    <td className="py-2 pr-3">
                      <select aria-label={`What sheet ${s.name} is`} className={`${input} w-full min-w-[200px]`} value={value} onChange={(e) => {
                        const v = e.target.value;
                        if (v.startsWith("unit:")) void save({ sheets: { [s.name]: { action: "use", unit_id: v.slice(5) } } });
                        else if (v === "skip") void save({ sheets: { [s.name]: { action: "skip" } } });
                        else void save({ sheets: { [s.name]: { action: "create", new_unit: m.new_unit ?? { name: s.name, kind: "branch" } } } });
                      }}>
                        {units.filter((u) => u.is_active).map((u) => <option key={u.id} value={`unit:${u.id}`}>{u.name}</option>)}
                        <option value="create">Create a new {m.new_unit?.kind === "team" ? "team" : "branch"} “{m.new_unit?.name ?? s.name}”</option>
                        <option value="skip">Skip this sheet</option>
                      </select>
                      {m.reason && <span className="mt-1 block text-xs text-ink-500">{m.reason}</span>}
                    </td>
                    <td className="py-2">
                      <select aria-label={`Job role for new people on ${s.name}`} className={`${input} w-full`} value={m.role_key ?? ""} onChange={(e) => void save({ sheets: { [s.name]: { action: m.action, unit_id: m.unit_id, new_unit: m.new_unit, role_key: e.target.value || null } } })}>
                        <option value="">Default ({preview.options.default_role_key})</option>
                        {roles.filter((r) => r.is_active).map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>2. Who is who?</h2>
        <p className="mb-3 text-xs text-ink-500">{preview.names.length} names found. Exact matches are made for you; names that could be two people need your decision before anything can be imported.</p>
        {decideable.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700"><AlertTriangle size={14} /> {decideable.length} need a decision</p>
            <table className="w-full text-left text-sm"><caption className="sr-only">Names that need a decision</caption><tbody>{decideable.map((n) => <NameRow key={n.key} n={n} onDecide={(k, d) => void save({ staff: { [k]: d } })} />)}</tbody></table>
          </div>
        )}
        <table className="w-full text-left text-sm"><caption className="sr-only">Other names and how they will be handled</caption><tbody>{shown.map((n) => <NameRow key={n.key} n={n} onDecide={(k, d) => void save({ staff: { [k]: d } })} />)}</tbody></table>
        {others.length > 15 && <button type="button" className={`${btn} mt-3`} onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${others.length}`}</button>}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-display text-sm font-bold" style={heading}>3. What to import</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTION_LABELS.map(([k, label]) => (
            <label key={k} className="flex items-start gap-2 text-sm text-ink-700">
              <input type="checkbox" className="mt-1" checked={preview.options[k] as boolean} onChange={(e) => void save({ options: { [k]: e.target.checked } })} /> {label}
            </label>
          ))}
        </div>
        <fieldset className="mt-4">
          <legend className="mb-1 text-xs font-semibold text-ink-500">Leave these months out (use this if a column looks wrong in the checks below)</legend>
          <div className="flex flex-wrap gap-2">
            {months.map((m) => {
              const on = preview.options.exclude_months.includes(m);
              return (
                <label key={m} className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-red-300 bg-red-50 text-red-700" : "border-mist-200 text-ink-700"}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => void save({ options: { exclude_months: on ? preview.options.exclude_months.filter((x) => x !== m) : [...preview.options.exclude_months, m] } })} />
                  {monthName(m)}{on ? " (excluded)" : ""}
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>4. Checks on the workbook</h2>
        <h3 className="mb-2 mt-3 text-xs font-bold uppercase tracking-wide text-ink-500">Data-quality problems</h3>
        <Issues issues={preview.issues} counts={preview.issue_counts} dropped={preview.issues_dropped} />
        <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-ink-500">Branch totals vs the COMPANY sheet</h3>
        {preview.reconciliation.company_total_difference_count === 0 ? (
          <p className="text-sm text-green-700">Every branch total agrees with the COMPANY sheet.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-ink-500">{preview.reconciliation.company_total_difference_count} branch-month(s) disagree ({mismatches.length} by more than KES 1,000). Nothing is changed because of this; use it to decide which months to trust.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <caption className="sr-only">Branch totals that disagree with the COMPANY sheet</caption>
                <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-3">Branch</th><th scope="col" className="py-1 pr-3">Month</th><th scope="col" className="py-1 pr-3 text-right">COMPANY sheet</th><th scope="col" className="py-1 pr-3 text-right">Branch sheet adds up to</th><th scope="col" className="py-1 text-right">Difference</th></tr></thead>
                <tbody>
                  {preview.reconciliation.company_total_differences.slice(0, 60).map((d, i) => (
                    <tr key={i} className="border-t border-mist-200 text-ink-700">
                      <td className="py-1 pr-3">{d.branch}</td><td className="py-1 pr-3">{monthName(d.month)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{kes(d.company_total)}</td><td className="py-1 pr-3 text-right tabular-nums">{kes(d.branch_sheet_total)}</td>
                      <td className={`py-1 text-right tabular-nums ${d.status === "mismatch" ? "font-semibold text-red-600" : ""}`}>{d.difference > 0 ? "+" : ""}{kes(d.difference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {preview.reconciliation.company_branches_without_sheet.length > 0 && <p className="mt-2 text-xs text-ink-500">On the COMPANY sheet but with no branch sheet: {preview.reconciliation.company_branches_without_sheet.join(", ")}.</p>}
        <p className="mt-4 text-xs text-ink-500">{preview.reconciliation.band_difference_count} branch-month(s) have hand-counted staff bands (JAN–OCT sheets) that differ from counts recomputed from amount and target. {preview.reconciliation.note}</p>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-display text-sm font-bold" style={heading}>5. Check, then import</h2>
        {error && <p role="alert" className="mb-3 flex items-start gap-1.5 text-sm text-red-600"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={busy || preview.unresolved > 0} onClick={() => void run("dry")}>Dry run (writes nothing)</button>
          {preview.unresolved > 0 && <span className="text-xs text-amber-700">Decide the {preview.unresolved} name(s) above first.</span>}
        </div>
        {dry && (
          <div className="mt-4" role="status">
            <p className="mb-2 text-sm font-semibold text-ink-700">If you import now:</p>
            <CountTable counts={dry.counts} />
            <label className="mt-4 flex items-start gap-2 text-sm text-ink-700">
              <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              I've checked the numbers above. Import them (all or nothing). I can undo this run afterwards.
            </label>
            <button type="button" className={`${primary} mt-3`} disabled={busy || !confirm} onClick={() => void run("commit")}>Import now</button>
          </div>
        )}
        {!preview.is_hr && <p className="mt-4 text-xs text-ink-500">Only HR and administrators can import PIP and warning notes.</p>}
      </section>
    </div>
  );
}

function CountTable({ counts }: { counts: Record<string, number> }) {
  const rows = COUNT_LABELS.filter(([k]) => (counts[k] ?? 0) > 0);
  if (rows.length === 0) return <p className="text-sm text-ink-500">Nothing would change.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {rows.map(([k, label]) => (
        <div key={k} className="flex justify-between border-b border-mist-100 py-1"><dt className="text-ink-600">{label}</dt><dd className="font-semibold tabular-nums text-ink-900">{counts[k].toLocaleString("en-KE")}</dd></div>
      ))}
    </dl>
  );
}

function PastRuns({ items, onChanged }: { items: ImportListItem[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function act(fn: () => Promise<unknown>, id: string, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }
  if (items.length === 0) return null;
  return (
    <section className={card}>
      <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Past imports</h2>
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-mist-200 pt-2 text-ink-700">
            <span><span className="font-medium">{i.original_name}</span> · {i.status} · {new Date(i.created_at).toLocaleString("en-KE")} · by {i.created_by}{i.counts?.entries_created ? ` · ${i.counts.entries_created} figures` : ""}</span>
            {i.status === "committed" && <button type="button" className={btn} disabled={busy === i.id} onClick={() => { if (window.confirm("Undo this import? Records changed since it ran are left alone.")) void act(() => undoImport(i.id), i.id, "Import undone."); }}>Undo</button>}
            {i.status === "previewed" && (
              <span className="flex gap-2">
                <button type="button" className={btn} disabled={busy === i.id} onClick={() => onChanged()}>Resume</button>
                <button type="button" className={btn} disabled={busy === i.id} onClick={() => void act(() => discardImport(i.id), i.id, "Discarded.")}>Discard</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

type Boot = { past: ImportListItem[]; units: PerformanceUnit[]; roles: PerformanceRole[]; versions: ImportVersionRow[] | undefined };

/** Fetches past imports, branches/teams, roles and saved versions together and shows the page only when all have arrived. */
export default function AdminPerformanceImport() {
  usePageMeta("Import from Excel");
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listImports(), getUnits(), getPerformanceRoles(), listImportVersions()]).then(([p, u, r, v]) => {
      if (cancelled) return;
      setBoot({
        past: p.status === "fulfilled" ? p.value.items : [],
        units: u.status === "fulfilled" ? u.value.items : [],
        roles: r.status === "fulfilled" ? r.value.items : [],
        versions: v.status === "fulfilled" ? v.value.items : undefined,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!boot) {
    return (
      <div className="space-y-6">
        <div>
          <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
          <h1 className="font-display text-lg font-bold" style={heading}>Import from Excel</h1>
        </div>
        <p role="status" className="text-sm text-ink-500">Loading…</p>
      </div>
    );
  }
  return <ImportPage boot={boot} />;
}

function ImportPage({ boot }: { boot: Boot }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [units, setUnits] = useState<PerformanceUnit[]>(boot.units);
  const [roles, setRoles] = useState<PerformanceRole[]>(boot.roles);
  const [past, setPast] = useState<ImportListItem[]>(boot.past);
  const seeded = useRef(true);
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listImports().then((r) => setPast(r.items)).catch(() => undefined);
    getUnits().then((r) => setUnits(r.items)).catch(() => undefined);
    getPerformanceRoles().then((r) => setRoles(r.items)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (seeded.current) { seeded.current = false; return; } // the page already supplied the first load
    refresh();
  }, [refresh]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await uploadImportWorkbook(file, year ? Number(year) : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that workbook.");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    const open = past.find((p) => p.status === "previewed");
    if (!open) return;
    try {
      setPreview(await getImport(open.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that import.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Staff Performance</Link>
        <h1 className="font-display text-lg font-bold" style={heading}>Import from Excel</h1>
        <p className="text-sm text-ink-500">Bring in the monthly sales workbook: people, targets, figures and notes. You review everything and run a dry run first; nothing is written until you confirm, and a run can be undone.</p>
      </div>
      {!preview && (
        <section className={card}>
          <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Upload the workbook</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-ink-500">Workbook (.xlsx)
              <input type="file" accept=".xlsx" disabled={busy} className={`${input} mt-1 block`} onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <label className="text-xs text-ink-500">Year (only if it can't be read from the file)
              <input type="number" min={2000} max={2100} className={`${input} mt-1 block w-28`} value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026" />
            </label>
            <button type="button" className={`${btn} flex items-center gap-1.5`} onClick={() => void downloadImportTemplate().catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't download."))}>
              <Download size={14} /> Clean template
            </button>
            {past.some((p) => p.status === "previewed") && <button type="button" className={btn} onClick={() => void resume()}><Upload size={14} className="mr-1 inline" /> Resume last preview</button>}
          </div>
          {busy && <p role="status" className="mt-3 text-sm text-ink-500">Reading the workbook…</p>}
          {error && <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-600"><AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}</p>}
        </section>
      )}
      {preview && <Review preview={preview} units={units} roles={roles} onChange={setPreview} onDone={() => { refresh(); }} />}
      {preview && <button type="button" className={btn} onClick={() => { setPreview(null); refresh(); }}>Start over</button>}
      <ImportVersions onChanged={refresh} initial={boot.versions} />
      <PastRuns items={past} onChanged={refresh} />
    </div>
  );
}
