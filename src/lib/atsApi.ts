/**
 * ATS (Applicant Tracking System) API layer - thin, typed wrappers around
 * the existing adminGet/adminPost/adminPatch/adminDelete helpers from
 * adminApi.ts. No new auth or fetch machinery: this module reuses the same
 * bearer-token handling, 401 session-expiry event, and error shape as
 * every other admin page.
 */
import { adminDelete, adminGet, adminPatch, adminPost } from "./adminApi";
import type { PageMeta } from "../components/admin/Pagination";

export type ATSCriterionCategory =
  | "qualification"
  | "education"
  | "experience"
  | "skill"
  | "certification"
  | "location"
  | "custom";

export type ATSRecommendation = "recommended" | "review" | "not_recommended";
export type ATSEvaluationMode = "weighted" | "ai";
export type ATSAIProviderName = "openai" | "gemini";

export const ATS_CATEGORY_LABELS: Record<ATSCriterionCategory, string> = {
  qualification: "Qualification",
  education: "Education",
  experience: "Experience",
  skill: "Skill",
  certification: "Certification",
  location: "Location / Work Eligibility",
  custom: "Custom",
};

export const ATS_RECOMMENDATION_LABELS: Record<ATSRecommendation, string> = {
  recommended: "Recommended",
  review: "Needs Review",
  not_recommended: "Not Recommended",
};

export type ATSCriterion = {
  id: string;
  config_id: string;
  category: ATSCriterionCategory;
  label: string;
  description: string | null;
  match_keywords: string[];
  weight: number;
  is_required: boolean;
  created_at: string;
};

export type ATSCriterionInput = {
  category: ATSCriterionCategory;
  label: string;
  description?: string | null;
  match_keywords: string[];
  weight: number;
  is_required: boolean;
};

export type ATSConfiguration = {
  id: string;
  job_id: string;
  is_scoring_enabled: boolean;
  auto_reject_enabled: boolean;
  minimum_recommend_score: number;
  minimum_review_score: number;
  criteria: ATSCriterion[];
  created_at: string;
  updated_at: string;
  evaluation_mode: ATSEvaluationMode;
  ai_provider: ATSAIProviderName | null;
  ai_model: string | null;
};

export type ATSConfigurationWithJob = ATSConfiguration & {
  job_title: string;
  job_slug: string;
  job_is_open: boolean;
};

export type ATSCriterionOutcome = {
  criterion_id?: string;
  label: string;
  category?: string;
  weight?: number;
  is_required?: boolean;
  detail?: string;
};

export type ATSScreeningResult = {
  id: string;
  application_id: string;
  config_id: string | null;
  total_score: number;
  max_possible_score: number;
  score_percentage: number;
  system_recommendation: ATSRecommendation;
  override_recommendation: ATSRecommendation | null;
  override_reason: string | null;
  override_by: string | null;
  overridden_at: string | null;
  matched_criteria: ATSCriterionOutcome[];
  missing_criteria: ATSCriterionOutcome[];
  failed_mandatory_criteria: ATSCriterionOutcome[];
  auto_scored: boolean;
  scored_at: string;
  evaluation_method: ATSEvaluationMode;
  ai_provider: ATSAIProviderName | null;
  ai_model: string | null;
  ai_strengths: string[];
  ai_weaknesses: string[];
  ai_explanation: string | null;
  ai_fallback_reason: string | null;
};

export function finalRecommendation(result: ATSScreeningResult | null | undefined): ATSRecommendation | null {
  if (!result) return null;
  return result.override_recommendation ?? result.system_recommendation;
}

export type CareerApplicationWithATS = {
  id: string;
  job_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  cover_note: string;
  cv_original_filename: string;
  status: string;
  created_at: string;
  screening: ATSScreeningResult | null;
};

export type ATSRecruiterNote = {
  id: string;
  application_id: string;
  admin_id: string;
  admin_username: string | null;
  note: string;
  created_at: string;
};

export type ATSAuditLog = {
  id: string;
  application_id: string;
  admin_id: string | null;
  admin_username: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type ATSVettingDetail = {
  application: {
    id: string;
    job_id: string | null;
    full_name: string;
    email: string;
    phone: string;
    role: string;
    cover_note: string;
    cv_original_filename: string;
    status: string;
    created_at: string;
  };
  job: { id: string; slug: string; title: string; department: string; location: string; is_open: boolean } | null;
  screening: ATSScreeningResult | null;
  notes: ATSRecruiterNote[];
  history: ATSAuditLog[];
};

export type ATSStats = {
  total_applications: number;
  total_screened: number;
  total_unscreened: number;
  recommended_count: number;
  review_count: number;
  not_recommended_count: number;
  average_score_percentage: number;
};

// --- Configuration ---------------------------------------------------------

export function listATSConfigurations() {
  return adminGet<{ items: ATSConfigurationWithJob[] }>("/api/admin/ats/config");
}

export function getJobATSConfiguration(jobId: string) {
  return adminGet<{ data: ATSConfiguration }>(`/api/admin/ats/config/jobs/${jobId}`);
}

export function createJobATSConfiguration(
  jobId: string,
  payload: {
    is_scoring_enabled: boolean;
    auto_reject_enabled: boolean;
    minimum_recommend_score: number;
    minimum_review_score: number;
    criteria: ATSCriterionInput[];
    evaluation_mode?: ATSEvaluationMode;
    ai_provider?: ATSAIProviderName | null;
    ai_model?: string | null;
  }
) {
  return adminPost<{ data: ATSConfiguration }>(`/api/admin/ats/config/jobs/${jobId}`, payload);
}

export function updateATSConfiguration(
  configId: string,
  payload: Partial<{
    is_scoring_enabled: boolean;
    auto_reject_enabled: boolean;
    minimum_recommend_score: number;
    minimum_review_score: number;
    evaluation_mode: ATSEvaluationMode;
    ai_provider: ATSAIProviderName | null;
    ai_model: string | null;
  }>
) {
  return adminPatch<{ data: ATSConfiguration }>(`/api/admin/ats/config/${configId}`, payload);
}

export function addATSCriterion(configId: string, payload: ATSCriterionInput) {
  return adminPost<{ data: ATSCriterion }>(`/api/admin/ats/config/${configId}/criteria`, payload);
}

export function updateATSCriterion(criterionId: string, payload: Partial<ATSCriterionInput>) {
  return adminPatch<{ data: ATSCriterion }>(`/api/admin/ats/config/criteria/${criterionId}`, payload);
}

export function deleteATSCriterion(criterionId: string) {
  return adminDelete<void>(`/api/admin/ats/config/criteria/${criterionId}`);
}

// --- Screening ---------------------------------------------------------

export function screenApplication(applicationId: string, method?: ATSEvaluationMode) {
  const qs = method ? `?method=${method}` : "";
  return adminPost<{ data: ATSScreeningResult }>(`/api/admin/ats/screening/applications/${applicationId}/screen${qs}`, {});
}

export function screenAllForJob(jobId: string, rescoreAll: boolean, method?: ATSEvaluationMode) {
  const qs = new URLSearchParams({ rescore_all: String(rescoreAll) });
  if (method) qs.set("method", method);
  return adminPost<{ screened_count: number }>(`/api/admin/ats/screening/jobs/${jobId}/screen-all?${qs.toString()}`, {});
}

export type ATSApplicationFilters = {
  page?: number;
  page_size?: number;
  job_id?: string;
  status?: string;
  recommendation?: ATSRecommendation;
  min_score?: number;
  max_score?: number;
  mandatory_failed?: boolean;
  sort_by?: "date" | "score";
  sort_dir?: "asc" | "desc";
};

export function listATSApplications(filters: ATSApplicationFilters) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  });
  return adminGet<{ meta: PageMeta; items: CareerApplicationWithATS[] }>(
    `/api/admin/ats/screening/applications?${qs.toString()}`
  );
}

export function getATSStats(jobId?: string) {
  const qs = jobId ? `?job_id=${jobId}` : "";
  return adminGet<ATSStats>(`/api/admin/ats/screening/stats${qs}`);
}

// --- Vetting ---------------------------------------------------------

export function getVettingDetail(applicationId: string) {
  return adminGet<ATSVettingDetail>(`/api/admin/ats/applications/${applicationId}`);
}

export function overrideRecommendation(applicationId: string, recommendation: ATSRecommendation, reason: string) {
  return adminPatch<{ data: ATSScreeningResult }>(`/api/admin/ats/applications/${applicationId}/override`, {
    recommendation,
    reason,
  });
}

export function addRecruiterNote(applicationId: string, note: string) {
  return adminPost<{ data: ATSRecruiterNote }>(`/api/admin/ats/applications/${applicationId}/notes`, { note });
}

export function getAuditHistory(applicationId: string) {
  return adminGet<ATSAuditLog[]>(`/api/admin/ats/applications/${applicationId}/history`);
}

// --- AI provider status (shared by ATS Configuration + Job Listings) -------

export type ATSAIProviderStatus = { configured: boolean; default_model: string };

export function getAIProviderStatus() {
  return adminGet<{ providers: Record<ATSAIProviderName, ATSAIProviderStatus> }>("/api/admin/ai/providers");
}

// --- AI screening-criteria suggestion (Screening Criteria "Suggest with AI") ---

export type AISuggestedCriterion = ATSCriterionInput;

export function generateATSCriteria(jobId: string, provider: ATSAIProviderName, model?: string | null) {
  return adminPost<{ data: { criteria: AISuggestedCriterion[]; provider: string; model: string } }>(
    `/api/admin/ai/ats/criteria/generate/${jobId}`,
    { provider, model: model || null }
  );
}
