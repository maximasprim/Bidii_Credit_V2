import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Download, CheckCircle2, XCircle, MinusCircle, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { adminDownloadFile, adminPatch } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import ATSRecommendationBadge, { ATSScorePill } from "../../components/admin/ats/ATSScoreBadge";
import {
  addRecruiterNote,
  finalRecommendation,
  getVettingDetail,
  overrideRecommendation,
  screenApplication,
  type ATSCriterionOutcome,
  type ATSEvaluationMode,
  type ATSRecommendation,
  type ATSVettingDetail,
} from "../../lib/atsApi";

const STATUSES = ["received", "reviewing", "shortlisted", "rejected", "hired"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

function actionLabel(action: string) {
  return action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** For "screened" entries, surfaces which engine actually ran - pulled from
 *  the same `details` the backend already logs (evaluation_method, provider,
 *  model, manual_override, cv_text_used). Other action types get a short,
 *  relevant note where one applies (e.g. an AI failure falling back). */
function methodLabel(h: { action: string; details: Record<string, unknown> }): string | null {
  const d = h.details;
  if (h.action === "screened") {
    const method = d.evaluation_method as string | undefined;
    const override = d.manual_override ? " · manual override" : "";
    if (method === "ai") {
      const provider = d.provider as string | undefined;
      const model = d.model as string | undefined;
      const providerBit = provider ? ` - ${provider}${model ? ` (${model})` : ""}` : "";
      return `AI Evaluation${providerBit}${override}`;
    }
    if (method === "weighted") {
      const cvNote = d.cv_text_used === false ? " · CV text unavailable, cover note & role only" : "";
      return `Weighted Scoring${cvNote}${override}`;
    }
    return null;
  }
  if (h.action === "ai_fallback_to_weighted") {
    return "AI evaluation failed, fell back to Weighted Scoring";
  }
  if (h.action === "ai_evaluation_failed") {
    const provider = d.provider as string | undefined;
    return `AI Evaluation failed${provider ? ` (${provider})` : ""}`;
  }
  return null;
}

export default function AdminATSCandidate() {
  const { applicationId } = useParams<{ applicationId: string }>();
  usePageMeta("Candidate Vetting");

  const [detail, setDetail] = useState<ATSVettingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [screening, setScreening] = useState<"default" | "weighted" | "ai" | null>(null);

  const [overrideChoice, setOverrideChoice] = useState<ATSRecommendation>("review");
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  function load() {
    if (!applicationId) return;
    getVettingDetail(applicationId)
      .then((data) => { setDetail(data); setError(null); })
      .catch((err) => setError(err.message ?? "Couldn't load candidate."))
      .finally(() => setLoaded(true));
  }

  useEffect(load, [applicationId]);

  async function runScreen(method?: ATSEvaluationMode) {
    if (!applicationId) return;
    setScreening(method ?? "default");
    try {
      await screenApplication(applicationId, method);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't screen this application.");
    } finally {
      setScreening(null);
    }
  }

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!applicationId) return;
    setOverriding(true);
    try {
      await overrideRecommendation(applicationId, overrideChoice, overrideReason);
      setOverrideReason("");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't override recommendation.");
    } finally {
      setOverriding(false);
    }
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!applicationId || !noteText.trim()) return;
    setAddingNote(true);
    try {
      await addRecruiterNote(applicationId, noteText.trim());
      setNoteText("");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't add note.");
    } finally {
      setAddingNote(false);
    }
  }

  async function updateStatus(status: string) {
    if (!applicationId) return;
    setUpdatingStatus(true);
    try {
      await adminPatch(`/api/admin/career-applications/${applicationId}`, { status });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't update status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function downloadCv() {
    if (!detail) return;
    try {
      await adminDownloadFile(`/api/admin/career-applications/${detail.application.id}/cv`, detail.application.cv_original_filename);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't download CV.");
    }
  }

  if (!loaded) return <p className="text-sm text-ink-500">Loading…</p>;
  if (error) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }
  if (!detail) return null;

  const { application, job, screening: result, notes, history } = detail;
  const rec = finalRecommendation(result);

  return (
    <div>
      <Link to="/admin/ats" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
        <ArrowLeft size={13} />
        Back to candidate screening
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>{application.full_name}</h1>
          <p className="text-sm text-ink-500">{application.email} · {application.phone}</p>
          <p className="mt-1 text-sm text-ink-700">Applied for <strong>{application.role}</strong>{job && !job.is_open && " (posting now closed)"}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={application.status}
            disabled={updatingStatus}
            onChange={(e) => updateStatus(e.target.value)}
            className="rounded-lg border border-mist-200 bg-surface px-3 py-2 text-xs text-ink-700 focus:outline-none disabled:opacity-50"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={downloadCv}
            className="flex items-center gap-1.5 rounded-xl border border-mist-200 px-3 py-2 text-xs font-semibold text-ink-700"
          >
            <Download size={13} />
            Download CV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Cover note */}
          <Card title="Cover Note">
            <p className="whitespace-pre-wrap text-sm text-ink-700">{application.cover_note}</p>
          </Card>

          {/* ATS score */}
          <Card title="ATS Screening">
            {!result ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-500">
                  {application.job_id ? "This candidate hasn't been screened yet." : "General applications (no specific job) can't be scored."}
                </p>
                {application.job_id && (
                  <button
                    onClick={() => runScreen()}
                    disabled={screening !== null}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-ember-500)" }}
                  >
                    {screening === "default" ? "Screening…" : "Run screening"}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <ATSScorePill percentage={result.score_percentage} />
                  {rec && <ATSRecommendationBadge recommendation={rec} overridden={!!result.override_recommendation} />}
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: "var(--color-mist-100)", color: "var(--color-ink-700)" }}
                  >
                    {result.evaluation_method === "ai" ? <Sparkles size={11} /> : null}
                    {result.evaluation_method === "ai"
                      ? `AI (${result.ai_provider ?? "?"}${result.ai_model ? " · " + result.ai_model : ""})`
                      : "Weighted"}
                  </span>
                  <span className="text-xs text-ink-500">Scored {fmtDate(result.scored_at)}</span>
                  <div className="ml-auto flex items-center gap-3">
                    <button
                      onClick={() => runScreen()}
                      disabled={screening !== null}
                      className="text-xs font-semibold disabled:opacity-50"
                      style={{ color: "var(--color-ember-500)" }}
                    >
                      {screening === "default" ? "Re-screening…" : "Re-run screening"}
                    </button>
                    {result.evaluation_method === "ai" ? (
                      <button
                        onClick={() => runScreen("weighted")}
                        disabled={screening !== null}
                        title="Score this candidate with Weighted Scoring instead, without changing the job's default method"
                        className="text-xs font-semibold text-red-500 underline decoration-dotted disabled:opacity-50"
                      >
                        {screening === "weighted" ? "Screening…" : "Try Weighted Scoring instead"}
                      </button>
                    ) : (
                      <button
                        onClick={() => runScreen("ai")}
                        disabled={screening !== null}
                        title="Score this candidate with AI Evaluation instead, without changing the job's default method"
                        className="text-xs font-semibold text-green-500 underline decoration-dotted disabled:opacity-50"
                      >
                        {screening === "ai" ? "Screening…" : "Try AI Evaluation instead"}
                      </button>
                    )}
                  </div>
                </div>

                {result.ai_fallback_reason && (
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    AI Evaluation was unavailable for this run, so Weighted Scoring was used instead ({result.ai_fallback_reason}).
                  </p>
                )}

                {result.override_recommendation && (
                  <p className="mb-4 rounded-xl bg-mist-50 p-3 text-xs text-ink-700">
                    System recommendation was <strong>{result.system_recommendation.replace("_", " ")}</strong>, manually
                    overridden to <strong>{result.override_recommendation.replace("_", " ")}</strong>
                    {result.override_reason && <>: “{result.override_reason}”</>}
                  </p>
                )}

                {result.ai_explanation && (
                  <p className="mb-4 text-sm text-ink-700">{result.ai_explanation}</p>
                )}

                {(result.ai_strengths.length > 0 || result.ai_weaknesses.length > 0) && (
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {result.ai_strengths.length > 0 && (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          <ThumbsUp size={12} color="#16A34A" /> Strengths
                        </p>
                        <ul className="flex flex-col gap-1">
                          {result.ai_strengths.map((s, i) => (
                            <li key={i} className="text-sm text-ink-700">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.ai_weaknesses.length > 0 && (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                          <ThumbsDown size={12} color="#DC2626" /> Weaknesses
                        </p>
                        <ul className="flex flex-col gap-1">
                          {result.ai_weaknesses.map((s, i) => (
                            <li key={i} className="text-sm text-ink-700">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <CriteriaList label={result.evaluation_method === "ai" ? "Matched requirements" : "Matched criteria"} icon={<CheckCircle2 size={14} color="#16A34A" />} items={result.matched_criteria} />
                <CriteriaList label={result.evaluation_method === "ai" ? "Missing requirements" : "Missing criteria"} icon={<MinusCircle size={14} color="#D97706" />} items={result.missing_criteria} />
                {result.failed_mandatory_criteria.length > 0 && (
                  <CriteriaList label="Failed mandatory criteria" icon={<XCircle size={14} color="#DC2626" />} items={result.failed_mandatory_criteria} />
                )}
              </div>
            )}
          </Card>

          {/* Override */}
          {result && (
            <Card title="Override Recommendation">
              <form onSubmit={submitOverride} className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  <select
                    value={overrideChoice}
                    onChange={(e) => setOverrideChoice(e.target.value as ATSRecommendation)}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="review">Needs Review</option>
                    <option value="not_recommended">Not Recommended</option>
                  </select>
                </div>
                <textarea
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for this override - visible in the audit trail."
                  rows={2}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
                <button
                  type="submit"
                  disabled={overriding}
                  className="self-start rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-ember-500)" }}
                >
                  {overriding ? "Saving…" : "Save override"}
                </button>
              </form>
            </Card>
          )}

          {/* Recruiter notes */}
          <Card title="Recruiter Notes">
            <form onSubmit={submitNote} className="mb-4 flex flex-col gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a vetting note…"
                rows={2}
                className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
              />
              <button
                type="submit"
                disabled={addingNote || !noteText.trim()}
                className="self-start rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--color-ember-500)" }}
              >
                {addingNote ? "Adding…" : "Add note"}
              </button>
            </form>
            {notes.length === 0 ? (
              <p className="text-sm text-ink-500">No notes yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-xl bg-mist-50 p-3">
                    <p className="text-sm text-ink-700">{n.note}</p>
                    <p className="mt-1 text-xs text-ink-500">{n.admin_username ?? "Admin"} · {fmtDate(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Audit trail */}
        <Card title="Audit Trail">
          {history.length === 0 ? (
            <p className="text-sm text-ink-500">No activity yet.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {/* {history.map((h) => (
                <li key={h.id} className="border-l-2 pl-3" style={{ borderColor: "var(--color-mist-200)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>{actionLabel(h.action)}</p>
                  <p className="text-xs text-ink-500">{h.admin_username ?? "System"} · {fmtDate(h.created_at)}</p>
                </li>
              ))} */}
              {history.map((h) => (
                <li key={h.id} className="border-l-2 pl-3" style={{ borderColor: "var(--color-mist-200)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>{actionLabel(h.action)}</p>
                  {methodLabel(h) && (
                    <p className="text-xs" style={{ color: "var(--color-ember-600)" }}>{methodLabel(h)}</p>
                  )}
                  <p className="text-xs text-ink-500">{h.admin_username ?? "System"} · {fmtDate(h.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-mist-200 bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>{title}</h2>
      {children}
    </div>
  );
}

function CriteriaList({ label, icon, items }: { label: string; icon: React.ReactNode; items: ATSCriterionOutcome[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <ul className="flex flex-col gap-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
            <span className="mt-0.5">{icon}</span>
            <span>
              {c.label}
              {c.weight !== undefined && (
                <span className="text-xs text-ink-400"> ({c.weight} pts{c.is_required ? ", required" : ""})</span>
              )}
              {c.detail && <span className="block text-xs text-ink-500">{c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
