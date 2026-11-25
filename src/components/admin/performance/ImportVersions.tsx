import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  compareImportVersions, getRestorePlan, labelImportVersion, listImportVersions, restoreImportVersion, unpostImportVersion,
  type ImportVersionRow, type VersionCompare,
} from "../../../lib/performanceApi";

const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work.");
const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-KE") : "");
const num = (v: number | null) => (v == null ? "none" : v.toLocaleString("en-KE"));

/** `initial` (optional) is the list the page already fetched, so it shows with the rest of the page. */
export default function ImportVersions({ onChanged, initial }: { onChanged?: () => void; initial?: ImportVersionRow[] }) {
  const [rows, setRows] = useState<ImportVersionRow[]>(initial ?? []);
  const seeded = useRef(initial !== undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [cmp, setCmp] = useState<VersionCompare | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const load = useCallback(() => { listImportVersions().then((r) => setRows(r.items)).catch((e) => toast.error(msg(e))); }, []);
  useEffect(() => {
    if (seeded.current) { seeded.current = false; return; } // the page already supplied the first load
    load();
  }, [load]);

  const done = (ok: string) => { toast.success(ok); load(); onChanged?.(); };
  const ask = (q: string) => (window.prompt(q) ?? "").trim();

  async function unpost(r: ImportVersionRow) {
    const newer = rows.filter((x) => x.series === r.series && x.version > r.version && x.status === "posted");
    const cascade = newer.length > 0 && window.confirm(`v${newer.map((n) => n.version).join(", v")} ${newer.length === 1 ? "was" : "were"} posted after v${r.version}. Unpost ${newer.length === 1 ? "it" : "them"} together with v${r.version}?`);
    if (newer.length > 0 && !cascade) return;
    const reason = ask(`Why are you unposting v${r.version}? (at least 5 characters)`);
    if (reason.length < 5) return;
    setBusy(r.import_id);
    try {
      const out = await unpostImportVersion(r.import_id, reason, cascade);
      const kept = out.unposted.reduce((n, u) => n + u.kept, 0);
      done(`Unposted${kept ? `; ${kept} record(s) changed since were left alone` : ""}.`);
    } catch (e) { toast.error(msg(e)); } finally { setBusy(null); }
  }

  async function restore(r: ImportVersionRow) {
    setBusy(r.import_id);
    try {
      const plan = await getRestorePlan(r.import_id);
      if (plan.blocked_by_locked_months.length) { toast.error(`These months are locked: ${plan.blocked_by_locked_months.join(", ")}. HR must reopen them first.`); return; }
      const steps = [
        ...plan.unpost.map((u) => `unpost v${u.version}`),
        ...(plan.repost_as_new_version ? [`post v${plan.target_version} again as a new version`] : []),
      ];
      if (!window.confirm(`Restore to v${plan.target_version}?\n\nThis will: ${steps.join(", then ")}.\n\n${plan.note}`)) return;
      const reason = ask("Why are you restoring this version? (at least 5 characters)");
      if (reason.length < 5) return;
      const out = await restoreImportVersion(r.import_id, reason);
      done(out.new_version ? `Restored; posted as v${out.new_version}.` : `Restored to v${out.restored_to}.`);
    } catch (e) { toast.error(msg(e)); } finally { setBusy(null); }
  }

  async function rename(r: ImportVersionRow) {
    const v = window.prompt("Name this version (for example 'Corrected Nairobi sheet')", r.label ?? "");
    if (v === null) return;
    try { await labelImportVersion(r.import_id, v.trim() || null); load(); } catch (e) { toast.error(msg(e)); }
  }

  function toggle(id: string) { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2))); }
  async function compare() {
    if (picked.length !== 2) return;
    const [a, b] = [...picked].sort((x, y) => (rows.find((r) => r.import_id === x)?.version ?? 0) - (rows.find((r) => r.import_id === y)?.version ?? 0));
    try { setCmp(await compareImportVersions(a, b)); } catch (e) { toast.error(msg(e)); }
  }

  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-5" aria-label="Import versions">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>Workbook versions</h2>
        <button type="button" className={btn} disabled={picked.length !== 2} onClick={() => void compare()}>Compare selected (pick 2)</button>
      </div>
      <p className="mb-3 text-xs text-ink-500">Every posted import is a numbered version of its year's workbook. Unpost one to reverse it, or restore any earlier version. Nothing changed by hand since an import is overwritten.</p>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.import_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-mist-200 pt-2 text-ink-700">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={picked.includes(r.import_id)} onChange={() => toggle(r.import_id)} aria-label={`Select version ${r.version} to compare`} />
              <span>
                <span className="font-semibold">{r.series} · v{r.version}</span>{r.label ? ` · ${r.label}` : ""}{" "}
                <span className={r.status === "posted" ? "text-emerald-700" : "text-ink-500"}>{r.status === "posted" ? (r.is_current ? "Current" : "Posted (superseded)") : "Unposted"}</span>
                <br />
                <span className="text-xs text-ink-500">
                  {r.file_name} · posted {when(r.posted_at)} by {r.posted_by}
                  {r.restored_from ? ` · restore of v${r.restored_from}` : ""}
                  {r.same_file_as_version ? ` · same file as v${r.same_file_as_version}` : ""}
                  {r.status === "unposted" ? ` · unposted ${when(r.unposted_at)} by ${r.unposted_by ?? "?"}${r.unposted_reason ? `: ${r.unposted_reason}` : ""}` : ""}
                </span>
              </span>
            </label>
            <span className="flex gap-2">
              <button type="button" className={btn} onClick={() => void rename(r)}>Name</button>
              {r.status === "posted" && <button type="button" className={btn} disabled={busy === r.import_id} onClick={() => void unpost(r)}>Unpost</button>}
              {!(r.status === "posted" && r.is_current) && <button type="button" className={btn} disabled={busy === r.import_id} onClick={() => void restore(r)}>Restore to this version</button>}
            </span>
          </li>
        ))}
      </ul>
      {cmp && (
        <div className="mt-4 rounded-xl border border-mist-200 p-3 text-sm" role="region" aria-label="Version comparison">
          <div className="mb-2 flex items-center justify-between">
            <strong>v{cmp.from_version} to v{cmp.to_version}</strong>
            <button type="button" className={btn} onClick={() => setCmp(null)}>Close</button>
          </div>
          <p className="mb-2 text-xs text-ink-500">{cmp.same_file ? "The two versions came from the identical file. " : ""}{cmp.counts.changed} changed, {cmp.counts.added} new, {cmp.counts.removed} no longer in the sheet (first 100 of each shown).</p>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-ink-500"><th className="py-1 pr-2">Sheet</th><th className="pr-2">Name</th><th className="pr-2">Month</th><th className="pr-2">Was</th><th>Now</th></tr></thead>
              <tbody>
                {[...cmp.changed, ...cmp.added, ...cmp.removed].map((c, i) => (
                  <tr key={i} className="border-t border-mist-100"><td className="py-1 pr-2">{c.sheet}</td><td className="pr-2">{c.name}</td><td className="pr-2">{c.month}</td><td className="pr-2">{num(c.from)}</td><td>{num(c.to)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
