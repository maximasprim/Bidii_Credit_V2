import { adminGet, adminPut, adminPost, adminDownloadFile } from "./adminApi";
import type { ATSAIProviderName } from "./atsApi";

export type AIJobDraft = {
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  provider: string;
  model: string;
};

export function generateJobDraft(title: string, provider: ATSAIProviderName, model?: string) {
  return adminPost<{ data: AIJobDraft }>("/api/admin/ai/jobs/generate", { title, provider, model: model || undefined });
}


// --- Formal Job Description document (letterhead PDF) ----------------------

export type JDKeyResponsibility = {
  heading: string;
  bullets: string[];
  pct_time: number;
  criteria: string[];
};

export type JDContent = {
  overall_role_purpose: string;
  reports_to: string;
  key_responsibilities: JDKeyResponsibility[];
  reporting_relationships: string;
  decision_making_mandates: string;
  planning_responsibility: string;
  relationship_management: string;
  minimum_qualifications: string[];
  experience_and_skills: string[];
};

export function generateFormalJD(jobId: string, provider: ATSAIProviderName, model?: string) {
  return adminPost<{ data: JDContent; provider: string; model: string }>(`/api/admin/ai/jobs/${jobId}/jd/generate`, {
    provider,
    model: model || undefined,
  });
}

export function getJobDescription(jobId: string) {
  return adminGet<{ data: JDContent | null }>(`/api/admin/jobs/${jobId}/jd`);
}

export function saveJobDescription(jobId: string, jdContent: JDContent) {
  return adminPut<{ data: JDContent }>(`/api/admin/jobs/${jobId}/jd`, { jd_content: jdContent });
}

export function downloadJobDescriptionPdf(jobId: string, jobTitle: string) {
  return adminDownloadFile(`/api/admin/jobs/${jobId}/jd/pdf`, `JD - ${jobTitle}.pdf`);
}
