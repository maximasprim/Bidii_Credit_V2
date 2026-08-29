import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  adminLogin,
  clearAdminToken,
  getAdminToken,
  getCurrentAdminRole,
  onAdminSessionExpired,
  setAdminToken,
} from "./adminApi";
import { getMyPermissions } from "./rolePermissionsApi";

type AdminAuthContextValue = {
  isAuthenticated: boolean;
  /** "admin" | "loan_officer" | "hr" | "marketing_manager" | null (null when logged out) */
  role: string | null;
    /**
   * This admin's currently-allowed dashboard menu paths, fetched from
   * GET /api/admin/role-permissions/mine - the live, admin-configured
   * answer. null until that fetch resolves (or if it fails); AdminLayout
   * falls back to a static default for that window, see roleAccess.ts.
   */
  allowedMenus: string[] | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
    /** Re-fetches allowedMenus - call after saving changes on the Roles &
   *  Permissions page so an affected admin's own sidebar (if they're not
   *  "admin") updates without needing to log out and back in. */
  refreshPermissions: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAdminToken()));
  const [role, setRole] = useState(() => getCurrentAdminRole());
  const [allowedMenus, setAllowedMenus] = useState<string[] | null>(null);

  function fetchPermissions() {
    getMyPermissions()
      .then((res) => setAllowedMenus(res.allowed_menus))
      .catch(() => setAllowedMenus(null)); // AdminLayout falls back to the static default on a fetch failure
  }

    useEffect(() => {
    if (isAuthenticated) fetchPermissions();
    // Only on mount (session restore from a stored token) - login() and
    // refreshPermissions() below trigger their own fetches explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onAdminSessionExpired(() => {
      setIsAuthenticated(false);
      setRole(null);
      setAllowedMenus(null);
    });
  }, []);

  async function login(username: string, password: string) {
    const { access_token } = await adminLogin(username, password);
    setAdminToken(access_token);
    setIsAuthenticated(true);
    setRole(getCurrentAdminRole());
    fetchPermissions();
  }

  function logout() {
    clearAdminToken();
    setIsAuthenticated(false);
    setRole(null);
    setAllowedMenus(null);
  }

  return (
    <AdminAuthContext.Provider 
      value={{ isAuthenticated, role, login, logout, allowedMenus, refreshPermissions: fetchPermissions }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return ctx;
}


// import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
// import {
//   adminLogin,
//   clearAdminToken,
//   getAdminToken,
//   onAdminSessionExpired,
//   setAdminToken,
// } from "./adminApi";

// type AdminAuthContextValue = {
//   isAuthenticated: boolean;
//   login: (username: string, password: string) => Promise<void>;
//   logout: () => void;
// };

// const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

// export function AdminAuthProvider({ children }: { children: ReactNode }) {
//   const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAdminToken()));

//   useEffect(() => {
//     return onAdminSessionExpired(() => setIsAuthenticated(false));
//   }, []);

//   async function login(username: string, password: string) {
//     const { access_token } = await adminLogin(username, password);
//     setAdminToken(access_token);
//     setIsAuthenticated(true);
//   }

//   function logout() {
//     clearAdminToken();
//     setIsAuthenticated(false);
//   }

//   return (
//     <AdminAuthContext.Provider value={{ isAuthenticated, login, logout }}>
//       {children}
//     </AdminAuthContext.Provider>
//   );
// }

// export function useAdminAuth() {
//   const ctx = useContext(AdminAuthContext);
//   if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
//   return ctx;
// }
