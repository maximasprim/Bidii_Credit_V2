import { adminPost } from "./adminApi";
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
