import { adminGet, adminPost } from "./adminApi";

const INSIGHTS = `/api/admin/performance/insights`;

export interface OutlookPoint {
  month: string; // YYYY-MM
  actual: number | null;
  state: string;
  projected: number | null;
  low: number | null;
  high: number | null;
  plan: number | null;
  saved_plan: number | null;
}
export interface OutlookGoalOption {
  key: string;
  label: string;
  pct: number;
}
export type PlanState = "awaiting" | "on_track" | "behind" | "reached" | "ended_not_reached";
export interface PlanEvaluation {
  state: PlanState;
  goal_pct: number;
  rows: { month: string; planned: number; actual: number | null; gap: number | null }[];
  latest: { month: string; actual: number; planned: number; gap: number } | null;
}
export interface SavedPlan {
  id: string;
  profile_id: string;
  recommendation_id: string | null;
  status: "active" | "closed" | "superseded";
  goal_pct: number;
  goal_label: string | null;
  start_month: string;
  start_pct: number;
  plan_months: number;
  path: { month: string; pct: number }[];
  created_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  result: (Partial<PlanEvaluation> & { closed_on?: string }) | null;
  evaluation?: PlanEvaluation;
  // only for people who can manage the plan
  note?: string | null;
  created_by?: string;
  closed_by?: string | null;
  close_note?: string | null;
}
export interface Outlook {
  available: boolean;
  reason?: string;
  name?: string;
  headline?: string;
  last_scored_month?: string;
  months_scored?: number;
  horizon_months?: number;
  plan_months?: number;
  goal_options: OutlookGoalOption[];
  points: OutlookPoint[];
  projection: { available: boolean; reason?: string; method?: string; range_pct_points?: number; data_window_months?: number };
  plan: { available: boolean; reason?: string; note?: string; goal_pct?: number; goal_label?: string; months?: number; from_pct?: number; step_pct_points?: number };
  can_manage_plan: boolean;
  tracked_plan: SavedPlan | null;
  plans_unavailable?: boolean;
}

export const getPersonOutlook = (profileId: string, opts: { goalPct?: number | null; months?: number } = {}) => {
  const q = new URLSearchParams();
  if (opts.goalPct != null) q.set("goal_pct", String(opts.goalPct));
  if (opts.months != null) q.set("months", String(opts.months));
  const qs = q.toString();
  return adminGet<Outlook>(`${INSIGHTS}/outlook/person/${encodeURIComponent(profileId)}${qs ? `?${qs}` : ""}`);
};

/** The server works the path out itself from the goal and length; nothing numeric about the path is sent. */
export const savePlan = (body: { profile_id: string; goal_pct?: number | null; months: number; recommendation_id?: string | null; note?: string | null }) =>
  adminPost<{ created: boolean; plan: SavedPlan }>(`${INSIGHTS}/plans`, body);

export const closePlan = (planId: string, note?: string | null) => adminPost<{ plan: SavedPlan }>(`${INSIGHTS}/plans/${encodeURIComponent(planId)}/close`, { note: note || null });
