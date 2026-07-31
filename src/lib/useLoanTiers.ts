import { useEffect, useState } from "react";
import { apiGet } from "./api";
import { groupFallbackTiers } from "../data/fallbackLoanTiers";

export type RepaymentFrequency = "weekly" | "monthly";
export type InterestBasis = "flat_over_term" | "per_month";

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
  registration_fee: number;
  processing_fee_rate: number;
  life_insurance_fee_rate: number;
  chattel_fee: number;
  incharge_fee: number;
  tracking_fee_per_month: number;
  excise_duty_on_fees_rate: number;
  guarantors: number | null;
  display_order: number;
  is_active: boolean;
};

/**
 * Fetches every active loan tier once and groups them by product_slug.
 * This is the live, admin-editable replacement for what used to be a
 * hardcoded `tiers` array per product in src/data/content.ts — product
 * marketing copy (name, tagline, features, FAQs) still lives there, but
 * the financial terms now come from the backend so admin edits show up
 * immediately without a redeploy.
 *
 * If the backend can't be reached, this falls back to the static data in
 * src/data/fallbackLoanTiers.ts (the original hardcoded rates) instead of
 * leaving the Calculator/Apply pages unusable. `isFallback` lets callers
 * show a subtle "showing default rates" notice rather than a hard error.
 */
export function useLoanTiers() {
  const [tiersByProduct, setTiersByProduct] = useState<Record<string, LoanTier[]>>({});
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ items: LoanTier[] }>("/api/loan-tiers")
      .then((data) => {
        if (cancelled) return;
        const grouped: Record<string, LoanTier[]> = {};
        for (const tier of data.items) {
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
