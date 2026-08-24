import { useEffect, useState } from "react";
import { apiGet } from "./api";
import { FALLBACK_BRANCHES } from "../data/fallbackBranches";

export type Branch = {
  id: string;
  name: string;
  address: string;
  hours: string;
  phone: string;
  lat: number;
  lng: number;
  display_order: number;
  is_active: boolean;
};

/**
 * Fetches every active branch once, sorted by display_order. This is the
 * live, admin-editable replacement for what used to be a hardcoded
 * `branches` array in src/data/content.ts — an admin can now add, edit,
 * or remove a branch from the dashboard (Branches page) and it shows up
 * on the site immediately, no redeploy needed.
 *
 * If the backend can't be reached, this falls back to the static data in
 * src/data/fallbackBranches.ts (the original hardcoded branch list)
 * instead of leaving the Branch Locator / homepage preview empty.
 * `isFallback` lets callers show a subtle "showing default locations"
 * notice rather than a hard error — same pattern as useLoanTiers.
 */
export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ items: Branch[] }>("/api/branches")
      .then((data) => {
        if (cancelled) return;
        setBranches([...data.items].sort((a, b) => a.display_order - b.display_order));
        setIsFallback(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBranches(FALLBACK_BRANCHES);
        setIsFallback(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { branches, loading, isFallback };
}
