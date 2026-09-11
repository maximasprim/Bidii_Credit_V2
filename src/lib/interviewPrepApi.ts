import { adminDownloadFile, adminGet, adminPost, adminPut } from "./adminApi";
import type { ATSAIProviderName } from "./atsApi";

export type InterviewPrepQuestion = {
  question: string;
  why_it_matters: string;
};

export type InterviewPrepSection = {
  title: string;
  questions: InterviewPrepQuestion[];
};

export type InterviewPrepContent = {
  candidate_summary: string;
  key_strengths: string[];
  areas_to_probe: string[];
  sections: InterviewPrepSection[];
};

export type InterviewPrepGenerateResult = {
  data: InterviewPrepContent;
  provider: string;
  model: string;
};

// Drafts a candidate-specific interview prep sheet via AI. Never saved on
// its own - the admin reviews/edits the result and calls
// saveInterviewPrep to persist it, same "generate then save" two-step as
// generateFormalJD in aiJobApi.ts.
export function generateInterviewPrep(applicationId: string, provider: ATSAIProviderName, model?: string) {
  return adminPost<InterviewPrepGenerateResult>(
    `/api/admin/ai/career-applications/${applicationId}/interview-prep/generate`,
    { provider, model: model || undefined }
  );
}

export function getInterviewPrep(applicationId: string) {
  return adminGet<{ data: InterviewPrepContent | null }>(
    `/api/admin/career-applications/${applicationId}/interview-prep`
  );
}

export function saveInterviewPrep(applicationId: string, content: InterviewPrepContent) {
  return adminPut<{ data: InterviewPrepContent }>(
    `/api/admin/career-applications/${applicationId}/interview-prep`,
    { interview_prep_content: content }
  );
}

export function downloadInterviewPrepPdf(applicationId: string, candidateName: string) {
  return adminDownloadFile(
    `/api/admin/career-applications/${applicationId}/interview-prep/pdf`,
    `Interview Prep - ${candidateName}.pdf`
  );
}
