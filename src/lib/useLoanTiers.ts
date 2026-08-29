import { useEffect, useState } from "react";
import { apiGet } from "./api";
import { adminGet, getAdminToken, getCurrentAdminRole } from "./adminApi";
import { groupFallbackTiers } from "../data/fallbackLoanTiers";

export type RepaymentFrequency = "weekly" | "monthly";
export type InterestBasis = "flat_over_term" | "per_month";

// Internal fee fields are optional on this type because they're only
// present once merged in for a logged-in admin/loan officer (see
// useLoanTiers) - the rest of the calculation (installment, total
// interest, total repayment) never depends on them. Whether to actually
// *display* fee data is a separate, role-based decision made by the
// caller (see PRIVILEGED_ROLES / useAdminAuth) - not by checking whether
// these fields happen to be present, since the offline fallback data
// below always includes them (it's static data bundled into the JS, so
// there's nothing to strip at the network layer for that path).
export type LoanTier = {
  id: string;
  product_slug: string;
  tier_key: string;
  label: string;
  min_amount: number;
  max_amount: number;
  term_unit: "weeks" | "months";
  min_term: number;
  max_term: number;
  repayment_frequency: RepaymentFrequency;
  interest_rate: number;
  interest_basis: InterestBasis;
  tracking_fee_per_month: number;
  display_order: number;
  is_active: boolean;
  // Internal - only present for a logged-in admin/loan officer.
  registration_fee?: number;
  processing_fee_rate?: number;
  life_insurance_fee_rate?: number;
  chattel_fee?: number;
  incharge_fee?: number;
  excise_duty_on_fees_rate?: number;
  guarantors?: number | null;
};

/** Roles allowed to see a loan tier's internal fee breakdown. */
export const PRIVILEGED_ROLES = new Set(["admin", "loan_officer"]);

/**
 * Fetches every active loan tier once and groups them by product_slug.
 * This is the live, admin-editable replacement for what used to be a
 * hardcoded `tiers` array per product in src/data/content.ts - product
 * marketing copy (name, tagline, features, FAQs) still lives there, but
 * the financial terms now come from the backend so admin edits show up
 * immediately without a redeploy.
 *
 * If the backend can't be reached, this falls back to the static data in
 * src/data/fallbackLoanTiers.ts (the original hardcoded rates) instead of
 * leaving the Calculator/Apply pages unusable. `isFallback` lets callers
 * show a subtle "showing default rates" notice rather than a hard error.
 *
 * If the visitor is signed in as an admin or loan officer (same
 * localStorage session used by /admin), this also fetches
 * GET /api/loan-tiers/internal and merges in the internal fee fields
 * (registration/processing/insurance/chattel/incharge fees, excise duty,
 * guarantors) - general-public visitors never get these fields from the
 * live API at all. Callers should still gate *display* of any fee data
 * on the viewer's role (via useAdminAuth + PRIVILEGED_ROLES) rather than
 * on whether these fields are present, since the offline fallback tiers
 * always include them (see the type comment above).
 */
export function useLoanTiers() {
  const [tiersByProduct, setTiersByProduct] = useState<Record<string, LoanTier[]>>({});
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isPrivilegedViewer = Boolean(getAdminToken()) && PRIVILEGED_ROLES.has(getCurrentAdminRole() ?? "");

    Promise.all([
      apiGet<{ items: LoanTier[] }>("/api/loan-tiers"),
      isPrivilegedViewer
        ? adminGet<{ items: LoanTier[] }>("/api/loan-tiers/internal").catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([publicData, internalData]) => {
        if (cancelled) return;
        const internalById = new Map((internalData?.items ?? []).map((t) => [t.id, t]));
        const merged = publicData.items.map((tier) => ({ ...tier, ...internalById.get(tier.id) }));

        const grouped: Record<string, LoanTier[]> = {};
        for (const tier of merged) {
          (grouped[tier.product_slug] ??= []).push(tier);
        }
        for (const slug in grouped) {
          grouped[slug].sort((a, b) => a.display_order - b.display_order);
        }
        setTiersByProduct(grouped);
        setIsFallback(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTiersByProduct(groupFallbackTiers());
        setIsFallback(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { tiersByProduct, loading, isFallback };
}


// import { useEffect, useState } from "react";
// import { apiGet } from "./api";
// import { groupFallbackTiers } from "../data/fallbackLoanTiers";

// export type RepaymentFrequency = "weekly" | "monthly";
// export type InterestBasis = "flat_over_term" | "per_month";

// export type LoanTier = {
//   id: string;
//   product_slug: string;
//   tier_key: string;
//   label: string;
//   min_amount: number;
//   max_amount: number;
//   term_unit: "weeks" | "months";
//   min_term: number;
//   max_term: number;
//   repayment_frequency: RepaymentFrequency;
//   interest_rate: number;
//   interest_basis: InterestBasis;
//   registration_fee: number;
//   processing_fee_rate: number;
//   life_insurance_fee_rate: number;
//   chattel_fee: number;
//   incharge_fee: number;
//   tracking_fee_per_month: number;
//   excise_duty_on_fees_rate: number;
//   guarantors: number | null;
//   display_order: number;
//   is_active: boolean;
// };

// /**
//  * Fetches every active loan tier once and groups them by product_slug.
//  * This is the live, admin-editable replacement for what used to be a
//  * hardcoded `tiers` array per product in src/data/content.ts - product
//  * marketing copy (name, tagline, features, FAQs) still lives there, but
//  * the financial terms now come from the backend so admin edits show up
//  * immediately without a redeploy.
//  *
//  * If the backend can't be reached, this falls back to the static data in
//  * src/data/fallbackLoanTiers.ts (the original hardcoded rates) instead of
//  * leaving the Calculator/Apply pages unusable. `isFallback` lets callers
//  * show a subtle "showing default rates" notice rather than a hard error.
//  */
// export function useLoanTiers() {
//   const [tiersByProduct, setTiersByProduct] = useState<Record<string, LoanTier[]>>({});
//   const [loading, setLoading] = useState(true);
//   const [isFallback, setIsFallback] = useState(false);

//   useEffect(() => {
//     let cancelled = false;
//     apiGet<{ items: LoanTier[] }>("/api/loan-tiers")
//       .then((data) => {
//         if (cancelled) return;
//         const grouped: Record<string, LoanTier[]> = {};
//         for (const tier of data.items) {
//           (grouped[tier.product_slug] ??= []).push(tier);
//         }
//         for (const slug in grouped) {
//           grouped[slug].sort((a, b) => a.display_order - b.display_order);
//         }
//         setTiersByProduct(grouped);
//         setIsFallback(false);
//       })
//       .catch(() => {
//         if (cancelled) return;
//         setTiersByProduct(groupFallbackTiers());
//         setIsFallback(true);
//       })
//       .finally(() => {
//         if (!cancelled) setLoading(false);
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   return { tiersByProduct, loading, isFallback };
// }
