/*
  When a login is created, the server links it to an existing staff profile only if exactly one UNLINKED profile has the same
  full name (ignoring capitals); otherwise it makes a new profile. This mirrors that rule so the form can say which will happen.
*/

export type NameCandidate = { full_name: string; admin_user_id: string | null; username?: string | null; performance_role_name?: string | null };
export type NameHint = { tone: "ok" | "warn"; text: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** `complete` is false when the list we have is only part of everyone (so "no match" can't be claimed). */
export function nameHint(typed: string, people: NameCandidate[], complete: boolean): NameHint | null {
  const name = typed.trim();
  if (name.length < 2) return null;
  const free = people.filter((p) => !p.admin_user_id && same(p.full_name, name));
  if (free.length === 1) {
    const role = free[0].performance_role_name;
    return { tone: "ok", text: `Will be linked to the existing staff profile for ${free[0].full_name}${role ? ` (${role})` : ""}.` };
  }
  if (free.length > 1) {
    return { tone: "warn", text: `More than one unlinked staff profile is called ${name}, so a new one would be created. Tidy the duplicate in Staff Performance first.` };
  }
  const taken = people.find((p) => p.admin_user_id && same(p.full_name, name));
  if (taken) {
    return { tone: "warn", text: `${taken.full_name} already has a login${taken.username ? ` (${taken.username})` : ""}. Creating another would add a second staff profile. Check this isn't the same person.` };
  }
  if (!complete) return null;
  return { tone: "warn", text: "No existing staff profile has this name, so a new one will be created. If this person is already in Staff Performance, pick their name from the list." };
}

/** Names of active staff profiles that have no login yet, for the suggestion list. */
export const unlinkedNames = (people: NameCandidate[]): string[] =>
  [...new Set(people.filter((p) => !p.admin_user_id).map((p) => p.full_name.trim()))].sort((a, b) => a.localeCompare(b));