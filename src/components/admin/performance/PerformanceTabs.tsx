import { NavLink } from "react-router-dom";
import {
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  ListChecks,
  MessageCircle,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAdminAuth } from "../../../lib/AdminAuthContext";

type Tab = { to: string; label: string; icon: LucideIcon; end?: boolean; adminOnly?: boolean };

/** The same destinations, in the same order, as the old row of links (Staff first so there is always a way back). */
const TABS: Tab[] = [
  { to: "/admin/performance", label: "Staff", icon: Users, end: true },
  { to: "/admin/performance/org", label: "Organisation chart", icon: Building2 },
  { to: "/admin/performance/targets", label: "Targets", icon: Target },
  { to: "/admin/performance/entries", label: "Monthly figures", icon: CalendarClock },
  { to: "/admin/performance/reports", label: "Reports", icon: FileText },
  { to: "/admin/performance/operations", label: "Operations", icon: Settings2 },
  { to: "/admin/performance/feedback", label: "360 feedback", icon: MessageCircle },
  { to: "/admin/performance/cascade", label: "Goal cascading", icon: ListChecks },
  { to: "/admin/performance/pack", label: "Board pack", icon: Briefcase },
  { to: "/admin/performance/suggestions", label: "Suggestions", icon: Sparkles },
  { to: "/admin/performance/appraisals", label: "Appraisals", icon: ClipboardCheck },
  { to: "/admin/performance/governance", label: "Governance", icon: ShieldCheck, adminOnly: true },
  { to: "/admin/performance/import", label: "Import from Excel", icon: Upload, adminOnly: true },
];

export default function PerformanceTabs() {
  const { role } = useAdminAuth();
  // Governance and Import are for administrators and HR only, as before.
  const canEdit = role === "admin" || role === "hr";

  return (
    <nav
      aria-label="Staff Performance"
      className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-mist-200 bg-surface p-1.5 md:flex-wrap md:overflow-visible"
    >
      {TABS.filter((t) => !t.adminOnly || canEdit).map((t) => {
        const Icon = t.icon;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] transition-colors hover:bg-mist-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ember-500)]"
            style={({ isActive }) => ({
              backgroundColor: isActive ? "var(--color-ember-100)" : undefined,
              color: isActive ? "var(--color-ink-900)" : "var(--color-ink-500)",
              fontWeight: isActive ? 600 : 500,
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} aria-hidden="true" style={{ color: isActive ? "var(--color-ember-600)" : undefined }} />
                {t.label}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
