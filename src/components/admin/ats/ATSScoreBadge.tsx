import type { ATSRecommendation } from "../../../lib/atsApi";
import { ATS_RECOMMENDATION_LABELS } from "../../../lib/atsApi";

const SCHEME: Record<ATSRecommendation, { bg: string; text: string }> = {
  recommended: { bg: "#DCFCE7", text: "#16A34A" },
  review: { bg: "#DBEAFE", text: "#2563EB" },
  not_recommended: { bg: "#FEE2E2", text: "#DC2626" },
};

export default function ATSRecommendationBadge({
  recommendation,
  overridden = false,
}: {
  recommendation: ATSRecommendation;
  overridden?: boolean;
}) {
  const scheme = SCHEME[recommendation];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: scheme.bg, color: scheme.text }}
      title={overridden ? "Manually overridden by a recruiter" : "System-generated recommendation"}
    >
      {ATS_RECOMMENDATION_LABELS[recommendation]}
      {overridden && <span aria-hidden>·override</span>}
    </span>
  );
}

export function ATSScorePill({ percentage }: { percentage: number }) {
  const color = percentage >= 70 ? "#16A34A" : percentage >= 40 ? "#D97706" : "#DC2626";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
      <span
        className="inline-block h-1.5 w-10 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--color-mist-200)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: color }}
        />
      </span>
      {percentage.toFixed(0)}%
    </span>
  );
}
