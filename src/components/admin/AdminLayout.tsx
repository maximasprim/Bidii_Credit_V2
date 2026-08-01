import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Mail,
  Landmark,
  Briefcase,
  Users,
  LogOut,
  Sun,
  Moon,
  Newspaper,
  BadgeDollarSign,
  Menu,
  X,
} from "lucide-react";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { useTheme } from "../../lib/useTheme";
import { cn } from "../../lib/utils";
import logo from "../../../public/Bidii_Credit_Logo.png";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ backgroundColor: "var(--color-mist-50)" }}>
      <header
        className="flex shrink-0 items-center justify-between px-5 py-4 lg:px-8"
        style={{ backgroundColor: "var(--color-navy-950)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 lg:hidden"
          >
            <Menu size={19} />
          </button>
          <span className="flex flex-row justify-between gap-2 place-items-center font-display text-lg font-extrabold text-white">
                      <div className="inline-block rounded-full  dark:bg-white">
            <img
              src={logo}
              alt="Bidii Credit"
              className="h-14 w-auto object-contain"
            />
          </div>
            {/* Bidii<span style={{ color: "var(--color-ember-500)" }}>Credit</span>{" "} */}
            <span className="font-medium text-ember-500">Admin</span>
          </span>
        </div>
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

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r border-mist-200 px-3 py-4 transition-transform duration-200 lg:static lg:h-full lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ backgroundColor: "var(--color-surface)" }}
        >
          <div className="mb-3 flex items-center justify-between px-2 lg:hidden">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 hover:bg-mist-100"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-xl border-l-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                    isActive ? "border-ember-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-700"
                  )
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        borderColor: "var(--color-ember-500)",
                        color: "var(--color-ink-900)",
                        backgroundColor: "var(--color-mist-50)",
                      }
                    : undefined
                }
              >
                <tab.icon size={16} className="shrink-0" />
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}