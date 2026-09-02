/**
 * The only counties currently served. Kept in exact sync with the
 * backend's COVERED_COUNTIES (app/services/branch_assignment.py) - if
 * you change one, change the other, or the two will silently disagree
 * about what's covered (the backend's list is the one actually enforced
 * server-side; this one only controls what the dropdown/UI offers).
 *
 * Used by:
 * - src/pages/Apply.tsx - the applicant's county dropdown.
 * - src/pages/admin/AdminBranches.tsx - assigning each branch to the
 *   county it serves, which is what makes county-based routing actually
 *   narrow anything down (see the backend's _restrict_for_county).
 */
export const COVERED_COUNTIES = [
  "Nairobi",
  "Nyeri",
  "Kiambu",
  "Murang'a",
  "Kirinyaga",
  "Kajiado",
  "Machakos",
  "Nakuru",
] as const;

export type CoveredCounty = (typeof COVERED_COUNTIES)[number];

/** Sentinel value for "my county isn't in this list" - never sent as a real county. */
export const OTHER_COUNTY_VALUE = "__other__";
