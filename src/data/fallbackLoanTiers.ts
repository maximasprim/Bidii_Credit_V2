import type { LoanTier } from "../lib/useLoanTiers";

/**
 * If /api/loan-tiers can't be reached, the site falls back to this data
 * instead of breaking the Calculator/Apply flow. This mirrors the backend's
 * app/data/seed_loan_tiers.py — if an admin edits rates in the dashboard,
 * this fallback won't reflect that (it's a last-resort default, not a
 * cache), but it keeps the loan calculator and application usable if the
 * backend is briefly down.
 */
export const FALLBACK_LOAN_TIERS: LoanTier[] = [
  // SME Loans
  { id: "fallback-sme-hustle-yangu", product_slug: "sme-loans", tier_key: "hustle-yangu", label: "Hustle Yangu", min_amount: 2_000, max_amount: 15_000, term_unit: "weeks", min_term: 1, max_term: 4, repayment_frequency: "weekly", interest_rate: 0.15, interest_basis: "flat_over_term", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0.20, guarantors: 2, display_order: 0, is_active: true },
  { id: "fallback-sme-hustle-yangu-plus", product_slug: "sme-loans", tier_key: "hustle-yangu-plus", label: "Hustle Yangu Plus", min_amount: 16_000, max_amount: 30_000, term_unit: "weeks", min_term: 4, max_term: 8, repayment_frequency: "weekly", interest_rate: 0.15, interest_basis: "per_month", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0.20, guarantors: 2, display_order: 1, is_active: true },
  { id: "fallback-sme-jikuze", product_slug: "sme-loans", tier_key: "jikuze", label: "Jikuze", min_amount: 32_000, max_amount: 70_000, term_unit: "weeks", min_term: 4, max_term: 12, repayment_frequency: "weekly", interest_rate: 0.125, interest_basis: "per_month", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0.20, guarantors: 2, display_order: 2, is_active: true },
  { id: "fallback-sme-jikuze-plus", product_slug: "sme-loans", tier_key: "jikuze-plus", label: "Jikuze Plus", min_amount: 80_000, max_amount: 100_000, term_unit: "weeks", min_term: 4, max_term: 24, repayment_frequency: "weekly", interest_rate: 0.125, interest_basis: "per_month", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0.20, guarantors: 2, display_order: 3, is_active: true },
  { id: "fallback-sme-jikuze-monthly", product_slug: "sme-loans", tier_key: "jikuze-monthly", label: "Jikuze Monthly", min_amount: 80_000, max_amount: 100_000, term_unit: "months", min_term: 1, max_term: 6, repayment_frequency: "monthly", interest_rate: 0.125, interest_basis: "per_month", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0.20, guarantors: 2, display_order: 4, is_active: true },

  // Mobile Loans
  { id: "fallback-mobile-weekly", product_slug: "mobile-loans", tier_key: "weekly", label: "Weekly Plan", min_amount: 500, max_amount: 50_000, term_unit: "weeks", min_term: 1, max_term: 4, repayment_frequency: "weekly", interest_rate: 0.15, interest_basis: "flat_over_term", registration_fee: 100, processing_fee_rate: 0, life_insurance_fee_rate: 0.01, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0, guarantors: null, display_order: 0, is_active: true },
  { id: "fallback-mobile-monthly", product_slug: "mobile-loans", tier_key: "monthly", label: "Monthly Plan", min_amount: 500, max_amount: 50_000, term_unit: "months", min_term: 1, max_term: 1, repayment_frequency: "monthly", interest_rate: 0.15, interest_basis: "flat_over_term", registration_fee: 100, processing_fee_rate: 0, life_insurance_fee_rate: 0.01, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0, guarantors: null, display_order: 1, is_active: true },

  // Logbook Loans
  { id: "fallback-logbook-standard", product_slug: "logbook-loans", tier_key: "standard", label: "Auto Loan", min_amount: 50_000, max_amount: 5_000_000, term_unit: "months", min_term: 3, max_term: 24, repayment_frequency: "monthly", interest_rate: 0.05, interest_basis: "per_month", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 3_500, incharge_fee: 1_500, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0.20, guarantors: null, display_order: 0, is_active: true },
  { id: "fallback-logbook-jikuze-auto", product_slug: "logbook-loans", tier_key: "jikuze-auto", label: "Jikuze Auto (vehicles 21-25 yrs)", min_amount: 50_000, max_amount: 150_000, term_unit: "months", min_term: 3, max_term: 9, repayment_frequency: "monthly", interest_rate: 0.075, interest_basis: "per_month", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 3_500, incharge_fee: 0, tracking_fee_per_month: 1_500, excise_duty_on_fees_rate: 0.20, guarantors: null, display_order: 1, is_active: true },

  // Rental Income Loans
  { id: "fallback-rental-standard", product_slug: "rental-income-loans", tier_key: "standard", label: "Rental Income Loan", min_amount: 300_000, max_amount: 5_000_000, term_unit: "months", min_term: 1, max_term: 12, repayment_frequency: "monthly", interest_rate: 0.05, interest_basis: "per_month", registration_fee: 700, processing_fee_rate: 0.04, life_insurance_fee_rate: 0.01, chattel_fee: 3_500, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0.20, guarantors: null, display_order: 0, is_active: true },

  // Check Off Loans
  { id: "fallback-checkoff-standard", product_slug: "check-off-loans", tier_key: "standard", label: "Check Off Loan", min_amount: 10_000, max_amount: 3_000_000, term_unit: "months", min_term: 3, max_term: 120, repayment_frequency: "monthly", interest_rate: 0.02, interest_basis: "per_month", registration_fee: 1000, processing_fee_rate: 0, life_insurance_fee_rate: 0, chattel_fee: 0, incharge_fee: 0, tracking_fee_per_month: 0, excise_duty_on_fees_rate: 0, guarantors: null, display_order: 0, is_active: true },
];

export function groupFallbackTiers(): Record<string, LoanTier[]> {
  const grouped: Record<string, LoanTier[]> = {};
  for (const tier of FALLBACK_LOAN_TIERS) {
    (grouped[tier.product_slug] ??= []).push(tier);
  }
  return grouped;
}
