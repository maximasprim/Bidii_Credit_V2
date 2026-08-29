import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Plus, Trash2, Pencil, Check, X, Sparkles } from "lucide-react";
import { adminGet } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import {
  ATS_CATEGORY_LABELS,
  addATSCriterion,
  createJobATSConfiguration,
  deleteATSCriterion,
  generateATSCriteria,
  getAIProviderStatus,
  getJobATSConfiguration,
  updateATSConfiguration,
  updateATSCriterion,
  type AISuggestedCriterion,
  type ATSAIProviderName,
  type ATSAIProviderStatus,
  type ATSConfiguration,
  type ATSCriterion,
  type ATSCriterionCategory,
  type ATSCriterionInput,
  type ATSEvaluationMode,
} from "../../lib/atsApi";

type JobSummary = { id: string; title: string };

const CATEGORIES = Object.keys(ATS_CATEGORY_LABELS) as ATSCriterionCategory[];

const emptyCriterion: ATSCriterionInput = {
  category: "skill",
  label: "",
  description: "",
  match_keywords: [],
  weight: 10,
  is_required: false,
};

export default function AdminATSConfig() {
  const { jobId } = useParams<{ jobId: string }>();
  usePageMeta("ATS Configuration");

  const [job, setJob] = useState<JobSummary | null>(null);
  const [config, setConfig] = useState<ATSConfiguration | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);

  const [providerStatus, setProviderStatus] = useState<Record<ATSAIProviderName, ATSAIProviderStatus> | null>(null);

  const [newCriterion, setNewCriterion] = useState<ATSCriterionInput>(emptyCriterion);
  const [addingCriterion, setAddingCriterion] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ATSCriterionInput>(emptyCriterion);
  const [savingEdit, setSavingEdit] = useState(false);

  const [suggestedCriteria, setSuggestedCriteria] = useState<AISuggestedCriterion[] | null>(null);
  const [suggestingCriteria, setSuggestingCriteria] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addingSuggestedIndex, setAddingSuggestedIndex] = useState<number | null>(null);
  const [addingAllSuggested, setAddingAllSuggested] = useState(false);

  function load() {
    if (!jobId) return;
    setLoaded(false);
    adminGet<{ items: JobSummary[] }>("/api/admin/jobs")
      .then((data) => setJob(data.items.find((j) => j.id === jobId) ?? null));

    getJobATSConfiguration(jobId)
      .then((data) => {
        setConfig(data.data);
        setNotConfigured(false);
        setError(null);
      })
      .catch((err) => {
        if (err?.status === 404) {
          setNotConfigured(true);
          setError(null);
        } else {
          setError(err.message ?? "Couldn't load ATS configuration.");
        }
      })
      .finally(() => setLoaded(true));
  }

  useEffect(load, [jobId]);

  useEffect(() => {
    getAIProviderStatus()
      .then((data) => setProviderStatus(data.providers))
      .catch(() => { });
  }, []);

  async function createDefault() {
    if (!jobId) return;
    try {
      const res = await createJobATSConfiguration(jobId, {
        is_scoring_enabled: true,
        auto_reject_enabled: false,
        minimum_recommend_score: 70,
        minimum_review_score: 40,
        criteria: [],
      });
      setConfig(res.data);
      setNotConfigured(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create ATS configuration.");
    }
  }

  async function saveSettings(patch: Partial<ATSConfiguration>) {
    if (!config) return;
    setSavingSettings(true);
    try {
      const res = await updateATSConfiguration(config.id, patch);
      setConfig(res.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function onAddCriterion(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setAddingCriterion(true);
    try {
      await addATSCriterion(config.id, newCriterion);
      setNewCriterion(emptyCriterion);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't add criterion.");
    } finally {
      setAddingCriterion(false);
    }
  }

  function startEdit(c: ATSCriterion) {
    setEditingId(c.id);
    setEditForm({
      category: c.category,
      label: c.label,
      description: c.description ?? "",
      match_keywords: c.match_keywords,
      weight: c.weight,
      is_required: c.is_required,
    });
  }

  async function saveEditCriterion(id: string) {
    setSavingEdit(true);
    try {
      await updateATSCriterion(id, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save criterion.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeCriterion(id: string) {
    if (!confirm("Remove this criterion? Past screening results referencing it are kept for history.")) return;
    try {
      await deleteATSCriterion(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete criterion.");
    }
  }

  async function suggestCriteria() {
    if (!jobId) return;
    // Prefer whichever provider this job's already using; otherwise fall
    // back to the first one that's actually got a server-side API key.
    const provider: ATSAIProviderName | null =
      config?.ai_provider ??
      (providerStatus?.gemini?.configured ? "gemini" : providerStatus?.openai?.configured ? "openai" : null);
    if (!provider) {
      setSuggestError("No AI provider is configured on the server yet - add an OpenAI or Gemini API key first.");
      return;
    }
    setSuggestingCriteria(true);
    setSuggestError(null);
    try {
      const res = await generateATSCriteria(jobId, provider, providerStatus?.[provider]?.default_model);
      setSuggestedCriteria(res.data.criteria);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Couldn't generate suggested criteria.");
    } finally {
      setSuggestingCriteria(false);
    }
  }

  async function addSuggestedCriterion(index: number) {
    if (!config || !suggestedCriteria) return;
    setAddingSuggestedIndex(index);
    try {
      await addATSCriterion(config.id, suggestedCriteria[index]);
      setSuggestedCriteria((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't add criterion.");
    } finally {
      setAddingSuggestedIndex(null);
    }
  }

  async function addAllSuggestedCriteria() {
    if (!config || !suggestedCriteria) return;
    setAddingAllSuggested(true);
    try {
      for (const c of suggestedCriteria) {
        await addATSCriterion(config.id, c);
      }
      setSuggestedCriteria(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't add all criteria - some may have been added already.");
      load();
    } finally {
      setAddingAllSuggested(false);
    }
  }

  return (
    <div>
      <Link to="/admin/ats" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
        <ArrowLeft size={13} />
        Back to candidate screening
      </Link>

      <h1 className="mb-1 font-display text-xl font-bold" style={{ color: "var(--color-ink-900)" }}>
        ATS Configuration
      </h1>
      <p className="mb-6 text-sm text-ink-500">{job ? job.title : "Loading job…"}</p>

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : notConfigured ? (
        <div className="rounded-2xl border border-mist-200 bg-surface p-6 text-center">
          <p className="mb-4 text-sm text-ink-500">This job has no ATS configuration yet. Screening stays off until one is created.</p>
          <button
            onClick={createDefault}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            Set up ATS for this job
          </button>
        </div>
      ) : config ? (
        <div className="flex flex-col gap-6">
          {/* Settings */}
          <div className="rounded-2xl border border-mist-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>Screening Settings</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-mist-200 px-4 py-3 text-sm">
                Automatic scoring enabled
                <input
                  type="checkbox"
                  checked={config.is_scoring_enabled}
                  disabled={savingSettings}
                  onChange={(e) => saveSettings({ is_scoring_enabled: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-mist-200 px-4 py-3 text-sm">
                Auto-reject on failed mandatory criteria
                <input
                  type="checkbox"
                  checked={config.auto_reject_enabled}
                  disabled={savingSettings}
                  onChange={(e) => saveSettings({ auto_reject_enabled: e.target.checked })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Minimum score to auto-recommend (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={config.minimum_recommend_score}
                  onBlur={(e) => saveSettings({ minimum_recommend_score: Number(e.target.value) })}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Below this score is "Not Recommended" (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={config.minimum_review_score}
                  onBlur={(e) => saveSettings({ minimum_review_score: Number(e.target.value) })}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
              </label>
            </div>
            {config.auto_reject_enabled && (
              <p className="mt-3 text-xs" style={{ color: "var(--color-ember-600)" }}>
                Candidates who fail a required criterion will be automatically set to "rejected" when screened.
              </p>
            )}
          </div>

          {/* Evaluation Method */}
          <div className="rounded-2xl border border-mist-200 bg-surface p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>
              <Sparkles size={15} />
              Evaluation Method
            </h2>
            <p className="mb-4 text-xs text-ink-500">
              Weighted Scoring matches the keywords you configure below. AI Evaluation reads each candidate's cover
              note and CV directly and judges them against your Screening Criteria below one by one (respecting each
              criterion's weight and required flag) - or, if no criteria are configured yet, against this job's
              posted requirements as free text. If AI evaluation fails or isn't configured, screening automatically
              falls back to Weighted Scoring.
            </p>

            <div className="mb-4 flex gap-2">
              {(["weighted", "ai"] as ATSEvaluationMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    // Switching to "ai" needs a provider set in the same
                    // request - the backend rejects evaluation_mode="ai"
                    // with no ai_provider, and the provider picker below
                    // only renders once evaluation_mode is already "ai",
                    // so without this the two conditions can never both
                    // become true. Default to whichever provider is
                    // actually configured server-side.
                    if (mode === "ai" && !config.ai_provider) {
                      const defaultProvider: ATSAIProviderName = providerStatus?.gemini?.configured
                        ? "gemini"
                        : providerStatus?.openai?.configured
                          ? "openai"
                          : "gemini";
                      saveSettings({
                        evaluation_mode: mode,
                        ai_provider: defaultProvider,
                        ai_model: providerStatus?.[defaultProvider]?.default_model ?? null,
                      });
                    } else {
                      saveSettings({ evaluation_mode: mode });
                    }
                  }}
                  disabled={savingSettings}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  style={
                    config.evaluation_mode === mode
                      ? { backgroundColor: "var(--color-ember-500)", color: "white", borderColor: "var(--color-ember-500)" }
                      : { borderColor: "var(--color-mist-200)", color: "var(--color-ink-700)" }
                  }
                >
                  {mode === "weighted" ? "Weighted Scoring" : "AI Evaluation"}
                </button>
              ))}
            </div>

            {config.evaluation_mode === "ai" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  AI Provider
                  <select
                    value={config.ai_provider ?? ""}
                    disabled={savingSettings}
                    onChange={(e) => {
                      const provider = e.target.value as ATSAIProviderName;
                      saveSettings({
                        ai_provider: provider,
                        ai_model: providerStatus?.[provider]?.default_model ?? null,
                      });
                    }}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  >
                    <option value="" disabled>Select a provider…</option>
                    <option value="openai">
                      OpenAI {providerStatus && !providerStatus.openai.configured ? "(no API key configured)" : ""}
                    </option>
                    <option value="gemini">
                      Google Gemini {providerStatus && !providerStatus.gemini.configured ? "(no API key configured)" : ""}
                    </option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Model
                  <input
                    value={config.ai_model ?? ""}
                    disabled={savingSettings}
                    onChange={(e) => saveSettings({ ai_model: e.target.value })}
                    placeholder={config.ai_provider ? providerStatus?.[config.ai_provider]?.default_model : "e.g. gpt-4o-mini"}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>

                {config.ai_provider && providerStatus && !providerStatus[config.ai_provider].configured && (
                  <p className="text-xs sm:col-span-2" style={{ color: "var(--color-ember-600)" }}>
                    {config.ai_provider === "openai" ? "OpenAI" : "Gemini"} has no API key configured on the server yet
                    - screening will automatically fall back to Weighted Scoring below until one is added to the
                    backend's .env and the server is restarted.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Criteria list */}
          <div className="rounded-2xl border border-mist-200 bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>
              Screening Criteria
              <span className="ml-2 text-xs font-normal text-ink-500">
                (drives Weighted Scoring's keyword matching, AND AI Evaluation's per-criterion judgement when
                evaluation mode is AI)
              </span>
            </h2>

            {config.criteria.length === 0 && config.evaluation_mode === "ai" && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  This job is on AI Evaluation, and Screening Criteria is empty. If AI evaluation ever fails or the
                  provider isn't configured, screening silently falls back to Weighted Scoring - with no criteria,
                  every candidate would score 0%. Add a few criteria below as a safety net, or use "Suggest with AI"
                  to draft some in one click.
                </span>
              </div>
            )}

            {config.criteria.length === 0 ? (
              <p className="mb-4 text-sm text-ink-500">No criteria configured yet - add at least one below.</p>
            ) : (
              <div className="mb-5 flex flex-col gap-2">
                {config.criteria.map((c) =>
                  editingId === c.id ? (
                    <CriterionForm
                      key={c.id}
                      value={editForm}
                      onChange={setEditForm}
                      saving={savingEdit}
                      onCancel={() => setEditingId(null)}
                      onSubmit={() => saveEditCriterion(c.id)}
                      submitLabel="Save"
                    />
                  ) : (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mist-200 px-4 py-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>
                          {c.label}
                          {c.is_required && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}>
                              Required
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-500">
                          {ATS_CATEGORY_LABELS[c.category]} · weight {c.weight}
                          {c.match_keywords.length > 0 && <> · matches: {c.match_keywords.join(", ")}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(c)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => removeCriterion(c.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="mb-5 rounded-xl border border-dashed border-mist-300 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--color-ink-900)" }}>
                    <Sparkles size={14} style={{ color: "var(--color-ember-500)" }} />
                    Suggest criteria with AI
                  </p>
                  <p className="text-xs text-ink-500">
                    Drafts criteria from this job's own description, responsibilities, and requirements - review,
                    edit, or discard each one before it's added.
                  </p>
                </div>
                <button
                  onClick={suggestCriteria}
                  disabled={suggestingCriteria}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-mist-200 px-3.5 py-2 text-xs font-semibold text-ink-700 disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  {suggestingCriteria ? "Generating…" : "Suggest with AI"}
                </button>
              </div>

              {suggestError && (
                <p className="mt-3 text-xs" style={{ color: "var(--color-ember-600)" }}>{suggestError}</p>
              )}

              {suggestedCriteria && suggestedCriteria.length > 0 && (
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {suggestedCriteria.length} suggested - edit anything, then add
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addAllSuggestedCriteria}
                        disabled={addingAllSuggested || addingSuggestedIndex !== null}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: "var(--color-ember-500)" }}
                      >
                        {addingAllSuggested ? "Adding all…" : "Add all"}
                      </button>
                      <button
                        onClick={() => setSuggestedCriteria(null)}
                        className="rounded-lg border border-mist-200 px-3 py-1.5 text-xs text-ink-700"
                      >
                        Discard all
                      </button>
                    </div>
                  </div>
                  {suggestedCriteria.map((c, i) => (
                    <CriterionForm
                      key={i}
                      value={c}
                      onChange={(v) => setSuggestedCriteria((prev) => prev!.map((item, idx) => (idx === i ? v : item)))}
                      saving={addingSuggestedIndex === i}
                      onSubmit={() => addSuggestedCriterion(i)}
                      onCancel={() => setSuggestedCriteria((prev) => prev!.filter((_, idx) => idx !== i))}
                      submitLabel="Add"
                      submitIcon={<Plus size={14} />}
                    />
                  ))}
                </div>
              )}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Add a criterion</p>
            <CriterionForm
              value={newCriterion}
              onChange={setNewCriterion}
              saving={addingCriterion}
              onSubmit={onAddCriterion}
              submitLabel="Add criterion"
              submitIcon={<Plus size={14} />}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CriterionForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
  submitIcon,
}: {
  value: ATSCriterionInput;
  onChange: (v: ATSCriterionInput) => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  onCancel?: () => void;
  saving: boolean;
  submitLabel: string;
  submitIcon?: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(e); }}
      className="grid grid-cols-1 gap-3 rounded-xl border border-mist-200 p-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Category
        <select
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value as ATSCriterionCategory })}
          className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
        >
          {CATEGORIES.map((cat) => <option key={cat} value={cat}>{ATS_CATEGORY_LABELS[cat]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Label
        <input
          required
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="e.g. 2+ years lending experience"
          className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500 sm:col-span-2">
        Match keywords (comma-separated - matched literally against CV, cover note & role text)
        <input
          value={value.match_keywords.join(", ")}
          onChange={(e) => onChange({ ...value, match_keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
          placeholder="e.g. lending, credit, loan officer, credit analysis, underwriting"
          className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
        />
        {value.match_keywords.length === 0 ? (
          <span className="text-amber-600">
            No keywords yet - this criterion will never match any applicant until you add at least one.
          </span>
        ) : value.match_keywords.length === 1 ? (
          <span className="text-ink-400">
            Matching is literal, not stemmed - one keyword misses variants like plurals or synonyms. Add a few
            (e.g. "manage", "managed", "management") to cover how applicants actually phrase this.
          </span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500 sm:col-span-2">
        Description (optional, shown to recruiters)
        <input
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Weight (score points)
        <input
          type="number"
          min={0}
          max={100}
          value={value.weight}
          onChange={(e) => onChange({ ...value, weight: Number(e.target.value) })}
          className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
        />
      </label>
      <label className="flex items-center gap-2 self-end text-sm text-ink-700">
        <input
          type="checkbox"
          checked={value.is_required}
          onChange={(e) => onChange({ ...value, is_required: e.target.checked })}
        />
        Required (mandatory) criterion
      </label>

      <div className="flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-ember-500)" }}
        >
          {submitIcon ?? <Check size={14} />}
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex items-center gap-1.5 rounded-xl border border-mist-200 px-4 py-2 text-sm text-ink-700">
            <X size={14} />
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
