import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, Lock, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { usePageMeta } from "../../lib/usePageMeta";
import {
  downloadAppraisalTemplate,
  downloadAppraisalTemplateDocx,
  extractJD,
  getJDOptions,
  getRoleJD,
  getRoleVersions,
  saveRoleJD,
  suggestKpis,
  type AIMeta,
  type JDOptions,
  type JDResponsibility,
  type JobDescription,
  type Kpi,
  type RoleVersion,
  type VersionSummary,
} from "../../lib/performanceApi";
import { usePerformanceCapabilities } from "../../lib/usePerformanceCapabilities";

const input = "w-full rounded-lg border border-mist-200 bg-surface px-3 py-2 text-sm text-ink-700 focus:outline-none disabled:opacity-60";
const card = "rounded-2xl border border-mist-200 bg-surface p-5";
const heading = { color: "var(--color-ink-900)" } as const;
const btn = "inline-flex items-center gap-1.5 rounded-lg border border-mist-200 px-3 py-2 text-sm font-semibold text-ink-700 disabled:opacity-50";

const STEP_LABEL: Record<string, string> = { staff: "Staff", manager: "Manager", csm: "CSM", rm_gm: "RM / GM", hr: "HR", ceo: "CEO" };
const OPTIONAL_STEPS = ["csm", "rm_gm", "hr"];

const blankResponsibility = (): JDResponsibility => ({ title: "", weight_pct: 0, description: "", criteria: [] });
const blankKpi = (): Kpi => ({
  key: "", label: "", description: null, unit: "rating", direction: "higher", weight: 0,
  source: "appraisal_rating", frequency: "quarterly", cap_pct: null, jd_section: null,
});

const num = (v: string) => (v === "" ? 0 : Number(v));
const lines = (v: string) => v.split("\n");
const total = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

type Draft = { jd: JobDescription; kpis: Kpi[]; chain: string[]; ceo: boolean; note: string };

function toDraft(v: RoleVersion): Draft {
  return { jd: v.jd, kpis: v.kpis, chain: v.signoff_chain, ceo: v.requires_ceo_signoff, note: v.note ?? "" };
}

function Total({ label, value }: { label: string; value: number }) {
  const ok = Math.abs(value - 100) <= 0.01;
  return (
    <p role="status" className={`mt-2 text-xs font-semibold ${ok ? "text-green-700" : "text-amber-700"}`}>
      {label}: {value}% {ok ? "✓" : "- must total 100"}
    </p>
  );
}

export default function AdminPerformanceRole() {
  usePageMeta("Job role - JD & KPIs");
  const { roleId = "" } = useParams();
  const navigate = useNavigate();
  const { can, ready } = usePerformanceCapabilities();
  const canEdit = can("roles.jd");
  const fileRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<JDOptions | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loaded, setLoaded] = useState<RoleVersion | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<number | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiNote, setAiNote] = useState<{ meta: AIMeta | null; warnings: string[]; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRoleJD(roleId, viewing), getRoleVersions(roleId), getJDOptions()])
      .then(([v, vs, o]) => {
        if (cancelled) return;
        setLoaded(v);
        setDraft(toDraft(v));
        setVersions(vs.items);
        setOptions(o);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load this role.");
      });
    return () => {
      cancelled = true;
    };
  }, [roleId, viewing, tick]);

  if (error)
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} /> {error}
      </div>
    );
  if (!loaded || !draft || !options) return <p className="text-sm text-ink-500">Loading…</p>;

  const readOnly = !canEdit || !loaded.is_latest;
  const { jd } = draft;
  const setJd = (patch: Partial<JobDescription>) => setDraft({ ...draft, jd: { ...jd, ...patch } });
  const setResp = (i: number, patch: Partial<JDResponsibility>) =>
    setJd({ responsibilities: jd.responsibilities.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setKpi = (i: number, patch: Partial<Kpi>) => setDraft({ ...draft, kpis: draft.kpis.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const respTotal = total(jd.responsibilities.map((r) => r.weight_pct));
  const kpiTotal = total(draft.kpis.map((k) => k.weight));
  const fullChain = [...draft.chain, ...(draft.ceo ? ["ceo"] : [])];

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await extractJD(file);
      setDraft((d) => (d ? { ...d, jd: { ...res.jd, competencies: res.jd.competencies.length ? res.jd.competencies : d.jd.competencies } } : d));
      setAiNote({ meta: res.ai, warnings: res.warnings, text: "Draft filled in from your file. Nothing is saved until you press Save." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't read that file." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSuggest() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await suggestKpis(jd.responsibilities.filter((r) => r.title.trim() !== ""), true);
      setDraft((d) => (d ? { ...d, kpis: res.kpis } : d));
      setAiNote({
        meta: res.ai,
        warnings: res.warnings,
        text: res.ai_used
          ? "KPIs proposed by AI. Weights are calculated from your responsibility weights, not by the AI."
          : `Proposed from the responsibilities (${res.fallback_reason ?? "AI unavailable"}). Edit them as needed.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't suggest KPIs." });
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      const saved = await saveRoleJD(roleId, {
        jd: draft.jd,
        kpis: draft.kpis.map((k) => ({ ...k, key: k.key.trim() })),
        signoff_chain: draft.chain,
        requires_ceo_signoff: draft.ceo,
        note: draft.note.trim() || null,
      });
      setMsg({
        ok: true,
        text: saved.created_new_version
          ? `Saved as version ${saved.version}. The previous version is kept unchanged for periods already scored with it.`
          : `Saved (version ${saved.version}).`,
      });
      setAiNote(null);
      setViewing(undefined);
      setTick((t) => t + 1);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/performance-settings" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-500">
          <ArrowLeft size={14} /> Performance settings
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold" style={heading}>{loaded.role_name}</h1>
            <p className="text-sm text-ink-500">
              {loaded.version === 0 ? "No job description saved yet" : `Version ${loaded.version}${loaded.is_latest ? " (current)" : " (older, read-only)"}`}
              {loaded.locked && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs"><Lock size={12} /> used in scoring - edits create a new version</span>
              )}
            </p>
          </div>
          {loaded.version > 0 && (
            <p className="flex flex-wrap gap-3 text-xs font-semibold text-ink-700">
              <button type="button" className="underline" onClick={() => void downloadAppraisalTemplate(roleId, loaded.role_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).catch(() => undefined)}>Blank form (PDF)</button>
              <button type="button" className="underline" onClick={() => void downloadAppraisalTemplateDocx(roleId, loaded.role_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).catch(() => undefined)}>Blank form (Word)</button>
            </p>
          )}
          {versions.length > 1 && (
            <label className="text-xs text-ink-500">
              View version
              <select className={`${input} mt-1`} value={viewing ?? ""} onChange={(e) => setViewing(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Current</option>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    v{v.version}{v.is_latest ? " (current)" : ""} - {new Date(v.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!loaded.configured && loaded.is_latest && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            This role can't be used for scoring yet: its KPI weights must total 100.
          </p>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="sr-only" id="jd-file" onChange={(e) => void onFile(e.target.files?.[0])} />
          <label htmlFor="jd-file" className={`${btn} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <Upload size={14} /> Upload a JD (PDF or DOCX) to draft with AI
          </label>
          <button type="button" className={btn} disabled={busy || jd.responsibilities.length === 0} onClick={() => void onSuggest()}>
            <Sparkles size={14} /> Suggest KPIs
          </button>
        </div>
      )}

      {aiNote && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">AI-generated; review before saving</p>
          <p className="mt-1 text-xs">{aiNote.text}</p>
          {aiNote.meta && <p className="mt-1 text-xs">{aiNote.meta.provider} · {aiNote.meta.model} · {aiNote.meta.prompt_version}{aiNote.meta.cached ? " · cached" : ""}</p>}
          {aiNote.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{aiNote.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}

      <section className={card}>
        <h2 className="mb-4 font-display text-sm font-bold" style={heading}>Position details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([["title", "Position title"], ["reports_to", "Reports to"], ["branch", "Branch"], ["department", "Department"], ["grade", "Grade"], ["date", "Date"]] as const).map(([k, label]) => (
            <label key={k} className="text-xs text-ink-500">
              {label}
              <input className={`${input} mt-1`} value={jd[k]} disabled={readOnly} maxLength={150} onChange={(e) => setJd({ [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <label className="mt-3 block text-xs text-ink-500">
          Overall role purpose
          <textarea className={`${input} mt-1`} rows={3} value={jd.purpose} disabled={readOnly} maxLength={3000} onChange={(e) => setJd({ purpose: e.target.value })} />
        </label>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Key responsibilities (% of time)</h2>
        <p className="mb-3 text-xs text-ink-500">One line of measurement criteria per row. Weights must total 100.</p>
        <div className="space-y-3">
          {jd.responsibilities.map((r, i) => (
            <div key={i} className="rounded-xl border border-mist-200 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto]">
                <label className="text-xs text-ink-500">
                  Responsibility {i + 1}
                  <input className={`${input} mt-1`} value={r.title} disabled={readOnly} maxLength={200} onChange={(e) => setResp(i, { title: e.target.value })} />
                </label>
                <label className="text-xs text-ink-500">
                  % of time
                  <input type="number" className={`${input} mt-1`} value={r.weight_pct} disabled={readOnly} onChange={(e) => setResp(i, { weight_pct: num(e.target.value) })} />
                </label>
                {!readOnly && (
                  <button type="button" aria-label={`Remove responsibility ${i + 1}`} className="self-end rounded-full p-2 text-red-500 hover:bg-red-50" onClick={() => setJd({ responsibilities: jd.responsibilities.filter((_, j) => j !== i) })}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <label className="mt-2 block text-xs text-ink-500">
                What the role does
                <textarea className={`${input} mt-1`} rows={2} value={r.description} disabled={readOnly} onChange={(e) => setResp(i, { description: e.target.value })} />
              </label>
              <label className="mt-2 block text-xs text-ink-500">
                Performance measurement criteria (one per line)
                <textarea className={`${input} mt-1`} rows={2} value={r.criteria.join("\n")} disabled={readOnly} onChange={(e) => setResp(i, { criteria: lines(e.target.value) })} />
              </label>
            </div>
          ))}
        </div>
        {!readOnly && (
          <button type="button" className={`${btn} mt-3`} onClick={() => setJd({ responsibilities: [...jd.responsibilities, blankResponsibility()] })}>
            <Plus size={14} /> Add responsibility
          </button>
        )}
        {jd.responsibilities.length > 0 && <Total label="Responsibility weights" value={respTotal} />}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>KPIs</h2>
        <p className="mb-3 text-xs text-ink-500">How the role is scored. Weights must total 100. Leave the key empty to generate it from the name.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">KPIs for this role</caption>
            <thead>
              <tr className="text-xs text-ink-500">
                {["Name", "Unit", "Better when", "Weight %", "Source", "How often", "Cap %", "Measures responsibility", ""].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.kpis.map((k, i) => (
                <tr key={i} className="border-t border-mist-200 align-top">
                  <td className="py-2 pr-2">
                    <input aria-label={`KPI ${i + 1} name`} className={input} value={k.label} disabled={readOnly} maxLength={200} onChange={(e) => setKpi(i, { label: e.target.value })} />
                    {k.key && <span className="mt-0.5 block text-[10px] text-ink-400">{k.key}</span>}
                  </td>
                  {([["unit", options.kpi_units], ["direction", options.kpi_directions]] as const).map(([f, opts]) => (
                    <td key={f} className="py-2 pr-2">
                      <select aria-label={`KPI ${i + 1} ${f}`} className={input} value={k[f]} disabled={readOnly} onChange={(e) => setKpi(i, { [f]: e.target.value })}>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                  ))}
                  <td className="py-2 pr-2">
                    <input aria-label={`KPI ${i + 1} weight`} type="number" className={`${input} w-20`} value={k.weight} disabled={readOnly} onChange={(e) => setKpi(i, { weight: num(e.target.value) })} />
                  </td>
                  {([["source", options.kpi_sources], ["frequency", options.kpi_frequencies]] as const).map(([f, opts]) => (
                    <td key={f} className="py-2 pr-2">
                      <select aria-label={`KPI ${i + 1} ${f}`} className={input} value={k[f]} disabled={readOnly} onChange={(e) => setKpi(i, { [f]: e.target.value })}>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                  ))}
                  <td className="py-2 pr-2">
                    <input aria-label={`KPI ${i + 1} cap`} type="number" placeholder="org" className={`${input} w-20`} value={k.cap_pct ?? ""} disabled={readOnly} onChange={(e) => setKpi(i, { cap_pct: e.target.value === "" ? null : Number(e.target.value) })} />
                  </td>
                  <td className="py-2 pr-2">
                    <select aria-label={`KPI ${i + 1} responsibility`} className={input} value={k.jd_section ?? ""} disabled={readOnly} onChange={(e) => setKpi(i, { jd_section: e.target.value || null })}>
                      <option value="">(none)</option>
                      {jd.responsibilities.filter((r) => r.title.trim()).map((r) => <option key={r.title} value={r.title}>{r.title}</option>)}
                    </select>
                  </td>
                  <td className="py-2">
                    {!readOnly && (
                      <button type="button" aria-label={`Remove KPI ${i + 1}`} className="rounded-full p-2 text-red-500 hover:bg-red-50" onClick={() => setDraft({ ...draft, kpis: draft.kpis.filter((_, j) => j !== i) })}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {draft.kpis.length === 0 && <p className="mt-2 text-xs text-ink-500">No KPIs yet. Add some, or use Suggest KPIs once you have responsibilities.</p>}
        {!readOnly && (
          <button type="button" className={`${btn} mt-3`} onClick={() => setDraft({ ...draft, kpis: [...draft.kpis, blankKpi()] })}>
            <Plus size={14} /> Add KPI
          </button>
        )}
        {draft.kpis.length > 0 && <Total label="KPI weights" value={kpiTotal} />}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-display text-sm font-bold" style={heading}>Appraisal sign-off</h2>
        <p className="mb-3 text-xs text-ink-500">The staff member and their manager always come first. Choose the further steps this role's appraisal goes through.</p>
        <div className="flex flex-wrap gap-4">
          {OPTIONAL_STEPS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={draft.chain.includes(s)}
                onChange={(e) =>
                  setDraft({ ...draft, chain: ["staff", "manager", ...OPTIONAL_STEPS.filter((o) => (o === s ? e.target.checked : draft.chain.includes(o)))] })
                }
              />
              {STEP_LABEL[s]}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" disabled={readOnly} checked={draft.ceo} onChange={(e) => setDraft({ ...draft, ceo: e.target.checked })} />
            CEO (senior roles)
          </label>
        </div>
        <p className="mt-3 text-xs text-ink-500">Order: {fullChain.map((s) => STEP_LABEL[s] ?? s).join(" → ")}</p>
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold" style={heading}>Behavioural competencies</h2>
          {!readOnly && (
            <button type="button" className={btn} onClick={() => setJd({ competencies: options.default_competencies })}>Use the six standard competencies</button>
          )}
        </div>
        <p className="mb-3 text-xs text-ink-500">Rated 1-5 by the manager and worth the competency share of the final score. Leave empty to score on KPIs alone.</p>
        <div className="space-y-2">
          {jd.competencies.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
              <input aria-label={`Competency ${i + 1} title`} className={input} value={c.title} disabled={readOnly} onChange={(e) => setJd({ competencies: jd.competencies.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <input aria-label={`Competency ${i + 1} description`} className={input} value={c.description} disabled={readOnly} onChange={(e) => setJd({ competencies: jd.competencies.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
              {!readOnly && (
                <button type="button" aria-label={`Remove competency ${i + 1}`} className="rounded-full p-2 text-red-500 hover:bg-red-50" onClick={() => setJd({ competencies: jd.competencies.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button type="button" className={`${btn} mt-3`} onClick={() => setJd({ competencies: [...jd.competencies, { title: "", description: "" }] })}>
            <Plus size={14} /> Add competency
          </button>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-4 font-display text-sm font-bold" style={heading}>Other responsibilities</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["mandates", "Decision-making mandates / constraints"], ["planning", "Planning responsibility"], ["relationships", "Relationship management"]] as const).map(([k, label]) => (
            <label key={k} className="text-xs text-ink-500">
              {label}
              <textarea className={`${input} mt-1`} rows={3} value={jd[k]} disabled={readOnly} maxLength={3000} onChange={(e) => setJd({ [k]: e.target.value })} />
            </label>
          ))}
          <label className="text-xs text-ink-500">
            Qualifications and experience (one per line)
            <textarea className={`${input} mt-1`} rows={3} value={jd.qualifications.join("\n")} disabled={readOnly} onChange={(e) => setJd({ qualifications: lines(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            JD approvals by job title (one per line)
            <textarea className={`${input} mt-1`} rows={2} value={jd.approvals.join("\n")} disabled={readOnly} onChange={(e) => setJd({ approvals: lines(e.target.value) })} />
          </label>
          <label className="text-xs text-ink-500">
            Next-quarter objective rows on the appraisal form (one per line)
            <textarea className={`${input} mt-1`} rows={2} value={jd.objective_rows.join("\n")} disabled={readOnly} onChange={(e) => setJd({ objective_rows: lines(e.target.value) })} />
          </label>
        </div>
      </section>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[240px] flex-1 text-xs text-ink-500">
            Note about this change (optional)
            <input className={`${input} mt-1`} maxLength={300} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          <button type="button" disabled={busy} onClick={() => void onSave()} className="self-end rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--color-ink-900)" }}>
            Save
          </button>
          <button type="button" className={`${btn} self-end`} onClick={() => navigate("/admin/performance-settings")}>Close</button>
        </div>
      ) : (
        <p className="text-xs text-ink-500">{canEdit ? "Switch back to the current version to edit." : ready ? "You don't have permission to edit job descriptions." : ""}</p>
      )}
      {msg && (
        <p role="status" className={`flex items-center gap-1.5 text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>
          {msg.ok ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
        </p>
      )}
    </div>
  );
}
