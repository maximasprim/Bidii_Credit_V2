import { NavLink } from "react-router-dom";
import {
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  Layers,
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
import { usePerformanceCapabilities } from "../../../lib/usePerformanceCapabilities";

/** `needs`: the tab shows when the person has at least one of these permissions (none listed = everyone). */
type Tab = { to: string; label: string; icon: LucideIcon; end?: boolean; needs?: string[] };

/** The same destinations, in the same order, as the old row of links (Staff first so there is always a way back). */
const TABS: Tab[] = [
  { to: "/admin/performance", label: "Staff", icon: Users, end: true },
  { to: "/admin/performance/org", label: "Organisation chart", icon: Building2 },
  { to: "/admin/performance/targets", label: "Targets", icon: Target },
  { to: "/admin/performance/levels", label: "Levels", icon: Layers, needs: ["levels.edit"] },
  { to: "/admin/performance/entries", label: "Monthly figures", icon: CalendarClock },
  { to: "/admin/performance/reports", label: "Reports", icon: FileText },
  { to: "/admin/performance/operations", label: "Operations", icon: Settings2 },
  { to: "/admin/performance/feedback", label: "360 feedback", icon: MessageCircle },
  { to: "/admin/performance/cascade", label: "Goal cascading", icon: ListChecks },
  { to: "/admin/performance/pack", label: "Board pack", icon: Briefcase },
  { to: "/admin/performance/suggestions", label: "Suggestions", icon: Sparkles },
  { to: "/admin/performance/appraisals", label: "Appraisals", icon: ClipboardCheck },
  { to: "/admin/performance/governance", label: "Governance", icon: ShieldCheck, needs: ["locks.manage", "governance.notice", "retention.view", "notifications.status"] },
  { to: "/admin/performance/import", label: "Import from Excel", icon: Upload, needs: ["imports.manage"] },
];

export default function PerformanceTabs() {
  const { can } = usePerformanceCapabilities();
  // Levels, Governance and Import show for people who hold at least one of the permissions they need (set on Roles & Permissions).

  return (
    <nav
      aria-label="Staff Performance"
      className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-mist-200 bg-surface p-1.5 md:flex-wrap md:overflow-visible"
    >
      {TABS.filter((t) => !t.needs || t.needs.some(can)).map((t) => {
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
