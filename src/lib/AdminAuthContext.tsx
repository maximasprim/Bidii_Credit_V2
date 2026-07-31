import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  adminLogin,
  clearAdminToken,
  getAdminToken,
  onAdminSessionExpired,
  setAdminToken,
} from "./adminApi";

type AdminAuthContextValue = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAdminToken()));

  useEffect(() => {
    return onAdminSessionExpired(() => setIsAuthenticated(false));
  }, []);

  async function login(username: string, password: string) {
    const { access_token } = await adminLogin(username, password);
    setAdminToken(access_token);
    setIsAuthenticated(true);
  }

  function logout() {
    clearAdminToken();
    setIsAuthenticated(false);
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return ctx;
}
