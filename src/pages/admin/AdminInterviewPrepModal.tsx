import { useEffect, useState } from "react";
import { X, Sparkles, Download, Save, Plus, Trash2 } from "lucide-react";
import {
  generateInterviewPrep,
  getInterviewPrep,
  saveInterviewPrep,
  downloadInterviewPrepPdf,
  type InterviewPrepContent,
} from "../../lib/interviewPrepApi";
import { getAIProviderStatus, type ATSAIProviderName, type ATSAIProviderStatus } from "../../lib/atsApi";

// Internal editing shape: arrays become newline-separated text for plain
// <textarea> editing, same convention AdminJobDescriptionModal.tsx uses
// for qualifications/skills - converted back to arrays on save.
type EditableQuestion = { question: string; why_it_matters: string };
type EditableSection = { title: string; questions: EditableQuestion[] };

function toEditable(prep: InterviewPrepContent): {
  strengthsText: string;
  probeText: string;
  sections: EditableSection[];
} {
  return {
    strengthsText: prep.key_strengths.join("\n"),
    probeText: prep.areas_to_probe.join("\n"),
    sections: prep.sections.map((s) => ({
      title: s.title,
      questions: s.questions.map((q) => ({ question: q.question, why_it_matters: q.why_it_matters })),
    })),
  };
}

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function AdminInterviewPrepModal({
  applicationId,
  candidateName,
  roleTitle,
  onClose,
}: {
  applicationId: string;
  candidateName: string;
  roleTitle: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [strengthsText, setStrengthsText] = useState("");
  const [probeText, setProbeText] = useState("");
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedContent, setHasSavedContent] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<ATSAIProviderName, ATSAIProviderStatus> | null>(null);

  useEffect(() => {
    Promise.all([getInterviewPrep(applicationId), getAIProviderStatus()])
      .then(([prepRes, providerRes]) => {
        setProviderStatus(providerRes.providers);
        if (prepRes.data) {
          const { strengthsText: st, probeText: pt, sections: loadedSections } = toEditable(prepRes.data);
          setSummary(prepRes.data.candidate_summary);
          setStrengthsText(st);
          setProbeText(pt);
          setSections(loadedSections);
          setHasSavedContent(true);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load interview prep."))
      .finally(() => setLoading(false));
  }, [applicationId]);

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
      const res = await generateInterviewPrep(applicationId, provider, providerStatus?.[provider]?.default_model);
      const { strengthsText: st, probeText: pt, sections: loadedSections } = toEditable(res.data);
      setSummary(res.data.candidate_summary);
      setStrengthsText(st);
      setProbeText(pt);
      setSections(loadedSections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a draft.");
    } finally {
      setGenerating(false);
    }
  }

  function buildPayload(): InterviewPrepContent {
    return {
      candidate_summary: summary,
      key_strengths: linesToList(strengthsText),
      areas_to_probe: linesToList(probeText),
      sections: sections.map((s) => ({
        title: s.title,
        questions: s.questions.filter((q) => q.question.trim().length > 0),
      })),
    };
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveInterviewPrep(applicationId, buildPayload());
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
      if (ok) await downloadInterviewPrepPdf(applicationId, candidateName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  function updateQuestion(sectionIndex: number, questionIndex: number, patch: Partial<EditableQuestion>) {
    setSections((prev) =>
      prev.map((s, si) =>
        si !== sectionIndex
          ? s
          : { ...s, questions: s.questions.map((q, qi) => (qi === questionIndex ? { ...q, ...patch } : q)) }
      )
    );
  }

  function addQuestion(sectionIndex: number) {
    setSections((prev) =>
      prev.map((s, si) =>
        si !== sectionIndex ? s : { ...s, questions: [...s.questions, { question: "", why_it_matters: "" }] }
      )
    );
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    setSections((prev) =>
      prev.map((s, si) =>
        si !== sectionIndex ? s : { ...s, questions: s.questions.filter((_, qi) => qi !== questionIndex) }
      )
    );
  }

  function addSection() {
    setSections((prev) => [...prev, { title: "", questions: [] }]);
  }

  function removeSection(sectionIndex: number) {
    setSections((prev) => prev.filter((_, si) => si !== sectionIndex));
  }

  function updateSectionTitle(sectionIndex: number, title: string) {
    setSections((prev) => prev.map((s, si) => (si === sectionIndex ? { ...s, title } : s)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-mist-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Interview Prep</h2>
            <p className="text-sm text-ink-500">
              {candidateName} · {roleTitle}
            </p>
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
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

              <div className="flex items-center justify-between rounded-xl border border-dashed border-mist-300 bg-mist-50 px-4 py-3">
                <p className="text-xs text-ink-500">
                  Drafts a candidate summary, key strengths, areas to probe, and a Role-Specific &amp; Technical
                  question set from this candidate's cover note, CV, and the job's requirements. The standard HR,
                  Competency, and Panel Fit questions every candidate is asked are always included and aren't
                  AI-generated - they stay identical for every interview.
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
                Candidate Summary
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Key Strengths (one per line)
                  <textarea
                    value={strengthsText}
                    onChange={(e) => setStrengthsText(e.target.value)}
                    rows={4}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Areas to Probe (one per line)
                  <textarea
                    value={probeText}
                    onChange={(e) => setProbeText(e.target.value)}
                    rows={4}
                    className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700"
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-700">Interview Question Sections</p>
                  <button
                    onClick={addSection}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus size={13} /> Add Section
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {sections.map((section, si) => (
                    <div key={si} className="rounded-lg border border-mist-200 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          value={section.title}
                          onChange={(e) => updateSectionTitle(si, e.target.value)}
                          placeholder="Section title, e.g. Role-Specific & Technical"
                          className="flex-1 rounded-lg border border-mist-200 px-2 py-1.5 text-sm font-medium text-ink-700"
                        />
                        <button onClick={() => removeSection(si)} className="text-ink-400 hover:text-rose-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {section.questions.map((q, qi) => (
                          <div key={qi} className="flex items-start gap-2 rounded-lg bg-mist-50 p-2">
                            <div className="flex flex-1 flex-col gap-1">
                              <textarea
                                value={q.question}
                                onChange={(e) => updateQuestion(si, qi, { question: e.target.value })}
                                placeholder="Question"
                                rows={2}
                                className="rounded-lg border border-mist-200 px-2 py-1.5 text-xs text-ink-700"
                              />
                              <input
                                value={q.why_it_matters}
                                onChange={(e) => updateQuestion(si, qi, { why_it_matters: e.target.value })}
                                placeholder="What a strong answer shows (optional)"
                                className="rounded-lg border border-mist-200 px-2 py-1.5 text-xs text-ink-500"
                              />
                            </div>
                            <button
                              onClick={() => removeQuestion(si, qi)}
                              className="mt-1 text-ink-400 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addQuestion(si)}
                          className="flex w-fit items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          <Plus size={12} /> Add question
                        </button>
                      </div>
                    </div>
                  ))}
                  {sections.length === 0 && (
                    <p className="text-xs text-ink-400">No sections yet - generate with AI or add one.</p>
                  )}
                </div>
              </div>
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
            disabled={downloading || loading || sections.length === 0}
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
