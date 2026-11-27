import { useEffect, useState } from "react";
import { getCurrentAdminId, getCurrentAdminRole } from "./adminApi";
import { getMyCapabilities } from "./performancePermissionsApi";

/**
 * "May this person do X in Staff Performance?" - answered from the permissions set on the Roles & Permissions screen.
 *
 * It only decides which buttons and pages to SHOW. The server checks every action again, so a hidden button is a courtesy and never the
 * protection. Administrators can always do everything and never wait for the lookup. For everyone else `ready` turns true once the
 * lookup has answered (or failed, in which case nothing extra is shown), so a page can avoid flashing a "not allowed" message.
 * The answer is kept in memory for 30 seconds per signed-in person and refreshed in the background when a page opens.
 */
const MAX_AGE_MS = 30_000;

type Snapshot = { who: string; caps: Set<string>; at: number };
let snapshot: Snapshot | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const whoAmI = () => `${getCurrentAdminId() ?? ""}:${getCurrentAdminRole() ?? ""}`;

export function refreshCapabilities(): Promise<void> {
  if (inflight) return inflight;
  const who = whoAmI();
  inflight = getMyCapabilities()
    .then((r) => {
      snapshot = { who, caps: new Set(r.capabilities), at: Date.now() };
    })
    .catch(() => {
      // Keep what we knew for this person; with nothing known they simply get no extra buttons (the server decides regardless).
      snapshot = { who, caps: snapshot && snapshot.who === who ? snapshot.caps : new Set(), at: Date.now() };
    })
    .finally(() => {
      inflight = null;
      listeners.forEach((l) => l());
    });
  return inflight;
}

export function usePerformanceCapabilities(): { can: (key: string) => boolean; ready: boolean } {
  const [, bump] = useState(0);
  const role = getCurrentAdminRole();
  const who = whoAmI();

  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    if (role !== "admin" && (!snapshot || snapshot.who !== who || Date.now() - snapshot.at > MAX_AGE_MS)) void refreshCapabilities();
    return () => {
      listeners.delete(l);
    };
  }, [role, who]);

  const mine = snapshot && snapshot.who === who ? snapshot : null;
  return {
    can: (key: string) => role === "admin" || (mine !== null && mine.caps.has(key)),
    ready: role === "admin" || mine !== null,
  };
}
