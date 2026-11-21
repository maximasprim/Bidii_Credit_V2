import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import {
  createRatingScale,
  getRatingScales,
  previewRatingScale,
  type CategoryBand,
  type RatingBand,
  type RatingScale,
  type ScalePreview,
} from "../../lib/performanceApi";
import { CategoryLegend } from "./CategoryBadge";

const input = "rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;

type Draft = {
  effectiveFrom: string;
  categories: CategoryBand[];
  bands: RatingBand[];
  pi: Record<string, number>;
  note: string;
};

const num = (v: string) => (v === "" ? 0 : Number(v));

function nextMonthStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Effective-dated category thresholds. Past scales are never edited: a change is saved as a
 * NEW scale with a later start date, so reports for closed periods never change silently.
 */
export default function RatingScaleEditor() {
  const [scales, setScales] = useState<RatingScale[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sample, setSample] = useState("");
  const [preview, setPreview] = useState<ScalePreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRatingScales()
      .then((res) => {
        if (cancelled) return;
        setScales(res.items);
        const current = res.items.find((s) => s.is_current) ?? res.items[0];
        setDraft((prev) =>
          prev ?? {
            effectiveFrom: nextMonthStart(),
            categories: current.categories,
            bands: current.rating_bands,
            pi: current.rating_to_pi,
            note: "",
          },
        );
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load rating scales.");
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (error)
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    );
  if (!draft) return <p className="text-sm text-ink-500">Loading rating scales…</p>;

  const current = scales.find((s) => s.is_current) ?? scales[0];
  const label = (key: string) => current.categories.find((c) => c.key === key)?.label ?? key;

  async function runPreview() {
    if (!draft) return;
    const scores = sample
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    setBusy(true);
    setMsg(null);
    try {
      setPreview(await previewRatingScale(draft.categories, scores));
    } catch (e) {
      setPreview(null);
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't preview." });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      await createRatingScale({
        effective_from: draft.effectiveFrom,
        categories: draft.categories,
        rating_bands: draft.bands,
        rating_to_pi: draft.pi,
        note: draft.note.trim() || null,
      });
      setMsg({ ok: true, text: "New scale saved. It applies to periods ending on or after its start date; earlier periods keep the scale they had." });
      setDraft(null);
      setPreview(null);
      setTick((t) => t + 1);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Rating scales (history)</h2>
        <p className="mb-4 text-xs text-ink-500">
          Each period is categorised with the scale in force on its last day. Past scales are never edited.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Rating scales by start date</caption>
            <thead>
              <tr className="text-xs text-ink-500">
                <th scope="col" className="py-2 pr-3">Starts</th>
                <th scope="col" className="py-2 pr-3">Category minimums (Above / Meeting / Approaching)</th>
                <th scope="col" className="py-2 pr-3">Note</th>
                <th scope="col" className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {scales.map((s) => (
                <tr key={s.id} className="border-t border-mist-200 text-ink-700">
                  <td className="py-2 pr-3">{s.effective_from}</td>
                  <td className="py-2 pr-3">{s.categories.slice(0, 3).map((c) => c.min_score).join(" / ")}</td>
                  <td className="py-2 pr-3">{s.note ?? "—"}</td>
                  <td className="py-2 pr-3">{s.is_current ? "In force" : new Date(s.effective_from) > new Date() ? "Scheduled" : "Superseded"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4"><CategoryLegend categories={current.categories} /></div>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Create a new scale</h2>
        <p className="mb-4 text-xs text-ink-500">
          A score at or above a category's minimum falls in that category. Minimums must decrease from top to bottom and the lowest is always 0.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-ink-500 sm:col-span-2">
            Takes effect on
            <input type="date" className={`${input} mt-1 w-full`} value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} />
          </label>
          <label className="text-xs text-ink-500 sm:col-span-2">
            Note (why)
            <input className={`${input} mt-1 w-full`} maxLength={300} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          {draft.categories.map((c, i) => (
            <label key={c.key} className="text-xs text-ink-500">
              {c.label}: minimum score
              <input
                type="number"
                className={`${input} mt-1 w-full`}
                value={c.min_score}
                disabled={i === draft.categories.length - 1}
                onChange={(e) => setDraft({ ...draft, categories: draft.categories.map((x, j) => (j === i ? { ...x, min_score: num(e.target.value) } : x)) })}
              />
            </label>
          ))}
        </div>

        <h3 className="mb-2 mt-5 text-xs font-bold text-ink-700">Achievement % to appraisal rating (1-5)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {draft.bands.map((b, i) => (
            <label key={b.rating} className="text-xs text-ink-500">
              {b.rating} {b.label}: from %
              <input
                type="number"
                className={`${input} mt-1 w-full`}
                value={b.min_pct}
                disabled={i === draft.bands.length - 1}
                onChange={(e) => setDraft({ ...draft, bands: draft.bands.map((x, j) => (j === i ? { ...x, min_pct: num(e.target.value) } : x)) })}
              />
            </label>
          ))}
        </div>

        <h3 className="mb-2 mt-5 text-xs font-bold text-ink-700">Rating to performance index</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {["5", "4", "3", "2", "1"].map((r) => (
            <label key={r} className="text-xs text-ink-500">
              Rating {r} counts as
              <input type="number" className={`${input} mt-1 w-full`} value={draft.pi[r] ?? 0} onChange={(e) => setDraft({ ...draft, pi: { ...draft.pi, [r]: num(e.target.value) } })} />
            </label>
          ))}
        </div>

        <h3 className="mb-2 mt-5 text-xs font-bold text-ink-700">Preview before saving</h3>
        <p className="mb-2 text-xs text-ink-500">
          Paste sample scores (for example last quarter's) to see how these thresholds would re-categorise them. Last-quarter scores will be filled in automatically once dashboards are live.
        </p>
        <div className="flex flex-wrap gap-2">
          <input className={`${input} min-w-0 flex-1`} placeholder="e.g. 125, 108, 92, 74, 55" value={sample} onChange={(e) => setSample(e.target.value)} aria-label="Sample scores" />
          <button type="button" onClick={() => void runPreview()} disabled={busy || sample.trim() === ""} className="rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50">
            Preview
          </button>
        </div>
        {preview && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Staff per category before and after the change</caption>
              <thead>
                <tr className="text-xs text-ink-500">
                  <th scope="col" className="py-1.5 pr-3">Category</th>
                  <th scope="col" className="py-1.5 pr-3">Now</th>
                  <th scope="col" className="py-1.5 pr-3">With change</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(preview.before) as (keyof ScalePreview["before"])[]).map((k) => (
                  <tr key={k} className="border-t border-mist-200 text-ink-700">
                    <td className="py-1.5 pr-3">{label(k)}</td>
                    <td className="py-1.5 pr-3">{preview.before[k]}</td>
                    <td className="py-1.5 pr-3">{preview.after[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-500">{preview.moved} of {preview.total} would change category.</p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--color-ink-900)" }}>
            Save new scale
          </button>
          {msg && (
            <span className={`flex items-center gap-1.5 text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>
              {msg.ok ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
