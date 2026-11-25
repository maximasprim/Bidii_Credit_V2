import { useEffect, useRef, useState } from "react";
import { getAccessLog, type AccessLogRow } from "../../../lib/performanceApi";

const LABEL: Record<string, string> = { "report.view": "Viewed the results report", appraisal_viewed: "Opened an appraisal", appraisal_downloaded: "Downloaded an appraisal", appraisal_file_downloaded: "Downloaded an uploaded form" };

/** Who has looked at this person's report and appraisals. HR/admin and the person themselves only. */
export default function AccessLog({ profileId, title = "Who has viewed my records", initial }: { profileId: string; title?: string; initial?: AccessLogRow[] | null }) {
  const [rows, setRows] = useState<AccessLogRow[] | null>(initial ?? null);
  const seededFor = useRef<string | null>(initial ? profileId : null);
  useEffect(() => {
    if (seededFor.current === profileId) return; // already loaded by the page
    seededFor.current = null;
    let cancelled = false;
    getAccessLog(profileId).then((d) => !cancelled && setRows(d.items)).catch(() => !cancelled && setRows(null));
    return () => {
      cancelled = true;
    };
  }, [profileId]);
  if (!rows) return null;
  return (
    <details className="rounded-2xl border border-mist-200 p-4">
      <summary className="cursor-pointer text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{title} ({rows.length})</summary>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-600">Nobody else has viewed them yet.</p>
      ) : (
        <table className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">Views of this person's records</caption>
          <thead><tr className="text-ink-500"><th scope="col" className="py-1 pr-2">Who</th><th scope="col" className="py-1 pr-2">What</th><th scope="col" className="py-1">When</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-mist-100"><td className="py-1 pr-2">{r.viewer}</td><td className="py-1 pr-2">{LABEL[r.action] ?? r.action}</td><td className="py-1">{r.at ? new Date(r.at).toLocaleString("en-KE") : ""}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
