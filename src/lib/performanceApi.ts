import { adminGet, adminPost, adminPatch, adminPut, adminDelete, API_BASE_URL, getAdminToken } from "./adminApi";

export type CategoryKey =
  | "above_expectation"
  | "meeting_expectation"
  | "approaching_expectation"
  | "below_expectation";

export type CategoryBand = { key: CategoryKey; label: string; min_score: number };
export type RatingBand = { rating: number; label: string; min_pct: number };

export type PerformanceConfig = {
  fiscal_year_start_month: number;
  sales_entry_window_days: number;
  ramp_up_months: number;
  show_peer_rankings: boolean;
  rating_authority: "manager" | "average";
  achievement_cap_pct: number;
  competency_share_pct: number;
  retention_years: number;
  early_warning: {
    consecutive_months_below: number;
    below_threshold_pct: number;
    appraisal_overdue_days: number;
  };
};

export type RoleKind = "sales" | "appraisal" | "hybrid";
export type StaffStatus = "active" | "probation" | "pip" | "exited";

export type PerformanceRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  department: string | null;
  kind: RoleKind;
  is_active: boolean;
  is_system: boolean;
  config_overrides: Partial<PerformanceConfig> | null;
  staff_count: number;
  current_version: number | null;
  kpi_count: number;
  configured: boolean;
  created_at: string;
};

export type StaffProfile = {
  id: string;
  full_name: string;
  employee_no: string | null;
  performance_role_id: string;
  performance_role_name: string | null;
  performance_role_kind: string | null;
  admin_user_id: string | null;
  username: string | null;
  unit_id: string | null;
  unit_name: string | null;
  manager_id: string | null;
  manager_name: string | null;
  level_id: string | null;
  level_label: string | null;
  hire_date: string | null;
  probation_end_date: string | null;
  status: StaffStatus;
  is_executive: boolean;
  is_active: boolean;
  created_at: string;
};

export type NewLoginInput = { username: string; password: string; email?: string | null; role?: string };
export type StaffInput = {
  login?: NewLoginInput | null;
  full_name: string;
  performance_role_id: string;
  admin_user_id?: string | null;
  employee_no?: string | null;
  unit_id?: string | null;
  manager_id?: string | null;
  level_id?: string | null;
  hire_date?: string | null;
  probation_end_date?: string | null;
  status?: StaffStatus;
  is_active?: boolean;
  change_reason?: string | null;
};

export type MyPerformance = {
  profile: StaffProfile | null;
  categories: CategoryBand[];
  rating_bands: RatingBand[];
  team_size: number;
  sees_everyone: boolean;
  read_only: boolean;
};

export type RatingScale = {
  id: string;
  effective_from: string;
  categories: CategoryBand[];
  rating_bands: RatingBand[];
  rating_to_pi: Record<string, number>;
  note: string | null;
  created_by: string | null;
  created_at: string;
  is_current: boolean;
};

export type ScaleInput = {
  effective_from: string;
  categories: CategoryBand[];
  rating_bands: RatingBand[];
  rating_to_pi: Record<string, number>;
  note?: string | null;
};

export type ScalePreview = {
  before: Record<CategoryKey, number>;
  after: Record<CategoryKey, number>;
  moved: number;
  total: number;
};

export type PerformanceUnit = {
  id: string;
  name: string;
  parent_unit_id?: string | null;
  kind: "branch" | "team" | "head_office";
  branch_id: string | null;
  manager_profile_id: string | null;
  region_id: string | null;
  region_name: string | null;
  is_active: boolean;
};

export type LinkableUser = { id: string; username: string; role: string; branch_id: string | null };

const BASE = "/api/admin/performance";

export const getMyPerformance = () => adminGet<MyPerformance>(`${BASE}/me`);

export const getPerformanceConfig = () => adminGet<{ config: PerformanceConfig; version: number }>(`${BASE}/config`);
export const savePerformanceConfig = (config: PerformanceConfig) =>
  adminPut<{ data: { config: PerformanceConfig; version: number } }>(`${BASE}/config`, { config });

export const getPerformanceRoles = (includeInactive = false) =>
  adminGet<{ items: PerformanceRole[] }>(`${BASE}/roles?include_inactive=${includeInactive}`);
export const createPerformanceRole = (payload: { name: string; kind: RoleKind; department?: string | null; description?: string | null }) =>
  adminPost<{ data: PerformanceRole }>(`${BASE}/roles`, payload);
export const updatePerformanceRole = (
  id: string,
  payload: Partial<Pick<PerformanceRole, "name" | "description" | "department" | "kind" | "is_active">>,
) => adminPatch<{ data: PerformanceRole }>(`${BASE}/roles/${id}`, payload);
export const deletePerformanceRole = (id: string) => adminDelete<unknown>(`${BASE}/roles/${id}`);

export const getStaff = (params: { unit_id?: string; role_id?: string; q?: string; include_inactive?: boolean } = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs}` : "";
  return adminGet<{ items: StaffProfile[]; total: number }>(`${BASE}/staff${suffix}`);
};
export const createStaff = (payload: StaffInput) => adminPost<{ data: StaffProfile }>(`${BASE}/staff`, payload);
export const updateStaff = (id: string, payload: Partial<StaffInput>) =>
  adminPatch<{ data: StaffProfile }>(`${BASE}/staff/${id}`, payload);
export const getUnits = () => adminGet<{ items: PerformanceUnit[] }>(`${BASE}/units`);

export const getRatingScales = () => adminGet<{ items: RatingScale[] }>(`${BASE}/scales`);
export const createRatingScale = (payload: ScaleInput) => adminPost<{ data: RatingScale }>(`${BASE}/scales`, payload);
export const previewRatingScale = (categories: CategoryBand[], scores: number[]) =>
  adminPost<ScalePreview>(`${BASE}/scales/preview`, { categories, scores });

export const getLinkableUsers = () => adminGet<{ items: LinkableUser[] }>(`${BASE}/staff/linkable-users`);

/** Shared colour treatment for the four categories, reused by every performance chart and badge. */
export const CATEGORY_STYLE: Record<CategoryKey, { bg: string; text: string; solid: string }> = {
  above_expectation: { bg: "#DCFCE7", text: "#15803D", solid: "#16A34A" },
  meeting_expectation: { bg: "#DBEAFE", text: "#1D4ED8", solid: "#2563EB" },
  approaching_expectation: { bg: "#FEF3C7", text: "#B45309", solid: "#F59E0B" },
  below_expectation: { bg: "#FEE2E2", text: "#B91C1C", solid: "#DC2626" },
};


// ---- Job descriptions, KPIs, versions ----------------------------------------------------

export type JDResponsibility = { title: string; weight_pct: number; description: string; criteria: string[] };
export type JDCompetency = { key?: string; title: string; description: string };
export type JobDescription = {
  title: string;
  reports_to: string;
  branch: string;
  department: string;
  grade: string;
  date: string;
  purpose: string;
  responsibilities: JDResponsibility[];
  mandates: string;
  planning: string;
  relationships: string;
  qualifications: string[];
  competencies: JDCompetency[];
  approvals: string[];
  objective_rows: string[];
};
export type Kpi = {
  key: string;
  label: string;
  description: string | null;
  unit: string;
  direction: string;
  weight: number;
  source: string;
  frequency: string;
  cap_pct: number | null;
  jd_section: string | null;
  sort_order?: number;
};
export type RoleVersion = {
  role_id: string;
  role_key: string;
  role_name: string;
  version: number;
  is_latest: boolean;
  locked: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string | null;
  jd: JobDescription;
  kpis: Kpi[];
  signoff_chain: string[];
  effective_signoff_chain: string[];
  requires_ceo_signoff: boolean;
  weights: { responsibilities_total: number; kpis_total: number };
  configured: boolean;
  created_new_version: boolean;
};
export type VersionSummary = {
  version: number;
  is_latest: boolean;
  locked: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  kpi_count: number;
};
export type JDOptions = {
  kpi_units: string[];
  kpi_directions: string[];
  kpi_sources: string[];
  kpi_frequencies: string[];
  signoff_steps: string[];
  default_competencies: JDCompetency[];
};
export type AIMeta = { provider: string; model: string; prompt_version: string; cached: boolean; label: string };
export type JDExtract = { jd: JobDescription; warnings: string[]; ai: AIMeta };
export type KpiSuggestion = { kpis: Kpi[]; ai_used: boolean; ai: AIMeta | null; fallback_reason: string | null; warnings: string[] };

export type RoleVersionSave = {
  jd: JobDescription;
  kpis: Kpi[];
  signoff_chain: string[];
  requires_ceo_signoff: boolean;
  note?: string | null;
};

export const getJDOptions = () => adminGet<JDOptions>(`${BASE}/jd-options`);
export const getRoleJD = (roleId: string, version?: number) =>
  adminGet<RoleVersion>(version ? `${BASE}/roles/${roleId}/versions/${version}` : `${BASE}/roles/${roleId}/jd`);
export const getRoleVersions = (roleId: string) => adminGet<{ items: VersionSummary[] }>(`${BASE}/roles/${roleId}/versions`);
export const saveRoleJD = (roleId: string, payload: RoleVersionSave) => adminPut<RoleVersion>(`${BASE}/roles/${roleId}/jd`, payload);
export const suggestKpis = (responsibilities: JDResponsibility[], regenerate = false) =>
  adminPost<KpiSuggestion>(`${BASE}/ai/suggest-kpis`, { responsibilities, regenerate });

/** Sends the raw file as the request body (no multipart); the server decides the type from the bytes. */
export async function extractJD(file: File): Promise<JDExtract> {
  const response = await fetch(`${API_BASE_URL}${BASE}/ai/extract-jd?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAdminToken() ?? ""}` },
    body: file,
  });
  if (response.ok) return (await response.json()) as JDExtract;
  let detail = "Couldn't read that file.";
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string") detail = data.detail;
  } catch {
    // keep the generic message
  }
  throw new Error(response.status === 401 ? "Your session has expired. Please sign in again." : detail);
}


// ---- Organisation structure ---------------------------------------------------------------

export type OrgNode = {
  id: string;
  full_name: string;
  role_name: string | null;
  level_label: string | null;
  unit_name: string | null;
  status: StaffStatus;
  is_active: boolean;
  direct_reports: number;
  total_reports: number;
  children: OrgNode[];
};
export type OrgIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  profile_id?: string | null;
  unit_id?: string | null;
  region_id?: string | null;
  role_id?: string | null;
};
export type OrgHealth = { issues: OrgIssue[]; counts: Record<string, number> };
export type SetupRegion = { name: string; branch_ids: string[]; exists: boolean };
export type SetupPreview = {
  branches: { branch_id: string; name: string; unit_id: string | null; proposed_region: string | null }[];
  regions: SetupRegion[];
  extra_units: { name: string; kind: string; exists: boolean }[];
  unmatched: string[];
};
export type SetupResult = { units_created: number; units_linked: number; regions_created: number; links_created: number; conflicts: string[] };

export const getOrgTree = (includeInactive = false) =>
  adminGet<{ roots: OrgNode[]; total: number }>(`${BASE}/org-tree${includeInactive ? "?include_inactive=true" : ""}`);
export const getOrgHealth = () => adminGet<OrgHealth>(`${BASE}/org-health`);

// Flat facts for the Structure view (chain-of-command trees are built from these in the browser).
export type StructPerson = {
  id: string;
  full_name: string;
  role_key: string;
  role_name: string | null;
  department: string | null;
  level_label: string | null;
  is_executive: boolean;
  status: string;
  is_active: boolean;
  unit_id: string | null;
  manager_id: string | null;
  covers: string[]; // other units they also work in
};
export type StructUnit = { id: string; name: string; kind: string; manager_profile_id: string | null; region_id: string | null; parent_unit_id: string | null };
export type StructRegion = { id: string; name: string; manager_profile_id: string | null };
export type OrgStructure = { people: StructPerson[]; units: StructUnit[]; regions: StructRegion[] };
export const getOrgStructure = (includeInactive = false) =>
  adminGet<OrgStructure>(`${BASE}/org-structure${includeInactive ? "?include_inactive=true" : ""}`);
export const getSetupPreview = () => adminGet<SetupPreview>(`${BASE}/org-setup/preview`);
export const applySetup = (regions: SetupRegion[]) => adminPost<SetupResult>(`${BASE}/org-setup/apply`, { regions });

// ---- Levels and targets --------------------------------------------------------------------

export type PerformanceLevel = {
  id: string;
  role_id: string;
  key: string;
  label: string;
  rank: number;
  default_targets: Record<string, number>;
  note: string | null;
  is_active: boolean;
  staff_count: number;
};
export type TargetRow = { kpi_key: string; label: string; unit: string; direction: string; value: number | null; effective_from: string | null; source: string | null; reason: string | null };
export type TargetHistoryRow = { id: string; kpi_key: string; effective_from: string; value: number; source: string; reason: string; set_by_username: string | null; created_at: string };
export type StaffTargets = { profile_id: string; month: string; items: TargetRow[]; history: TargetHistoryRow[] };
export type TargetGridRow = { profile_id: string; full_name: string; unit_name: string | null; role_name: string | null; level_label: string | null; value: number | null; effective_from: string | null; source: string | null; has_kpi: boolean };
export type BulkMode = "set_value" | "level_defaults" | "copy_forward";
export type BulkInput = {
  mode: BulkMode;
  effective_from: string;
  reason: string;
  dry_run: boolean;
  role_id?: string | null;
  unit_id?: string | null;
  level_id?: string | null;
  kpi_key?: string | null;
  value?: number | null;
  overwrite?: boolean;
  source_month?: string | null;
  uplift_pct?: number;
};
export type PlanItem = { profile_id: string; full_name: string; kpi_key: string | null; current: number | null; new: number | null; action: "create" | "unchanged" | "skip"; note: string | null };
export type BulkResult = { dry_run: boolean; applied: number; summary: Record<"create" | "unchanged" | "skip", number>; items: PlanItem[] };
export type TargetRequest = {
  id: string;
  profile_id: string;
  profile_name: string | null;
  kpi_key: string;
  effective_from: string;
  proposed_value: number;
  current_value: number | null;
  reason: string;
  requested_by_username: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  decided_by_username: string | null;
  decision_note: string | null;
  created_at: string;
  is_mine: boolean;
  can_decide: boolean;
};

export const getLevels = (roleId?: string) => adminGet<{ items: PerformanceLevel[] }>(`${BASE}/levels${roleId ? `?role_id=${encodeURIComponent(roleId)}` : ""}`);
export const getStaffTargets = (profileId: string, month?: string) =>
  adminGet<StaffTargets>(`${BASE}/staff/${profileId}/targets${month ? `?month=${month}` : ""}`);
export const setStaffTarget = (profileId: string, payload: { kpi_key: string; effective_from: string; value: number; reason: string }) =>
  adminPut<{ changed: boolean; message: string; data: StaffTargets }>(`${BASE}/staff/${profileId}/targets`, payload);
export const getTargetsGrid = (params: { kpi_key: string; month?: string; role_id?: string; unit_id?: string; level_id?: string }) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
  return adminGet<{ items: TargetGridRow[] }>(`${BASE}/targets/grid?${q.toString()}`);
};
export const bulkTargets = (payload: BulkInput) => adminPost<BulkResult>(`${BASE}/targets/bulk`, payload);
export const requestTargetChange = (profileId: string, payload: { kpi_key: string; effective_from: string; value: number; reason: string }) =>
  adminPost<{ data: TargetRequest }>(`${BASE}/staff/${profileId}/target-requests`, payload);
export const getTargetRequests = (status: string = "pending") => adminGet<{ items: TargetRequest[] }>(`${BASE}/target-requests?status=${status}`);
export const decideTargetRequest = (id: string, approve: boolean, note?: string) =>
  adminPost<{ data: TargetRequest }>(`${BASE}/target-requests/${id}/decision`, { approve, note: note || null });
export const withdrawTargetRequest = (id: string) => adminPost<{ data: TargetRequest }>(`${BASE}/target-requests/${id}/withdraw`, {});


// ---- Monthly entries ----------------------------------------------------------------------

export type EntrySuggestion = { count: number; total_amount: number; note: string };
export type EntryRow = {
  kpi_key: string;
  label: string;
  unit: string;
  direction: string;
  entry_id: string | null;
  value: number | null;
  status: "draft" | "submitted" | "verified" | "rejected" | "locked" | null;
  note: string | null;
  rejection_reason: string | null;
  target: number | null;
  verified_value: number | null;
  achievement_pct: number | null;
  pending_verification: boolean;
  evidence_name: string | null;
  suggestion: EntrySuggestion | null;
};
export type EntryMonth = {
  profile_id: string;
  month: string;
  window: { state: "open" | "closed" | "future"; closes_on: string | null };
  rows: EntryRow[];
  can_enter: boolean;
  can_verify: boolean;
};
export type QueueItem = {
  entry_id: string;
  profile_id: string;
  profile_name: string;
  unit_name: string | null;
  kpi_key: string;
  label: string;
  unit: string;
  month: string;
  value: number;
  target: number | null;
  entered_by_username: string | null;
  submitted_at: string | null;
};

export const getEntries = (profileId: string, month: string) => adminGet<EntryMonth>(`${BASE}/staff/${profileId}/entries?month=${month}`);
export const saveEntry = (profileId: string, payload: { kpi_key: string; month: string; value: number; note?: string | null }) =>
  adminPut<{ message: string; data: EntryMonth }>(`${BASE}/staff/${profileId}/entries`, payload);
export const submitEntries = (profileId: string, month: string) =>
  adminPost<{ message: string; data: EntryMonth }>(`${BASE}/staff/${profileId}/entries/submit`, { month });
export const getEntryQueue = (month?: string) => adminGet<{ items: QueueItem[] }>(`${BASE}/entries/queue${month ? `?month=${month}` : ""}`);
export const decideEntries = (entryIds: string[], approve: boolean, reason?: string) =>
  adminPost<{ updated: number; failed: { entry_id: string; reason: string }[] }>(`${BASE}/entries/decision`, { entry_ids: entryIds, approve, reason: reason || null });
export const reopenEntry = (entryId: string, reason: string) => adminPost<{ message: string; data: EntryMonth }>(`${BASE}/entries/${entryId}/reopen`, { reason });

// ---- Appraisals ------------------------------------------------------------------------------

export type ChainStep = { step: string; label: string; state: "done" | "current" | "upcoming"; signed_by: string | null; signed_at: string | null; comment: string | null };
export type AppraisalItem = {
  kpi_key: string;
  label: string;
  weight: number;
  criteria: string | null;
  self_text: string | null;
  self_rating: number | null;
  manager_rating: number | null;
  final_rating: number | null;
  self_weighted: number | null;
  manager_weighted: number | null;
};
export type AppraisalCompetency = { key: string; title: string; self_rating: number | null; manager_rating: number | null };
export type AppraisalDispute = {
  id: string;
  item_key: string | null;
  reason: string;
  raised_by_username: string;
  status: "open" | "resolved";
  resolution: string | null;
  new_manager_rating: number | null;
  resolved_by_username: string | null;
  created_at: string;
  resolved_at: string | null;
};
export type AppraisalPermissions = {
  can_edit: boolean;
  editable: string[];
  can_submit: boolean;
  can_sign: boolean;
  can_return: boolean;
  can_dispute: boolean;
  can_resolve: boolean;
  can_acknowledge: boolean;
  can_reopen: boolean;
};
export type Appraisal = {
  id: string;
  profile: { id: string; full_name: string; role_name: string | null; unit_name: string | null; manager_name: string | null };
  period_key: string;
  period_label: string;
  status: "draft" | "in_review" | "finalised";
  current_step: string | null;
  current_step_label: string | null;
  chain: ChainStep[];
  items: AppraisalItem[];
  competencies: AppraisalCompetency[];
  objective_months: string[];
  objectives: { label: string; values: string[] }[];
  development_needs: { slot: number; text: string | null }[];
  signoffs: { step: string; label: string; decision: string; comment: string | null; actor_username: string; signed_at: string }[];
  disputes: AppraisalDispute[];
  self_weighted_total: number | null;
  manager_weighted_total: number | null;
  final_weighted_rating: number | null;
  acknowledged_at: string | null;
  acknowledged_by_username: string | null;
  source: string;
  extraction_status: string;
  permissions: AppraisalPermissions;
};
export type AppraisalSummary = {
  id: string;
  profile_id: string;
  profile_name: string;
  period_key: string;
  period_label: string;
  status: Appraisal["status"];
  current_step: string | null;
  current_step_label: string | null;
  awaiting_me: boolean;
  open_disputes: number;
  final_weighted_rating: number | null;
};
export type AppraisalFormSave = {
  items?: { kpi_key: string; self_text?: string | null; self_rating?: number | null; manager_rating?: number | null }[];
  competencies?: { key: string; self_rating?: number | null; manager_rating?: number | null }[];
  objectives?: { label: string; values: string[] }[];
  development_needs?: { slot: number; text: string | null }[];
};

type Wrapped = { message: string; data: Appraisal };
export const listAppraisals = (params: { status?: string; awaiting_me?: boolean; profile_id?: string } = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.awaiting_me) q.set("awaiting_me", "true");
  if (params.profile_id) q.set("profile_id", params.profile_id);
  return adminGet<{ items: AppraisalSummary[] }>(`${BASE}/appraisals?${q.toString()}`);
};
export const createAppraisal = (profileId: string, period: string) => adminPost<Wrapped>(`${BASE}/staff/${profileId}/appraisals`, { period });
export const getAppraisal = (id: string) => adminGet<Appraisal>(`${BASE}/appraisals/${id}`);
export const saveAppraisalForm = (id: string, body: AppraisalFormSave) => adminPut<Wrapped>(`${BASE}/appraisals/${id}/form`, body);
export const submitAppraisal = (id: string) => adminPost<Wrapped>(`${BASE}/appraisals/${id}/submit`, {});
export const signAppraisal = (id: string, decision: "sign" | "return", comment?: string) =>
  adminPost<Wrapped>(`${BASE}/appraisals/${id}/sign`, { decision, comment: comment || null });
export const disputeAppraisal = (id: string, itemKey: string | null, reason: string) =>
  adminPost<Wrapped>(`${BASE}/appraisals/${id}/disputes`, { item_key: itemKey, reason });
export const resolveDispute = (id: string, disputeId: string, resolution: string, newManagerRating: number | null) =>
  adminPost<Wrapped>(`${BASE}/appraisals/${id}/disputes/${disputeId}/resolve`, { resolution, new_manager_rating: newManagerRating });
export const acknowledgeAppraisal = (id: string) => adminPost<Wrapped>(`${BASE}/appraisals/${id}/acknowledge`, {});
export const reopenAppraisal = (id: string, reason: string) => adminPost<Wrapped>(`${BASE}/appraisals/${id}/reopen`, { reason });

/** Downloads a PDF the server builds (it needs the login token, so a plain link won't do). */
export async function downloadPdf(path: string, fileName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${BASE}${path}`, { headers: { Authorization: `Bearer ${getAdminToken() ?? ""}` } });
  if (!response.ok) throw new Error(response.status === 404 ? "That document isn't available." : "Couldn't download the PDF.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
export const downloadAppraisalPdf = (id: string) => downloadPdf(`/appraisals/${id}/pdf`, `appraisal-${id.slice(0, 8)}.pdf`);
export const downloadAppraisalTemplate = (roleId: string, roleKey: string) => downloadPdf(`/roles/${roleId}/appraisal-template.pdf`, `appraisal-template-${roleKey}.pdf`);


// ---- Excel import wizard (Phase 2d) -------------------------------------------------------

export type ImportSheetMapping = {
  action: "use" | "create" | "skip";
  unit_id: string | null;
  unit_name?: string;
  new_unit?: { name: string; kind: "branch" | "team" | "head_office" };
  role_key: string | null;
  reason?: string;
};
export type ImportSheet = { name: string; kind: string; hidden: boolean; rows?: number; months?: string[]; mapping?: ImportSheetMapping };
export type ImportCandidate = { profile_id: string; full_name: string; score: number };
export type ImportName = {
  key: string;
  name: string;
  state: "matched" | "new" | "team_row" | "ambiguous" | "decided";
  action: "match" | "create" | "skip" | null;
  profile_id: string | null;
  matched_name: string | null;
  candidates: ImportCandidate[];
  sheets: string[];
};
export type ImportIssue = { code: string; severity: "info" | "warning" | "error"; message: string; sheet: string | null; row?: number | null; month: string | null };
export type ImportOptionsState = {
  include_par: boolean;
  import_targets: boolean;
  import_actions: boolean;
  create_missing_staff: boolean;
  overwrite_manual: boolean;
  overwrite_targets: boolean;
  default_role_key: string;
  exclude_months: string[];
};
export type ImportReconciliation = {
  company_total_differences: { branch: string; sheet: string; month: string; company_total: number; branch_sheet_total: number; difference: number; status: "small" | "mismatch" }[];
  company_total_difference_count: number;
  company_branches_without_sheet: string[];
  band_differences: { branch: string; month: string; hand_counted: Record<string, number>; recomputed: Record<string, number> }[];
  band_difference_count: number;
  note: string;
};
export type ImportPreview = {
  id: string;
  status: "previewed" | "committed" | "undone";
  original_name: string;
  year: number;
  sheets: ImportSheet[];
  names: ImportName[];
  options: ImportOptionsState;
  decisions: { sheets?: Record<string, Partial<ImportSheetMapping>>; staff?: Record<string, { action: string; profile_id?: string; role_key?: string }> };
  unresolved: number;
  issues: ImportIssue[];
  issue_counts: Record<string, number>;
  issues_dropped: number;
  reconciliation: ImportReconciliation;
  is_hr: boolean;
};
export type ImportRunResult = { counts: Record<string, number>; issues: ImportIssue[]; dry_run: boolean; import_id: string; touched_profiles: number };
export type ImportListItem = {
  id: string;
  original_name: string;
  status: "previewed" | "committed" | "undone";
  created_by: string;
  created_at: string;
  committed_at: string | null;
  undone_at: string | null;
  counts: Record<string, number> | null;
};
export type ImportDecisionsBody = {
  options?: Partial<ImportOptionsState>;
  sheets?: Record<string, { action: "use" | "create" | "skip"; unit_id?: string | null; new_unit?: { name: string; kind: "branch" | "team" | "head_office" }; role_key?: string | null }>;
  staff?: Record<string, { action: "match" | "create" | "skip"; profile_id?: string | null; role_key?: string | null }>;
};

const IMPORT = `${BASE}/import`;
export const listImports = () => adminGet<{ items: ImportListItem[] }>(IMPORT);
export const getImport = (id: string) => adminGet<ImportPreview>(`${IMPORT}/${id}`);
export const saveImportDecisions = (id: string, body: ImportDecisionsBody) => adminPut<ImportPreview>(`${IMPORT}/${id}/decisions`, body);
export const dryRunImport = (id: string) => adminPost<ImportRunResult>(`${IMPORT}/${id}/dry-run`, {});
export const commitImport = (id: string) => adminPost<ImportRunResult>(`${IMPORT}/${id}/commit`, { confirm: true });
export const undoImport = (id: string) => adminPost<{ reverted: number; kept: number }>(`${IMPORT}/${id}/undo`, { confirm: true });
export const discardImport = (id: string) => adminDelete<{ message: string }>(`${IMPORT}/${id}`);

/** Sends the raw .xlsx as the request body (no multipart); the server checks the bytes, not the name. */
export async function uploadImportWorkbook(file: File, year?: number): Promise<ImportPreview> {
  const q = new URLSearchParams({ filename: file.name });
  if (year) q.set("year", String(year));
  const response = await fetch(`${API_BASE_URL}${IMPORT}/preview?${q.toString()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAdminToken() ?? ""}` },
    body: file,
  });
  if (response.ok) return (await response.json()) as ImportPreview;
  let detail = "Couldn't read that workbook.";
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string") detail = data.detail;
  } catch {
    // keep the generic message
  }
  throw new Error(response.status === 401 ? "Your session has expired. Please sign in again." : detail);
}
export const downloadImportTemplate = () => downloadPdf("/import/template", "staff-performance-import-template.xlsx");


// ---- Scores and reports (Phase 3) -------------------------------------------------------

export type ReportPeriod = { key: string; kind: string; label: string; start: string; end: string };
export type ReportCategory = { key: CategoryKey; label: string } | null;
export type ReportScale = { effective_from: string; categories: CategoryBand[]; rating_bands: RatingBand[] };
export type ReportKpi = {
  key: string;
  label: string;
  unit: string;
  direction: string;
  weight: number;
  source: string;
  actual?: number | null;
  target?: number | null;
  achievement_pct?: number | null;
  rating?: number | null;
  pi: number | null;
  months_scored?: number;
  months_pending?: number;
  months_unreported?: number;
  months_no_target?: number;
  not_scored_reason: string | null;
  per_month?: Record<string, { actual: number | null; target: number | null; pct: number | null; state: string }>;
};
export type ReportPerson = {
  profile_id: string;
  name: string;
  role_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  status: string;
  score: number | null;
  category: ReportCategory;
  rating: number | null;
  legacy_band: string | null;
  headline: { label: string; key: string; actual: number | null; target: number | null; pct: number | null } | null;
  coverage_pct: number | null;
  competency_score: number | null;
  trend: { month: string; actual: number | null; target: number | null; pct: number | null; state: string }[];
  spark: (number | null)[];
  attention: string[];
  kpis?: ReportKpi[];
  peer_rank?: { rank: number; of: number } | null;
};
export type GroupSummary = {
  people: number;
  achievement_pct: number | null;
  actual_total: number;
  target_total: number;
  scored_people: number;
  average_score: number | null;
  average_category: ReportCategory;
  category_counts: Record<string, number>;
  legacy_counts: Record<string, number>;
  unscored: number;
};
export type Heatmap = { months: string[]; rows: { profile_id?: string; unit_id?: string; name: string; cells: (number | null)[] }[] };
export type PersonReport = {
  period: ReportPeriod;
  scale: ReportScale;
  person: ReportPerson;
  quarter_to_date: { period: string; score: number | null; category: ReportCategory; headline: ReportPerson["headline"] };
  year_to_date: { score: number | null; category: ReportCategory; headline: ReportPerson["headline"] };
  explanation: string[];
  show_pip: boolean;
};
export type TeamReport = {
  period: ReportPeriod;
  scale: ReportScale;
  leader: ReportPerson;
  summary: GroupSummary;
  people: ReportPerson[];
  needs_attention: ReportPerson[];
  leader_vs_team: { leader_score: number | null; team_average: number | null };
  heatmap: Heatmap;
};
export type UnitReport = {
  period: ReportPeriod;
  scale: ReportScale;
  unit: { id: string; name: string; kind: string };
  summary: GroupSummary;
  organisation: { achievement_pct: number | null; average_score: number | null };
  small_unit: boolean;
  small_unit_note: string | null;
  people: ReportPerson[];
  heatmap: Heatmap;
  needs_attention: ReportPerson[];
};
export type BranchRow = {
  unit_id: string;
  name: string;
  people: number;
  actual_total: number;
  target_total: number;
  achievement_pct: number | null;
  average_score: number | null;
  category: ReportCategory;
  category_counts?: Record<string, number>;
  small_unit?: boolean;
};
export type RegionReport = { period: ReportPeriod; scale: ReportScale; region: { id: string; name: string }; summary: GroupSummary; branches: BranchRow[] };
export type MonthRow = {
  month: string;
  achievement_pct: number | null;
  average_score: number | null;
  category_counts: Record<string, number>;
  legacy_counts: Record<string, number>;
  scored_people: number;
  actual_total: number;
  target_total: number;
};
export type Mover = { profile_id: string; name: string; unit_name: string | null; score: number; previous: number; change: number };
export type OrgReport = {
  period: ReportPeriod;
  previous: ReportPeriod;
  scale: ReportScale;
  summary: GroupSummary;
  by_month: MonthRow[];
  branches: BranchRow[];
  heatmap: Heatmap;
  top_movers: Mover[];
  bottom_movers: Mover[];
  kes: { actual: number; target: number; achievement_pct: number | null };
};
export type CompareSide = Pick<GroupSummary, "people" | "achievement_pct" | "average_score" | "average_category" | "category_counts" | "legacy_counts" | "actual_total" | "target_total"> & { period: ReportPeriod };
export type CompareReport = { basis: string; a: CompareSide; b: CompareSide; change: { achievement_pct: number | null; average_score: number | null; actual_total: number | null } };

const REPORTS = "/reports";
const q = (period: string, extra: Record<string, string | undefined> = {}) => {
  const p = new URLSearchParams({ period });
  Object.entries(extra).forEach(([k, v]) => v && p.set(k, v));
  return `?${p.toString()}`;
};
export const getMyReport = (period: string) => adminGet<PersonReport>(`${BASE}${REPORTS}/me${q(period)}`);
export const getPersonReport = (id: string, period: string) => adminGet<PersonReport>(`${BASE}${REPORTS}/person/${encodeURIComponent(id)}${q(period)}`);
export const getTeamReport = (period: string, leaderId?: string) => adminGet<TeamReport>(`${BASE}${REPORTS}/team${q(period, { leader_id: leaderId })}`);
export const getUnitReport = (id: string, period: string) => adminGet<UnitReport>(`${BASE}${REPORTS}/unit/${encodeURIComponent(id)}${q(period)}`);
export const getRegionReport = (id: string, period: string) => adminGet<RegionReport>(`${BASE}${REPORTS}/region/${encodeURIComponent(id)}${q(period)}`);
export const getOrgReport = (period: string) => adminGet<OrgReport>(`${BASE}${REPORTS}/organisation${q(period)}`);
export const getCompare = (a: string, b: string, scope: { unitId?: string; profileId?: string } = {}) =>
  adminGet<CompareReport>(`${BASE}${REPORTS}/compare?${new URLSearchParams({ a, b, ...(scope.unitId ? { unit_id: scope.unitId } : {}), ...(scope.profileId ? { profile_id: scope.profileId } : {}) }).toString()}`);
export const downloadReport = (kind: "person" | "team" | "unit" | "region" | "org", period: string, id: string | undefined, format: "xlsx" | "pdf") =>
  downloadPdf(`${REPORTS}/export?${new URLSearchParams({ kind, period, format, ...(id ? { id } : {}) }).toString()}`, `performance-report.${format}`);
export const recomputeSnapshots = (period: string) => adminPost<{ period: string; stored: number }>(`${BASE}${REPORTS}/snapshots/recompute`, { period });
export type RegionOption = { id: string; name: string; unit_count: number };
export const getRegionOptions = () => adminGet<{ items: RegionOption[] }>(`${BASE}/regions`);


// ---- Filled forms, review and evidence (Phase 2c part 2) --------------------------------------

export type ExtractedItem = { kpi_key: string; self_text: string | null; self_rating: number | null; manager_rating: number | null; confidence: number; low_confidence?: boolean };
export type ExtractedCompetency = { key: string; self_rating: number | null; manager_rating: number | null; confidence: number; low_confidence?: boolean };
export type ExtractedObjective = { label: string; values: string[]; confidence: number; low_confidence?: boolean };
export type ExtractedNeed = { slot: number; text: string; confidence: number; low_confidence?: boolean };
export type ExtractionDraft = {
  items: ExtractedItem[];
  competencies: ExtractedCompetency[];
  objectives: ExtractedObjective[];
  development_needs: ExtractedNeed[];
  comments: Record<string, string>;
  warnings: string[];
  ocr_confidence?: number | null;
  low_confidence_count: number;
  ai: { provider: string; model: string; prompt_version: string; cached: boolean; label: string };
};
export type ExtractionReview = {
  extraction_status: string;
  file_name: string | null;
  file_kind: string | null;
  draft: ExtractionDraft | null;
  ocr_confidence: number | null;
  source_text: string | null;
  source_text_note: string | null;
  can_confirm: boolean;
  can_confirm_manager_column: boolean;
  rows: {
    items: { kpi_key: string; label: string; weight: number; self_text: string | null; self_rating: number | null; manager_rating: number | null }[];
    competencies: { key: string; title: string; self_rating: number | null; manager_rating: number | null }[];
    objectives: { label: string; values: string[] }[];
    development_needs: { slot: number; text: string | null }[];
  };
};
export type ReviewedValues = {
  confirm: boolean;
  items: { kpi_key: string; self_text?: string | null; self_rating?: number | null; manager_rating?: number | null }[];
  competencies: { key: string; self_rating?: number | null; manager_rating?: number | null }[];
  objectives: { label: string; values: string[] }[];
  development_needs: { slot: number; text: string | null }[];
};

async function postFile<T>(path: string, file: File): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${BASE}${path}${path.includes("?") ? "&" : "?"}filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAdminToken() ?? ""}` },
    body: file,
  });
  if (response.ok) return (await response.json()) as T;
  let detail = "Couldn't upload that file.";
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string") detail = data.detail;
  } catch {
    // keep the generic message
  }
  throw new Error(response.status === 401 ? "Your session has expired. Please sign in again." : detail);
}

export const uploadAppraisalForm = (id: string, file: File) => postFile<{ message: string; extraction_status: string; can_extract: boolean; file_name: string }>(`/appraisals/${id}/upload`, file);
export const extractAppraisalForm = (id: string, regenerate = false) => adminPost<{ extraction_status: string; draft: ExtractionDraft }>(`${BASE}/appraisals/${id}/extract${regenerate ? "?regenerate=true" : ""}`, {});
export const getExtractionReview = (id: string) => adminGet<ExtractionReview>(`${BASE}/appraisals/${id}/extraction`);
export const confirmExtraction = (id: string, body: ReviewedValues) => adminPost<{ message: string; applied: Record<string, number> }>(`${BASE}/appraisals/${id}/extraction/confirm`, body);
export const discardExtraction = (id: string) => adminDelete<{ message: string }>(`${BASE}/appraisals/${id}/extraction`);
export const downloadAppraisalFile = (id: string, kind: string) => downloadPdf(`/appraisals/${id}/file`, `appraisal-${id.slice(0, 8)}.${kind}`);
export const downloadAppraisalTemplateDocx = (roleId: string, roleKey: string) => downloadPdf(`/roles/${roleId}/appraisal-template.docx`, `appraisal-template-${roleKey}.docx`);
export const uploadEvidence = (entryId: string, file: File) => postFile<{ message: string; evidence_name: string }>(`/entries/${entryId}/evidence`, file);
export const downloadEvidence = (entryId: string, name: string) => downloadPdf(`/entries/${entryId}/evidence`, name);

// ---- Phase 4a: projections and suggestions ------------------------------------------------------------------------------

const INSIGHTS = `/api/admin/performance/insights`;

export interface ProjectionBlock {
  available: boolean;
  reason?: string;
  method?: string;
  data_window_months?: number;
  remaining_months?: number;
  actual_to_date?: number;
  target_total?: number;
  projected_actual_total?: number;
  projected_pct?: number | null;
  projected_monthly_average?: number | null;
}
export interface RequiredRunRate {
  available: boolean;
  reason?: string;
  goal_pct?: number;
  remaining_months?: number;
  needed_per_month?: number;
  needed_vs_monthly_target_pct?: number | null;
  already_met?: boolean;
}
export interface CategoryChances {
  available: boolean;
  reason?: string;
  method?: string;
  simulations?: number;
  categories?: Record<string, { label: string; low_pct: number; high_pct: number }>;
}
export interface ProjectionHorizon {
  period: { label: string; start: string; end: string };
  projection: ProjectionBlock;
  required_run_rate: RequiredRunRate;
  category_chances: CategoryChances;
}
export interface PersonProjection {
  available: boolean;
  reason?: string;
  headline?: string;
  data_window_months?: number;
  name?: string;
  horizons?: { quarter_end?: ProjectionHorizon; year_end?: ProjectionHorizon };
}
export interface GroupProjection {
  people_counted: number;
  year_end: ProjectionBlock;
  quarter_end: ProjectionBlock;
  method: string;
}
export const getMyProjection = () => adminGet<PersonProjection>(`${INSIGHTS}/projection/me`);
export const getPersonProjection = (id: string) => adminGet<PersonProjection>(`${INSIGHTS}/projection/person/${encodeURIComponent(id)}`);
export const getUnitProjection = (id: string) => adminGet<GroupProjection>(`${INSIGHTS}/projection/unit/${encodeURIComponent(id)}`);

export interface AdviceAction { action: string; owner: string; timeframe: string }
export interface Advice {
  source: "ai" | "rules";
  summary: string;
  root_causes: string[];
  actions: AdviceAction[];
  training: string[];
  confidence: string | null;
  label: string;
  why_fallback?: string;
  ai?: { provider: string; model: string; prompt_version: string; cached: boolean };
}
export interface Recommendation {
  id: string;
  entity_type: "staff" | "unit";
  entity_id: string;
  entity_name: string | null;
  period_key: string;
  rule_key: string;
  severity: "info" | "action" | "urgent";
  restricted: boolean;
  title: string;
  detail: string | null;
  figures: Record<string, unknown> | null;
  advice: Advice | null;
  status: "new" | "acknowledged" | "actioned" | "dismissed";
  status_note: string | null;
  due_on: string | null;
  assignee_profile_id: string | null;
  outcome: Record<string, unknown> | null;
  created_at: string | null;
}
export const getRecommendations = (status: "open" | "all" = "open") =>
  adminGet<{ items: Recommendation[]; can_generate: boolean }>(`${INSIGHTS}/recommendations?status=${status}`);
export const generateRecommendations = () => adminPost<{ people: number; created: number; updated: number }>(`${INSIGHTS}/recommendations/generate`, {});
export const updateRecommendation = (
  id: string,
  body: { status: "acknowledged" | "actioned" | "dismissed"; note?: string; due_on?: string | null; assignee_profile_id?: string | null },
) => adminPatch<Recommendation>(`${INSIGHTS}/recommendations/${encodeURIComponent(id)}`, body);
export const getRecommendationAdvice = (id: string, regenerate = false) =>
  adminPost<Advice>(`${INSIGHTS}/recommendations/${encodeURIComponent(id)}/advice?regenerate=${regenerate}`, {});

// ---- Phase 4b-1: governance ---------------------------------------------------------------------------------------------

const GOV = `/api/admin/performance/governance`;
export interface NoticeState { version: string; text: string; acknowledged: boolean; acknowledged_at: string | null }
export interface PeriodLockRow { month: string; status: "locked" | "open"; locked_by: string | null; locked_at: string | null; reopened_by: string | null; reopen_reason: string | null }
export interface RetentionCandidates { retention_years: number; cutoff: string; items: { profile_id: string; name: string; exit_date: string }[] }
export interface AccessLogRow { viewer: string; action: string; at: string | null }
export const getNotice = () => adminGet<NoticeState>(`${GOV}/notice`);
export const acknowledgeNotice = () => adminPost<NoticeState>(`${GOV}/notice/acknowledge`, {});
export const getNoticeOutstanding = () => adminGet<{ version: string; items: { profile_id: string; name: string }[] }>(`${GOV}/notice/outstanding`);
export const getLocks = () => adminGet<{ items: PeriodLockRow[] }>(`${GOV}/locks`);
export const lockPeriod = (period: string) => adminPost<{ locked: string[] }>(`${GOV}/locks`, { period });
export const reopenPeriod = (period: string, reason: string) => adminPost<{ reopened: string[] }>(`${GOV}/locks/reopen`, { period, reason });
export const getRetentionCandidates = () => adminGet<RetentionCandidates>(`${GOV}/retention/candidates`);
export const anonymiseLeaver = (id: string, confirm: string) =>
  adminPost<{ anonymised: boolean; files: number; text_fields: number }>(`${GOV}/retention/${encodeURIComponent(id)}/anonymise`, { confirm });
export const getAccessLog = (id: string) => adminGet<{ items: AccessLogRow[] }>(`${GOV}/access-log/${encodeURIComponent(id)}`);

// ---- Phase 4b-2: operations -----------------------------------------------------------------------------------------------

const OPS = `/api/admin/performance/ops`;
export interface ReminderItem { message: string; link: string }
export interface TrackedAction { id: string; profile_id: string; name: string | null; action_type: string; restricted: boolean; started_on: string; review_on: string | null; ends_on: string | null; outcome: string | null; note: string | null; overdue?: boolean }
export interface AnomalyRow { profile_id: string; name: string | null; kpi_key: string; month: string; value: number; typical: number; why: string }
export interface QualityIssue { kind: string; text: string; count: number; items: { profile_id: string; name: string }[] }
export interface CalibrationRow { manager_id: string; manager: string | null; team_size: number; average_score: number; gap_to_company: number | null; flag: string | null }
export interface Calibration { period: string; company_average: number | null; managers: CalibrationRow[]; note: string }
export interface UnitRank { unit_id: string; name: string; people: number; achievement_pct: number | null; average_score: number | null; small_unit: boolean }
export interface TimelineEvent { date: string; kind: string; text: string; restricted?: boolean }
export interface TrainingThemes { overall: { word: string; count: number }[]; units: { unit_id: string; unit: string; people: number; themes: { word: string; count: number }[] }[]; note: string }
export const getMyReminders = () => adminGet<{ items: ReminderItem[] }>(`${OPS}/reminders/me`);
export const getOpenActions = () => adminGet<{ items: TrackedAction[] }>(`${OPS}/actions/open`);
export const updateTrackedAction = (id: string, body: { review_on?: string | null; ends_on?: string | null; note?: string | null; outcome?: string }) =>
  adminPatch<TrackedAction>(`${OPS}/actions/${encodeURIComponent(id)}`, body);
export const getAnomalies = () => adminGet<{ items: AnomalyRow[] }>(`${OPS}/anomalies`);
export const getDataQuality = () => adminGet<{ issues: QualityIssue[] }>(`${OPS}/data-quality`);
export const getCalibration = () => adminGet<Calibration>(`${OPS}/calibration`);
export const getUnitLeaderboard = () => adminGet<{ items: UnitRank[] }>(`${OPS}/leaderboard/units`);
export const getTimeline = (id: string) => adminGet<{ items: TimelineEvent[] }>(`${OPS}/timeline/${encodeURIComponent(id)}`);
export const getTrainingThemes = () => adminGet<TrainingThemes>(`${OPS}/training-themes`);

// ---- Phase 6a: reminder channels ------------------------------------------------------------------------------------------

const NOTIFY = `/api/admin/performance/notifications`;
export interface NotifyPrefs { email_on: boolean; sms_on: boolean; phone: string | null; email_address_on_file: boolean; email_available: boolean; sms_available: boolean }
export interface DeliveryReport { since: string; email_configured: boolean; sms_configured: boolean; counts: { channel: string; status: string; count: number }[] }
export const getNotifyPrefs = () => adminGet<NotifyPrefs>(`${NOTIFY}/prefs/me`);
export const saveNotifyPrefs = (body: { email_on: boolean; sms_on: boolean; phone: string | null }) => adminPut<NotifyPrefs>(`${NOTIFY}/prefs/me`, body);
export const sendTestReminder = () => adminPost<{ results: Record<string, string> }>(`${NOTIFY}/test`, {});
export const getDeliveryReport = () => adminGet<DeliveryReport>(`${NOTIFY}/status`);

// ---- Phase 6b: weekly view -------------------------------------------------------------------------------------------------

export interface WeeklyReason { kind: string; severity: "urgent" | "action" | "info"; text: string }
export interface WeeklyPerson { profile_id: string; name: string | null; role: string | null; unit: string | null; score: number | null; category: string | null; trend: (number | null)[]; reasons: WeeklyReason[]; priority: number }
export interface WeeklyView {
  week_of: string; team_size: number; needing_attention: number; shown: number; people: WeeklyPerson[];
  recognise: { profile_id: string; name: string | null; score: number | null }[];
  to_verify: { profile_id: string; name: string | null; figures: number }[]; note: string;
}
export const getWeekly = () => adminGet<WeeklyView>(`/api/admin/performance/ops/weekly`);

// ---- Phase 6c: 360 feedback ------------------------------------------------------------------------------------------------

const F360 = `/api/admin/performance/feedback360`;
export interface F360Cycle { id: string; name: string; status: "draft" | "open" | "closed" | "released"; min_group: number; closes_on: string | null }
export interface F360Progress { subject_id: string; profile_id: string; name: string | null; asked: number; submitted: number; declined: number; pending_raters: string[] }
export interface F360Question { key: string; title: string; description: string }
export interface F360Request { rater_id: string; cycle: string; subject: string; relationship: string; status: string }
export interface F360Form extends F360Request { questions: F360Question[]; answers: Record<string, number> | null; strengths: string | null; development: string | null; anonymity: string }
export interface F360Group { shown: boolean; responses: number; averages?: Record<string, number>; strengths?: string[]; development?: string[]; message?: string }
export interface F360Results {
  subject_id?: string; subject: string | null; cycle: string; questions: F360Question[]; groups: Record<string, F360Group>;
  overall_others: Record<string, number> | null; self_vs_others: Record<string, number> | null; note: string;
}
export const f360Cycles = () => adminGet<{ items: F360Cycle[] }>(`${F360}/cycles`);
export const f360CreateCycle = (name: string, min_group: number) => adminPost<F360Cycle>(`${F360}/cycles`, { name, min_group });
export const f360Cycle = (id: string) => adminGet<F360Cycle & { progress: F360Progress[] }>(`${F360}/cycles/${encodeURIComponent(id)}`);
export const f360Suggest = (profileId: string) => adminGet<{ raters: { profile_id: string; name: string | null; relationship: string }[] }>(`${F360}/suggest/${encodeURIComponent(profileId)}`);
export const f360AddSubject = (id: string, profile_id: string) => adminPost<{ subject_id: string }>(`${F360}/cycles/${encodeURIComponent(id)}/subjects`, { profile_id });
export const f360SetStatus = (id: string, to: "open" | "closed" | "released") => adminPost<F360Cycle>(`${F360}/cycles/${encodeURIComponent(id)}/status`, { to });
export const f360MyRequests = () => adminGet<{ items: F360Request[] }>(`${F360}/my-requests`);
export const f360Request = (id: string) => adminGet<F360Form>(`${F360}/requests/${encodeURIComponent(id)}`);
export const f360Answer = (id: string, body: { answers: Record<string, number>; strengths: string | null; development: string | null }) => adminPut<{ status: string }>(`${F360}/requests/${encodeURIComponent(id)}`, body);
export const f360Decline = (id: string) => adminPost<{ status: string }>(`${F360}/requests/${encodeURIComponent(id)}/decline`, {});
export const f360MyResults = () => adminGet<{ items: F360Results[] }>(`${F360}/my-results`);
export const f360TeamResults = () => adminGet<{ items: F360Results[] }>(`${F360}/team-results`);
export const f360Results = (subjectId: string) => adminGet<F360Results>(`${F360}/results/${encodeURIComponent(subjectId)}`);

// ---- Phase 6d: goal cascading ---------------------------------------------------------------------------------------------

const CASC = `/api/admin/performance/cascade`;
export type CascadeLevel = "company" | "region" | "unit";
export interface CascadeGap { gap: number | null; state: "balanced" | "unallocated" | "over" | "no_target" }
export interface CascadePerson { profile_id: string; name: string; target: number | null }
export interface CascadeUnit extends CascadeGap { unit_id: string; name: string | null; target: number | null; individuals_total: number; people_without_target: number; people: CascadePerson[] }
export interface CascadeRegion extends CascadeGap { region_id: string | null; name: string; target: number | null; units_total: number; units: CascadeUnit[] }
export interface CascadeTree { kpi: string; month: string; company: (CascadeGap & { target: number | null; regions_total: number }) | null; regions: CascadeRegion[]; note: string }
export interface CascadeProposal { level: CascadeLevel; entity_id: string; child_level: string; parent: string; parent_target: number; rows: { child_id: string; name: string; current: number | null; proposed: number; change: number }[]; basis: string }
export const cascadeKpis = () => adminGet<{ items: { key: string; label: string; unit: string }[] }>(`${CASC}/kpis`);
export const cascadeTree = (kpi: string, month: string) => adminGet<CascadeTree>(`${CASC}/tree?kpi=${encodeURIComponent(kpi)}&month=${month}`);
export const cascadeSet = (b: { level: CascadeLevel; entity_id?: string; kpi_key: string; month: string; value: number; reason: string }) => adminPut<{ changed: boolean }>(`${CASC}/targets`, b);
export const cascadeProposal = (level: CascadeLevel, entity_id: string, kpi: string, month: string) =>
  adminGet<CascadeProposal>(`${CASC}/proposal?level=${level}&entity_id=${encodeURIComponent(entity_id)}&kpi=${encodeURIComponent(kpi)}&month=${month}`);
export const cascadeApply = (b: { level: CascadeLevel; entity_id?: string; kpi_key: string; month: string; confirm: boolean }) => adminPost<{ changed: number; children: number }>(`${CASC}/apply`, b);

// ---- Phase 6e: monthly board pack -------------------------------------------------------------------------------------
const PACK = `/api/admin/performance/pack`;
export interface BoardPackRow { id: string; month: string; label: string; generated_at: string | null; generated_by: string; summary: { achievement_pct?: number | null; ytd_pct?: number | null; completeness_pct?: number | null } }
export interface BoardPackData {
  label: string; generated_on: string; headcount: number; headline: string;
  month_result: { achievement_pct: number | null; scored_people: number }; previous_month_pct: number | null;
  ytd: { achievement_pct: number | null; actual: number; target: number };
  year_end: { projected_pct: number | null; available: boolean };
  categories: { key: string; label: string; count: number; share_pct: number | null }[];
  regions: { name: string; achievement_pct: number | null; people: number }[];
  top_branches: { name: string | null; achievement_pct: number | null; people: number; small_unit: boolean }[];
  bottom_branches: { name: string | null; achievement_pct: number | null; people: number; small_unit: boolean }[];
  completeness: { expected: number; reported: number; pct: number | null };
  appraisals: { quarter: string; draft?: number; in_review?: number; finalised?: number };
  cascade: { kpi: string; company_target: number; allocated_to_regions: number; gap: number } | null;
}
export const packList = () => adminGet<BoardPackRow[]>(`${PACK}/list`);
export const packPreview = (month?: string) => adminGet<BoardPackData>(`${PACK}/preview${month ? `?month=${month}` : ""}`);
export const packGenerate = (month?: string) => adminPost<BoardPackRow>(`${PACK}/generate`, month ? { month } : {});
export const downloadPack = (id: string, month: string) => downloadPdf(`/pack/download/${id}`, `staff-performance-${month}.pdf`);

// ---- Import version control ---------------------------------------------------------------------------------------
export type ImportVersionRow = {
  import_id: string; series: string; version: number; label: string | null; restored_from: number | null;
  status: "posted" | "unposted"; is_current: boolean; file_name: string; posted_by: string | null; posted_at: string | null;
  unposted_by: string | null; unposted_at: string | null; unposted_reason: string | null; counts: Record<string, number> | null; same_file_as_version: number | null;
};
export type RestorePlan = { target_version: number; target_posted: boolean; unpost: { version: number; label: string | null }[]; repost_as_new_version: boolean; blocked_by_locked_months: string[]; note: string };
export type VersionCompare = {
  from_version: number; to_version: number; same_file: boolean; counts: { added: number; removed: number; changed: number };
  changed: { sheet: string; name: string; month: string; from: number | null; to: number | null }[];
  added: { sheet: string; name: string; month: string; from: number | null; to: number | null }[];
  removed: { sheet: string; name: string; month: string; from: number | null; to: number | null }[];
};
export const listImportVersions = () => adminGet<{ items: ImportVersionRow[] }>(`${IMPORT}/versions`);
export const compareImportVersions = (a: string, b: string) => adminGet<VersionCompare>(`${IMPORT}/versions/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
export const getRestorePlan = (id: string) => adminGet<RestorePlan>(`${IMPORT}/${id}/restore-plan`);
export const unpostImportVersion = (id: string, reason: string, cascade: boolean) =>
  adminPost<{ unposted: { version: number; reverted: number; kept: number }[] }>(`${IMPORT}/${id}/unpost`, { reason, cascade, confirm: true });
export const restoreImportVersion = (id: string, reason: string) =>
  adminPost<{ restored_to: number; new_version: number | null }>(`${IMPORT}/${id}/restore`, { reason, confirm: true });
export const labelImportVersion = (id: string, label: string | null) => adminPut<{ message: string }>(`${IMPORT}/${id}/label`, { label });

// ---- Organisation editor and placement -----------------------------------------------------------------------------
export type LayoutChild = { id: string; name: string; kind: "branch" | "team" | "head_office"; staff: number; manager_profile_id: string | null; manager_name: string | null };
export type LayoutUnit = {
  id: string; name: string; kind: "branch" | "team" | "head_office"; branch_id: string | null; branch_name: string | null; staff: number;
  manager_profile_id: string | null; manager_name: string | null;
  children: LayoutChild[]; // units under this branch (its Debt Collection)
};
export type OrgLayout = {
  debt_units_missing: number; // open branches that have no Debt Collection unit yet
  all_branches: { id: string; name: string; unit_id: string | null; unit_empty: boolean }[];
  regions: { id: string; name: string; manager_profile_id: string | null; manager_name: string | null; units: LayoutUnit[] }[];
  units_without_region: LayoutUnit[];
  branches_without_unit: { id: string; name: string; suggested_unit_id: string | null; suggested_unit_name: string | null; suggested_unit_staff: number }[];
  people_without_unit: number;
  people_without_manager: number;
};
export type PlacementRow = {
  profile_id: string; name: string; role: string | null; current_unit: string | null; current_manager: string | null;
  unit_id: string | null; unit_name: string | null; unit_reason: string | null; manager_id: string | null; manager_name: string | null; manager_reason: string | null;
};
export type PlacementPreview = { proposals: PlacementRow[]; unplaced: { profile_id: string; name: string; role: string | null }[] };
export const getOrgLayout = () => adminGet<OrgLayout>(`${BASE}/org-setup/layout`);
export const getPlacement = () => adminGet<PlacementPreview>(`${BASE}/org-setup/placement`);
export const applyPlacement = (items: { profile_id: string; unit_id?: string | null; manager_id?: string | null }[]) =>
  adminPost<{ units_set: number; managers_set: number }>(`${BASE}/org-setup/placement/apply`, { items, confirm: true });
export const createRegion = (name: string) => adminPost<unknown>(`${BASE}/regions`, { name });
export const renameRegion = (id: string, name: string) => adminPatch<unknown>(`${BASE}/regions/${id}`, { name });
export const setRegionManager = (id: string, manager_profile_id: string | null) => adminPatch<unknown>(`${BASE}/regions/${id}`, { manager_profile_id });
export const retireRegion = (id: string) => adminPatch<unknown>(`${BASE}/regions/${id}`, { is_active: false });
export const createUnit = (b: { name: string; kind: "branch" | "team" | "head_office"; branch_id?: string | null }) => adminPost<unknown>(`${BASE}/units`, b);
export const setUnitManager = (id: string, manager_profile_id: string | null) => adminPatch<unknown>(`${BASE}/units/${id}`, { manager_profile_id });
export const addDebtCollectionUnits = () => adminPost<{ created: number; adopted: number }>(`${BASE}/org-setup/debt-collection-units`, {});

// Units someone works in besides their main one (a debt collector covering several branches).
export type StaffCoverage = { profile_id: string; main_unit_id: string | null; units: { id: string; name: string; kind: string; parent_unit_id: string | null; is_active: boolean }[] };
export const getStaffCoverage = (profileId: string) => adminGet<StaffCoverage>(`${BASE}/staff/${profileId}/coverage`);
export const setStaffCoverage = (profileId: string, unitIds: string[]) => adminPut<StaffCoverage>(`${BASE}/staff/${profileId}/coverage`, { unit_ids: unitIds });

export const moveUnitToRegion = (id: string, region_id: string | null) => adminPut<unknown>(`${BASE}/units/${id}/region`, { region_id });

export type DuplicatePair = { keep_id: string; keep_name: string; keep_staff: number; remove_id: string; remove_name: string; link_branch_id: string | null; link_branch_name: string | null; use_name: string };
export const getUnitDuplicates = () => adminGet<{ pairs: DuplicatePair[] }>(`${BASE}/org-setup/duplicates`);
export const cleanUpDuplicates = (items: { keep_id: string; remove_id: string; link: boolean; use_name: boolean }[]) =>
  adminPost<{ removed: number; linked: number; renamed: number }>(`${BASE}/org-setup/duplicates/clean-up`, { items, confirm: true });
export const linkUnitToBranch = (id: string, branch_id: string | null, use_branch_name: boolean) =>
  adminPost<{ removed_duplicate: string | null; name: string }>(`${BASE}/org-setup/units/${id}/link-branch`, { branch_id, use_branch_name, confirm: true });
export const removeEmptyUnit = (id: string) => adminDelete<{ message: string }>(`${BASE}/org-setup/units/${id}`);
export const closeUnit = (id: string, move_people_to: string | null) => adminPost<{ people_moved: number }>(`${BASE}/org-setup/units/${id}/close`, { move_people_to, confirm: true });
