import { getAdminToken, getCurrentAdminId } from "./adminApi";

/**
 * A small in-memory "show what you had, then refresh" cache for the report pages.
 *
 * Going back to a report you already opened (another tab, another branch, the same period again) shows it at once while the
 * fresh copy loads, instead of a blank page. The fresh copy always replaces it. It is kept in memory only (gone on reload), is
 * keyed by who is signed in so one person's data is never shown to another, and holds at most MAX_ENTRIES recent reports.
 */
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 40;

type Entry = { data: unknown; at: number };
const store = new Map<string, Entry>();

export function reportKey(load: () => unknown, deps: unknown[]): string {
  const who = `${getCurrentAdminId() ?? ""}:${(getAdminToken() ?? "").slice(-16)}`;
  return `${who}|${load.toString()}|${JSON.stringify(deps)}`;
}

export function readReport<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > MAX_AGE_MS) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function writeReport(key: string, data: unknown): void {
  store.delete(key); // re-insert so the oldest entry is always first
  store.set(key, { data, at: Date.now() });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}
