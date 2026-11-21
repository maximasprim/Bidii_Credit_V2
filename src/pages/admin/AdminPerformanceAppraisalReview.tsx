import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, Download, Upload } from "lucide-react";
import {
  confirmExtraction,
  discardExtraction,
  downloadAppraisalFile,
  extractAppraisalForm,
  getExtractionReview,
  uploadAppraisalForm,
  type ExtractionReview,
  type ReviewedValues,
} from "../../lib/performanceApi";
import { usePageMeta } from "../../lib/usePageMeta";

const input = "w-full rounded-lg border border-mist-200 bg-surface px-2 py-1.5 text-sm text-ink-700";
const btn = "rounded-full border border-mist-200 px-3.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";
const heading = { color: "var(--color-ink-900)" };
const RATINGS = [1, 2, 3, 4, 5];

type Msg = { ok: boolean; text: string } | null;
type Edit = { self_text: string; self_rating: string; manager_rating: string };

const toNum = (v: string) => (v === "" ? null : Number(v));

/** Upload a filled form, read it into a draft, then check it beside the original text before anything is saved. */
export default function AdminPerformanceAppraisalReview() {
  usePageMeta("Review filled appraisal form");
  const { appraisalId = "" } = useParams();
  const [review, setReview] = useState<ExtractionReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [comp, setComp] = useState<Record<string, { self_rating: string; manager_rating: string }>>({});
  const [needs, setNeeds] = useState<Record<number, string>>({});
  const [objectives, setObjectives] = useState<Record<string, string[]>>({});
  const [ticked, setTicked] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getExtractionReview(appraisalId);
      setReview(r);
      const d = r.draft;
      const e: Record<string, Edit> = {};
      r.rows.items.forEach((row) => {
        const x = d?.items.find((i) => i.kpi_key === row.kpi_key);
        e[row.kpi_key] = {
          self_text: x?.self_text ?? row.self_text ?? "",
          self_rating: String(x?.self_rating ?? row.self_rating ?? ""),
          manager_rating: String(x?.manager_rating ?? row.manager_rating ?? ""),
        };
      });
      setEdits(e);
      const c: Record<string, { self_rating: string; manager_rating: string }> = {};
      r.rows.competencies.forEach((row) => {
        const x = d?.competencies.find((i) => i.key === row.key);
        c[row.key] = { self_rating: String(x?.self_rating ?? row.self_rating ?? ""), manager_rating: String(x?.manager_rating ?? row.manager_rating ?? "") };
      });
      setComp(c);
      const n: Record<number, string> = {};
      r.rows.development_needs.forEach((row) => (n[row.slot] = d?.development_needs.find((i) => i.slot === row.slot)?.text ?? row.text ?? ""));
      setNeeds(n);
      const o: Record<string, string[]> = {};
      r.rows.objectives.forEach((row) => (o[row.label] = d?.objectives.find((i) => i.label === row.label)?.values ?? (row.values.length === 3 ? row.values : ["", "", ""])));
      setObjectives(o);
      setTicked(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this review.");
    }
  }, [appraisalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const low = useMemo(() => {
    const items = new Set((review?.draft?.items ?? []).filter((i) => i.low_confidence).map((i) => i.kpi_key));
    const comps = new Set((review?.draft?.competencies ?? []).filter((i) => i.low_confidence).map((i) => i.key));
    return { items, comps };
  }, [review]);

  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await fn();
      if (text) setMsg({ ok: true, text });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "That didn't work." });
    } finally {
      setBusy(false);
    }
  }

  function payload(): ReviewedValues {
    const mgr = !!review?.can_confirm_manager_column;
    return {
      confirm: ticked,
      items: Object.entries(edits).map(([kpi_key, v]) => ({ kpi_key, self_text: v.self_text || null, self_rating: toNum(v.self_rating), ...(mgr ? { manager_rating: toNum(v.manager_rating) } : {}) })),
      competencies: Object.entries(comp).map(([key, v]) => ({ key, self_rating: toNum(v.self_rating), ...(mgr ? { manager_rating: toNum(v.manager_rating) } : {}) })),
      objectives: Object.entries(objectives).map(([label, values]) => ({ label, values })),
      development_needs: Object.entries(needs).map(([slot, text]) => ({ slot: Number(slot), text: text || null })),
    };
  }

  if (error)
    return (
      <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    );
  if (!review) return <p role="status" className="text-sm text-ink-500">Loading…</p>;

  const status = review.extraction_status;
  const poorScan = review.ocr_confidence !== null && review.ocr_confidence < 70;
  const d = review.draft;
  const rating = (id: string, label: string, value: string, set: (v: string) => void, flagged: boolean) => (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} className={`${input} ${flagged ? "border-amber-400 bg-amber-50" : ""}`} value={value} onChange={(e) => set(e.target.value)}>
        <option value="">–</option>
        {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/admin/performance/appraisals/${appraisalId}`} className="mb-2 inline-block text-xs font-semibold text-ink-500">← Appraisal</Link>
        <h1 className="font-display text-lg font-bold" style={heading}>Filled form: review</h1>
        <p className="text-sm text-ink-500">Nothing counts until you have checked the values and confirmed. The original file stays attached.</p>
      </div>

      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-lg border p-3 text-sm ${msg.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <section className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="font-display text-sm font-bold" style={heading}>1. The file</h2>
        {review.file_name ? (
          <p className="mt-1 text-sm text-ink-700">
            Attached: {review.file_name}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void downloadAppraisalFile(appraisalId, review.file_kind ?? "pdf").catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't download." }))}>
              <Download size={12} className="inline" /> Download original
            </button>
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-500">No form uploaded yet. Use a PDF or Word (DOCX) file, or a photo or scan (PNG, JPG or a scanned PDF). Pictures are read on this server, never sent out as images; handwriting is read poorly, so check every value.</p>
        )}
        {review.can_confirm && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className={`${btn} inline-flex cursor-pointer items-center gap-1.5`}>
              <Upload size={13} /> {review.file_name ? "Replace file" : "Upload filled form"}
              <input
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void run(async () => (await uploadAppraisalForm(appraisalId, f)).message);
                }}
              />
            </label>
            {review.file_name && review.file_kind && ["pdf", "docx", "png", "jpg"].includes(review.file_kind) && (
              <button type="button" className={btn} disabled={busy} onClick={() => void run(async () => { await extractAppraisalForm(appraisalId, status === "extracted"); return "Draft prepared. Please check every row."; })}>
                {status === "extracted" ? "Read again" : "Read the form"}
              </button>
            )}
          </div>
        )}
        {status === "failed" && <p className="mt-2 text-xs text-amber-800">This form couldn't be read automatically (a clearer, upright scan of 200-300 dpi works best). It is still attached; please enter the appraisal by hand.</p>}
      </section>

      {status === "extracted" && d && (
        <>
          {review.ocr_confidence !== null && (
            <p role="note" className={`rounded-lg border p-3 text-xs ${poorScan ? "border-red-200 bg-red-50 text-red-800" : "border-mist-200 bg-mist-50 text-ink-700"}`}>
              This form is a picture, read at {review.ocr_confidence.toFixed(0)}% quality.{poorScan ? " That is low: the text on the left may be wrong, so compare each value with the original file." : " Handwriting in particular can be misread, so check the values."}
            </p>
          )}
          <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {d.ai.label}. Read by {d.ai.provider} ({d.ai.model}, {d.ai.prompt_version}){d.ai.cached ? ", from an earlier identical read" : ""}.
            {d.low_confidence_count > 0 ? ` ${d.low_confidence_count} value(s) are highlighted because the reading was unsure: check them against the original.` : ""}
            {d.warnings.length > 0 && ` ${d.warnings.join(" ")}`}
          </p>
          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="orig-h" className="rounded-2xl border border-mist-200 bg-surface p-5">
              <h2 id="orig-h" className="font-display text-sm font-bold" style={heading}>2. Original text</h2>
              {review.source_text ? (
                <pre className="mt-2 max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-lg bg-mist-50 p-3 text-xs text-ink-700" tabIndex={0}>{review.source_text}</pre>
              ) : (
                <p className="mt-2 text-sm text-ink-500">{review.source_text_note ?? "No text could be shown."}</p>
              )}
            </section>
            <section aria-labelledby="fields-h" className="space-y-4 rounded-2xl border border-mist-200 bg-surface p-5">
              <h2 id="fields-h" className="font-display text-sm font-bold" style={heading}>3. What was read (edit anything wrong)</h2>
              {review.rows.items.map((row) => {
                const e = edits[row.kpi_key];
                const flagged = low.items.has(row.kpi_key);
                return (
                  <fieldset key={row.kpi_key} className={`space-y-2 rounded-lg border p-3 ${flagged ? "border-amber-300" : "border-mist-200"}`}>
                    <legend className="px-1 text-xs font-semibold text-ink-700">{row.label} <span className="font-normal text-ink-400">weight {row.weight}%</span>{flagged ? " · check this" : ""}</legend>
                    <label htmlFor={`st-${row.kpi_key}`} className="text-xs text-ink-500">Self assessment</label>
                    <textarea id={`st-${row.kpi_key}`} className={input} rows={2} maxLength={4000} value={e?.self_text ?? ""} onChange={(ev) => setEdits({ ...edits, [row.kpi_key]: { ...e, self_text: ev.target.value } })} />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-ink-500">Self rating</p>
                        {rating(`sr-${row.kpi_key}`, `${row.label} self rating`, e?.self_rating ?? "", (v) => setEdits({ ...edits, [row.kpi_key]: { ...e, self_rating: v } }), flagged)}
                      </div>
                      {review.can_confirm_manager_column && (
                        <div>
                          <p className="text-xs text-ink-500">Manager rating</p>
                          {rating(`mr-${row.kpi_key}`, `${row.label} manager rating`, e?.manager_rating ?? "", (v) => setEdits({ ...edits, [row.kpi_key]: { ...e, manager_rating: v } }), flagged)}
                        </div>
                      )}
                    </div>
                  </fieldset>
                );
              })}
              {review.rows.competencies.length > 0 && (
                <fieldset className="space-y-2 rounded-lg border border-mist-200 p-3">
                  <legend className="px-1 text-xs font-semibold text-ink-700">Behavioural competencies</legend>
                  {review.rows.competencies.map((row) => (
                    <div key={row.key} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm">
                      <span className={low.comps.has(row.key) ? "font-semibold text-amber-800" : "text-ink-700"}>{row.title}</span>
                      {rating(`cs-${row.key}`, `${row.title} self rating`, comp[row.key]?.self_rating ?? "", (v) => setComp({ ...comp, [row.key]: { ...comp[row.key], self_rating: v } }), low.comps.has(row.key))}
                      {review.can_confirm_manager_column ? rating(`cm-${row.key}`, `${row.title} manager rating`, comp[row.key]?.manager_rating ?? "", (v) => setComp({ ...comp, [row.key]: { ...comp[row.key], manager_rating: v } }), low.comps.has(row.key)) : <span />}
                    </div>
                  ))}
                </fieldset>
              )}
              {review.rows.objectives.length > 0 && (
                <fieldset className="space-y-2 rounded-lg border border-mist-200 p-3">
                  <legend className="px-1 text-xs font-semibold text-ink-700">Objectives for the next 3 months</legend>
                  {review.rows.objectives.map((row) => (
                    <div key={row.label}>
                      <p className="text-xs text-ink-500">{row.label}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i}>
                            <label htmlFor={`ob-${row.label}-${i}`} className="sr-only">{row.label}, month {i + 1}</label>
                            <input id={`ob-${row.label}-${i}`} className={input} maxLength={300} value={objectives[row.label]?.[i] ?? ""} onChange={(ev) => setObjectives({ ...objectives, [row.label]: (objectives[row.label] ?? ["", "", ""]).map((x, k) => (k === i ? ev.target.value : x)) })} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </fieldset>
              )}
              <fieldset className="space-y-2 rounded-lg border border-mist-200 p-3">
                <legend className="px-1 text-xs font-semibold text-ink-700">Training and development needs</legend>
                {review.rows.development_needs.map((row) => (
                  <div key={row.slot}>
                    <label htmlFor={`need-${row.slot}`} className="text-xs text-ink-500">Need {row.slot}</label>
                    <input id={`need-${row.slot}`} className={input} maxLength={1000} value={needs[row.slot] ?? ""} onChange={(ev) => setNeeds({ ...needs, [row.slot]: ev.target.value })} />
                  </div>
                ))}
              </fieldset>
              {Object.keys(d.comments).length > 0 && (
                <div className="text-xs text-ink-600">
                  <p className="font-semibold">Comments found on the form (for reference only, not saved):</p>
                  <ul className="list-disc pl-5">{Object.entries(d.comments).map(([who, text]) => <li key={who}>{who}: {text}</li>)}</ul>
                </div>
              )}
            </section>
          </div>
          {review.can_confirm && (
            <section className="space-y-3 rounded-2xl border border-mist-200 bg-surface p-5">
              <label className="flex items-start gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-0.5" />
                I have checked these values against the original form and they are correct.
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${btn} bg-ink-900 text-white hover:bg-ink-800`} disabled={busy || !ticked} onClick={() => void run(async () => (await confirmExtraction(appraisalId, payload())).message)}>
                  Confirm and save to the appraisal
                </button>
                <button type="button" className={btn} disabled={busy} onClick={() => void run(async () => (await discardExtraction(appraisalId)).message)}>Discard draft</button>
              </div>
            </section>
          )}
        </>
      )}
      {status === "confirmed" && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Confirmed. The values are on the appraisal and the normal sign-off steps continue.</p>}
    </div>
  );
}
