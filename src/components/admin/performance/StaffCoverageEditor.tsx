import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getStaffCoverage, setStaffCoverage, type PerformanceUnit, type StaffCoverage } from "../../../lib/performanceApi";

/*
  "Also covers": the other branches someone works in besides their main unit (a debt collector covering several branches).
  Saves each change straight away, so it does not wait for the profile's Save button.
*/

const input = "w-full rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:border-ember-500 focus:outline-none focus:ring-2 focus:ring-ember-500/30 disabled:opacity-60";
const DEBT = /debt collection$/i;

export default function StaffCoverageEditor({ profileId, mainUnitId, units, collector }: { profileId: string; mainUnitId: string; units: PerformanceUnit[]; collector: boolean }) {
  const [cov, setCov] = useState<StaffCoverage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStaffCoverage(profileId)
      .then((c) => { if (!cancelled) setCov(c); })
      .catch(() => { if (!cancelled) setCov(null); });
    return () => { cancelled = true; };
  }, [profileId]);

  async function save(ids: string[]) {
    setBusy(true);
    setError(null);
    try {
      setCov(await setStaffCoverage(profileId, ids));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (!cov) return null;
  const current = cov.units.filter((u) => u.id !== mainUnitId);
  if (!collector && current.length === 0) return null;
  const taken = new Set([mainUnitId, ...current.map((u) => u.id)]);
  // a collector picks from the branches' Debt Collection units; for anyone else any open unit will do
  const options = units.filter((u) => !taken.has(u.id) && (!collector || DEBT.test(u.name)));

  return (
    <fieldset className="space-y-2 rounded-xl border border-mist-200 p-3" disabled={busy}>
      <legend className="px-1 text-xs font-semibold text-ink-700">Also covers</legend>
      <p className="text-xs text-ink-500">Other branches this person works in, besides the unit chosen above. Each change is saved straight away.</p>
      {current.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {current.map((u) => (
            <li key={u.id} className="flex items-center gap-1 rounded-full border border-mist-200 bg-mist-50 py-1 pl-3 pr-1 text-xs text-ink-700">
              {u.name}
              <button type="button" aria-label={`Stop covering ${u.name}`} className="rounded-full p-1 hover:bg-mist-100" onClick={() => void save(current.filter((x) => x.id !== u.id).map((x) => x.id))}><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}
      <select aria-label="Add a unit this person also covers" className={input} value="" onChange={(e) => { if (e.target.value) void save([...current.map((u) => u.id), e.target.value]); }}>
        <option value="">{options.length === 0 ? "No other units to add" : "Add a branch…"}</option>
        {options.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}
