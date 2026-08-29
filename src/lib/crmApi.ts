
const CRM_API_URL = import.meta.env.VITE_CRM_API_URL as string | undefined;
const CRM_TENANT_SLUG = import.meta.env.VITE_CRM_TENANT_SLUG as string | undefined;

export type LeadSourcePage = "calculator" | "contact" | "apply";

export type LeadTrigger =
  | "site_time_10min"
  | "calculator_time_5min"
  | "calculator_interaction"
  | "contact_submit"
  | "apply_submit";

export interface SubmitLeadInput {
  fullName: string;
  phone: string;
  email?: string;
  sourcePage: LeadSourcePage
  trigger: LeadTrigger;
  productInterest?: string;
  message?: string;
}

/**
 * Submits a lead to the CRM. Resolves to true/false rather than throwing,
 * since a failure here should never interrupt the visitor's flow - callers
 * that want to react to failure (e.g. the opt-in modal, to show a friendly
 * retry message) can check the boolean; callers that fire this
 * silently alongside another action (Contact/Apply submit) can ignore it.
 */
export async function submitCrmLead(input: SubmitLeadInput): Promise<boolean> {
  if (!CRM_API_URL || !CRM_TENANT_SLUG) {
    // CRM integration isn't configured for this environment - no-op rather
    // than breaking the site.
    return false;
  }

  try {
    const response = await fetch(`${CRM_API_URL}/api/public/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json",
        ...(CRM_TENANT_SLUG ? { "X-Tenant-Slug": CRM_TENANT_SLUG } : {}),
       },
      body: JSON.stringify({
        full_name: input.fullName,
        phone: input.phone,
        email: input.email || undefined,
        source_page: input.sourcePage,
        trigger: input.trigger,
        product_interest: input.productInterest,
        message: input.message,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
