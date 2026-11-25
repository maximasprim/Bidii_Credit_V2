import { useEffect, useState } from "react";
import { acknowledgeNotice, getNotice, type NoticeState } from "../../../lib/performanceApi";

/** Shown until the person acknowledges the current data-use notice. Never blocks the page. */
export default function NoticeBanner({ initial }: { initial?: NoticeState | null } = {}) {
  const [n, setN] = useState<NoticeState | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initial !== undefined) return; // the page already loaded it
    let cancelled = false;
    getNotice().then((d) => !cancelled && setN(d)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initial]);
  if (!n || n.acknowledged) return null;
  return (
    <section aria-labelledby="notice-h" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <h2 id="notice-h" className="font-bold text-amber-900">How your performance data is used</h2>
      <p className="mt-1 text-amber-900">{n.text}</p>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      <button
        onClick={() => acknowledgeNotice().then(setN).catch((e) => setError(e instanceof Error ? e.message : "Couldn't save that."))}
        className="mt-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
      >
        I've read this
      </button>
    </section>
  );
}
