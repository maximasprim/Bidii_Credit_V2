import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Home, Eye, EyeOff } from "lucide-react";
import { useAdminAuth } from "../../lib/AdminAuthContext";
import { usePageMeta } from "../../lib/usePageMeta";
import { getCurrentAdminRole } from "../../lib/adminApi";
import { resolveAllowedMenus, getLandingPath } from "../../lib/roleAccess";
import loginBg from "../../../public/Bidii_Credit_Logo.png";

/**
 * Only ever redirect back to a path on this site (never an external URL).
 * With no explicit ?next=, lands on this role's own first allowed page
 * rather than a hardcoded "/admin" - Overview ("/admin") is itself a
 * configurable, sometimes-hidden menu entry now (see MENU_REGISTRY), so a
 * role without it would otherwise land somewhere it immediately gets
 * bounced away from by AdminLayout's own access guard.
 */
function safeRedirectTarget(next: string | null, role: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return getLandingPath(resolveAllowedMenus(role, null));
}

export default function AdminLogin() {
  usePageMeta("Admin Login");
  const { isAuthenticated, role, login } = useAdminAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("next"), role);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      // Recomputed post-login (rather than reusing the `redirectTo` closed
      // over above) since that one was necessarily computed before we knew
      // this account's actual role.
      const next = safeRedirectTarget(searchParams.get("next"), getCurrentAdminRole());
      navigate(next, { replace: true });
    } catch {
      setError("Invalid username or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <img
        src={loginBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xs"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
          opacity: 0.85,
        }}
      />

      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-8 shadow-2xl">
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
          {/* <div>
            <label className="mb-1.5 block text-sm text-ink-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
          </div> */}
          <div>
            <label className="mb-1.5 block text-sm text-ink-500">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 pr-10 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-500 hover:text-ink-700"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
          <div className="flex items-center justify-center ">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 transition-colors hover:text-orange-400 hover:underline"
            >
              <Home size={14} />
              Back to site
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// import { useState } from "react";
// import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
// import { AlertCircle, Home, Eye, EyeOff } from "lucide-react";
// import { useAdminAuth } from "../../lib/AdminAuthContext";
// import { usePageMeta } from "../../lib/usePageMeta";
// import loginBg from "../../../public/Bidii_Credit_Logo.png";

// /** Only ever redirect back to a path on this site (never an external URL). */
// function safeRedirectTarget(next: string | null): string {
//   if (next && next.startsWith("/") && !next.startsWith("//")) return next;
//   return "/admin";
// }

// export default function AdminLogin() {
//   usePageMeta("Admin Login");
//   const { isAuthenticated, login } = useAdminAuth();
//   const navigate = useNavigate();
//   const [searchParams] = useSearchParams();
//   const redirectTo = safeRedirectTarget(searchParams.get("next"));

//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   if (isAuthenticated) {
//     return <Navigate to={redirectTo} replace />;
//   }

//   async function onSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     setError(null);
//     setIsSubmitting(true);
//     try {
//       await login(username, password);
//       navigate(redirectTo, { replace: true });
//     } catch {
//       setError("Invalid username or password.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   return (
//     <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
//       <img
//         src={loginBg}
//         alt=""
//         aria-hidden="true"
//         className="absolute inset-0 h-full w-full scale-110 object-cover blur-xs"
//       />
//       <div
//         className="absolute inset-0"
//         style={{
//           background:
//             "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
//           opacity: 0.85,
//         }}
//       />

//       <div className="relative w-full max-w-sm rounded-3xl bg-surface p-8 shadow-2xl">
//         <h1 className="font-display text-xl font-extrabold" style={{ color: "var(--color-ink-900)" }}>
//           Bidii<span style={{ color: "var(--color-ember-500)" }}>Credit</span>
//         </h1>
//         <p className="mt-1 text-sm text-ink-500">Sign in to view submissions and site activity.</p>

//         {error && (
//           <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
//             <AlertCircle size={16} className="mt-0.5 shrink-0" />
//             {error}
//           </div>
//         )}

//         <form onSubmit={onSubmit} className="mt-6 space-y-4">
//           <div>
//             <label className="mb-1.5 block text-sm text-ink-500">Username</label>
//             <input
//               value={username}
//               onChange={(e) => setUsername(e.target.value)}
//               autoComplete="username"
//               required
//               className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//             />
//           </div>
//           {/* <div>
//             <label className="mb-1.5 block text-sm text-ink-500">Password</label>
//             <input
//               type="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               autoComplete="current-password"
//               required
//               className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//             />
//           </div> */}
//           <div>
//             <label className="mb-1.5 block text-sm text-ink-500">Password</label>
//             <div className="relative">
//               <input
//                 type={showPassword ? "text" : "password"}
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 autoComplete="current-password"
//                 required
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 pr-10 text-sm focus:outline-none"
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowPassword((v) => !v)}
//                 tabIndex={-1}
//                 aria-label={showPassword ? "Hide password" : "Show password"}
//                 className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-500 hover:text-ink-700"
//               >
//                 {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
//               </button>
//             </div>
//           </div>
//           <button
//             type="submit"
//             disabled={isSubmitting}
//             className="w-full rounded-full py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
//             style={{ backgroundColor: "var(--color-ember-500)" }}
//           >
//             {isSubmitting ? "Signing in…" : "Sign In"}
//           </button>
//           <div className="flex items-center justify-center ">
//             <Link
//               to="/"
//               className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-500 transition-colors hover:text-orange-400 hover:underline"
//             >
//               <Home size={14} />
//               Back to site
//             </Link>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

