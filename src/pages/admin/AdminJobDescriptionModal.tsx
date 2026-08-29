import { useEffect, useState } from "react";
import { X, Sparkles, Download, Save, Plus, Trash2 } from "lucide-react";
import {
  generateFormalJD,
  getJobDescription,
  saveJobDescription,
  downloadJobDescriptionPdf,
  type JDContent,
  type JDKeyResponsibility,
} from "../../lib/aiJobApi";
import { getAIProviderStatus, type ATSAIProviderName, type ATSAIProviderStatus } from "../../lib/atsApi";

const EMPTY_JD: JDContent = {
  overall_role_purpose: "",
  reports_to: "",
  key_responsibilities: [],
  reporting_relationships: "",
  decision_making_mandates: "",
  planning_responsibility: "",
  relationship_management: "",
  minimum_qualifications: [],
  experience_and_skills: [],
};

// Internal editing shape: arrays become newline-separated text for plain
// <textarea> editing, same convention AdminJobs.tsx already uses for
// requirements/responsibilities - converted back to arrays on save.
type EditableResponsibility = {
  heading: string;
  bulletsText: string;
  pct_time: number;
  criteriaText: string;
};

function toEditable(jd: JDContent): { jd: JDContent; responsibilities: EditableResponsibility[] } {
  return {
    jd,
    responsibilities: jd.key_responsibilities.map((r) => ({
      heading: r.heading,
      bulletsText: r.bullets.join("\n"),
      pct_time: r.pct_time,
      criteriaText: r.criteria.join("\n"),
    })),
  };
}

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function AdminJobDescriptionModal({
  jobId,
  jobTitle,
  onClose,
}: {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}) {
  const [jd, setJd] = useState<JDContent>(EMPTY_JD);
  const [responsibilities, setResponsibilities] = useState<EditableResponsibility[]>([]);
  const [qualificationsText, setQualificationsText] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedContent, setHasSavedContent] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<ATSAIProviderName, ATSAIProviderStatus> | null>(null);

  useEffect(() => {
    Promise.all([getJobDescription(jobId), getAIProviderStatus()])
      .then(([jdRes, providerRes]) => {
        setProviderStatus(providerRes.providers);
        if (jdRes.data) {
          const { jd: loadedJd, responsibilities: loadedResp } = toEditable(jdRes.data);
          setJd(loadedJd);
          setResponsibilities(loadedResp);
          setQualificationsText(loadedJd.minimum_qualifications.join("\n"));
          setSkillsText(loadedJd.experience_and_skills.join("\n"));
          setHasSavedContent(true);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load job description."))
      .finally(() => setLoading(false));
  }, [jobId]);

  async function generate() {
    const provider: ATSAIProviderName | null = providerStatus?.gemini?.configured
      ? "gemini"
      : providerStatus?.openai?.configured
        ? "openai"
        : null;
    if (!provider) {
      setError("No AI provider is configured on the server yet - add an OpenAI or Gemini API key first.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await generateFormalJD(jobId, provider, providerStatus?.[provider]?.default_model);
      const { jd: loadedJd, responsibilities: loadedResp } = toEditable(res.data);
      setJd(loadedJd);
      setResponsibilities(loadedResp);
      setQualificationsText(loadedJd.minimum_qualifications.join("\n"));
      setSkillsText(loadedJd.experience_and_skills.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a draft.");
    } finally {
      setGenerating(false);
    }
  }

  function buildPayload(): JDContent {
    return {
      ...jd,
      key_responsibilities: responsibilities.map(
        (r): JDKeyResponsibility => ({
          heading: r.heading,
          bullets: linesToList(r.bulletsText),
          pct_time: Number(r.pct_time) || 0,
          criteria: linesToList(r.criteriaText),
        })
      ),
      minimum_qualifications: linesToList(qualificationsText),
      experience_and_skills: linesToList(skillsText),
    };
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveJobDescription(jobId, buildPayload());
      setHasSavedContent(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndDownload() {
    setDownloading(true);
    setError(null);
    try {
      const ok = await save();
      if (ok) await downloadJobDescriptionPdf(jobId, jobTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  function updateResponsibility(index: number, patch: Partial<EditableResponsibility>) {
    setResponsibilities((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addResponsibility() {
    setResponsibilities((prev) => [...prev, { heading: "", bulletsText: "", pct_time: 0, criteriaText: "" }]);
  }

  function removeResponsibility(index: number) {
    setResponsibilities((prev) => prev.filter((_, i) => i !== index));
  }

  const pctTotal = responsibilities.reduce((sum, r) => sum + (Number(r.pct_time) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-mist-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Formal Job Description</h2>
            <p className="text-sm text-ink-500">{jobTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-mist-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-ink-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-5">
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
              )}

              <div className="flex items-center justify-between rounded-xl border border-dashed border-mist-300 bg-mist-50 px-4 py-3">
                <p className="text-xs text-ink-500">
                  Drafts the role-specific sections from this job's title, department, description, requirements &
                  responsibilities. The letterhead, tables, and behavioral competencies are always the same fixed
                  company format - only the content below is generated.
                </p>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="ml-4 flex shrink-0 items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-ember-500 hover:bg-brand-700 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {generating ? "Generating…" : hasSavedContent ? "Regenerate with AI" : "Generate with AI"}
                </button>
              </div>

              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Overall Role Purpose
                <textarea
                  value={jd.overall_role_purpose}
                  onChange={(e) => setJd({ ...jd, overall_role_purpose: e.target.value })}
                  rows={2}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Reports To
                <input
                  value={jd.reports_to}
                  onChange={(e) => setJd({ ...jd, reports_to: e.target.value })}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-700">
                    Key Responsibilities{" "}
                    <span className={pctTotal === 100 ? "text-emerald-600" : "text-amber-600"}>
                      (% of time totals {pctTotal}{pctTotal !== 100 ? " - should total 100" : ""})
                    </span>
                  </p>
                  <button
                    onClick={addResponsibility}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {responsibilities.map((r, i) => (
                    <div key={i} className="rounded-lg border border-mist-200 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          value={r.heading}
                          onChange={(e) => updateResponsibility(i, { heading: e.target.value })}
                          placeholder="Heading, e.g. Loan Book Quality Management"
                          className="flex-1 rounded-lg border border-mist-200 px-2 py-1.5 text-sm text-ink-700"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={r.pct_time}
                          onChange={(e) => updateResponsibility(i, { pct_time: Number(e.target.value) })}
                          className="w-20 rounded-lg border border-mist-200 px-2 py-1.5 text-sm text-ink-700"
                        />
                        <span className="text-xs text-ink-400">%</span>
                        <button onClick={() => removeResponsibility(i)} className="text-ink-400 hover:text-rose-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea
                          value={r.bulletsText}
                          onChange={(e) => updateResponsibility(i, { bulletsText: e.target.value })}
                          placeholder="Responsibilities, one per line"
                          rows={3}
                          className="rounded-lg border border-mist-200 px-2 py-1.5 text-xs text-ink-700"
                        />
                        <textarea
                          value={r.criteriaText}
                          onChange={(e) => updateResponsibility(i, { criteriaText: e.target.value })}
                          placeholder="Performance criteria, one per line"
                          rows={3}
                          className="rounded-lg border border-mist-200 px-2 py-1.5 text-xs text-ink-700"
                        />
                      </div>
                    </div>
                  ))}
                  {responsibilities.length === 0 && (
                    <p className="text-xs text-ink-400">No responsibilities yet - generate with AI or add one.</p>
                  )}
                </div>
              </div>

              <p className="text-xs font-medium text-ink-700">Other Responsibilities</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Reporting Relationships
                  <input
                    value={jd.reporting_relationships}
                    onChange={(e) => setJd({ ...jd, reporting_relationships: e.target.value })}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Decision Making Mandates/Constraints
                  <input
                    value={jd.decision_making_mandates}
                    onChange={(e) => setJd({ ...jd, decision_making_mandates: e.target.value })}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Planning Responsibility
                  <input
                    value={jd.planning_responsibility}
                    onChange={(e) => setJd({ ...jd, planning_responsibility: e.target.value })}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Relationship Management
                  <input
                    value={jd.relationship_management}
                    onChange={(e) => setJd({ ...jd, relationship_management: e.target.value })}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Minimum Qualifications (one per line)
                  <textarea
                    value={qualificationsText}
                    onChange={(e) => setQualificationsText(e.target.value)}
                    rows={4}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Experience and Skills (one per line)
                  <textarea
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    rows={4}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
              </div>

              <p className="text-xs text-ink-400">
                The Performance and Behavioral Competencies section and signature block are fixed company format and
                aren't editable here - they're the same on every job's JD.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-mist-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-mist-100">
            Close
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-1.5 rounded-lg border border-mist-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-mist-50 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={saveAndDownload}
            disabled={downloading || loading || !jd.overall_role_purpose}
            className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            <Download size={14} />
            {downloading ? "Preparing…" : "Save & Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
