import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { usePageMeta } from "../../lib/usePageMeta";

export default function AdminLogin() {
  usePageMeta("Admin Login");
  const { isAuthenticated, login } = useAdminAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      navigate("/admin", { replace: true });
    } catch {
      setError("Invalid username or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-surface p-8 shadow-2xl">
        <h1 className="font-display text-xl font-extrabold" style={{ color: "var(--color-ink-900)" }}>
          Bidii<span style={{ color: "var(--color-ember-500)" }}>Credit</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">Sign in to view submissions and site activity.</p>

        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-ink-500">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-ink-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
