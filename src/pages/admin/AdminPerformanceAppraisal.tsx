import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, Check, Download } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import {
  acknowledgeAppraisal,
  disputeAppraisal,
  downloadAppraisalPdf,
  getAppraisal,
  reopenAppraisal,
  resolveDispute,
  saveAppraisalForm,
  signAppraisal,
  submitAppraisal,
  type Appraisal,
  type AppraisalFormSave,
} from "../../lib/performanceApi";

const input = "w-full rounded-lg border border-mist-200 bg-surface px-2.5 py-1.5 text-sm text-ink-700 focus:outline-none disabled:bg-transparent disabled:opacity-100";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";
const RATING = ["Outstanding", "Excellent", "Good", "Average", "Poor"]; // 5 .. 1
const RATING_GUIDE = "5 Outstanding (>120%) · 4 Excellent (100-120%) · 3 Good (80-100%) · 2 Average (60-80%) · 1 Poor (<60%)";

type Draft = {
  items: Record<string, { self_text: string; self_rating: number | null; manager_rating: number | null }>;
  comps: Record<string, { self_rating: number | null; manager_rating: number | null }>;
  objectives: Record<string, string[]>;
  needs: Record<number, string>;
};

function toDraft(a: Appraisal): Draft {
  return {
    items: Object.fromEntries(a.items.map((i) => [i.kpi_key, { self_text: i.self_text ?? "", self_rating: i.self_rating, manager_rating: i.manager_rating }])),
    comps: Object.fromEntries(a.competencies.map((c) => [c.key, { self_rating: c.self_rating, manager_rating: c.manager_rating }])),
    objectives: Object.fromEntries(a.objectives.map((o) => [o.label, o.values])),
    needs: Object.fromEntries(a.development_needs.map((n) => [n.slot, n.text ?? ""])),
  };
}

function RatingSelect({ label, value, onChange, disabled }: { label: string; value: number | null; onChange: (v: number | null) => void; disabled: boolean }) {
  return (
    <select aria-label={label} className={input} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
      <option value="">—</option>
      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} - {RATING[5 - n]}</option>)}
    </select>
  );
}

export default function AdminPerformanceAppraisal() {
  usePageMeta("Appraisal");
  const { appraisalId = "" } = useParams();
  const [a, setA] = useState<Appraisal | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [disputeItem, setDisputeItem] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [resolution, setResolution] = useState<Record<string, { text: string; rating: string }>>({});
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAppraisal(appraisalId)
      .then((res) => {
        if (cancelled) return;
        setA(res);
        setDraft(toDraft(res));
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the appraisal.");
      });
    return () => {
      cancelled = true;
    };
  }, [appraisalId, tick]);

  if (error)
    return (
      <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    );
  if (!a || !draft) return <p className="text-sm text-ink-500">Loading…</p>;

  const perms = a.permissions;
  const can = (f: string) => perms.editable.includes(f);
  const setItem = (k: string, patch: Partial<Draft["items"][string]>) => setDraft({ ...draft, items: { ...draft.items, [k]: { ...draft.items[k], ...patch } } });
  const setComp = (k: string, patch: Partial<Draft["comps"][string]>) => setDraft({ ...draft, comps: { ...draft.comps, [k]: { ...draft.comps[k], ...patch } } });

  function payload(): AppraisalFormSave {
    if (!a || !draft) return {};
    const staffStep = can("self_rating");
    return {
      items: a.items.map((i) => (staffStep
        ? { kpi_key: i.kpi_key, self_text: draft.items[i.kpi_key].self_text, self_rating: draft.items[i.kpi_key].self_rating }
        : { kpi_key: i.kpi_key, manager_rating: draft.items[i.kpi_key].manager_rating })),
      competencies: a.competencies.map((c) => (staffStep ? { key: c.key, self_rating: draft.comps[c.key].self_rating } : { key: c.key, manager_rating: draft.comps[c.key].manager_rating })),
      objectives: a.objectives.map((o) => ({ label: o.label, values: draft.objectives[o.label] })),
      development_needs: a.development_needs.map((n) => ({ slot: n.slot, text: draft.needs[n.slot] || null })),
    };
  }

  async function run(action: () => Promise<{ message: string; data: Appraisal }>, saveFirst = false) {
    setBusy(true);
    setMsg(null);
    try {
      if (saveFirst && perms.can_edit) await saveAppraisalForm(appraisalId, payload());
      const res = await action();
      setA(res.data);
      setDraft(toDraft(res.data));
      setMsg({ ok: true, text: res.message });
      setComment("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "That didn't work." });
    } finally {
      setBusy(false);
    }
  }

  const label = (k: string | null) => (k === null ? "the overall rating" : a.items.find((i) => i.kpi_key === k)?.label ?? k);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance/appraisals" className="mb-2 inline-block text-xs font-semibold text-ink-500">← Appraisals</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-bold" style={heading}>{a.profile.full_name} - {a.period_label}</h1>
            <p className="text-sm text-ink-500">
              {[a.profile.role_name, a.profile.unit_name, a.profile.manager_name ? `Reports to ${a.profile.manager_name}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" className={`${btn} inline-flex items-center gap-1.5`} onClick={() => void downloadAppraisalPdf(a.id).catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't download." }))}>
            <Download size={14} /> Printable PDF
          </button>
          {a.status !== "finalised" && <Link to={`/admin/performance/appraisals/${a.id}/review`} className={`${btn} inline-flex items-center gap-1.5`}>Upload a filled form</Link>}
        </div>
        <ol className="mt-4 flex flex-wrap gap-2" aria-label="Sign-off progress">
          {a.chain.map((c) => (
            <li key={c.step} className={`rounded-full border px-3 py-1 text-xs font-semibold ${c.state === "done" ? "border-green-300 bg-green-50 text-green-800" : c.state === "current" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-mist-200 text-ink-500"}`}>
              {c.state === "done" ? "✓ " : ""}{c.label}{c.state === "current" ? " (now)" : ""}
            </li>
          ))}
        </ol>
        {a.status === "finalised" && a.final_weighted_rating !== null && (
          <p className="mt-3 text-sm font-semibold text-ink-900">Final weighted rating: {a.final_weighted_rating.toFixed(2)} out of 5</p>
        )}
      </div>

      {msg && (
        <p role="status" className={`flex items-center gap-1.5 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
          {msg.ok ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
        </p>
      )}

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Performance against objectives</h2>
        <p className="mb-3 text-xs text-ink-500">{RATING_GUIDE}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Appraisal form</caption>
            <thead>
              <tr className="text-xs text-ink-500">
                <th scope="col" className="py-2 pr-2">A. Job objectives</th><th scope="col" className="py-2 pr-2">B. % weight</th><th scope="col" className="py-2 pr-2">C. Measurement criteria</th>
                <th scope="col" className="py-2 pr-2">D. Self assessment</th><th scope="col" className="py-2 pr-2">E. Rating</th><th scope="col" className="py-2 pr-2">F. Weighted (B×E)</th>
                <th scope="col" className="py-2 pr-2">G. Manager assessment</th>{a.status === "finalised" && <th scope="col" className="py-2">Final</th>}
              </tr>
            </thead>
            <tbody>
              {a.items.map((i) => (
                <tr key={i.kpi_key} className="border-t border-mist-200 align-top text-ink-700">
                  <td className="py-2 pr-2 font-medium">{i.label}</td>
                  <td className="py-2 pr-2 tabular-nums">{i.weight}</td>
                  <td className="whitespace-pre-line py-2 pr-2 text-xs">{i.criteria ?? ""}</td>
                  <td className="w-64 py-2 pr-2">
                    <textarea aria-label={`${i.label} self assessment`} rows={3} maxLength={4000} className={input} disabled={!can("self_text")} value={draft.items[i.kpi_key].self_text} onChange={(e) => setItem(i.kpi_key, { self_text: e.target.value })} />
                  </td>
                  <td className="w-40 py-2 pr-2"><RatingSelect label={`${i.label} self rating`} value={draft.items[i.kpi_key].self_rating} disabled={!can("self_rating")} onChange={(v) => setItem(i.kpi_key, { self_rating: v })} /></td>
                  <td className="py-2 pr-2 tabular-nums">{draft.items[i.kpi_key].self_rating !== null ? ((i.weight * (draft.items[i.kpi_key].self_rating ?? 0)) / 100).toFixed(2) : ""}</td>
                  <td className="w-40 py-2 pr-2"><RatingSelect label={`${i.label} manager rating`} value={draft.items[i.kpi_key].manager_rating} disabled={!can("manager_rating")} onChange={(v) => setItem(i.kpi_key, { manager_rating: v })} /></td>
                  {a.status === "finalised" && <td className="py-2 tabular-nums">{i.final_rating?.toFixed(1) ?? ""}</td>}
                </tr>
              ))}
              <tr className="border-t border-mist-200 font-semibold text-ink-900">
                <td className="py-2 pr-2">Total</td><td className="py-2 pr-2 tabular-nums">{a.items.reduce((s, i) => s + i.weight, 0)}</td><td /><td />
                <td /><td className="py-2 pr-2 tabular-nums">{a.self_weighted_total?.toFixed(2) ?? ""}</td><td className="py-2 pr-2 tabular-nums">{a.manager_weighted_total?.toFixed(2) ?? ""}</td>{a.status === "finalised" && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {a.competencies.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Behavioural competencies</h2>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Competency ratings</caption>
            <thead><tr className="text-xs text-ink-500"><th scope="col" className="py-2 pr-3">Competency</th><th scope="col" className="py-2 pr-3">Self rating</th><th scope="col" className="py-2">Manager rating</th></tr></thead>
            <tbody>
              {a.competencies.map((c) => (
                <tr key={c.key} className="border-t border-mist-200 text-ink-700">
                  <td className="py-2 pr-3">{c.title}</td>
                  <td className="w-44 py-2 pr-3"><RatingSelect label={`${c.title} self rating`} value={draft.comps[c.key].self_rating} disabled={!can("competency_self_rating")} onChange={(v) => setComp(c.key, { self_rating: v })} /></td>
                  <td className="w-44 py-2"><RatingSelect label={`${c.title} manager rating`} value={draft.comps[c.key].manager_rating} disabled={!can("competency_manager_rating")} onChange={(v) => setComp(c.key, { manager_rating: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className={card}>
        <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Objectives for the next 3 months</h2>
        {a.objectives.length > 0 && (
          <table className="mb-5 w-full text-left text-sm">
            <caption className="sr-only">Objectives</caption>
            <thead><tr className="text-xs text-ink-500"><th scope="col" className="py-2 pr-3">Objective</th>{a.objective_months.map((m) => <th key={m} scope="col" className="py-2 pr-3">{m}</th>)}</tr></thead>
            <tbody>
              {a.objectives.map((o) => (
                <tr key={o.label} className="border-t border-mist-200 text-ink-700">
                  <td className="py-2 pr-3 font-medium">{o.label}</td>
                  {[0, 1, 2].map((m) => (
                    <td key={m} className="py-2 pr-3">
                      <input aria-label={`${o.label} ${a.objective_months[m]}`} className={input} maxLength={300} disabled={!can("objectives")} value={draft.objectives[o.label][m] ?? ""}
                        onChange={(e) => setDraft({ ...draft, objectives: { ...draft.objectives, [o.label]: draft.objectives[o.label].map((v, j) => (j === m ? e.target.value : v)) } })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3 className="mb-2 text-sm font-semibold text-ink-900">Training and development needs</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {a.development_needs.map((n) => (
            <label key={n.slot} className="text-xs text-ink-500">Need {n.slot}
              <textarea className={`${input} mt-1`} rows={2} maxLength={1000} disabled={!can("development_needs")} value={draft.needs[n.slot] ?? ""} onChange={(e) => setDraft({ ...draft, needs: { ...draft.needs, [n.slot]: e.target.value } })} />
            </label>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Comments and sign-off</h2>
        {a.signoffs.length === 0 ? <p className="mb-3 text-sm text-ink-500">Nobody has signed yet.</p> : (
          <ul className="mb-4 space-y-2">
            {a.signoffs.map((s, idx) => (
              <li key={idx} className="rounded-xl border border-mist-200 p-3 text-sm text-ink-700">
                <strong>{s.label}</strong> {s.decision === "signed" ? "signed" : "returned it"} · {s.actor_username} · {new Date(s.signed_at).toLocaleDateString()}
                {s.comment && <span className="mt-1 block whitespace-pre-line text-ink-600">{s.comment}</span>}
              </li>
            ))}
          </ul>
        )}
        {(perms.can_sign || perms.can_return || perms.can_submit) && (
          <div>
            {(perms.can_sign || perms.can_return) && (
              <label className="mb-3 block text-xs text-ink-500">Your comment{perms.can_return ? " (required if you return it)" : ""}
                <textarea className={`${input} mt-1`} rows={3} maxLength={3000} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {perms.can_edit && <button type="button" className={btn} disabled={busy} onClick={() => void run(async () => ({ message: "Saved.", data: (await saveAppraisalForm(appraisalId, payload())).data }))}>Save</button>}
              {perms.can_submit && <button type="button" className={btn} disabled={busy} onClick={() => void run(() => submitAppraisal(appraisalId), true)}>Submit my self-assessment</button>}
              {perms.can_sign && <button type="button" className={btn} disabled={busy} onClick={() => void run(() => signAppraisal(appraisalId, "sign", comment), true)}>Sign and pass on</button>}
              {perms.can_return && <button type="button" className={btn} disabled={busy || comment.trim().length < 3} onClick={() => void run(() => signAppraisal(appraisalId, "return", comment))}>Return</button>}
            </div>
          </div>
        )}
        {perms.can_edit && !perms.can_submit && !perms.can_sign && (
          <button type="button" className={btn} disabled={busy} onClick={() => void run(async () => ({ message: "Saved.", data: (await saveAppraisalForm(appraisalId, payload())).data }))}>Save</button>
        )}
      </section>

      {(a.disputes.length > 0 || perms.can_dispute) && (
        <section className={card}>
          <h2 className="mb-3 font-display text-sm font-bold" style={heading}>Disputes</h2>
          {a.disputes.map((d) => (
            <div key={d.id} className="mb-3 rounded-xl border border-mist-200 p-3 text-sm text-ink-700">
              <p><strong>About {label(d.item_key)}</strong> · {d.raised_by_username} · {d.status === "open" ? "Open" : "Resolved"}</p>
              <p className="mt-1 whitespace-pre-line">{d.reason}</p>
              {d.resolution && <p className="mt-1 whitespace-pre-line text-ink-600">HR: {d.resolution}</p>}
              {d.status === "open" && perms.can_resolve && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-[200px] flex-1 text-xs text-ink-500">How it was resolved
                    <input className={`${input} mt-1`} maxLength={2000} value={resolution[d.id]?.text ?? ""} onChange={(e) => setResolution({ ...resolution, [d.id]: { text: e.target.value, rating: resolution[d.id]?.rating ?? "" } })} />
                  </label>
                  {d.item_key && (
                    <label className="text-xs text-ink-500">New manager rating (optional)
                      <select className={`${input} mt-1`} value={resolution[d.id]?.rating ?? ""} onChange={(e) => setResolution({ ...resolution, [d.id]: { text: resolution[d.id]?.text ?? "", rating: e.target.value } })}>
                        <option value="">Keep</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  )}
                  <button type="button" className={btn} disabled={busy || (resolution[d.id]?.text ?? "").trim().length < 3}
                    onClick={() => void run(() => resolveDispute(appraisalId, d.id, resolution[d.id].text, resolution[d.id].rating ? Number(resolution[d.id].rating) : null))}>Resolve</button>
                </div>
              )}
            </div>
          ))}
          {perms.can_dispute && (
            <div className="space-y-2">
              <p className="text-xs text-ink-500">If you disagree with a rating, tell HR why. It's reviewed before the appraisal is finalised.</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-ink-500">About
                  <select className={`${input} mt-1`} value={disputeItem} onChange={(e) => setDisputeItem(e.target.value)}>
                    <option value="">The overall rating</option>{a.items.map((i) => <option key={i.kpi_key} value={i.kpi_key}>{i.label}</option>)}
                  </select>
                </label>
                <label className="min-w-[240px] flex-1 text-xs text-ink-500">What you disagree with
                  <input className={`${input} mt-1`} maxLength={2000} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
                </label>
                <button type="button" className={btn} disabled={busy || disputeReason.trim().length < 5} onClick={() => void run(() => disputeAppraisal(appraisalId, disputeItem || null, disputeReason)).then(() => setDisputeReason(""))}>Send to HR</button>
              </div>
            </div>
          )}
        </section>
      )}

      {a.status === "finalised" && (
        <section className={card}>
          {a.acknowledged_at ? (
            <p className="text-sm text-ink-700">Acknowledged by {a.acknowledged_by_username} on {new Date(a.acknowledged_at).toLocaleDateString()}.</p>
          ) : perms.can_acknowledge ? (
            <button type="button" className={btn} disabled={busy} onClick={() => void run(() => acknowledgeAppraisal(appraisalId))}>I have read and acknowledge this appraisal</button>
          ) : (
            <p className="text-sm text-ink-500">Waiting for the staff member to acknowledge.</p>
          )}
          {perms.can_reopen && (
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="min-w-[240px] flex-1 text-xs text-ink-500">Reopen for review (reason required)
                <input className={`${input} mt-1`} maxLength={300} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
              </label>
              <button type="button" className={btn} disabled={busy || reopenReason.trim().length < 3} onClick={() => void run(() => reopenAppraisal(appraisalId, reopenReason)).then(() => { setReopenReason(""); setTick((t) => t + 1); })}>Reopen</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
