/**
 * Extracted directly from Bidii Credit's real check-off loan calculator
 * (loan_calculator_.xlsx, "Definitions" sheet). Do not adjust these without
 * checking against that source - they encode actual pricing decisions, not
 * a generic formula.
 *
 * FACTOR is the installment-per-shilling ratio for that duration: given an
 * affordable monthly installment, MaxQualifiedAmount = Installment / Factor.
 * It isn't derivable from the Interest column by a simple formula (it's its
 * own pricing input), so both columns are kept verbatim.
 */
export type CheckOffRateRow = {
  durationMonths: number;
  monthlyInterestRate: number;
  factor: number;
};

export const CHECK_OFF_RATE_TABLE: CheckOffRateRow[] = [
  { durationMonths: 3, monthlyInterestRate: 0.10, factor: 0.4334 },
  { durationMonths: 6, monthlyInterestRate: 0.08, factor: 0.246733333333333 },
  { durationMonths: 9, monthlyInterestRate: 0.08, factor: 0.191178 },
  { durationMonths: 12, monthlyInterestRate: 0.08, factor: 0.1634 },
  { durationMonths: 18, monthlyInterestRate: 0.08, factor: 0.135622666666667 },
  { durationMonths: 24, monthlyInterestRate: 0.065, factor: 0.106733333333333 },
  { durationMonths: 30, monthlyInterestRate: 0.065, factor: 0.0984 },
  { durationMonths: 36, monthlyInterestRate: 0.05, factor: 0.0778446666666667 },
  { durationMonths: 48, monthlyInterestRate: 0.045, factor: 0.0659 },
  { durationMonths: 54, monthlyInterestRate: 0.045, factor: 0.0635853333333333 },
  { durationMonths: 60, monthlyInterestRate: 0.03, factor: 0.0467333333333333 },
  { durationMonths: 72, monthlyInterestRate: 0.03, factor: 0.043956 },
  { durationMonths: 84, monthlyInterestRate: 0.03, factor: 0.041972 },
  { durationMonths: 96, monthlyInterestRate: 0.025, factor: 0.0354833333333333 },
  { durationMonths: 108, monthlyInterestRate: 0.0225, factor: 0.031826 },
  { durationMonths: 120, monthlyInterestRate: 0.02, factor: 0.0284 },
  // { durationMonths: 132, monthlyInterestRate: 0.019, factor: 0.0266426666666667 },
  // { durationMonths: 144, monthlyInterestRate: 0.018, factor: 0.0250113333333333 },
];

// Loan Application Fee (flat), Loan Processing Fee rate, Insurance Fee rate.
export const CHECK_OFF_FEES = {
  LAF: 1000,
  LPF: 0.03,
  IF: 0.01,
};

/**
 * XLOOKUP(term, Duration, ..., match_mode=-1) in the source sheet means
 * "exact match, or the next smaller duration if there's no exact one" -
 * so an arbitrary term still resolves to a sensible row instead of failing.
 */
export function findCheckOffRateRow(termMonths: number): CheckOffRateRow {
  const exact = CHECK_OFF_RATE_TABLE.find((r) => r.durationMonths === termMonths);
  if (exact) return exact;
  const lower = [...CHECK_OFF_RATE_TABLE].reverse().find((r) => r.durationMonths <= termMonths);
  return lower ?? CHECK_OFF_RATE_TABLE[0];
}
