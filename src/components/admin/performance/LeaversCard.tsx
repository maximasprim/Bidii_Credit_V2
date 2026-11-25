import { Card, fmtNum, fmtPct } from "./ReportCharts";

export type LeaverRow = {
  profile_id: string;
  name: string;
  role_name: string | null;
  reason: "left" | "deactivated";
  exit_date: string | null;
  months_counted: number;
  first_month: string | null;
  last_month: string | null;
  actual: number | null;
  target: number | null;
  pct: number | null;
};

/** The people who have left whose months are inside a report's KES totals. Reads `summary.leavers`; nothing to show when it's empty. */
export const leaversOf = (summary: unknown): LeaverRow[] => (summary as { leavers?: LeaverRow[] } | null | undefined)?.leavers ?? [];

const mLabel = (ym: string | null) => (ym ? new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short", year: "2-digit" }) : "–");
const dLabel = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : null);

export default function LeaversCard({ leavers, onOpen }: { leavers: LeaverRow[]; onOpen?: (id: string) => void }) {
  if (!leavers.length) return null;
  const actual = leavers.reduce((n, r) => n + (r.actual ?? 0), 0);
  const target = leavers.reduce((n, r) => n + (r.target ?? 0), 0);
  return (
    <Card title="Staff who have left" note="Their results for the months they worked are inside the KES totals and the achievement % above. They are not counted as people.">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-500">
              {["Name", "Left", "Months counted", "Actual (KES)", "Target (KES)", "Achievement"].map((h) => (
                <th key={h} scope="col" className="px-2 py-1.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leavers.map((r) => (
              <tr
                key={r.profile_id}
                onClick={onOpen ? () => onOpen(r.profile_id) : undefined}
                className={`border-t border-mist-200 align-top ${onOpen ? "cursor-pointer hover:bg-mist-50" : ""}`}
              >
                <td className="px-2 py-2">
                  {onOpen ? <button type="button" onClick={() => onOpen(r.profile_id)} className="text-left font-semibold underline">{r.name}</button> : <span className="font-semibold">{r.name}</span>}
                  {r.role_name && <div className="text-xs text-ink-500">{r.role_name}</div>}
                </td>
                <td className="px-2 py-2">{dLabel(r.exit_date) ?? (r.reason === "deactivated" ? "Deactivated" : "Date not recorded")}</td>
                <td className="px-2 py-2">{r.months_counted} {r.months_counted === 1 ? "month" : "months"}<div className="text-xs text-ink-500">{mLabel(r.first_month)} – {mLabel(r.last_month)}</div></td>
                <td className="px-2 py-2">{fmtNum(r.actual)}</td>
                <td className="px-2 py-2">{fmtNum(r.target)}</td>
                <td className="px-2 py-2">{fmtPct(r.pct)}</td>
              </tr>
            ))}
          </tbody>
          {leavers.length > 1 && (
            <tfoot>
              <tr className="border-t border-mist-200 text-xs font-semibold text-ink-700">
                <td className="px-2 py-2" colSpan={3}>Added to the totals by people who have left</td>
                <td className="px-2 py-2">{fmtNum(actual)}</td>
                <td className="px-2 py-2">{fmtNum(target)}</td>
                <td className="px-2 py-2">{target > 0 ? fmtPct((actual / target) * 100) : "–"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
