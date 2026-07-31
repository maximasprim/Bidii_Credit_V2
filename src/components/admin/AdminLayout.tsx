import { Navigate, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Mail, Landmark, Briefcase, Users, LogOut, Sun, Moon, Newspaper, BadgeDollarSign } from "lucide-react";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { useTheme } from "../../lib/useTheme";
import { cn } from "../../lib/utils";

const tabs = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/contacts", label: "Contact Messages", icon: Mail },
  { to: "/admin/loan-applications", label: "Loan Applications", icon: Landmark },
  { to: "/admin/career-applications", label: "Career Applications", icon: Briefcase },
  { to: "/admin/news", label: "News", icon: Newspaper },
  { to: "/admin/jobs", label: "Jobs", icon: Briefcase },
  { to: "/admin/loan-terms", label: "Loan Terms", icon: BadgeDollarSign },
  { to: "/admin/users", label: "Admin Users", icon: Users },
];

export default function AdminLayout() {
  const { isAuthenticated, logout } = useAdminAuth();
  const { theme, toggleTheme } = useTheme();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-mist-50)" }}>
      <header
        className="flex items-center justify-between px-5 py-4 lg:px-8"
        style={{ backgroundColor: "var(--color-navy-950)" }}
      >
        <span className="font-display text-lg font-extrabold text-white">
          Bidii<span style={{ color: "var(--color-ember-500)" }}>Credit</span>{" "}
          <span className="font-medium text-white/50">Admin</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto border-b border-mist-200 px-5 lg:px-8"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                isActive ? "border-ember-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"
              )
            }
            style={({ isActive }) =>
              isActive ? { borderColor: "var(--color-ember-500)", color: "var(--color-ink-900)" } : undefined
            }
          >
            <tab.icon size={15} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
